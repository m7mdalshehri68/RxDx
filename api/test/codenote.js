/* /v1/code-note over HTTP: the clinical edits, ambiguity, the closed code
   set, identifiers, feedback, the audit trail, NPHIES, security settings,
   the hospital configuration and the optional adjudicator. Every 200
   response is checked against the schema published in api/openapi.json. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { start, runner } = require('./_server.js');
const { validate } = require('./schema.js');

const { t, done } = runner('code-note');
const ARABIC = /[؀-ۿݐ-ݿࡰ-ࣿﭐ-﷿ﹰ-﻿]/;
const all = r => [r.primary_diagnosis].concat(r.secondary_diagnoses || []).filter(Boolean);
const codes = r => all(r).map(d => d.icd_code);
const errs = r => r.coding_validation.errors.map(e => e.code);
const warns = r => r.coding_validation.warnings.map(e => e.code);
const schemaOk = r => { const e = validate('CodeNoteResponse', r); return e.length ? e.slice(0, 3).join(' | ') : true; };
const note = (clinical_note, extra) => Object.assign({ clinical_note, encounter_type: 'outpatient' }, extra || {});

const STEMI = '55 y male with central chest pain radiating to the left arm. Known hypertension. ECG: ST elevation in II, III and aVF. '
  + 'Troponin I elevated. Impression: inferior STEMI. Aspirin 300 mg and clopidogrel 600 mg given, referred for primary PCI.';

(async () => {
  const A = await start(8811);

  /* ---------- the service ---------- */
  await t('health reports the pipeline and that no text is stored', async () => {
    const r = await A.req('GET', '/v1/health');
    return (r.json.storesClinicalText === false && r.json.codeNote && r.json.codeNote.pipeline && r.json.codeNote.formularyDrugs > 1000) || JSON.stringify(r.json.codeNote);
  });
  await t('the published specification carries the new paths and schemas', async () => {
    const r = await A.req('GET', '/openapi.json');
    return !!(r.json.paths['/v1/code-note'] && r.json.paths['/v1/feedback'] && r.json.components.schemas.CodeNoteResponse) || 'missing';
  });

  let stemi;
  await t('a STEMI note: principal I21.1 from the assessment, schema-valid', async () => {
    const r = await A.req('POST', '/v1/code-note', note(STEMI, { encounter_type: 'emergency', patient: { age_years: 55, sex: 'male' }, payer: 'bupa' }));
    stemi = r.json;
    if (r.status !== 200) return 'status ' + r.status;
    if (r.json.primary_diagnosis.icd_code !== 'I21.1') return 'principal ' + r.json.primary_diagnosis.icd_code;
    if (codes(r.json).indexOf('I10') < 0) return 'I10 missing';
    return schemaOk(r.json);
  });
  await t('descriptions are the table\'s and every quote sits at its offsets', async () => {
    const d = all(stemi);
    for (const x of d) {
      for (const e of x.evidence) if (STEMI.slice(e.start, e.end) !== e.quote) return 'quote mismatch for ' + x.icd_code;
    }
    return d[0].description === 'Acute transmural myocardial infarction of inferior wall' || d[0].description;
  });
  await t('the principal\'s reason names the rule and what it outranks', async () => {
    const r = stemi.primary_diagnosis.reason;
    return (/ACS 0001/.test(r) && /outranks I10/.test(r)) || r;
  });
  await t('the planned services are linked to the diagnoses that justify them', async () => {
    const m = stemi.medical_necessity;
    const pci = m.find(x => /PCI/.test(x.service)), asp = m.find(x => x.service === 'Aspirin');
    return (pci && pci.status === 'supported' && pci.supported_by[0] === 'I21.1' && asp && asp.status === 'supported') || JSON.stringify(m);
  });
  await t('the payer\'s requirements come back with what the note already answers', async () => {
    const p = stemi.payer_requirements;
    return (p.length > 0 && p.some(x => x.satisfied) && p.some(x => !x.satisfied)) || JSON.stringify(p);
  });
  await t('chest pain is left out as integral to the STEMI, and said so', async () => {
    return stemi.not_coded.some(n => n.reason === 'integral_symptom' && /chest pain/.test(n.mention)) || JSON.stringify(stemi.not_coded);
  });
  await t('the audit record names the content and engine versions', async () => {
    const a = stemi.audit;
    return (/table:16953\//.test(a.content_version) && /rxdx-engine\//.test(a.engine_version) && a.received_chars === STEMI.length && a.llm === null) || JSON.stringify(a);
  });

  /* ---------- clinical edits, one each ---------- */
  const BPH = 'Impression: benign prostatic hyperplasia with moderate symptoms. Started tamsulosin.';
  await t('edit: a male-only code on a female patient is an error', async () => {
    const r = await A.req('POST', '/v1/code-note', note(BPH, { patient: { age_years: 60, sex: 'female' } }));
    const e = r.json.coding_validation.errors.find(x => x.code === 'SEX_EDIT');
    return (r.json.coding_validation.valid === false && !!e && e.concerns === 'N40' && !!e.fix) || JSON.stringify(r.json.coding_validation);
  });
  await t('edit: a code outside its age band is an error', async () => {
    const r = await A.req('POST', '/v1/code-note', note(BPH, { patient: { age_years: 25, sex: 'male' } }));
    const e = r.json.coding_validation.errors.filter(x => x.code === 'AGE_EDIT');
    return (e.length === 1 && e[0].concerns === 'N40' && /30/.test(e[0].message)) || JSON.stringify(r.json.coding_validation);
  });
  await t('edit: an UnacceptPDx code is never sequenced principal', async () => {
    const r = await A.req('POST', '/v1/code-note', note('Impression: generalised osteoarthritis. Paracetamol regularly.', { patient: { age_years: 70, sex: 'female' } }));
    return (r.json.primary_diagnosis === null && codes(r.json).indexOf('M15.9') >= 0 && errs(r.json).indexOf('NO_PRINCIPAL') >= 0
      && r.json.clarification_required === true && schemaOk(r.json) === true) || JSON.stringify({ p: r.json.primary_diagnosis, c: codes(r.json), e: errs(r.json) });
  });
  await t('edit: an UnacceptPDx code offered as principal is refused by the validator', async () => {
    /* the validator, fed a principal it must refuse, whatever produced it */
    const { createPipeline } = require('../codenote/index.js');
    const P = createPipeline({ llm: null });
    const text = 'Impression: generalised osteoarthritis.';
    const doc = P.stages.normalize(text);
    const at = text.indexOf('generalised osteoarthritis');
    const res = { primary_diagnosis: { icd_code: 'M15.9', description: P.table.desc('M15.9'), coding_system: 'ICD-10-AM', status: 'confirmed',
      evidence: [{ quote: 'generalised osteoarthritis', start: at, end: at + 26, section: 'assessment' }], reason: 'x', source: 'llm', confidence: 0.5 },
      secondary_diagnoses: [], not_coded: [], medical_necessity: [], documentation_gaps: [] };
    const v = P.validator.run(res, { doc, patient: {} });
    return (v.valid === false && v.errors.some(e => e.code === 'PDX_NOT_ACCEPTABLE' && e.concerns === 'M15.9')) || JSON.stringify(v.errors);
  });
  await t('edit: a neoplasm without histology is flagged and queried', async () => {
    const r = await A.req('POST', '/v1/code-note', note('Impression: breast cancer, awaiting biopsy. Referred to oncology.', { patient: { age_years: 50, sex: 'female' } }));
    const g = r.json.documentation_gaps.find(x => x.concerns === 'C50.9' && /histology/.test(x.missing));
    return (warns(r.json).indexOf('MORPHOLOGY_REQUIRED') >= 0 && g && /Other \(please specify\)/.test(g.physician_query) && /Cannot be determined/.test(g.physician_query)) || JSON.stringify(r.json.documentation_gaps);
  });
  await t('edit: an asterisk code without its dagger is an error', async () => {
    const r = await A.req('POST', '/v1/code-note', note('Impression: anaemia of chronic kidney disease. Started iron.', { patient: { age_years: 70, sex: 'male' } }));
    const e = r.json.coding_validation.errors.find(x => x.code === 'ASTERISK_WITHOUT_DAGGER');
    return (e && e.concerns === 'D63' && r.json.primary_diagnosis === null) || JSON.stringify(r.json.coding_validation.errors);
  });

  /* ---------- ambiguity ---------- */
  await t('two conditions named as equals: clarification with a specific question', async () => {
    const r = await A.req('POST', '/v1/code-note', note('Fever and dysuria with a productive cough for 3 days. Impression: community acquired pneumonia and urinary tract infection. Started amoxicillin and nitrofurantoin.', { options: { nphies: true } }));
    const c = r.json.clarifications[0] || {};
    return (r.json.clarification_required === true && c.type === 'principal_ambiguous' && /pneumonia/.test(c.question) && /urinary tract infection/.test(c.question)
      && c.options.length >= 3 && r.json.primary_diagnosis.status === 'provisional' && r.json.nphies === null && schemaOk(r.json) === true) || JSON.stringify(r.json.clarifications);
  });
  await t('a subordinate second condition ("with") is not ambiguous', async () => {
    const r = await A.req('POST', '/v1/code-note', note('Impression: severe community acquired pneumonia with type 1 respiratory failure. Admitted, IV co-amoxiclav.', { encounter_type: 'emergency' }));
    return (r.json.clarification_required === false && r.json.primary_diagnosis.icd_code === 'J18.9') || JSON.stringify([r.json.primary_diagnosis && r.json.primary_diagnosis.icd_code, r.json.clarifications]);
  });
  await t('a note too thin to code asks the physician', async () => {
    const r = await A.req('POST', '/v1/code-note', note('Seen today.'));
    return (r.json.clarification_required && r.json.primary_diagnosis === null && r.json.clarifications[0].type === 'insufficient_documentation') || JSON.stringify(r.json.clarifications);
  });

  /* ---------- the closed code set ---------- */
  await t('a note seeded with ICD-10-CM codes returns none of them', async () => {
    const CM = ['I50.21', 'I50.31', 'R51.9', 'Z79.4', 'E78.49', 'M54.50', 'Z79.84', 'N18.30'];
    const { createPipeline } = require('../codenote/index.js');
    const T = createPipeline({ llm: null }).table;
    const inTable = CM.filter(c => T.has(c));
    if (inTable.length) return 'test codes unexpectedly in the table: ' + inTable.join(',');
    const text = 'Assessment: I50.21 acute systolic heart failure (I50.21), R51.9 headache, Z79.4 long term insulin, E78.49 hyperlipidaemia, M54.50, Z79.84, N18.30. '
      + 'Codes from the referral letter: I50.31; I50.21. Plan: furosemide.';
    const r = await A.req('POST', '/v1/code-note', note(text, { options: { nphies: true } }));
    const body = JSON.stringify({ d: all(r.json), n: r.json.not_coded, m: r.json.medical_necessity, g: r.json.documentation_gaps, x: r.json.nphies });
    const leaked = CM.filter(c => new RegExp('"' + c.replace('.', '\\.') + '"').test(body) || codes(r.json).indexOf(c) >= 0);
    return (!leaked.length && codes(r.json).every(c => T.has(c))) || 'leaked ' + leaked.join(',');
  });
  await t('a request asking for another coding system is refused', async () => {
    const r = await A.req('POST', '/v1/code-note', note('Impression: pneumonia.', { coding_system: 'ICD-10-CM' }));
    return (r.status === 400 && r.json.error.code === 'unsupported_coding_system') || r.status;
  });

  /* ---------- documented facts only ---------- */
  await t('negated, ruled out, family, hypothetical and uncertain are never coded', async () => {
    const text = 'Chest pain for 2 hours. No myocardial infarction. CT ruled out pulmonary embolism. Mother has breast cancer. '
      + 'Father had a stroke. Risk of diabetes discussed. Impression: musculoskeletal chest pain. Suspected pneumonia, chest X-ray requested. Plan: ibuprofen.';
    const r = await A.req('POST', '/v1/code-note', note(text, { encounter_type: 'emergency' }));
    const bad = codes(r.json).filter(c => /^(I21|I26|C50|I64|I63|E11|E14|I30)/.test(c));
    const reasons = new Set(r.json.not_coded.map(n => n.reason));
    const want = ['negated', 'ruled_out', 'family_history', 'uncertain'].filter(x => !reasons.has(x));
    return (!bad.length && !want.length && warns(r.json).indexOf('UNCERTAIN_DIAGNOSIS') >= 0) || JSON.stringify({ bad, want, nc: r.json.not_coded.map(n => n.mention + ':' + n.reason) });
  });
  await t('conditions under a "Family history:" heading are a relative\'s', async () => {
    const text = 'CC: cough\nHPI: 3 days of productive cough and fever.\nFamily history:\nType 2 diabetes, hypertension, asthma\nAssessment: community acquired pneumonia\nPlan: amoxicillin';
    const r = await A.req('POST', '/v1/code-note', note(text));
    const bad = codes(r.json).filter(c => /^(E11|I10|J45)/.test(c));
    return (!bad.length && r.json.primary_diagnosis.icd_code === 'J18.9' && r.json.not_coded.some(n => n.reason === 'family_history')) || JSON.stringify({ bad, nc: r.json.not_coded });
  });
  await t('history is coded only when it still affects the encounter (ACS 0002)', async () => {
    const a = await A.req('POST', '/v1/code-note', note('History of atrial fibrillation, on warfarin. Impression: community acquired pneumonia. Started amoxicillin.'));
    const b = await A.req('POST', '/v1/code-note', note('Previous appendicitis. Impression: community acquired pneumonia. Started amoxicillin.'));
    const af = a.json.secondary_diagnoses.find(d => d.icd_code === 'I48.9');
    return (af && af.affects.indexOf('treatment') >= 0 && codes(b.json).join() === 'J18.9'
      && b.json.not_coded.some(n => n.reason === 'historical_no_impact' && /appendicitis/.test(n.mention))) || JSON.stringify([codes(a.json), codes(b.json), b.json.not_coded]);
  });
  await t('Arabic in the note is ignored for coding and never reaches a claim field', async () => {
    const text = 'Impression: community acquired pneumonia. المريض يعاني من سعال. Started amoxicillin.';
    const r = await A.req('POST', '/v1/code-note', note(text));
    const claim = JSON.stringify({ d: all(r.json).map(d => [d.icd_code, d.description, d.reason, d.evidence.map(e => e.quote)]), s: r.json.encounter_summary,
                                   m: r.json.medical_necessity, g: r.json.documentation_gaps });
    return (r.json.primary_diagnosis.icd_code === 'J18.9' && !ARABIC.test(claim) && r.json.audit.arabic_chars_ignored > 0 && schemaOk(r.json) === true) || claim.slice(0, 300);
  });

  /* ---------- identity ---------- */
  const IDENT = [
    ['a name', 'Mr Khalid presented with cough. Impression: pneumonia.'],
    ['a national ID', 'ID 1087654321. Impression: pneumonia.'],
    ['an Iqama number', 'Iqama 2345678901, cough for 3 days. Impression: pneumonia.'],
    ['an MRN', 'MRN: 00123456. Impression: pneumonia.'],
    ['a phone number', 'Call back on 0551234567. Impression: pneumonia.']
  ];
  for (const [what, text] of IDENT) {
    await t('422 for ' + what + ' in the note, without repeating it', async () => {
      const r = await A.req('POST', '/v1/code-note', note(text));
      const leaked = /Khalid|1087654321|2345678901|00123456|0551234567/.test(r.text);
      return (r.status === 422 && r.json.error.code === 'identifier_present' && !leaked) || r.status + ' ' + r.text.slice(0, 200);
    });
  }
  await t('422 for identity fields, anywhere', async () => {
    const a = await A.req('POST', '/v1/code-note', note('Impression: pneumonia.', { patient: { age_years: 40, sex: 'male', name: 'X' } }));
    const b = await A.req('POST', '/v1/code-note', Object.assign(note('Impression: pneumonia.'), { national_id: '1087654321' }));
    const c = await A.req('POST', '/v1/code-note', Object.assign(note('Impression: pneumonia.'), { mrn: '123' }));
    return (a.status === 422 && b.status === 422 && c.status === 422 && !/1087654321/.test(b.text)) || [a.status, b.status, c.status].join(',');
  });
  await t('an unknown field is refused, not silently ignored', async () => {
    const r = await A.req('POST', '/v1/code-note', Object.assign(note('Impression: pneumonia.'), { icd_version: 'CM' }));
    return (r.status === 400 && r.json.error.code === 'unknown_field') || r.status;
  });
  await t('a missing encounter type is a 400 with the valid values', async () => {
    const r = await A.req('POST', '/v1/code-note', { clinical_note: 'Impression: pneumonia.' });
    return (r.status === 400 && /outpatient/.test(r.json.error.message)) || r.status;
  });
  await t('a note over the size limit is refused with 413', async () => {
    const big = 'Impression: pneumonia. ' + 'x'.repeat(270 * 1024);
    const r = await A.req('POST', '/v1/code-note', note(big));
    return r.status === 413 || r.status;
  });
  await t('invalid JSON is a 400 with no stack trace', async () => {
    const r = await A.req('POST', '/v1/code-note', '{"clinical_note": "pneumonia", ');
    return (r.status === 400 && !/at [A-Za-z].*\(.*:\d+:\d+\)/.test(r.text) && !/SyntaxError/.test(r.text)) || r.text;
  });

  /* ---------- NPHIES ---------- */
  await t('NPHIES Claim.diagnosis entries come from the configuration', async () => {
    const r = await A.req('POST', '/v1/code-note', note(STEMI, { encounter_type: 'emergency', options: { nphies: true } }));
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'nphies.config.json'), 'utf8'));
    const d = (r.json.nphies || {}).diagnosis || [];
    return (d.length === all(r.json).length && d[0].sequence === 1 && d[0].type[0].coding[0].code === cfg.principalType
      && d[1].type[0].coding[0].code === cfg.secondaryType && d[0].diagnosisCodeableConcept.coding[0].system === cfg.diagnosisSystem
      && d[0].diagnosisCodeableConcept.coding[0].code === 'I21.1' && schemaOk(r.json) === true) || JSON.stringify(r.json.nphies);
  });

  /* ---------- batch ---------- */
  await t('batch: each note answered in order, errors per note, schema-valid', async () => {
    const r = await A.req('POST', '/v1/code-note/batch', { defaults: { encounter_type: 'outpatient' }, notes: [
      { id: 'a', clinical_note: STEMI, encounter_type: 'emergency' },
      { id: 'b', clinical_note: 'Mr Khalid. Impression: pneumonia.' },
      { id: 'c' },
      { id: 'd', clinical_note: 'Impression: essential hypertension, controlled. Continue ramipril.' }] });
    const [a, b, c, d] = r.json.results;
    return (r.status === 200 && a.id === 'a' && a.primary_diagnosis.icd_code === 'I21.1' && b.error.code === 'identifier_present'
      && c.error.code === 'missing_clinical_note' && d.primary_diagnosis.icd_code === 'I10'
      && validate('CodeNoteResponse', Object.assign({}, a, { id: undefined })).filter(x => !/unexpected property id/.test(x)).length === 0) || JSON.stringify(r.json).slice(0, 400);
  });
  await t('batch: more than 200 notes is refused', async () => {
    const notes = Array.from({ length: 201 }, (_, i) => ({ id: String(i), clinical_note: 'Impression: pneumonia.' }));
    const r = await A.req('POST', '/v1/code-note/batch', { defaults: { encounter_type: 'outpatient' }, notes });
    return r.status === 413 || r.status;
  });

  /* ---------- feedback and the audit trail ---------- */
  await t('feedback is stored as codes only and exported for the Coder Review queue', async () => {
    const r1 = await A.req('POST', '/v1/feedback', { request_id: stemi.request_id, code: 'I21.1', decision: 'accept', reason: 'correct' });
    const r2 = await A.req('POST', '/v1/feedback', { request_id: stemi.request_id, code: 'I10', decision: 'reject', reason: 'not_documented' });
    const ex = await A.req('GET', '/v1/feedback');
    const q = ex.json.review_queue.find(x => x.code === 'I10');
    return (r1.status === 201 && r1.json.code_was_returned && r2.status === 201 && q && q.bucket === 'doc'
      && validate('FeedbackResponse', r1.json).length === 0 && !/chest pain|STEMI|hypertension/i.test(ex.text)) || [r1.status, r2.status, ex.text.slice(0, 200)].join(' ');
  });
  await t('feedback refuses free text, unknown reasons and codes outside the table', async () => {
    const a = await A.req('POST', '/v1/feedback', { request_id: stemi.request_id, code: 'I10', decision: 'reject', reason: 'other', comment: 'patient said...' });
    const b = await A.req('POST', '/v1/feedback', { request_id: stemi.request_id, code: 'I10', decision: 'reject', reason: 'the patient told me' });
    const c = await A.req('POST', '/v1/feedback', { request_id: stemi.request_id, code: 'I50.21', decision: 'reject', reason: 'wrong_code' });
    return (a.status === 400 && b.status === 400 && c.status === 422) || [a.status, b.status, c.status].join(',');
  });
  await t('the audit record of a request holds codes, versions and timings only', async () => {
    const r = await A.req('GET', '/v1/audit/' + stemi.request_id);
    return (r.status === 200 && r.json.principal === 'I21.1' && r.json.codes.indexOf('I10') >= 0 && r.json.received_chars === STEMI.length
      && !/chest|STEMI|aspirin/i.test(r.text)) || r.text.slice(0, 300);
  });
  await t('the log line holds the request id, character count, codes and timings — and no text', async () => {
    const line = A.logs.find(l => l.indexOf(stemi.request_id) >= 0 && l.indexOf('/v1/code-note') >= 0);
    if (!line) return 'no log line';
    const o = JSON.parse(line);
    return (o.chars === STEMI.length && o.codes.indexOf('I21.1') >= 0 && typeof o.ms === 'number' && !/chest|STEMI|aspirin|hypertension/i.test(line)) || line;
  });
  await t('existing endpoint /v1/code still answers as before', async () => {
    const r = await A.req('POST', '/v1/code', { text: 'Community acquired pneumonia. No myocardial infarction.' });
    return (r.status === 200 && r.json.principal[0].code === 'J18.9' && r.json.mentionedButNotCoded.some(x => x.code === 'I21.9')) || r.text.slice(0, 200);
  });
  await A.stop();

  /* ---------- security settings ---------- */
  await t('outside demo mode the service will not start without an API key', async () => {
    const S = await start(8812, { RXDX_PUBLIC_DEMO: '0', RXDX_API_KEY: '' });
    await new Promise(r => setTimeout(r, 300));
    const refused = S.logs.some(l => /refused_to_start/.test(l));
    await S.stop();
    return (refused && S.exitCode === 1) || S.logs.join('\n');
  });
  await t('with a key, /v1/code-note needs X-API-Key', async () => {
    const S = await start(8813, { RXDX_PUBLIC_DEMO: '0', RXDX_API_KEY: 'k-test-123' });
    const a = await S.req('POST', '/v1/code-note', note('Impression: pneumonia.'));
    const b = await S.req('POST', '/v1/code-note', note('Impression: pneumonia.'), { 'X-API-Key': 'k-test-123' });
    const c = await S.req('POST', '/v1/code-note', note('Impression: pneumonia.'), { 'X-API-Key': 'wrong' });
    await S.stop();
    return (a.status === 401 && b.status === 200 && c.status === 401) || [a.status, b.status, c.status].join(',');
  });
  await t('CORS answers only the origins on the allowlist', async () => {
    const S = await start(8814, { RXDX_ALLOW_ORIGINS: 'https://coder.hospital.local' });
    const ok = await S.req('POST', '/v1/code-note', note('Impression: pneumonia.'), { Origin: 'https://coder.hospital.local' });
    const no = await S.req('POST', '/v1/code-note', note('Impression: pneumonia.'), { Origin: 'https://elsewhere.example' });
    await S.stop();
    return (ok.headers.get('access-control-allow-origin') === 'https://coder.hospital.local' && !no.headers.get('access-control-allow-origin')) || 'cors';
  });

  /* ---------- the hospital's configuration ---------- */
  await t('RXDX_CONFIG: switched-off codes and hospital defaults apply to /v1/code-note', async () => {
    const f = path.join(os.tmpdir(), 'rxdx-config-test-' + process.pid + '.json');
    fs.writeFileSync(f, JSON.stringify({ product: 'RxDx', kind: 'configuration', facility: 'TEST', cfg: {},
      itc: { v: 1, off: { cc: [], tool: [], moh: [], mds: [], ix: [], icd: ['U78.1'] },
             defaults: [{ p: 'diabetes', c: 'E11.9', n: 'type 2 unless stated' }], rules: [], integ: {}, meta: { rev: 4 } } }));
    const S = await start(8815, { RXDX_CONFIG: f });
    const r = await S.req('POST', '/v1/code-note', note('Obesity, BMI 41. Known diabetes. Impression: obesity. Dietitian referral.'));
    const h = await S.req('GET', '/v1/health');
    await S.stop();
    fs.unlinkSync(f);
    const c = codes(r.json);
    const gap = r.json.documentation_gaps.find(g => g.concerns === 'E11.9' && /type of diabetes/.test(g.missing));
    return (c.indexOf('U78.1') < 0 && c.indexOf('E66.90') >= 0 && c.indexOf('E11.9') >= 0 && warns(r.json).indexOf('SPECIFICITY_NOT_SUPPORTED') >= 0 && gap
      && h.json.codeNote.configuration.revision === 4 && /config:rev4\//.test(r.json.audit.content_version)) || JSON.stringify({ c, w: warns(r.json), cfg: h.json.codeNote.configuration });
  });

  /* ---------- the optional adjudicator ---------- */
  let mode = 'good', seen = [];
  const fake = http.createServer((q, s) => {
    let b = ''; q.on('data', c => { b += c; }); q.on('end', () => {
      seen.push(b);
      const send = o => { s.writeHead(200, { 'Content-Type': 'application/json' }); s.end(JSON.stringify(o)); };
      if (mode === 'slow') return setTimeout(() => send({}), 4000);
      if (mode === 'good') return send({ output: { principal: { icd_code: 'E11.9', quote: 'type 2 diabetes' },
        replacements: [{ engine_code: 'E11.9', icd_code: 'E11.40', quote: 'diabetic peripheral neuropathy' }], additions: [], clarification_required: false, clarification_question: '' } });
      if (mode === 'cm') return send({ principal: { icd_code: 'I50.21', quote: 'burning pain' }, replacements: [{ engine_code: 'E11.9', icd_code: 'E11.65', quote: 'HbA1c 9.1%' }],
        additions: [{ mention: 'neuropathy', icd_code: 'G63.2', quote: 'neuropathy' }], clarification_required: false, clarification_question: '' });
      return send({ nonsense: true });
    });
  });
  await new Promise(r => fake.listen(0, '127.0.0.1', r));
  const N33 = '55 y male with burning pain in both feet at night for 2 years, worse in bed. Known type 2 diabetes for 12 years, HbA1c 9.1%. '
    + 'Reduced pinprick and vibration to mid-calf. No ulcer, no ischaemia, pedal pulses present. Impression: diabetic peripheral neuropathy. Started pregabalin. سكري';
  const L = await start(8816, { RXDX_LLM_PROVIDER: 'hospital', RXDX_LLM_URL: 'http://127.0.0.1:' + fake.address().port + '/adjudicate', RXDX_LLM_TIMEOUT_MS: '1500' });
  await t('adjudicator: a specific candidate stated verbatim replaces the engine code', async () => {
    mode = 'good';
    const r = await L.req('POST', '/v1/code-note', note(N33, { options: { use_llm: true } }));
    const p = r.json.primary_diagnosis;
    return (p.icd_code === 'E11.40' && p.source === 'engine+llm' && r.json.audit.llm.used === true && warns(r.json).indexOf('LLM_DISAGREES_WITH_ENGINE') >= 0
      && schemaOk(r.json) === true) || JSON.stringify({ p: p && p.icd_code, llm: r.json.audit.llm, w: warns(r.json) });
  });
  await t('adjudicator: codes outside the candidates or the table are rejected', async () => {
    mode = 'cm';
    const r = await L.req('POST', '/v1/code-note', note(N33, { options: { use_llm: true } }));
    const c = codes(r.json);
    return (c.indexOf('I50.21') < 0 && c.indexOf('E11.65') < 0 && c.indexOf('G63.2') < 0 && c[0] === 'E11.9' && r.json.audit.llm.rejected === 3) || JSON.stringify({ c, llm: r.json.audit.llm });
  });
  await t('adjudicator: a malformed answer falls back to the engine with a warning', async () => {
    mode = 'junk';
    const r = await L.req('POST', '/v1/code-note', note(N33, { options: { use_llm: true } }));
    return (r.json.primary_diagnosis.icd_code === 'E11.9' && r.json.primary_diagnosis.source === 'engine' && warns(r.json).indexOf('LLM_UNAVAILABLE') >= 0) || JSON.stringify(r.json.audit.llm);
  });
  await t('adjudicator: a hard timeout returns the engine result', async () => {
    mode = 'slow';
    const t0 = Date.now();
    const r = await L.req('POST', '/v1/code-note', note(N33, { options: { use_llm: true } }));
    const ms = Date.now() - t0;
    return (r.json.audit.llm.outcome === 'timeout' && ms < 3000 && r.json.primary_diagnosis.icd_code === 'E11.9') || JSON.stringify({ ms, llm: r.json.audit.llm });
  });
  await t('adjudicator: only de-identified text without Arabic leaves the server', async () => {
    const sent = seen.join('\n');
    return (seen.length >= 4 && !ARABIC.test(sent) && /de-identified/.test(sent) && /diabetic peripheral neuropathy/.test(sent)) || 'sent ' + seen.length;
  });
  await t('use_llm is refused in batch', async () => {
    const r = await L.req('POST', '/v1/code-note/batch', { defaults: { encounter_type: 'outpatient', options: { use_llm: true } }, notes: [{ clinical_note: 'Impression: pneumonia.' }] });
    return r.status === 400 || r.status;
  });
  await L.stop();
  fake.close();
  await t('adjudicator: a public host without a data processing agreement is never called', async () => {
    const S = await start(8817, { RXDX_LLM_PROVIDER: 'hospital', RXDX_LLM_URL: 'https://llm.example.com/v1' });
    const h = await S.req('GET', '/v1/health');
    const r = await S.req('POST', '/v1/code-note', note('Impression: pneumonia.', { options: { use_llm: true } }));
    await S.stop();
    return (h.json.codeNote.llm.status === 'not_permitted_public_host' && r.json.audit.llm.used === false && warns(r.json).indexOf('LLM_UNAVAILABLE') >= 0) || JSON.stringify(h.json.codeNote.llm);
  });
  await t('adjudicator: the Anthropic API is never called without a data processing agreement', async () => {
    const S = await start(8818, { RXDX_LLM_PROVIDER: 'anthropic', RXDX_LLM_DPA: '' });
    const h = await S.req('GET', '/v1/health');
    await S.stop();
    return h.json.codeNote.llm.status === 'not_permitted_no_dpa' || JSON.stringify(h.json.codeNote.llm);
  });

  process.exit(done() ? 1 : 0);
})().catch(e => { console.log('ERR', e && e.stack); process.exit(1); });
