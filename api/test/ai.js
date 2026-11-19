/* The coding API with the AI gateway switched on. A stand-in gateway answers
   on a local port the way the real one does, so this runs offline and costs
   nothing. Checked: what the service sends out, what it returns, and that it
   falls back to the dictionary engine when the gateway fails. */
'use strict';
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 8794, GW = 8795;
const BASE = 'http://127.0.0.1:' + PORT;
let child, gateway, P = 0, F = 0, mode = 'ok', lastSeen = null;
const logs = [];
const ok = (c, m) => { if (c) P++; else { F++; console.log('  FAIL', m); } };

function startGateway() {
  return new Promise(resolve => {
    gateway = http.createServer((req, res) => {
      let b = '';
      req.on('data', d => { b += d; });
      req.on('end', () => {
        lastSeen = { key: req.headers['x-rxdx-server-key'], body: JSON.parse(b || '{}') };
        if (mode === 'down') { res.writeHead(503, { 'content-type': 'application/json' }); return res.end('{"ok":false,"error":"upstream"}'); }
        const items = [
          { text: 'fracture of distal radius', condition: 'Fracture of lower end of radius', status: 'active', role: 'principal',
            code: 'S52.501A', title: 'Unspecified fracture of the lower end of right radius, initial encounter' },
          { text: 'Fell from a ladder', condition: 'Fall on and from ladder', status: 'active', role: 'external_cause', code: 'W11', title: 'Fall on and from ladder' },
          { text: 'no head injury', condition: 'Head injury', status: 'negated', role: 'secondary', code: '', title: '' }
        ];
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, model: 'claude-haiku-5-5', items, usage: { input_tokens: 800, output_tokens: 150 },
          deidRemoved: 0, sentText: lastSeen.body.note }));
      });
    }).listen(GW, '127.0.0.1', resolve);
  });
}

function start() {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
      env: Object.assign({}, process.env, { PORT: String(PORT), RXDX_RATE_LIMIT: '500',
        RXDX_AI_GATEWAY: 'http://127.0.0.1:' + GW, RXDX_AI_KEY: 'srv-secret' }),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let done = false;
    child.stdout.on('data', d => { String(d).split('\n').filter(Boolean).forEach(l => logs.push(l)); if (!done && String(d).indexOf('listening') >= 0) { done = true; resolve(); } });
    child.stderr.on('data', d => logs.push('ERR ' + d));
    child.on('exit', c => { if (!done) reject(new Error('server exited ' + c + '\n' + logs.join('\n'))); });
    setTimeout(() => { if (!done) reject(new Error('server did not start\n' + logs.join('\n'))); }, 25000);
  });
}

const post = (p, body) => fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  .then(r => r.json().then(j => ({ status: r.status, json: j })));

const NOTE = 'Patient name: Ahmed Saleh. Fell from a ladder at home. X-ray: fracture of distal radius. No head injury.';

(async function () {
  await startGateway();
  await start();

  const h = await fetch(BASE + '/v1/health').then(r => r.json());
  ok(h.aiGateway === true, 'health reports the gateway');

  let r = await post('/v1/code', { text: NOTE, sex: 'male' });
  ok(r.status === 200 && r.json.coder === 'claude', 'codes through Claude by default: ' + JSON.stringify(r.json).slice(0, 200));
  ok(lastSeen && lastSeen.key === 'srv-secret', 'sends the server key to the gateway');
  ok(lastSeen && !/Ahmed|Saleh/.test(lastSeen.body.note) && lastSeen.body.sex === 'male', 'removes the name before the note leaves');
  ok(r.json.principal.length === 1 && r.json.principal[0].code === 'S52.50' && r.json.principal[0].adjustedFrom === 'S52.501A',
    'an ICD-10-CM answer comes back as ICD-10-AM: ' + JSON.stringify(r.json.principal));
  ok(r.json.supporting.some(x => x.code === 'W11' && x.role === 'external_cause'), 'the external cause is kept');
  ok(r.json.mentionedButNotCoded.some(x => x.status === 'negated'), 'the denied injury is listed, not coded');
  ok(r.json.principal[0].evidence.term === 'fracture of distal radius' && /fracture of distal radius/.test(r.json.principal[0].evidence.sentence),
    'evidence carries the words and the sentence');
  ok(r.json.identifiersRemoved >= 1, 'reports what was removed');

  r = await post('/v1/code', { text: NOTE, coder: 'dictionary' });
  ok(r.status === 200 && r.json.coder === 'dictionary', 'the dictionary engine can still be asked for');

  mode = 'down';
  r = await post('/v1/code', { text: 'Impression: community acquired pneumonia.' });
  ok(r.status === 200 && r.json.coder === 'dictionary' && r.json.principal.some(x => x.code === 'J18.9'), 'falls back when the gateway fails');
  ok(r.json.warnings.some(w => /AI gateway could not be reached/.test(w.message)), 'and says so');

  mode = 'ok';
  const b = await post('/v1/code/batch', { notes: [{ id: 'a', text: 'Impression: asthma.' }] });
  ok(b.status === 200 && b.json.results[0].principal.some(x => x.code === 'J45.9'), 'batch stays on the dictionary engine');

  const leaked = logs.some(l => /Ahmed|Saleh|ladder/.test(l));
  ok(!leaked, 'no clinical text in the service log');

  child.kill(); gateway.close();
  console.log(P + ' passed, ' + F + ' failed');
  process.exit(F ? 1 : 0);
})().catch(e => { console.log('  ERR', e.message); try { child.kill(); gateway.close(); } catch (_) {} process.exit(1); });
