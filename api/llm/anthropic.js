/* ══════════════════════════════════════════════════════════════════════
   Claude through the Anthropic API — for a host covered by a data processing
   agreement. Loaded only when RXDX_LLM_PROVIDER=anthropic; the coding core
   never requires it, so the service still runs with no npm dependencies.

     npm install @anthropic-ai/sdk        (inside api/)

   The request asks for JSON matching the adjudicator schema (structured
   outputs). A refusal, a truncated answer or anything that is not that JSON
   is reported as such; the caller then keeps the engine's result.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

function createAnthropicClient(cfg) {
  let Anthropic;
  try { Anthropic = require('@anthropic-ai/sdk'); Anthropic = Anthropic.default || Anthropic; }
  catch (_) { return { name: 'anthropic', model: cfg.model, unavailable: 'client_not_installed' }; }

  /* the process's own fetch, not the engine shell's stub */
  const client = new Anthropic(Object.assign({ maxRetries: 0, timeout: cfg.timeoutMs }, cfg.fetch ? { fetch: cfg.fetch } : {}));

  async function complete({ system, user, schema, signal }) {
    const params = {
      model: cfg.model,
      max_tokens: 4000,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { effort: cfg.effort, format: { type: 'json_schema', schema } }
    };
    let msg;
    try {
      if (cfg.fallbacks === 'default') {
        /* on a policy decline the API re-runs the request on its recommended
           fallback model inside the same call */
        msg = await client.beta.messages.create(Object.assign({ betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, params),
          { signal, timeout: cfg.timeoutMs, maxRetries: 0 });
      } else {
        msg = await client.messages.create(params, { signal, timeout: cfg.timeoutMs, maxRetries: 0 });
      }
    } catch (e) {
      /* the error's text may echo the request; only its class leaves here */
      if (e instanceof Anthropic.APIConnectionTimeoutError || (e && e.name === 'AbortError')) return { outcome: 'timeout' };
      if (e instanceof Anthropic.RateLimitError) return { outcome: 'rate_limited' };
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return { outcome: 'not_permitted' };
      if (e instanceof Anthropic.APIError) return { outcome: 'error', status: e.status || null };
      return { outcome: 'error' };
    }
    if (msg.stop_reason === 'refusal') return { outcome: 'refused' };
    if (msg.stop_reason === 'max_tokens') return { outcome: 'truncated' };
    const text = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    try { return { outcome: 'answered', json: JSON.parse(text), model: msg.model || cfg.model }; }
    catch (_) { return { outcome: 'invalid_json' }; }
  }

  return { name: 'anthropic', model: cfg.model, complete };
}

module.exports = { createAnthropicClient };
