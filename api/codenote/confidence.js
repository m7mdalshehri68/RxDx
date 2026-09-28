/* ══════════════════════════════════════════════════════════════════════
   CONFIDENCE

   A probability that the code is right, computed from signals anyone can
   check — never from a model's opinion of itself:
     vocab     the engine matched a long, exact phrase from the vocabulary
     abbrev    the engine matched only an abbreviation
     clear     every quoted mention is asserted plainly (no hedging in its sentence)
     named     the physician named it in the assessment
     specific  the code is as specific as the note allows (no specificity issue)
     clean     the validator raised no error against it
     symptom   it is a chapter R symptom
     llm       the adjudicator agreed (+1), disagreed (−1) or did not run (0)

   Weights are a logistic fit on the labelled corpus (gold/calibrate.js writes
   calibration.json). The llm weight cannot be fitted until adjudicated notes
   are labelled, so it stays at its stated prior and the file says so.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const FEATURES = ['vocab', 'abbrev', 'clear', 'named', 'specific', 'clean', 'symptom', 'llm'];
const PRIOR = { intercept: 0.5, vocab: 0.8, abbrev: -0.8, clear: 1.0, named: 1.0, specific: 0.6, clean: 1.5, symptom: -0.5, llm: 0.7 };
const HEDGE = /\b(?:likely|possible|possibly|probable|probably|suspected|query|\?|versus|vs\.?|differential|cannot exclude|borderline)\b/i;

function loadCalibration(file) {
  try {
    const c = JSON.parse(fs.readFileSync(file || path.join(__dirname, 'calibration.json'), 'utf8'));
    if (c && c.weights) return c;
  } catch (_) {}
  return { weights: PRIOR, fitted_on: null, note: 'prior weights: calibration.json missing' };
}

function features(c, ctx) {
  const term = String(c.term || '');
  const sentences = (c.spans || []).map(s => ctx.sentence(s.start)).join(' ');
  return {
    vocab: term.length >= 8 || /\s/.test(term) ? 1 : 0,
    abbrev: term.length <= 4 ? 1 : 0,
    clear: (c.spans || []).length && !HEDGE.test(sentences) ? 1 : 0,
    named: c.named ? 1 : 0,
    specific: ctx.specificityIssue ? 0 : 1,
    clean: ctx.hasError ? 0 : 1,
    symptom: /^R/.test(c.code) ? 1 : 0,
    llm: ctx.llm === 'agree' ? 1 : ctx.llm === 'disagree' ? -1 : 0
  };
}

function score(f, cal) {
  const w = (cal && cal.weights) || PRIOR;
  let z = w.intercept || 0;
  FEATURES.forEach(k => { z += (w[k] || 0) * (f[k] || 0); });
  const p = 1 / (1 + Math.exp(-z));
  return Math.round(Math.min(0.99, Math.max(0.01, p)) * 100) / 100;
}

module.exports = { FEATURES, PRIOR, features, score, loadCalibration };
