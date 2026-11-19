/* Measure coding with Claude on the labelled corpus, through the real gateway,
   with the same de-identification and checks the tool applies, and set it beside
   the word-list engine on the same notes.

     node gold/measure_ai.js https://rxdx-ai.<account>.workers.dev

   The gateway must have SERVER_KEY set; pass the same value in RXDX_AI_KEY:
     RXDX_AI_KEY=... node gold/measure_ai.js https://...

   60 notes, one every 3.5 seconds to stay under the gateway's rate limit:
   about four minutes. Cost at Claude Haiku 5.5 prices: a few US cents. */
'use strict';
const https = require('https');
const http = require('http');
/* the harness replaces timers and URL with stubs; keep the real ones */
const realSetTimeout = setTimeout;
const RealURL = URL;
const { load, makeEnv } = require('../tests/_harness.js');
const { code } = load();
makeEnv();
eval(code + ';Object.assign(global,{aicDeid,aicValidate,_stProblems,ICD_MAP});');

const GW = String(process.argv[2] || process.env.RXDX_AI_GATEWAY || '').replace(/\/+$/, '');
const KEY = String(process.env.RXDX_AI_KEY || '');
if (!GW) { console.log('usage: RXDX_AI_KEY=<SERVER_KEY> node gold/measure_ai.js <gateway address>'); process.exit(2); }
const corpus = require('./corpus.json');
const PRICE = { in: 0.10, out: 0.50, cacheRead: 0.01, cacheWrite: 0.125 };   /* US$ per million tokens, Haiku 5.5 */

function ask(note) {
  return new Promise((resolve, reject) => {
    const u = new RealURL(GW + '/code'), body = JSON.stringify({ note });
    const req = (u.protocol === 'https:' ? https : http).request(u, { method: 'POST',
      headers: Object.assign({ 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }, KEY ? { 'x-rxdx-server-key': KEY } : {}) },
    res => { let d = ''; res.setEncoding('utf8'); res.on('data', c => { d += c; });
      res.on('end', () => { let j = null; try { j = JSON.parse(d); } catch (_) {}
        if (res.statusCode !== 200 || !j || !j.ok) return reject(new Error(res.statusCode + ' ' + (j && (j.error || j.message) || d.slice(0, 120))));
        resolve(j); }); });
    req.setTimeout(60000, () => req.destroy(new Error('timed out')));
    req.on('error', reject); req.end(body);
  });
}
const wait = ms => new Promise(r => realSetTimeout(r, ms));
const cat = c => String(c).split('.')[0];
function score(pred, gold, s) {
  const P = new Set(pred), G = new Set(gold), PC = new Set(pred.map(cat)), GC = new Set(gold.map(cat));
  G.forEach(g => { if (P.has(g)) s.tp++; else s.fn++; }); P.forEach(p => { if (!G.has(p)) s.fp++; });
  GC.forEach(g => { if (PC.has(g)) s.ctp++; else s.cfn++; }); PC.forEach(p => { if (!GC.has(p)) s.cfp++; });
}
const blank = () => ({ tp: 0, fp: 0, fn: 0, ctp: 0, cfp: 0, cfn: 0 });
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '—';
function line(name, s) {
  const p = s.tp / (s.tp + s.fp || 1), r = s.tp / (s.tp + s.fn || 1), cp = s.ctp / (s.ctp + s.cfp || 1), cr = s.ctp / (s.ctp + s.cfn || 1);
  const f = (a, b) => (a + b ? (200 * a * b / (a + b)).toFixed(1) + '%' : '—');
  console.log(name.padEnd(12) + ' full code  P ' + pct(s.tp, s.tp + s.fp) + '  R ' + pct(s.tp, s.tp + s.fn) + '  F1 ' + f(p, r)
    + '   |   category  P ' + pct(s.ctp, s.ctp + s.cfp) + '  R ' + pct(s.ctp, s.ctp + s.cfn) + '  F1 ' + f(cp, cr));
}

(async () => {
  const ai = blank(), wl = blank(), misses = [], extra = [];
  let traps = 0, held = 0, fixed = 0, review = 0, failed = 0, ms = 0;
  const tok = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 };
  for (let i = 0; i < corpus.length; i++) {
    const n = corpus[i];
    const low = ' ' + n.note.toLowerCase().replace(/\s+/g, ' ') + ' ';
    score(_stProblems(n.note, low).filter(x => x.principal !== false).map(x => x.code), n.codes, wl);
    const d = aicDeid(n.note);
    let j = null;
    const t0 = Date.now();
    try { j = await ask(d.text); } catch (e) { failed++; console.log('  ' + n.id + ' gateway error: ' + e.message); }
    ms += Date.now() - t0;
    if (j) {
      const u = j.usage || {};
      tok.in += u.input_tokens || 0; tok.out += u.output_tokens || 0;
      tok.cacheRead += u.cache_read_input_tokens || 0; tok.cacheWrite += u.cache_creation_input_tokens || 0;
      const sent = j.sentText || d.text;
      const res = aicValidate(sent, j.items, {});
      const dx = res.coded.filter(x => x.role === 'principal' || x.role === 'secondary');
      const pred = dx.map(x => x.code);
      score(pred, n.codes, ai);
      fixed += res.coded.filter(x => x.flags.indexOf('fixed') >= 0).length;
      review += res.review.length;
      n.codes.forEach(g => { if (pred.indexOf(g) < 0) misses.push(n.id + ' missed ' + g + ' (' + (ICD_MAP[g] || {}).ascii_desc + ') — gave ' + (pred.join(', ') || 'nothing')); });
      pred.forEach(p => { if (n.codes.indexOf(p) < 0) extra.push(n.id + ' added  ' + p + ' (' + (ICD_MAP[p] || {}).ascii_desc + ')'); });
      (n.must_not_code || []).forEach(t => {
        traps++;
        const tl = t.toLowerCase();
        if (!dx.some(x => { const q = String(x.term || '').toLowerCase(); return q.indexOf(tl) >= 0 || tl.indexOf(q) >= 0; })) held++;
      });
    }
    process.stdout.write('\r  ' + (i + 1) + '/' + corpus.length);
    if (i < corpus.length - 1) await wait(3500);
  }
  console.log('\n');
  line('Claude', ai);
  line('Word list', wl);
  console.log('\nDenied or excluded findings kept out by Claude: ' + held + ' of ' + traps);
  console.log('Codes moved to ICD-10-AM by the checks: ' + fixed + ' · sent to the coder: ' + review + ' · gateway failures: ' + failed);
  const cost = (tok.in * PRICE.in + tok.out * PRICE.out + tok.cacheRead * PRICE.cacheRead + tok.cacheWrite * PRICE.cacheWrite) / 1e6;
  const done = corpus.length - failed;
  console.log('Tokens: ' + tok.in + ' in, ' + tok.out + ' out, ' + tok.cacheRead + ' cache read, ' + tok.cacheWrite + ' cache write');
  console.log('Cost: US$' + cost.toFixed(4) + ' for ' + done + ' notes · US$' + (done ? (1000 * cost / done).toFixed(2) : '—') + ' per 1,000 notes · '
    + (done ? Math.round(ms / done) : 0) + ' ms per note');
  if (misses.length) { console.log('\nMissed (' + misses.length + '):'); misses.forEach(m => console.log('  ' + m)); }
  if (extra.length) { console.log('\nCoded beyond the labels (' + extra.length + ') — read these: some will be right and unlabelled:'); extra.forEach(m => console.log('  ' + m)); }
})();
