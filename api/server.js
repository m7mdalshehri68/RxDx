/* ══════════════════════════════════════════════════════════════════════
   RxDx Coding API — HTTP layer

   Zero npm dependencies. Not minimalism for its own sake: a service that a
   hospital IT department has to accept is easier to accept when it has no
   supply chain, starts in under a second, and fits in one readable file.

   WHAT THIS SERVICE STORES: nothing. Clinical text is held in memory for the
   life of one request and is never written to disk, never logged, and never
   sent anywhere. The access log records a request id, a character count, how
   many codes came back and how long it took — never the text itself. That is
   enforced below, not promised in a README.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const engine = require('./engine.js');
const { createPipeline } = require('./codenote/index.js');
const { parseCodeNote, identifiersIn } = require('./codenote/request.js');
const { createAuditStore, createFeedbackStore } = require('./codenote/store.js');

const PORT = Number(process.env.PORT || 8080);
const API_KEY = String(process.env.RXDX_API_KEY || '').trim();
const ORIGINS = String(process.env.RXDX_ALLOW_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
const MAX_BODY = Number(process.env.RXDX_MAX_BODY || 256 * 1024);       /* 256 KB of text */
const MAX_BATCH = Number(process.env.RXDX_MAX_BATCH || 200);
const RATE_N = Number(process.env.RXDX_RATE_LIMIT || 120);              /* requests */
const RATE_WINDOW = Number(process.env.RXDX_RATE_WINDOW || 60) * 1000;  /* per minute */
const PUBLIC_DEMO = String(process.env.RXDX_PUBLIC_DEMO || '1') === '1';

const STARTED = Date.now();
const VERSION = '1.1.0';
let SERVED = 0;

/* Outside the public demonstration, every coding call needs a key. A hospital
   deployment that forgot to set one does not start, rather than start open. */
if (!PUBLIC_DEMO && !API_KEY) {
  process.stdout.write(JSON.stringify({ t: new Date().toISOString(), event: 'refused_to_start',
    reason: 'RXDX_PUBLIC_DEMO=0 requires RXDX_API_KEY' }) + '\n');
  process.exit(1);
}
let PIPE = null, AUDIT = null, FEEDBACK = null;   /* set before the server listens */
function keyMatches(given) {
  const a = Buffer.from(String(given || '')), b = Buffer.from(API_KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* A crash must not print a stack or a message: either could carry text from a
   request. The name of the error is enough to find the bug. */
process.on('uncaughtException', e => {
  process.stdout.write(JSON.stringify({ t: new Date().toISOString(), event: 'uncaught', err: (e && e.name) || 'Error' }) + '\n');
  process.exit(1);
});
process.on('unhandledRejection', e => {
  process.stdout.write(JSON.stringify({ t: new Date().toISOString(), event: 'unhandled_rejection', err: (e && e.name) || 'Error' }) + '\n');
});

/* ---------- rate limit: a plain sliding window, per caller ---------- */
const hits = new Map();
function overLimit(key) {
  const now = Date.now();
  const a = (hits.get(key) || []).filter(t => now - t < RATE_WINDOW);
  a.push(now);
  hits.set(key, a);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > RATE_WINDOW) hits.delete(k);
  return a.length > RATE_N ? Math.ceil((RATE_WINDOW - (now - a[0])) / 1000) : 0;
}

/* The caller is identified by a salted hash, so the log cannot be turned back
   into a list of who used the service from where. */
const SALT = crypto.randomBytes(16).toString('hex');
function callerId(req) {
  const raw = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || (req.socket && req.socket.remoteAddress) || 'unknown';
  return crypto.createHash('sha256').update(SALT + raw).digest('hex').slice(0, 12);
}

/* ---------- helpers ---------- */
function corsOrigin(req) {
  const o = req.headers.origin;
  if (ORIGINS.includes('*')) return o || '*';
  return o && ORIGINS.includes(o) ? o : null;
}

function send(req, res, status, payload, extra) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const origin = corsOrigin(req);
  const h = Object.assign({
    'Content-Type': typeof payload === 'string' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-RxDx-Stores-Clinical-Text': 'no'
  }, extra || {});
  if (origin) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Vary'] = 'Origin';
    h['Access-Control-Allow-Headers'] = 'Content-Type, X-API-Key';
    h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    h['Access-Control-Max-Age'] = '86400';
  }
  res.writeHead(status, h);
  res.end(req.method === 'HEAD' ? '' : body);
}

function fail(req, res, status, code, message, extra) {
  send(req, res, status, Object.assign({ error: { code, message } }, extra || {}));
}

/* An oversized body is drained rather than the socket torn down: a caller that
   gets a connection reset has to guess what went wrong, and a caller that gets
   413 with a message does not. */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let n = 0, over = false; const parts = [];
    req.on('data', c => {
      n += c.length;
      if (n > limit) { over = true; parts.length = 0; return; }
      parts.push(c);
    });
    req.on('end', () => {
      if (over) return reject(Object.assign(new Error('too large'), { tooLarge: true }));
      resolve(Buffer.concat(parts).toString('utf8'));
    });
    req.on('error', reject);
  });
}

/* The one line that ever reaches the log. No text, by construction: only
   these keys are written, and only numbers, codes and fixed labels go in
   them. Anything else handed to log() is dropped, not printed. */
const LOG_KEYS = ['event', 'id', 'route', 'status', 'who', 'chars', 'notes', 'principal', 'supporting', 'refused',
  'presentation', 'payer', 'visitRules', 'missing', 'codes', 'valid', 'errors', 'llm', 'reason', 'err', 'ms',
  'port', 'version', 'contentVersion', 'icdCodes', 'vocabularyTerms', 'presentations', 'payerRuleSets',
  'engineLoadMs', 'authRequired', 'rateLimit', 'formularyDrugs', 'pipelineLoadMs', 'llmStatus', 'config'];
function log(o) {
  const line = { t: new Date().toISOString() };
  LOG_KEYS.forEach(k => { if (o[k] !== undefined) line[k] = o[k]; });
  process.stdout.write(JSON.stringify(line) + '\n');
}

/* ---------- static ---------- */
let DOCS = '';
function docsHtml() {
  if (!DOCS) DOCS = fs.readFileSync(path.join(__dirname, 'docs.html'), 'utf8');
  return DOCS;
}
let SPEC = null;
function spec() {
  if (!SPEC) SPEC = JSON.parse(fs.readFileSync(path.join(__dirname, 'openapi.json'), 'utf8'));
  return SPEC;
}

/* ══════════════════════════════════════════════════════════════════════ */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname.replace(/\/+$/, '') || '/';
  const id = crypto.randomBytes(6).toString('hex');

  if (req.method === 'OPTIONS') return send(req, res, 204, '');

  /* ---- open routes ---- */
  if (p === '/' || p === '/docs') return send(req, res, 200, docsHtml());
  if (p === '/openapi.json') return send(req, res, 200, spec());
  if (p === '/v1/health' || p === '/health') {
    const info = engine.load();
    return send(req, res, 200, {
      ok: true, service: 'rxdx-coding-api', version: VERSION,
      contentVersion: info.contentVersion,
      icdCodes: info.icdCount, vocabularyCodes: info.synCount, vocabularyTerms: info.termCount,
      presentations: info.presentationCount, payerRuleSets: info.payerRuleCount,
      engineLoadMs: info.loadMs, uptimeSeconds: Math.round((Date.now() - STARTED) / 1000),
      requestsServed: SERVED,
      storesClinicalText: false,
      publicDemo: PUBLIC_DEMO,
      authRequired: !!API_KEY,
      codeNote: PIPE ? {
        pipeline: PIPE.version, contentVersion: PIPE.contentVersion, engineVersion: PIPE.engineVersion,
        formularyDrugs: PIPE.formularyCount, uncertainDiagnosisPolicy: PIPE.policy,
        configuration: info.config, llm: PIPE.llm ? { provider: PIPE.llm.provider, status: PIPE.llm.status } : { status: 'off' },
        calibration: PIPE.calibration.fitted_on || 'prior'
      } : null
    });
  }
  if (p === '/v1/version') {
    const reg = engine.load().rx.CONTENT_REG || [];
    return send(req, res, 200, {
      service: VERSION,
      contentVersion: engine.load().contentVersion,
      sources: reg.map(b => ({ id: b.id, name: b.n, version: b.v, source: b.src, reviewed: b.read, size: b.n_ || null }))
    });
  }
  /* The 98 complaints the protocol library knows, with the spellings it also
     accepts. Open, because it carries no clinical text and an integrator needs
     it before they can call anything else. */
  if (p === '/v1/presentations') {
    const list = engine.listPresentations();
    return send(req, res, 200, {
      count: list.length,
      contentVersion: engine.load().contentVersion,
      presentations: list
    });
  }

  /* ---- guarded routes ---- */
  const who = callerId(req);
  if (API_KEY) {
    const given = String(req.headers['x-api-key'] || url.searchParams.get('key') || '');
    if (!keyMatches(given)) {
      log({ id, route: p, status: 401, who });
      return fail(req, res, 401, 'unauthorised', 'Send your key in the X-API-Key header.');
    }
  }
  const wait = overLimit(who);
  if (wait) {
    log({ id, route: p, status: 429, who });
    return fail(req, res, 429, 'rate_limited',
      'Too many requests. Try again in ' + wait + ' seconds.', { retryAfterSeconds: wait });
  }

  /* ---------- the coding pipeline, feedback and the audit trail ---------- */
  if (CODE_NOTE_ROUTES[p] || /^\/v1\/audit\/[0-9a-f-]{36}$/i.test(p)) {
    try { return await codeNoteRoutes(req, res, p); }
    catch (e) {
      /* the name of the failure only: its message could quote the request */
      log({ id, route: p, status: 500, err: (e && e.name) || 'Error' });
      return fail(req, res, 500, 'internal_error', 'The coding service failed on this request. Nothing from it was stored.', { requestId: id });
    }
  }

  const POSTABLE = ['/v1/code', '/v1/code/batch', '/v1/encounter'];
  if (req.method !== 'POST' || POSTABLE.indexOf(p) < 0) {
    return fail(req, res, 404, 'not_found', 'No such endpoint. See /docs for what this service offers.');
  }

  let raw;
  try { raw = await readBody(req, p === '/v1/code/batch' ? MAX_BODY * 8 : MAX_BODY); }
  catch (e) {
    if (e && e.tooLarge) return fail(req, res, 413, 'too_large', 'The note is larger than this service accepts.');
    return fail(req, res, 400, 'bad_request', 'Could not read the request body.');
  }

  let body;
  try { body = raw ? JSON.parse(raw) : {}; }
  catch (_) { return fail(req, res, 400, 'bad_json', 'The body is not valid JSON.'); }

  const t0 = Date.now();

  /* ---------- POST /v1/encounter ----------
     The half of the product that earns the money: what the payer is going to
     want, while the patient is still in the room and it can still be written. */
  if (p === '/v1/encounter') {
    if (typeof body.complaint !== 'string' || !body.complaint.trim()) {
      return fail(req, res, 400, 'missing_complaint',
        'Send {"complaint": "chest pain"}. Call /v1/presentations for the 98 this service knows.');
    }
    let out;
    try { out = engine.askEncounter(body); }
    catch (e) {
      log({ id, route: p, status: 500, who, err: (e && e.name) || 'Error' });
      return fail(req, res, 500, 'engine_error', 'The question engine failed on this request.', { requestId: id });
    }
    if (out && out.error) {
      log({ id, route: p, status: 422, who, reason: out.error.code });
      return send(req, res, 422, Object.assign({ requestId: id }, out));
    }
    SERVED++;
    log({ id, route: p, status: 200, who,
          presentation: out.presentation, payer: ['bupa', 'taw', 'art'].indexOf(body.payer) >= 0 ? body.payer : null,
          chars: (body.note || '').length,
          visitRules: out.payerRequirements.length,
          missing: out.stillMissing.length, ms: Date.now() - t0 });
    return send(req, res, 200, Object.assign({ requestId: id, engine: 'rxdx/' + VERSION }, out));
  }

  /* ---------- POST /v1/code ---------- */
  if (p === '/v1/code') {
    if (typeof body.text !== 'string') {
      return fail(req, res, 400, 'missing_text', 'Send {"text": "the clinical note"}.');
    }
    let out;
    try { out = engine.codeNote(body.text, { sex: body.sex, explainRefusals: body.explainRefusals }); }
    catch (e) {
      log({ id, route: p, status: 500, who, chars: body.text.length, err: (e && e.name) || 'Error' });
      return fail(req, res, 500, 'engine_error', 'The coding engine failed on this request.', { requestId: id });
    }
    SERVED++;
    log({ id, route: p, status: 200, who, chars: body.text.length,
          principal: out.principal.length, supporting: out.supporting.length,
          refused: out.mentionedButNotCoded.length, ms: Date.now() - t0 });
    return send(req, res, 200, Object.assign({ requestId: id, engine: 'rxdx/' + VERSION }, out));
  }

  /* ---------- POST /v1/code/batch ----------
     For the coder workstation and the monthly gap report: many notes, one call,
     each answer carried back with the id the caller sent so nothing is mixed up. */
  const items = Array.isArray(body.notes) ? body.notes : null;
  if (!items) return fail(req, res, 400, 'missing_notes', 'Send {"notes":[{"id":"1","text":"..."}]}.');
  if (items.length > MAX_BATCH) {
    return fail(req, res, 413, 'batch_too_large', 'At most ' + MAX_BATCH + ' notes per call.');
  }
  const results = items.map((n, i) => {
    const nid = (n && n.id != null) ? String(n.id) : String(i);
    if (!n || typeof n.text !== 'string') return { id: nid, error: { code: 'missing_text', message: 'no text' } };
    try { return Object.assign({ id: nid }, engine.codeNote(n.text, { sex: n.sex, explainRefusals: body.explainRefusals })); }
    catch (e) { return { id: nid, error: { code: 'engine_error', message: 'could not code this note' } }; }
  });
  SERVED += results.length;
  log({ id, route: p, status: 200, who, notes: items.length,
        chars: items.reduce((s, n) => s + ((n && n.text) ? n.text.length : 0), 0), ms: Date.now() - t0 });
  return send(req, res, 200, {
    requestId: id, engine: 'rxdx/' + VERSION,
    contentVersion: engine.load().contentVersion,
    count: results.length, results
  });
});

/* ══════════════════════════════════════════════════════════════════════
   /v1/code-note, /v1/code-note/batch, /v1/feedback, /v1/audit/{id}

   The note is read into memory, coded, and dropped when the response is
   sent. The log line and the audit record carry the request id, the
   character count, the codes and the timings — never the note, never a
   quote from it, never an error message.
   ══════════════════════════════════════════════════════════════════════ */
const CODE_NOTE_ROUTES = { '/v1/code-note': 1, '/v1/code-note/batch': 1, '/v1/feedback': 1 };

async function codeNoteRoutes(req, res, p) {
  const t0 = Date.now();

  if (/^\/v1\/audit\//.test(p)) {
    if (req.method !== 'GET') return fail(req, res, 405, 'method_not_allowed', 'Use GET.');
    const r = AUDIT.get(p.split('/').pop());
    return r ? send(req, res, 200, r) : fail(req, res, 404, 'not_found', 'No audit record for that request id on this instance.');
  }
  if (p === '/v1/feedback' && req.method === 'GET') {
    return send(req, res, 200, FEEDBACK.exportAll());
  }
  if (req.method !== 'POST') return fail(req, res, 405, 'method_not_allowed', 'Use POST.');

  const batch = p === '/v1/code-note/batch';
  let raw;
  /* JSON escaping can double a note's size on the wire; the note itself is
     measured against RXDX_MAX_BODY once parsed */
  try { raw = await readBody(req, batch ? MAX_BODY * 8 : MAX_BODY * 2 + 16384); }
  catch (e) {
    if (e && e.tooLarge) { log({ route: p, status: 413 }); return fail(req, res, 413, 'too_large', 'The request is larger than this service accepts.'); }
    return fail(req, res, 400, 'bad_request', 'Could not read the request body.');
  }
  let body;
  try { body = raw ? JSON.parse(raw) : {}; }
  catch (_) { log({ route: p, status: 400, err: 'bad_json' }); return fail(req, res, 400, 'bad_json', 'The body is not valid JSON.'); }
  raw = null;

  /* ---------- POST /v1/feedback ---------- */
  if (p === '/v1/feedback') {
    const out = FEEDBACK.add(body, AUDIT, PIPE.table);
    if (out.error) { log({ route: p, status: out.status, err: out.error.code }); return send(req, res, out.status, { error: out.error }); }
    log({ id: out.item.request_id, route: p, status: 201, codes: [out.item.code], reason: out.item.decision + ':' + out.item.reason, ms: Date.now() - t0 });
    return send(req, res, 201, { stored: true, feedback_id: out.item.feedback_id, request_known: out.item.request_known,
                                  code_was_returned: out.item.code_was_returned, stores: 'codes only' });
  }

  const codeOne = async (b) => {
    const parsed = parseCodeNote(b, { maxNoteBytes: MAX_BODY });
    if (parsed.error) return parsed;
    const request_id = crypto.randomUUID();
    const out = await PIPE.run(parsed.req, { requestId: request_id });
    AUDIT.record(out, p);
    return { out };
  };
  const codesOf = r => [r.primary_diagnosis].concat(r.secondary_diagnoses).filter(Boolean).map(d => d.icd_code);

  /* ---------- POST /v1/code-note ---------- */
  if (!batch) {
    const r = await codeOne(body);
    if (r.error) {
      log({ route: p, status: r.status, err: r.error.code });
      return send(req, res, r.status, { error: r.error });
    }
    SERVED++;
    log({ id: r.out.request_id, route: p, status: 200, chars: r.out.audit.received_chars, codes: codesOf(r.out),
          valid: r.out.coding_validation.valid, errors: r.out.coding_validation.errors.map(e => e.code),
          llm: r.out.audit.llm ? r.out.audit.llm.outcome : null, ms: Date.now() - t0 });
    return send(req, res, 200, r.out);
  }

  /* ---------- POST /v1/code-note/batch ---------- */
  const items = Array.isArray(body.notes) ? body.notes : null;
  if (!items) return fail(req, res, 400, 'missing_notes', 'Send {"notes":[{"id":"1","clinical_note":"…","encounter_type":"outpatient"}]}.');
  if (items.length > MAX_BATCH) return fail(req, res, 413, 'batch_too_large', 'At most ' + MAX_BATCH + ' notes per call.');
  const extra = Object.keys(body).filter(k => k !== 'notes' && k !== 'defaults');
  if (extra.length) return fail(req, res, 400, 'unknown_field', 'Unknown field(s): ' + extra.join(', ') + '.');
  const defaults = body.defaults && typeof body.defaults === 'object' ? body.defaults : {};
  if (defaults.options && defaults.options.use_llm) {
    return fail(req, res, 400, 'llm_not_in_batch', 'use_llm is available one note at a time, on /v1/code-note, where its timeout is per request.');
  }
  const results = [];
  let chars = 0;
  for (let i = 0; i < items.length; i++) {
    const n = items[i];
    const nid = n && n.id != null ? String(n.id).slice(0, 64) : String(i);
    if (!n || typeof n !== 'object') { results.push({ id: nid, error: { code: 'bad_request', message: 'each note must be an object' } }); continue; }
    if (identifiersIn(nid).length) {
      results.push({ id: String(i), status: 422, error: { code: 'identifier_present', message: 'a note id must not be a patient identifier; use a request reference', fields: ['id'] } });
      continue;
    }
    const one = Object.assign({}, defaults, n);
    delete one.id;
    if (one.options && one.options.use_llm) { results.push({ id: nid, error: { code: 'llm_not_in_batch', message: 'use_llm is available on /v1/code-note only' } }); continue; }
    if (typeof one.clinical_note === 'string') chars += one.clinical_note.length;
    try {
      const r = await codeOne(one);
      results.push(r.error ? { id: nid, status: r.status, error: r.error } : Object.assign({ id: nid }, r.out));
    } catch (e) {
      results.push({ id: nid, error: { code: 'internal_error', message: 'could not code this note' } });
    }
  }
  SERVED += results.length;
  log({ route: p, status: 200, notes: items.length, chars,
        codes: results.map(r => r.request_id ? codesOf(r).join(' ') : 'error'), ms: Date.now() - t0 });
  return send(req, res, 200, { count: results.length, content_version: PIPE.contentVersion, results });
}

server.on('clientError', (e, socket) => { try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch (_) {} });

/* Warm the engine and the pipeline before accepting traffic, so the first
   doctor does not pay for the load. */
const info = engine.load();
const tp = Date.now();
PIPE = createPipeline();
const pipelineLoadMs = Date.now() - tp;
AUDIT = createAuditStore({ file: process.env.RXDX_AUDIT_FILE || null });
FEEDBACK = createFeedbackStore({ file: process.env.RXDX_FEEDBACK_FILE || null });
server.listen(PORT, () => {
  log({ event: 'listening', port: PORT, version: VERSION,
        contentVersion: info.contentVersion, icdCodes: info.icdCount,
        vocabularyTerms: info.termCount, presentations: info.presentationCount,
        payerRuleSets: info.payerRuleCount, engineLoadMs: info.loadMs,
        formularyDrugs: PIPE.formularyCount, pipelineLoadMs, llmStatus: PIPE.llmStatus,
        config: info.config ? 'rev' + info.config.revision + '/' + info.config.sha256 : 'none',
        authRequired: !!API_KEY, rateLimit: RATE_N + '/' + (RATE_WINDOW / 1000) + 's' });
});

module.exports = server;
