/* ══════════════════════════════════════════════════════════════════════
   PARITY — the API and the browser must never disagree

   The API loads the same script the browser runs, but it deliberately skips
   the drug formulary to stay small. That is the one place a difference could
   creep in: if any coding path quietly read the formulary, the service would
   start answering differently from the tool in the doctor's hand, and nobody
   would notice until a claim was refused.

   So this runs every note in the labelled corpus through both loaders — the
   browser path with the full data, and the API path without the formulary —
   and fails if a single code differs.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HERE = __dirname;
const SITE = path.join(HERE, '..', '..');
const CORPUS = path.join(SITE, 'gold', 'corpus.json');

function notes() {
  const raw = JSON.parse(fs.readFileSync(CORPUS, 'utf8'));
  const list = Array.isArray(raw) ? raw : (raw.notes || raw.cases || []);
  return list.map((n, i) => ({
    id: n.id || ('N' + (i + 1)),
    text: n.text || n.note || n.body || ''
  })).filter(n => n.text && n.text.length > 10);
}

/* Each loader runs in its own process: both eval into the global namespace,
   so they cannot share one. */
const BROWSER_RUNNER = `
const path=require('path');
const {load,makeEnv}=require(${JSON.stringify(path.join(SITE, 'tests', '_harness.js'))});
const {code}=load();makeEnv();
eval(code+';Object.assign(global,{_stProblems});');
const notes=JSON.parse(process.argv[2]);
const out={};
notes.forEach(n=>{
  const low=' '+n.text.toLowerCase().replace(/\\s+/g,' ')+' ';
  out[n.id]=(_stProblems(n.text,low)||[]).map(x=>x.code+(x.principal===false?'~s':'')).sort();
});
process.stdout.write(JSON.stringify(out));
`;

const API_RUNNER = `
const E=require(${JSON.stringify(path.join(HERE, '..', 'engine.js'))});
const notes=JSON.parse(process.argv[2]);
const out={};
notes.forEach(n=>{
  const r=E.codeNote(n.text,{});
  out[n.id]=r.principal.map(x=>x.code).concat(r.supporting.map(x=>x.code+'~s')).sort();
});
process.stdout.write(JSON.stringify(out));
`;

function run(src, payload) {
  const f = path.join(require('os').tmpdir(), 'rxdx_par_' + Math.random().toString(36).slice(2) + '.js');
  fs.writeFileSync(f, src);
  try {
    return JSON.parse(execFileSync(process.execPath, [f, payload],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

const list = notes();
if (!list.length) { console.log('PARITY: no corpus found at ' + CORPUS); process.exit(1); }
const payload = JSON.stringify(list);

console.log('Running ' + list.length + ' labelled notes through both loaders…');
const A = run(BROWSER_RUNNER, payload);   /* browser: full data, formulary included */
const B = run(API_RUNNER, payload);       /* api: no formulary */

let same = 0;
const diffs = [];
list.forEach(n => {
  const a = (A[n.id] || []).join(','), b = (B[n.id] || []).join(',');
  if (a === b) same++;
  else diffs.push({ id: n.id, browser: a || '(none)', api: b || '(none)' });
});

console.log('');
console.log('  identical : ' + same + ' / ' + list.length);
console.log('  different : ' + diffs.length);
if (diffs.length) {
  console.log('');
  diffs.slice(0, 20).forEach(d => {
    console.log('  ' + d.id);
    console.log('    browser : ' + d.browser);
    console.log('    api     : ' + d.api);
  });
  console.log('');
  console.log('PARITY FAILED — the API no longer answers like the tool.');
  process.exit(1);
}
console.log('');
console.log('PARITY HELD — the API and the browser return the same codes for every labelled note.');
