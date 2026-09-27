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

const PORT = Number(process.env.PORT || 8080);
const API_KEY = String(process.env.RXDX_API_KEY || '').trim();
const ORIGINS = String(process.env.RXDX_ALLOW_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
const MAX_BODY = Number(process.env.RXDX_MAX_BODY || 256 * 1024);       /* 256 KB of text */
const MAX_BATCH = Number(process.env.RXDX_MAX_BATCH || 200);
const RATE_N = Number(process.env.RXDX_RATE_LIMIT || 120);              /* requests */
const RATE_WINDOW = Number(process.env.RXDX_RATE_WINDOW || 60) * 1000;  /* per minute */
const PUBLIC_DEMO = String(process.env.RXDX_PUBLIC_DEMO || '1') === '1';

const STARTED = Date.now();
const VERSION = '1.0.0';
let SERVED = 0;

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

/* The one line that ever reaches the log. No text, by construction. */
function log(o) {
  process.stdout.write(JSON.stringify(Object.assign({ t: new Date().toISOString() }, o)) + '\n');
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
      authRequired: !!API_KEY
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
    if (given !== API_KEY) {
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
      log({ id, route: p, status: 500, who, err: e.message });
      return fail(req, res, 500, 'engine_error', 'The question engine failed on this request.', { requestId: id });
    }
    if (out && out.error) {
      log({ id, route: p, status: 422, who, reason: out.error.code });
      return send(req, res, 422, Object.assign({ requestId: id }, out));
    }
    SERVED++;
    log({ id, route: p, status: 200, who,
          presentation: out.presentation, payer: body.payer || null,
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
      log({ id, route: p, status: 500, who, chars: body.text.length, err: e.message });
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

server.on('clientError', (e, socket) => { try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch (_) {} });

/* Warm the engine before accepting traffic, so the first doctor does not pay
   for the load. */
const info = engine.load();
server.listen(PORT, () => {
  log({ event: 'listening', port: PORT, version: VERSION,
        contentVersion: info.contentVersion, icdCodes: info.icdCount,
        vocabularyTerms: info.termCount, presentations: info.presentationCount,
        payerRuleSets: info.payerRuleCount, engineLoadMs: info.loadMs,
        authRequired: !!API_KEY, rateLimit: RATE_N + '/' + (RATE_WINDOW / 1000) + 's' });
});

module.exports = server;
