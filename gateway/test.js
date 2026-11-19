/* Gateway tests. Run: node gateway/test.js
   The Anthropic API is replaced by a stub, so these run offline and cost nothing.
   What is checked: who may call, what is sent to Claude, what comes back, and
   that identifiers are removed before anything leaves. */
import W from './load.mjs';
const { deid, readAnswer, SCHEMA, SYSTEM, userMessage } = W;
const worker = W.default;

let P = 0, F = 0;
const ok = (c, m) => { if (c) P++; else { F++; console.log('  FAIL', m); } };

const ORIGIN = 'https://m7mdalshehri68.github.io';
const ENV = { ANTHROPIC_API_KEY: 'sk-test', SERVER_KEY: 'srv-secret' };
let sent = null, reply = null;

globalThis.fetch = async (url, opt) => {
  sent = { url: String(url), headers: opt.headers, body: JSON.parse(opt.body) };
  const r = typeof reply === 'function' ? reply() : reply;
  return new Response(JSON.stringify(r.body), { status: r.status || 200, headers: { 'content-type': 'application/json' } });
};

const ITEMS = [
  { text: 'type 2 diabetes with diabetic nephropathy', condition: 'Type 2 diabetes mellitus with established diabetic nephropathy', status: 'active', role: 'principal', code: 'E11.22', title: 'Type 2 diabetes mellitus with established diabetic nephropathy' },
  { text: 'no chest pain', condition: 'Chest pain', status: 'negated', role: 'secondary', code: '', title: '' }
];
const good = () => ({ body: { model: 'claude-haiku-5-5', stop_reason: 'end_turn', usage: { input_tokens: 900, output_tokens: 210 },
  content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify({ items: ITEMS }) }] } });

function post(body, headers, env) {
  const req = new Request('https://rxdx-ai.example.workers.dev/code', {
    method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json' }, headers || {}),
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
  return worker.fetch(req, env || ENV);
}
async function j(res) { return { status: res.status, h: res.headers, b: await res.json().catch(() => null) }; }

/* ---------- de-identification ---------- */
{
  const src = 'Patient name: Ahmed Saleh. MRN: 4458921. National ID 1098765432, Iqama 2456789012. '
    + 'Mobile 0551234567, +966 55 123 4567. Email a.saleh@mail.com. Seen 12/03/2026 and 2026-03-14, review 3 March 2026. '
    + 'Mr Khalid Al Harbi brought him. Dr. Fawaz reviewed. محمد الشهري. '
    + '45 year old with HbA1c 8.2%, BP 118/72, 3/7 history of cough, E11.9 coded, CKD stage 3.';
  const d = deid(src);
  ok(!/Ahmed|Saleh|4458921|1098765432|2456789012|0551234567|123 4567|a\.saleh|Khalid|Harbi|Fawaz/.test(d.text), 'identifiers removed: ' + d.text);
  ok(!/[؀-ۿ]/.test(d.text), 'Arabic script removed');
  ok(!/12\/03\/2026|2026-03-14|3 March 2026/.test(d.text), 'dates removed');
  ok(/45 year old/.test(d.text) && /HbA1c 8\.2%/.test(d.text) && /BP 118\/72/.test(d.text) && /3\/7 history/.test(d.text), 'clinical content kept: ' + d.text);
  ok(/E11\.9/.test(d.text) && /CKD stage 3/.test(d.text), 'codes and stages kept');
  ok(d.removed >= 12, 'counts removals: ' + d.removed);
  ok(deid('MR and MS noted; Ms Fatima Ali seen').text.indexOf('MR and MS noted') === 0, 'MR / MS abbreviations are not names');
  ok(deid('Seen by Dr on call').text === 'Seen by Dr on call', 'a title without a name is left alone');
}

/* ---------- what is asked ---------- */
{
  ok(/ICD-10-AM/.test(SYSTEM) && /not use ICD-10-CM/.test(SYSTEM), 'system prompt names ICD-10-AM and rules out ICD-10-CM');
  ok(/J22/.test(SYSTEM) && /O99\.01/.test(SYSTEM) && /Y92/.test(SYSTEM) && /U50/.test(SYSTEM), 'system prompt carries the AM rules');
  const walk = (s, path) => {
    if (!s || typeof s !== 'object') return;
    ['maxItems', 'minLength', 'maxLength', 'minimum', 'maximum', 'multipleOf'].forEach(k => ok(!(k in s), 'unsupported keyword ' + k + ' at ' + path));
    if (s.type === 'object') {
      ok(s.additionalProperties === false, 'additionalProperties false at ' + path);
      ok(Array.isArray(s.required) && s.required.length === Object.keys(s.properties).length, 'every property required at ' + path);
      Object.keys(s.properties).forEach(k => walk(s.properties[k], path + '.' + k));
    }
    if (s.type === 'array') walk(s.items, path + '[]');
  };
  walk(SCHEMA, 'root');
  const re = new RegExp(SCHEMA.properties.items.items.properties.code.pattern);
  ok(re.test('E11.22') && re.test('I10') && re.test('S52.50') && re.test(''), 'code pattern accepts AM codes and empty');
  ok(!re.test('S52.501A') && !re.test('E1122') && !re.test('e11.9'), 'code pattern rejects CM seventh characters and malformed codes');
  const m = userMessage('note text', 'female', 32, 'outpatient');
  ok(/Encounter: outpatient/.test(m) && /Patient: female, 32 years/.test(m) && /<<<\nnote text\n>>>/.test(m), 'user message carries context and the note');
}

/* ---------- answer parsing ---------- */
{
  ok(readAnswer(good().body).length === 2, 'reads JSON after a thinking block');
  let e = null; try { readAnswer({ stop_reason: 'max_tokens', content: [] }); } catch (x) { e = x; }
  ok(e && e.code === 'truncated', 'cut-off answer is an error');
  e = null; try { readAnswer({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] }); } catch (x) { e = x; }
  ok(e && e.code === 'bad_answer', 'non-JSON answer is an error');
}

/* ---------- routes ---------- */
{
  let r = await j(await worker.fetch(new Request('https://x/health'), ENV));
  ok(r.status === 200 && r.b.ok && r.b.keyConfigured === true && r.b.model === 'claude-haiku-5-5' && r.b.effort === 'low', 'health');
  r = await j(await worker.fetch(new Request('https://x/health'), {}));
  ok(r.b.keyConfigured === false, 'health reports a missing key');

  const pre = await worker.fetch(new Request('https://x/code', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), ENV);
  ok(pre.status === 204 && pre.headers.get('Access-Control-Allow-Origin') === ORIGIN, 'preflight from the tool');

  reply = good;
  r = await j(await post({ note: 'Known type 2 diabetes with diabetic nephropathy, no chest pain. Patient name: Ahmed Saleh.', sex: 'male', age: 61, encounter: 'outpatient' }, { Origin: ORIGIN }));
  ok(r.status === 200 && r.b.ok && r.b.items.length === 2, 'codes a note from the tool');
  ok(r.h.get('Access-Control-Allow-Origin') === ORIGIN, 'answers with CORS for the tool');
  ok(sent.url === 'https://api.anthropic.com/v1/messages', 'calls the Messages API');
  ok(sent.headers['x-api-key'] === 'sk-test' && sent.headers['anthropic-version'] === '2026-10-21', 'sends key and version');
  ok(sent.body.model === 'claude-haiku-5-5' && sent.body.output_config.effort === 'low', 'Haiku 5.5 at low effort');
  ok(sent.body.output_config.format.type === 'json_schema', 'structured output');
  ok(sent.body.system[0].cache_control && sent.body.system[0].cache_control.type === 'ephemeral', 'system prompt cached');
  ok(!/Ahmed|Saleh/.test(sent.body.messages[0].content), 'name never reaches Claude');
  ok(/Patient: male, 61 years/.test(sent.body.messages[0].content), 'sex and age passed');
  ok(r.b.deidRemoved >= 1 && !/Ahmed/.test(r.b.sentText), 'reports what was removed and the text Claude saw');

  r = await j(await post({ note: 'Asthma.' }, { Origin: 'https://evil.example' }));
  ok(r.status === 403, 'other websites are refused');
  r = await j(await post({ note: 'Asthma.' }, {}));
  ok(r.status === 403, 'no origin and no server key is refused');
  r = await j(await post({ note: 'Asthma.' }, { 'x-rxdx-server-key': 'srv-secret' }));
  ok(r.status === 200, 'the coding API is let in with its key');
  r = await j(await post({ note: 'Asthma.' }, { 'x-rxdx-server-key': 'wrong' }));
  ok(r.status === 403, 'a wrong server key is refused');
  r = await j(await post({ note: 'Asthma.' }, { Origin: ORIGIN }, { SERVER_KEY: 'x' }));
  ok(r.status === 503 && r.b.error === 'no_key', 'no key configured');

  r = await j(await post('{bad', { Origin: ORIGIN }));
  ok(r.status === 400, 'bad JSON');
  r = await j(await post({ note: ' ' }, { Origin: ORIGIN }));
  ok(r.status === 400, 'empty note');
  r = await j(await post({ note: 'x'.repeat(8001) }, { Origin: ORIGIN }));
  ok(r.status === 413, 'note too long');

  reply = { status: 529, body: { type: 'error', error: { type: 'overloaded_error' } } };
  r = await j(await post({ note: 'Asthma.' }, { Origin: ORIGIN }));
  ok(r.status === 503, 'overloaded upstream is a 503 the tool can fall back from');
  reply = { status: 400, body: { type: 'error', error: { type: 'invalid_request_error' } } };
  r = await j(await post({ note: 'Asthma.' }, { Origin: ORIGIN }));
  ok(r.status === 502 && r.b.ok === false, 'upstream error is a 502');
  reply = { body: { stop_reason: 'max_tokens', content: [] } };
  r = await j(await post({ note: 'Asthma.' }, { Origin: ORIGIN }));
  ok(r.status === 502 && r.b.error === 'truncated', 'cut-off answer is a 502');
  reply = { body: { stop_reason: 'refusal', content: [] } };
  r = await j(await post({ note: 'Asthma.' }, { Origin: ORIGIN }));
  ok(r.status === 422 && r.b.error === 'refused', 'refusal is a 422');

  reply = good;
  const env2 = Object.assign({}, ENV, { RATE_PER_MIN: '2' });
  const hdr = { Origin: ORIGIN, 'CF-Connecting-IP': '203.0.113.9' };
  const a1 = await post({ note: 'Asthma.' }, hdr, env2), a2 = await post({ note: 'Asthma.' }, hdr, env2), a3 = await post({ note: 'Asthma.' }, hdr, env2);
  ok(a1.status === 200 && a2.status === 200 && a3.status === 429, 'per-instance limit without the binding');
  const env3 = Object.assign({}, ENV, { RATE_LIMITER: { limit: async () => ({ success: false }) } });
  r = await j(await post({ note: 'Asthma.' }, { Origin: ORIGIN }, env3));
  ok(r.status === 429, 'rate-limit binding is honoured');
}

console.log(P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
