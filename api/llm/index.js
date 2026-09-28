/* ══════════════════════════════════════════════════════════════════════
   THE OPTIONAL LLM ADJUDICATOR — client, egress policy, de-identification

   Off unless the service is configured for it AND the request asks for it.

     RXDX_LLM_PROVIDER    anthropic | hospital     (unset: no adjudicator)
     RXDX_LLM_MODEL       model id (anthropic default: claude-opus-5-5)
     RXDX_LLM_TIMEOUT_MS  hard timeout, default 6000
     RXDX_LLM_EFFORT      anthropic effort, default low
     RXDX_LLM_FALLBACKS   anthropic server-side fallbacks: default | off
     RXDX_LLM_URL         hospital endpoint (see hospital.js)
     RXDX_LLM_AUTH        hospital endpoint Authorization header value
     RXDX_LLM_DPA         1 = a data processing agreement covers this host

   Egress rule: only de-identified text leaves the server, and only to a host
   covered by a data processing agreement (RXDX_LLM_DPA=1) or to a model
   inside the hospital network (a private address). Anything else is refused
   before a byte is sent, and the engine's result is returned.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const { NATIVE } = require('../engine.js');
const { createAnthropicClient } = require('./anthropic.js');
const { createHospitalClient } = require('./hospital.js');
const { SYSTEM_PROMPT, OUTPUT_SCHEMA, PROMPT_VERSION } = require('./prompt.js');

const realSetTimeout = NATIVE.setTimeout, realClearTimeout = NATIVE.clearTimeout;

function privateHost(url) {
  let h;
  try { h = new URL(url).hostname.toLowerCase(); } catch (_) { return false; }
  h = h.replace(/^\[|\]$/g, '');
  return h === 'localhost' || h === '::1' || /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /^f[cd][0-9a-f]{2}:/.test(h)
    || /\.(?:local|internal|lan|intranet|corp|home\.arpa)$/.test(h) || h.indexOf('.') < 0;
}

/* Whatever could identify a person is replaced before text leaves the
   server. The request was already refused if it carried an identifier; this
   is the second net, not the first. */
function deidentify(text) {
  return String(text)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]')
    .replace(/(?:\+|00)?966[\s-]?5\d(?:[\s-]?\d){7}\b|\b05\d(?:[\s-]?\d){7}\b/g, '[PHONE]')
    .replace(/\b(?:mrn|medical record(?: number)?|file (?:no|number)|hospital number|national id|iqama(?: number| no)?|id(?: number| no)?)\s*[:#.]?\s*[A-Z0-9-]{4,}/gi, '[IDENTIFIER]')
    .replace(/\b(?:name|patient name|patient)\s*:\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}/g, '[NAME]')
    .replace(/\b(?:mr|mrs|ms|miss)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}/gi, '[NAME]')
    .replace(/\b(?:dob|date of birth|born)\s*[:]?\s*\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}/gi, '[DOB]')
    .replace(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/g, '[DATE]')
    .replace(/\b\d{7,}\b/g, '[NUMBER]');
}

function config() {
  const provider = String(process.env.RXDX_LLM_PROVIDER || '').trim().toLowerCase();
  return {
    provider,
    model: String(process.env.RXDX_LLM_MODEL || (provider === 'anthropic' ? 'claude-opus-5-5' : '')).trim(),
    timeoutMs: Math.max(500, Math.min(60000, Number(process.env.RXDX_LLM_TIMEOUT_MS || 6000))),
    effort: String(process.env.RXDX_LLM_EFFORT || 'low'),
    fallbacks: String(process.env.RXDX_LLM_FALLBACKS || 'default') === 'off' ? 'off' : 'default',
    url: String(process.env.RXDX_LLM_URL || '').trim(),
    auth: String(process.env.RXDX_LLM_AUTH || '').trim(),
    dpa: String(process.env.RXDX_LLM_DPA || '') === '1',
    fetch: NATIVE.fetch
  };
}

/* the client, or the reason there is none */
function createLlm(cfg) {
  cfg = cfg || config();
  if (!cfg.provider) return null;
  let client;
  if (cfg.provider === 'anthropic') {
    if (!cfg.dpa) return { name: 'anthropic', model: cfg.model, unavailable: 'not_permitted_no_dpa' };
    client = createAnthropicClient(cfg);
  } else if (cfg.provider === 'hospital') {
    if (cfg.url && !privateHost(cfg.url) && !cfg.dpa) return { name: 'hospital', model: cfg.model, unavailable: 'not_permitted_public_host' };
    client = createHospitalClient(cfg);
  } else {
    return { name: cfg.provider, model: cfg.model, unavailable: 'unknown_provider' };
  }
  if (client.unavailable) return client;

  /* one call, with a timeout that holds whatever the client does */
  async function ask(user) {
    const ctl = new AbortController();
    let timer;
    const timeout = new Promise(res => { timer = realSetTimeout(() => { try { ctl.abort(); } catch (_) {} res({ outcome: 'timeout' }); }, cfg.timeoutMs); });
    const t0 = Date.now();
    let out;
    try {
      out = await Promise.race([
        client.complete({ system: SYSTEM_PROMPT, user, schema: OUTPUT_SCHEMA, signal: ctl.signal }).catch(() => ({ outcome: 'error' })),
        timeout
      ]);
    } finally { realClearTimeout(timer); }
    out.ms = Date.now() - t0;
    return out;
  }
  return { name: client.name, model: client.model, timeoutMs: cfg.timeoutMs, promptVersion: PROMPT_VERSION, ask };
}

module.exports = { createLlm, config, deidentify, privateHost, SYSTEM_PROMPT, OUTPUT_SCHEMA, PROMPT_VERSION };
