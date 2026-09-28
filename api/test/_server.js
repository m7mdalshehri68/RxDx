/* Start the real service on a port, collect everything it prints, stop it.
   Shared by the /v1/code-note tests. */
'use strict';
const { spawn } = require('child_process');
const path = require('path');

/* A test may load the engine in-process, and the engine's browser shell
   replaces fetch with a stub; keep the real one for talking to the server. */
const nativeFetch = global.fetch;

/* no server outlives the test that started it, even when the test crashes */
const children = new Set();
process.on('exit', () => { children.forEach(c => { try { c.kill(); } catch (_) {} }); });

function start(port, env) {
  return new Promise((resolve, reject) => {
    const logs = [];
    const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
      env: Object.assign({}, process.env, { PORT: String(port), RXDX_RATE_LIMIT: '100000', RXDX_PUBLIC_DEMO: '1' }, env || {}),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    children.add(child);
    child.on('exit', () => children.delete(child));
    let done = false;
    child.stdout.on('data', d => {
      String(d).split('\n').filter(Boolean).forEach(l => logs.push(l));
      if (!done && String(d).indexOf('"listening"') >= 0) { done = true; resolve(api); }
    });
    child.stderr.on('data', d => logs.push('STDERR ' + d));
    child.on('exit', c => { api.exitCode = c; if (!done) { done = true; resolve(api); } });
    setTimeout(() => { if (!done) reject(new Error('server did not start\n' + logs.join('\n'))); }, 30000);
    const base = 'http://127.0.0.1:' + port;
    const api = {
      base, logs, child, exitCode: null,
      req(method, p, body, headers) {
        return nativeFetch(base + p, {
          method,
          headers: Object.assign(body !== undefined ? { 'Content-Type': 'application/json' } : {}, headers || {}),
          body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body))
        }).then(r => r.text().then(text => {
          let json = null; try { json = JSON.parse(text); } catch (_) {}
          return { status: r.status, headers: r.headers, json, text };
        }));
      },
      stop() { try { child.kill(); } catch (_) {} return new Promise(r => setTimeout(r, 150)); }
    };
  });
}

function runner(title) {
  let P = 0, F = 0;
  const t = (name, fn) => Promise.resolve().then(fn).then(r => {
    if (r === true || r === undefined) P++;
    else { F++; console.log('  FAIL', name, '→', r); }
  }).catch(e => { F++; console.log('  ERR ', name, '→', e && e.message, e && e.cause ? '(' + (e.cause.code || e.cause.message) + ')' : ''); });
  const done = () => { console.log((title ? title + ': ' : '') + P + ' passed, ' + F + ' failed'); return F; };
  return { t, done };
}

module.exports = { start, runner };
