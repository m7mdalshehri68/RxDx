/* Fits the confidence weights /v1/code-note uses (api/codenote/calibration.json).

   Every code the pipeline returns for the 60 labelled notes (use_llm=false) is
   an example: its signals (see api/codenote/confidence.js) and whether the
   code is in the note's labels. An L2-regularised logistic regression turns
   the signals into a probability. The adjudicator-agreement weight cannot be
   fitted here — no labelled note has been adjudicated — so it keeps its
   stated prior, and the file says so.

   node gold/calibrate.js            fit and write
   node gold/calibrate.js --check    report only */
'use strict';
const fs = require('fs');
const path = require('path');
const { createPipeline } = require('../api/codenote/index.js');
const confidence = require('../api/codenote/confidence.js');

const OUT = path.join(__dirname, '..', 'api', 'codenote', 'calibration.json');
const FIT = confidence.FEATURES.filter(f => f !== 'llm');
const LAMBDA = 1.0;

(async () => {
  const P = createPipeline({ llm: null });
  const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus.json'), 'utf8'));
  const X = [], Y = [];
  for (const n of corpus) {
    const r = await P.run({ clinical_note: n.note, encounter_type: n.setting === 'ED' ? 'emergency' : 'outpatient', patient: {} }, { features: true });
    [r.primary_diagnosis].concat(r.secondary_diagnoses).filter(Boolean).forEach(d => {
      X.push(FIT.map(k => d._features[k]));
      Y.push(n.codes.indexOf(d.icd_code) >= 0 ? 1 : 0);
    });
  }
  /* A signal that never varies in the corpus (no labelled note triggers a
     validator error, for example) cannot be fitted: it keeps its stated prior
     and enters the fit as a fixed offset, so the intercept absorbs it. */
  const constant = FIT.map((k, i) => X.every(x => x[i] === X[0][i]));
  const fixed = FIT.filter((k, i) => constant[i]);
  /* gradient descent on the penalised log-loss; the intercept is not penalised */
  let w = FIT.map((k, i) => constant[i] ? confidence.PRIOR[k] : 0);
  w.unshift(0);
  const sig = z => 1 / (1 + Math.exp(-z));
  const pred = x => sig(w[0] + x.reduce((s, v, i) => s + v * w[i + 1], 0));
  for (let it = 0; it < 20000; it++) {
    const g = new Array(w.length).fill(0);
    X.forEach((x, j) => { const e = pred(x) - Y[j]; g[0] += e; x.forEach((v, i) => { g[i + 1] += e * v; }); });
    for (let i = 1; i < w.length; i++) g[i] = constant[i - 1] ? 0 : g[i] + LAMBDA * w[i];
    w = w.map((v, i) => v - 0.05 * g[i] / X.length);
  }
  const p = X.map(pred);
  const brier = p.reduce((s, v, j) => s + (v - Y[j]) * (v - Y[j]), 0) / p.length;
  const weights = { intercept: +w[0].toFixed(4) };
  FIT.forEach((k, i) => { weights[k] = +w[i + 1].toFixed(4); });
  weights.llm = confidence.PRIOR.llm;
  const bins = [[0, 0.8], [0.8, 0.9], [0.9, 0.95], [0.95, 1.01]].map(([a, b]) => {
    const idx = p.map((v, j) => j).filter(j => p[j] >= a && p[j] < b);
    return { range: a + '–' + Math.min(b, 1), n: idx.length,
             predicted: idx.length ? +(idx.reduce((s, j) => s + p[j], 0) / idx.length).toFixed(3) : null,
             observed: idx.length ? +(idx.reduce((s, j) => s + Y[j], 0) / idx.length).toFixed(3) : null };
  });
  const out = {
    fitted_on: 'gold/corpus.json · ' + corpus.length + ' notes · ' + X.length + ' returned codes, ' + Y.filter(Boolean).length + ' labelled correct',
    method: 'L2-regularised logistic regression (lambda ' + LAMBDA + ') on the signals in confidence.js',
    weights,
    fixed_at_prior: fixed.concat(['llm']),
    brier: +brier.toFixed(4),
    reliability: bins,
    limits: 'The corpus was labelled by the author of the vocabulary and has few wrong codes to learn from, so the fitted spread is narrow. The llm weight is a prior, not a fit: no labelled note has been adjudicated yet. Refit when certified coders have reviewed a larger sample.'
  };
  console.log(JSON.stringify(out, null, 1));
  if (process.argv.indexOf('--check') < 0) fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
})();
