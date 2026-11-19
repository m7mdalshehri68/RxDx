/* ══════════════════════════════════════════════════════════════════════
   RxDx AI gateway — Cloudflare Worker

   The only place the Anthropic key lives. RxDx (the browser tool and the
   coding API) sends a de-identified note here; Claude reads it and returns
   the conditions it found, each with the words it was read from and a
   suggested ICD-10-AM code. Nothing returned here is final: RxDx checks every
   code against its own ICD-10-AM table, checks that the quoted words are in
   the note, and runs its own negation layer before anything is shown.

   Routes
     GET  /health   is the gateway up and is a key configured
     POST /code     {"note": "...", "sex": "male|female", "age": 45, "encounter": "outpatient|inpatient|emergency"}

   Secrets (Cloudflare → Worker → Settings → Variables and Secrets)
     ANTHROPIC_API_KEY   required
     SERVER_KEY          optional; the RxDx coding API sends it in x-rxdx-server-key

   Variables (optional, defaults in DEFAULTS below)
     ALLOW_ORIGINS  MODEL  EFFORT  MAX_CHARS  MAX_TOKENS  RATE_PER_MIN

   One file and one export, so it can be pasted into the Cloudflare editor as is.
   ══════════════════════════════════════════════════════════════════════ */

const DEFAULTS = {
  ALLOW_ORIGINS: 'https://m7mdalshehri68.github.io,https://rxdx-5pn.pages.dev,null',
  MODEL: 'claude-haiku-5-5',
  EFFORT: 'low',
  MAX_CHARS: 8000,
  MAX_TOKENS: 4000,
  RATE_PER_MIN: 20,
  ANTHROPIC_VERSION: '2026-10-21',
  TIMEOUT_MS: 25000
};

/* ---------- de-identification ----------
   The browser already removes identifiers before sending. This second pass is
   the same list, run again here, so a copy of RxDx with an older script, or a
   hospital system calling the API, cannot send a name through by mistake.
   Keep this list identical to aicDeid() in index.html (tests check both). */
const DEID = [
  [/\b(patient'?s? name|pt'?s? name|full name|name of patient|mother'?s name|father'?s name)\s*[:\-–]\s*[^\n,;.]{1,60}/gi, '$1: [NAME]'],
  [/(^|\n)\s*name\s*[:\-–]\s*[^\n,;.]{1,60}/gi, '$1Name: [NAME]'],
  [/\b(mrn|mr no\.?|medical record(?: number| no\.?)?|file (?:no\.?|number)|hospital (?:no\.?|number)|patient id|national id|id no\.?|iqama(?: no\.?)?|passport(?: no\.?)?)\s*[:#\-–]?\s*[A-Za-z0-9\-\/]{3,20}/gi, '$1 [ID]'],
  [/\b(address)\s*[:\-–]\s*[^\n;.]{1,80}/gi, '$1: [ADDRESS]'],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[EMAIL]'],
  [/(?:\+?966[\s-]?|\b0)5\d(?:[\s-]?\d){7}\b/g, '[PHONE]'],
  [/\b[12]\d{9}\b/g, '[ID]'],
  [/\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/g, '[DATE]'],
  [/\b\d{4}-\d{2}-\d{2}\b/g, '[DATE]'],
  [/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s+\d{2,4}\b/gi, '[DATE]'],
  [/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/gi, '[DATE]'],
  [/\b(?:Mr|Mrs|Ms|Miss|Mstr|Master|Dr|Sheikh|Shaikh)\.?\s+[A-Z][A-Za-z'\-]+(?:\s+(?:Al[- ])?[A-Z][A-Za-z'\-]+){0,3}/g, '[NAME]'],
  [/[؀-ۿ][؀-ۿ\s]*/g, '[AR] '],
  [/\b\d{7,}\b/g, '[NUMBER]']
];
function deid(text) {
  let out = String(text == null ? '' : text), removed = 0;
  for (const [re, rep] of DEID) {
    out = out.replace(re, function () { removed++; return rep.replace(/\$1/g, arguments[1] == null ? '' : arguments[1]); });
  }
  return { text: out, removed };
}

/* ---------- what Claude is asked ---------- */
const SYSTEM = `You are a clinical coder for Saudi private health insurance claims. Saudi claims use ICD-10-AM (Australian Modification), 10th edition, with the Australian Coding Standards. They do not use ICD-10-CM.

Read the de-identified clinical note and list every condition it documents, one item per condition.

For each item:
- text: the exact words from the note that state the condition, copied character for character, at most 12 words.
- condition: the condition in ICD-10-AM index wording, as specific as the note allows.
- status: active = the patient has it in this encounter; history = past and resolved; negated = denied, absent, excluded, ruled out or negative; uncertain = suspected, possible, probable, query, "?", "rule out" or listed under a differential diagnosis, not confirmed; family = a relative's condition.
- role: principal = the main reason for this encounter (exactly one active item); secondary = any other condition; external_cause, place, activity = the companion codes an injury needs.
- code: the ICD-10-AM code: a letter, two digits, then optionally a dot and one or two characters (E11.22, S52.50, I10). Never an ICD-10-CM code, never a seventh character, never an X placeholder. Leave it empty when you are not sure.
- title: the ICD-10-AM title of that code.

Coding rules:
1. Code to the highest specificity the note supports and no further. A lower respiratory tract infection without pneumonia is J22, not a pneumonia code.
2. Diabetes: use the E10 to E14 combination code for each complication, one code per complication (E11.22 established nephropathy, E11.31 background retinopathy, E11.42 polyneuropathy, E11.64 hypoglycaemia, E11.65 poor control, E11.73 foot ulcer due to multiple causes). When the type is stated, every diabetes code uses that type. Add a separate code for the complication only when the combination code does not describe it fully, such as the stage of chronic kidney disease.
3. Pregnancy, childbirth and the puerperium: a condition in a pregnant patient takes a chapter 15 (O) code, with an additional code for the condition when the O code does not name it (anaemia in pregnancy is O99.01). Do not use Z33 when any O code applies.
4. Injuries: code each injury (S or T codes), then its external cause (V01 to Y98), the place of occurrence (Y92) and the activity (U50 to U73). Use the unspecified place or activity code when the note does not say.
5. Neoplasms: code the primary site and every secondary site (C77 to C79). Morphology codes are added by the coder later; do not output them.
6. Chronic obstructive pulmonary disease: J44.1 for an acute exacerbation; J44.0 when there is an acute lower respiratory infection, plus the infection code.
7. Do not code a sign or symptom that a coded diagnosis explains. Code a symptom only when no diagnosis explains it.
8. Read abbreviations in context (HTN, DM, IHD, CKD, COPD, UTI, AKI, AF, CHF, CAP, GERD, BPH and the like).
9. Chronic conditions the note lists as present (known case of, background, past history of a condition that continues) are active secondary conditions.

Also list conditions the note denies, excludes, suspects or attributes to a relative, so the reader can see they were set aside. Skip routine normal findings. Give those items a code only when you are sure of it.`;

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          condition: { type: 'string' },
          status: { type: 'string', enum: ['active', 'history', 'negated', 'uncertain', 'family'] },
          role: { type: 'string', enum: ['principal', 'secondary', 'external_cause', 'place', 'activity'] },
          code: { type: 'string', pattern: '^([A-Z][0-9]{2}(\\.[0-9A-Z]{1,2})?)?$' },
          title: { type: 'string' }
        },
        required: ['text', 'condition', 'status', 'role', 'code', 'title'],
        additionalProperties: false
      }
    }
  },
  required: ['items'],
  additionalProperties: false
};

function userMessage(note, sex, age, encounter) {
  const head = [];
  if (encounter) head.push('Encounter: ' + encounter);
  const who = [sex, age ? age + ' years' : ''].filter(Boolean).join(', ');
  if (who) head.push('Patient: ' + who);
  return (head.length ? head.join('\n') + '\n' : '') + 'Note:\n<<<\n' + note + '\n>>>';
}

/* ---------- plumbing ---------- */
function cfg(env, k) {
  const v = env && env[k] != null && env[k] !== '' ? env[k] : DEFAULTS[k];
  return typeof DEFAULTS[k] === 'number' ? Number(v) : String(v);
}

function corsFor(request, env) {
  const origin = request.headers.get('Origin');
  const list = cfg(env, 'ALLOW_ORIGINS').split(',').map(s => s.trim()).filter(Boolean);
  const allowed = origin !== null && (list.indexOf('*') >= 0 || list.indexOf(origin) >= 0);
  const h = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-rxdx-server-key',
    'Access-Control-Max-Age': '86400'
  };
  if (allowed) h['Access-Control-Allow-Origin'] = origin;
  return { allowed, headers: h };
}

function json(status, body, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers || {})
  });
}

/* When no rate-limit binding is configured, a per-instance window still stops
   one browser from emptying the account in a loop. The binding is better: it
   is shared across instances in a location. */
const WINDOW = new Map();
function localLimit(key, perMin) {
  const now = Date.now(), from = now - 60000;
  const hits = (WINDOW.get(key) || []).filter(t => t > from);
  if (hits.length >= perMin) { WINDOW.set(key, hits); return false; }
  hits.push(now); WINDOW.set(key, hits);
  if (WINDOW.size > 5000) WINDOW.clear();
  return true;
}

async function withinLimit(env, key) {
  if (env && env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === 'function') {
    try { const r = await env.RATE_LIMITER.limit({ key }); return !!(r && r.success); } catch (_) { /* fall through */ }
  }
  return localLimit(key, cfg(env, 'RATE_PER_MIN'));
}

/* Claude's answer is JSON in the text block; thinking blocks may come first. */
function readAnswer(msg) {
  if (!msg || !Array.isArray(msg.content)) throw Object.assign(new Error('empty answer'), { code: 'bad_answer' });
  if (msg.stop_reason === 'max_tokens') throw Object.assign(new Error('the answer was cut off'), { code: 'truncated' });
  if (msg.stop_reason === 'refusal') throw Object.assign(new Error('the model declined this note'), { code: 'refused' });
  const block = msg.content.find(b => b && b.type === 'text' && typeof b.text === 'string');
  if (!block) throw Object.assign(new Error('no text in the answer'), { code: 'bad_answer' });
  let parsed;
  try { parsed = JSON.parse(block.text); } catch (_) { throw Object.assign(new Error('the answer was not JSON'), { code: 'bad_answer' }); }
  if (!parsed || !Array.isArray(parsed.items)) throw Object.assign(new Error('no items in the answer'), { code: 'bad_answer' });
  return parsed.items;
}

async function askClaude(env, note, sex, age, encounter) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), DEFAULTS.TIMEOUT_MS);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': DEFAULTS.ANTHROPIC_VERSION
      },
      body: JSON.stringify({
        model: cfg(env, 'MODEL'),
        max_tokens: cfg(env, 'MAX_TOKENS'),
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userMessage(note, sex, age, encounter) }],
        output_config: { effort: cfg(env, 'EFFORT'), format: { type: 'json_schema', schema: SCHEMA } }
      })
    });
    const body = await r.json().catch(() => null);
    if (!r.ok) {
      const kind = (body && body.error && body.error.type) || ('http_' + r.status);
      throw Object.assign(new Error('Claude answered ' + r.status + ' (' + kind + ')'), { code: 'upstream', status: r.status });
    }
    return { items: readAnswer(body), usage: body.usage || {}, model: body.model || cfg(env, 'MODEL') };
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const cors = corsFor(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors.headers });

    if (request.method === 'GET' && (path === '/' || path === '/health')) {
      return json(200, {
        ok: true, service: 'rxdx-ai-gateway', model: cfg(env, 'MODEL'), effort: cfg(env, 'EFFORT'),
        keyConfigured: !!(env && env.ANTHROPIC_API_KEY), storesClinicalText: false
      }, cors.headers);
    }

    if (request.method !== 'POST' || path !== '/code') return json(404, { ok: false, error: 'not_found' }, cors.headers);

    const serverKey = env && env.SERVER_KEY ? String(env.SERVER_KEY) : '';
    const fromServer = !!serverKey && request.headers.get('x-rxdx-server-key') === serverKey;
    if (!fromServer && !cors.allowed) return json(403, { ok: false, error: 'origin_not_allowed' }, cors.headers);
    if (!env || !env.ANTHROPIC_API_KEY) return json(503, { ok: false, error: 'no_key', message: 'ANTHROPIC_API_KEY is not set on the gateway' }, cors.headers);

    const who = fromServer ? 'server' : (request.headers.get('CF-Connecting-IP') || 'anon');
    if (!(await withinLimit(env, who))) return json(429, { ok: false, error: 'rate_limited', message: 'Too many notes in a minute. Wait a moment.' }, cors.headers);

    let body;
    try { body = await request.json(); } catch (_) { return json(400, { ok: false, error: 'bad_json' }, cors.headers); }
    const raw = body && typeof body.note === 'string' ? body.note : '';
    if (raw.trim().length < 3) return json(400, { ok: false, error: 'missing_note' }, cors.headers);
    if (raw.length > cfg(env, 'MAX_CHARS')) return json(413, { ok: false, error: 'too_long', maxChars: cfg(env, 'MAX_CHARS') }, cors.headers);

    const sex = body.sex === 'male' || body.sex === 'female' ? body.sex : '';
    const age = Number.isFinite(Number(body.age)) && Number(body.age) > 0 && Number(body.age) < 130 ? Math.round(Number(body.age)) : 0;
    const encounter = ['outpatient', 'inpatient', 'emergency'].indexOf(body.encounter) >= 0 ? body.encounter : '';
    const clean = deid(raw);

    const t0 = Date.now();
    try {
      const a = await askClaude(env, clean.text, sex, age, encounter);
      const ms = Date.now() - t0;
      console.log(JSON.stringify({ event: 'code', chars: clean.text.length, items: a.items.length, ms,
        in: a.usage.input_tokens || 0, out: a.usage.output_tokens || 0, cacheRead: a.usage.cache_read_input_tokens || 0, from: fromServer ? 'server' : 'browser' }));
      return json(200, { ok: true, model: a.model, effort: cfg(env, 'EFFORT'), items: a.items, usage: a.usage, ms,
        deidRemoved: clean.removed, sentText: clean.text }, cors.headers);
    } catch (e) {
      console.log(JSON.stringify({ event: 'error', code: e.code || 'error', status: e.status || 0, ms: Date.now() - t0 }));
      const status = e.code === 'refused' ? 422 : (e.status === 429 || e.status === 529 ? 503 : 502);
      return json(status, { ok: false, error: e.code || 'error', message: e.message }, cors.headers);
    }
  }
};
