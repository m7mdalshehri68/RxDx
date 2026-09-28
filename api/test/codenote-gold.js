/* The labelled corpus through POST /v1/code-note (use_llm=false), over HTTP.

   Floors (the build fails below them):
     category F1 ≥ 99.3 %, full-code F1 ≥ 96.1 %, denied findings kept out 123/123,
     every returned code in the table, every quote verified at its offsets,
     every response valid against api/openapi.json, p95 ≤ 300 ms for a
     2,000-character note on the deterministic path.

   Principal agreement is reported against the corpus's principal labels.
   Those labels are marked "unreviewed" until a certified coder confirms
   them, and unreviewed labels are never treated as ground truth: agreement
   with them is printed, not enforced. Labels marked "reviewed" are enforced
   at 95 %. */
'use strict';
const fs = require('fs');
const path = require('path');
const { start, runner } = require('./_server.js');
const { validate } = require('./schema.js');

const PORT = 8821;
const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'gold', 'corpus.json'), 'utf8'));
const { t, done } = runner('code-note on the gold corpus');
const cat = c => String(c).split('.')[0];
const pct = (a, b) => b ? (100 * a / b) : 0;
const f1 = (p, r) => (p + r) ? 2 * p * r / (p + r) : 0;

function patientOf(note) {
  const m = /^(\d+(?:\.\d+)?)\s*(y|year|month)/i.exec(note);
  const age = m ? (/month/i.test(m[2]) ? +m[1] / 12 : +m[1]) : undefined;
  const sex = /\b(female|girl|woman)\b/i.test(note.slice(0, 40)) ? 'female' : /\b(male|boy|man)\b/i.test(note.slice(0, 40)) ? 'male' : undefined;
  const p = {};
  if (age !== undefined) p.age_years = age;
  if (sex) p.sex = sex;
  return p;
}

(async () => {
  const S = await start(PORT);
  const engine = require('../engine.js');
  const { createPipeline } = require('../codenote/index.js');
  const P = createPipeline({ llm: null });
  const T = P.table;

  const results = [];
  for (const n of corpus) {
    const r = await S.req('POST', '/v1/code-note', {
      clinical_note: n.note, encounter_type: n.setting === 'ED' ? 'emergency' : 'outpatient',
      patient: patientOf(n.note), options: { nphies: true }
    });
    results.push({ n, r });
  }

  /* ---------- accuracy, exactly as gold/measure.js counts it ---------- */
  const idx = engine.load().rx._buildNoteIndexes();
  const termToCode = {}; idx.probTerms.forEach(x => { termToCode[x.term.toLowerCase()] = x.code; });
  function conceptCode(phrase) {
    const p = phrase.toLowerCase().trim();
    if (termToCode[p]) return termToCode[p];
    let best = null;
    for (const k in termToCode) if (k.includes(p) && k.length >= p.length && (!best || k.length < best.length)) best = k;
    return best ? termToCode[best] : null;
  }
  let TP = 0, FP = 0, FN = 0, cTP = 0, cFP = 0, cFN = 0, negT = 0, negP = 0;
  const negFails = [];
  results.forEach(({ n, r }) => {
    const pred = [r.json.primary_diagnosis].concat(r.json.secondary_diagnoses || []).filter(Boolean).map(d => d.icd_code);
    const ps = new Set(pred), pc = new Set(pred.map(cat)), gs = new Set(n.codes), gc = new Set(n.codes.map(cat));
    n.codes.forEach(g => { if (ps.has(g)) TP++; else FN++; });
    pred.forEach(p => { if (!gs.has(p)) FP++; });
    gc.forEach(g => { if (pc.has(g)) cTP++; else cFN++; });
    pc.forEach(p => { if (!gc.has(p)) cFP++; });
    (n.must_not_code || []).forEach(x => { const c = conceptCode(x); if (!c) return; negT++; if (!ps.has(c)) negP++; else negFails.push(n.id + ' ' + x + ' → ' + c); });
  });
  const P1 = TP / (TP + FP), R1 = TP / (TP + FN), cP = cTP / (cTP + cFP), cR = cTP / (cTP + cFN);
  const F = 100 * f1(P1, R1), cF = 100 * f1(cP, cR);
  console.log('  full code  precision ' + pct(TP, TP + FP).toFixed(1) + '%  recall ' + pct(TP, TP + FN).toFixed(1) + '%  F1 ' + F.toFixed(1) + '%');
  console.log('  category   precision ' + pct(cTP, cTP + cFP).toFixed(1) + '%  recall ' + pct(cTP, cTP + cFN).toFixed(1) + '%  F1 ' + cF.toFixed(1) + '%');
  console.log('  denied findings kept out ' + negP + ' / ' + negT);
  await t('category F1 is at least 99.3 %', () => +cF.toFixed(1) >= 99.3 || cF.toFixed(2));
  await t('full-code F1 is at least 96.1 %', () => +F.toFixed(1) >= 96.1 || F.toFixed(2));
  await t('every denied or excluded finding is kept out (123 / 123)', () => (negT === 123 && negP === 123) || negP + '/' + negT + ' ' + negFails.join('; '));

  /* ---------- integrity ---------- */
  let codesSeen = 0, codesOk = 0, quotes = 0, quotesOk = 0, schemaBad = [];
  results.forEach(({ n, r }) => {
    const j = r.json;
    const codeList = [].concat(
      [j.primary_diagnosis].concat(j.secondary_diagnoses).filter(Boolean).map(d => d.icd_code),
      [].concat.apply([], j.not_coded.map(x => (x.icd_codes || []).concat(x.candidates || []))),
      [].concat.apply([], j.medical_necessity.map(m => m.supported_by)),
      j.documentation_gaps.map(g => g.concerns),
      j.nphies ? j.nphies.diagnosis.map(d => d.diagnosisCodeableConcept.coding[0].code) : []);
    codeList.forEach(c => { codesSeen++; if (T.has(c)) codesOk++; });
    const ev = [].concat.apply([], [j.primary_diagnosis].concat(j.secondary_diagnoses).filter(Boolean).map(d => d.evidence))
      .concat([].concat.apply([], j.not_coded.map(x => x.evidence)));
    ev.forEach(e => { quotes++; if (n.note.slice(e.start, e.end) === e.quote) quotesOk++; });
    const v = validate('CodeNoteResponse', j);
    if (v.length) schemaBad.push(n.id + ': ' + v[0]);
  });
  console.log('  codes in the table ' + codesOk + ' / ' + codesSeen + ' · quotes verified ' + quotesOk + ' / ' + quotes);
  await t('100 % of returned codes exist in the table', () => (codesSeen > 0 && codesOk === codesSeen) || codesOk + '/' + codesSeen);
  await t('100 % of quotes verify at their offsets', () => (quotes > 0 && quotesOk === quotes) || quotesOk + '/' + quotes);
  await t('every response validates against the published schema', () => !schemaBad.length || schemaBad.slice(0, 3).join(' | '));
  await t('no gold note trips a clinical edit or a validation error other than NO_PRINCIPAL', () => {
    const bad = results.filter(({ r }) => r.json.coding_validation.errors.some(e => e.code !== 'NO_PRINCIPAL'))
      .map(({ n, r }) => n.id + ':' + r.json.coding_validation.errors.map(e => e.code).join(','));
    return !bad.length || bad.join(' ');
  });

  /* ---------- principal agreement ---------- */
  const labelled = results.filter(({ n }) => n.principal !== undefined);
  const agree = labelled.filter(({ n, r }) => (r.json.primary_diagnosis ? r.json.primary_diagnosis.icd_code : null) === n.principal);
  const reviewed = labelled.filter(({ n }) => n.principal_status === 'reviewed');
  const reviewedAgree = reviewed.filter(x => agree.includes(x));
  console.log('  principal agreement ' + agree.length + ' / ' + labelled.length + ' (' + pct(agree.length, labelled.length).toFixed(1) + '%) against labels that are '
    + (reviewed.length ? reviewed.length + ' reviewed, ' + (labelled.length - reviewed.length) + ' unreviewed' : 'all UNREVIEWED — reported, not treated as ground truth'));
  /* the same condition chosen, even where the engine picked a different
     member of its family: sequencing agreement as distinct from code choice */
  const agreeCat = labelled.filter(({ n, r }) => {
    const got = r.json.primary_diagnosis ? r.json.primary_diagnosis.icd_code : null;
    return got === n.principal || (got && n.principal && cat(got) === cat(n.principal));
  });
  console.log('  same condition as principal (3-character category) ' + agreeCat.length + ' / ' + labelled.length + ' (' + pct(agreeCat.length, labelled.length).toFixed(1) + '%)');
  labelled.filter(x => !agree.includes(x)).forEach(({ n, r }) => console.log('    ' + n.id + ' label ' + n.principal + ' · service ' + (r.json.primary_diagnosis ? r.json.primary_diagnosis.icd_code : 'none')));
  await t('every gold note carries a principal label and its review status', () => labelled.length === corpus.length && corpus.every(n => /^(reviewed|unreviewed)$/.test(n.principal_status)) || labelled.length);
  await t('reviewed principal labels agree at 95 % or more', () => !reviewed.length || pct(reviewedAgree.length, reviewed.length) >= 95 || reviewedAgree.length + '/' + reviewed.length);

  /* ---------- latency: 2,000-character notes, deterministic path ---------- */
  const long = [];
  for (let i = 0; long.length < 60; i++) {
    let s = '';
    for (let k = i; s.length < 2000; k++) s += corpus[k % corpus.length].note.replace(/Impression:/g, 'Finding:') + ' ';
    s = s.slice(0, 2000);
    long.push(s.slice(0, s.lastIndexOf('. ') + 1 || 2000) + ' Impression: ' + corpus[i % corpus.length].concepts[0] + '.');
  }
  for (let i = 0; i < 5; i++) await S.req('POST', '/v1/code-note', { clinical_note: long[i], encounter_type: 'outpatient' });
  const ms = [], server = [];
  for (const s of long) {
    const t0 = process.hrtime.bigint();
    const r = await S.req('POST', '/v1/code-note', { clinical_note: s, encounter_type: 'outpatient', options: { nphies: true } });
    ms.push(Number(process.hrtime.bigint() - t0) / 1e6);
    server.push(r.json.audit.ms);
  }
  const p95 = a => a.slice().sort((x, y) => x - y)[Math.ceil(a.length * 0.95) - 1];
  const avgLen = Math.round(long.reduce((s, x) => s + x.length, 0) / long.length);
  console.log('  latency, ' + long.length + ' notes of ~' + avgLen + ' characters: p95 ' + p95(ms).toFixed(1) + ' ms round trip, ' + p95(server).toFixed(1) + ' ms in the pipeline');
  await t('p95 is at most 300 ms for a 2,000-character note', () => p95(ms) <= 300 || p95(ms).toFixed(1) + ' ms');

  await S.stop();
  process.exit(done() ? 1 : 0);
})().catch(e => { console.log('ERR', e && e.stack); process.exit(1); });
