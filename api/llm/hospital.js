/* ══════════════════════════════════════════════════════════════════════
   A model inside the hospital network.

   The hospital runs whatever model it has approved behind one HTTP endpoint
   (RXDX_LLM_URL) that accepts

     POST {"system": "...", "input": "...", "schema": {...}, "model": "..."}

   and answers with the JSON object the schema describes, either bare or as
   {"output": {...}}. That contract is all this adapter knows; the endpoint
   translates it for the model server behind it.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

function createHospitalClient(cfg) {
  if (!cfg.url) return { name: 'hospital', model: cfg.model, unavailable: 'not_configured' };

  const fetchFn = cfg.fetch;
  if (typeof fetchFn !== 'function') return { name: 'hospital', model: cfg.model, unavailable: 'no_http_client' };

  async function complete({ system, user, schema, signal }) {
    let r;
    try {
      r = await fetchFn(cfg.url, {
        method: 'POST',
        signal,
        headers: Object.assign({ 'Content-Type': 'application/json' }, cfg.auth ? { Authorization: cfg.auth } : {}),
        body: JSON.stringify({ system, input: user, schema, model: cfg.model || undefined })
      });
    } catch (e) {
      return { outcome: e && e.name === 'AbortError' ? 'timeout' : 'error' };
    }
    if (!r.ok) return { outcome: 'error', status: r.status };
    let j;
    try { j = await r.json(); } catch (_) { return { outcome: 'invalid_json' }; }
    const out = j && typeof j === 'object' && j.output && typeof j.output === 'object' ? j.output : j;
    return { outcome: 'answered', json: out, model: (j && j.model) || cfg.model || 'hospital' };
  }

  return { name: 'hospital', model: cfg.model || 'hospital', complete };
}

module.exports = { createHospitalClient };
