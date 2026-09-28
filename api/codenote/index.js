/* ══════════════════════════════════════════════════════════════════════
   /v1/code-note — the coding pipeline

     1 normalize    sections, abbreviations, Arabic set aside
     2 extract      the RxDx engine (authoritative): codes, assertion, spans
     3 candidates   table-only alternatives where the engine was unspecific
     4 adjudicate   optional LLM proposal, off by default, validated or dropped
     5 sequence     ACS 0001 principal, ACS 0002 additional
     6 necessity    planned services → the diagnoses that justify them
     7 validate     closed code set, verbatim evidence, clinical edits
     8 assemble     the response and its audit record

   Each stage is a function on the object `stages`; any one of them can be
   replaced by passing a different function to createPipeline. Nothing here
   writes the note anywhere. It lives in `doc` for the length of one call.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const engine = require('../engine.js');
const { createTable } = require('./table.js');
const { normalize } = require('./normalize.js');
const { createExtractor } = require('./extract.js');
const { createCandidates } = require('./candidates.js');
const { createSequencer, SEPSIS } = require('./sequence.js');
const { createNecessity, loadCatalogue } = require('./necessity.js');
const { createGaps } = require('./gaps.js');
const { createValidator } = require('./validate.js');
const { loadFormulary, createMedicationReader } = require('./formulary.js');
const confidence = require('./confidence.js');
const { loadNphiesConfig, claimDiagnosis } = require('./nphies.js');
const { createLlm } = require('../llm/index.js');
const { createAdjudicator } = require('./adjudicate.js');

const VERSION = '1.1.0';
const ENCOUNTERS = ['outpatient', 'emergency', 'inpatient', 'day_case'];
const ADMITTED = { inpatient: 1, day_case: 1 };
const REASON = { negated: 'negated', ruled_out: 'ruled_out', family: 'family_history', historical: 'historical_no_impact',
                 uncertain: 'uncertain', hypothetical: 'hypothetical' };
const SECTIONS = ['complaint', 'hpi', 'pmh', 'medications', 'allergies', 'family_history', 'social_history', 'examination',
                  'investigations', 'assessment', 'plan', 'other'];

function sha(s, n) { return crypto.createHash('sha256').update(s).digest('hex').slice(0, n || 12); }

function createPipeline(opts) {
  opts = opts || {};
  const info = engine.load();
  const rx = info.rx;
  const DATA = path.join(__dirname, '..', '..', 'data');
  const formulary = opts.formulary !== undefined ? opts.formulary : loadFormulary(DATA);
  const table = createTable(rx, { formularyAges: formulary ? formulary.ages : [] });
  const extractor = createExtractor(engine, table);
  const cands = createCandidates(table);
  const sequencer = createSequencer(table, rx);
  const gaps = createGaps(table);
  const catalogue = loadCatalogue(opts.servicesFile);
  const icdWords = new Set();
  Object.keys(rx.ICD_MAP).forEach(c => table.words(rx.ICD_MAP[c].ascii_desc).forEach(w => icdWords.add(w)));
  const medications = createMedicationReader(engine, formulary, icdWords);
  const necessity = createNecessity(engine, table, extractor, medications, catalogue);
  const validator = createValidator(table, extractor);
  const calibration = confidence.loadCalibration(opts.calibrationFile);
  const nphiesCfg = loadNphiesConfig(opts.nphiesFile);
  /* the optional adjudicator: null when not configured, or the reason it may not run */
  const llm = opts.llm !== undefined ? opts.llm : createLlm();
  const llmStatus = !llm ? 'off' : (llm.unavailable || 'ready');
  const adjudicator = llm && !llm.unavailable ? createAdjudicator(llm, { table, candidates: cands }) : null;
  let itc = {};
  try { itc = rx.itcLoad() || {}; } catch (_) {}
  const policy = String(process.env.RXDX_UNCERTAIN_POLICY || (itc.coding && itc.coding.uncertain_diagnosis_policy) || 'code_as_established');
  const offMds = ((itc.off || {}).mds || []).slice();

  const htmlFile = process.env.RXDX_HTML || path.join(__dirname, '..', '..', 'index.html');
  let htmlSha = 'unknown';
  try { htmlSha = sha(fs.readFileSync(htmlFile)); } catch (_) {}
  const contentVersion = [info.contentVersion, 'table:' + table.size + '/' + table.fingerprint,
    'services:' + catalogue.version, 'config:' + (info.config ? 'rev' + info.config.revision + '/' + info.config.sha256 : 'none')].join(' | ');
  const engineVersion = 'rxdx-engine/' + htmlSha + ' pipeline/' + VERSION;

  /* the vocabulary's abbreviations, expanded to the code description they map to */
  const abbr = Object.create(null);
  rx._buildNoteIndexes().probTerms.forEach(t => {
    if (t.term.length <= 5 && /^[a-z0-9]+$/.test(t.term) && rx.ICD_MAP[t.code]) abbr[t.term] = rx.ICD_MAP[t.code].ascii_desc;
  });

  /* ══════════════════════════ the stages ══════════════════════════ */
  const stages = Object.assign({
    normalize: (note) => normalize(note, { abbr }),

    extract: (doc) => extractor.extract(doc),

    candidates: (doc, coded, refused, max) => {
      const covered = [];
      coded.forEach(c => (c.allSpans || c.spans).forEach(s => covered.push(s)));
      refused.forEach(r => covered.push(r));
      const unresolved = cands.unresolved(doc, covered, max);
      const byCode = Object.create(null);
      coded.forEach(c => {
        const root = c.code.split('.')[0];
        const related = unresolved.filter(u => u.candidates.some(k => k.split('.')[0] === root));
        const ctx = c.spans.map(s => rx._stSentence(doc.text, s.start)).concat(related.map(u => u.phrase)).join(' ');
        byCode[c.code] = Object.assign(cands.forCondition(c, ctx, max), { related });
      });
      return { byCode, unresolved };
    },

    /* replaced by ../llm when the caller asks for it and the service allows it */
    adjudicate: async () => null,

    sequence: (doc, coded, encounter) => sequencer.choose(doc, coded, encounter),

    necessity: (doc) => necessity.detect(doc),

    validate: (res, ctx) => validator.run(res, ctx)
  }, opts.stages || {});

  /* ══════════════════════════ one request ══════════════════════════ */
  async function run(req, runOpts) {
    runOpts = runOpts || {};
    const T = {};
    const t0 = process.hrtime.bigint();
    const lap = (k, since) => { T[k] = Math.round(Number(process.hrtime.bigint() - since) / 1e4) / 100; };
    const o = Object.assign({ use_llm: false, max_candidates: 5, include_not_coded: true, nphies: false }, req.options || {});
    const encounter = req.encounter_type;
    const patient = req.patient || {};
    const admitted = !!ADMITTED[encounter];

    let s = process.hrtime.bigint();
    const doc = stages.normalize(req.clinical_note);
    lap('normalize', s);

    s = process.hrtime.bigint();
    const ext = stages.extract(doc);
    lap('extract', s);

    /* engine symptoms beside a diagnosis are integral; engine diagnoses are coded */
    let coded = ext.conditions.filter(c => c.enginePrincipal);
    const integral = ext.conditions.filter(c => !c.enginePrincipal);
    const refused = ext.refused.slice();

    /* uncertain diagnoses: symptoms for non-admitted; policy for admitted */
    const uncertainNotes = [];
    refused.filter(r => r.assertion === 'uncertain').forEach(r => {
      const code = (r.codes || []).find(c => table.has(c));
      if (admitted && policy === 'code_as_established' && code && !coded.some(c => c.code === code)) {
        const span = { code, term: r.mention, start: r.start, end: r.end, quote: r.mention, section: r.section, engineActive: false, assertion: 'uncertain' };
        coded.push({ code, term: r.mention.toLowerCase(), engine: { conf: null }, named: r.section === 'assessment', symptom: rx._stIsSymptom(code),
                     enginePrincipal: true, spans: [span], allSpans: [span], assertion: 'uncertain', firstAt: r.start, status: 'uncertain' });
        r.promoted = true;
      } else {
        uncertainNotes.push({ mention: r.mention, cue: r.cue, coded: coded.some(c => rx._stIsSymptom(c.code)) || integral.length > 0 });
      }
    });

    s = process.hrtime.bigint();
    const svc = stages.necessity(doc);
    lap('necessity_detect', s);

    /* ACS 0002: a condition written as history is still coded when it still
       affects this encounter — a medicine indicated for it is being taken or
       given, or the assessment or plan deals with it ("history of atrial
       fibrillation, on warfarin"). Otherwise it stays in not_coded. */
    const meds = svc.current.concat(svc.planned).filter(x => x.kind === 'medication');
    (ext.dropped || []).filter(c => c.assertion === 'historical').forEach(c => {
      const root = c.code.split('.')[0];
      /* a medicine counts only when no current diagnosis already explains it:
         amoxicillin for today's pneumonia does not treat an old appendicitis */
      const treated = meds.some(m => m.roots && m.roots.has(root)
        && !coded.some(k => m.roots.has(k.code.split('.')[0])));
      const dealtWith = (c.allSpans || []).some(sp => sp.section === 'assessment' || sp.section === 'plan');
      if (!treated && !dealtWith) return;
      const hist = (c.allSpans || []).filter(sp => sp.engineActive);
      c.spans = hist.length ? hist : c.spans;
      c.assertion = 'present';
      c.historyWithImpact = treated ? 'treatment' : 'monitoring';
      (c.enginePrincipal ? coded : integral).push(c);
      for (let i = refused.length - 1; i >= 0; i--) if (refused[i].droppedByPipeline && refused[i].codes.indexOf(c.code) >= 0) refused.splice(i, 1);
    });

    s = process.hrtime.bigint();
    const cand = stages.candidates(doc, coded, refused, Math.max(1, Math.min(10, o.max_candidates | 0 || 5)));
    lap('candidates', s);

    /* ---------- sequence ---------- */
    s = process.hrtime.bigint();
    let seq = stages.sequence(doc, coded, encounter);
    const principalCond = seq.principal;

    /* ---------- medical necessity ---------- */
    const order = () => [principalCond].concat(coded.filter(c => c !== principalCond)).filter(Boolean);
    let links = necessity.link(svc.planned, order(), refused.concat(integral.map(c => ({ codes: [c.code], mention: (c.spans[0] || {}).quote || c.term }))));
    /* a symptom is kept only when it is the one thing that justifies a planned test */
    const keptForNecessity = [];
    links.forEach(l => {
      if (l.status === 'supported' || l.kind === 'medication') return;
      const sym = integral.find(c => necessity.justifies(l.span, c.code) && keptForNecessity.indexOf(c) < 0 && !coded.includes(c));
      if (sym) {
        keptForNecessity.push(sym); coded.push(sym);
        Object.assign(sym, { keptFor: l.service, background: false, assessmentAt: null, eligible: sequencer.eligible(sym) });
      }
    });
    if (keptForNecessity.length) links = necessity.link(svc.planned, order(), refused);
    const additional = sequencer.additional(doc, coded, principalCond, links, svc.current.concat(svc.planned.filter(p => p.kind === 'medication')));
    lap('sequence', s);

    /* ---------- specificity, gaps ---------- */
    const specific = [], unsupportedSpec = [], documentationGaps = [], morph = Object.create(null);
    [principalCond].concat(additional).filter(Boolean).forEach(c => {
      const k = cand.byCode[c.code] || { candidates: [], related: [] };
      const doc1 = (k.candidates || []).find(x => x.documented);
      if (doc1) {
        const q = (k.related[0] && k.related[0].phrase) || (c.spans[0] || {}).quote || c.term;
        specific.push({ code: c.code, better: doc1.code, quote: q });
      }
      const ctxText = c.spans.map(sp => rx._stSentence(doc.text, sp.start)).join(' ');
      const g = gaps.specificity(c, k.candidates, ctxText);
      if (g) documentationGaps.push(g);
      const u = gaps.unsupported(c, ctxText, doc.text);
      if (u) { unsupportedSpec.push({ code: c.code, axis: u.axis, quote: u.quote }); documentationGaps.push(u.gap); }
      const m = gaps.morphology(c, doc.text);
      if (m) { morph[c.code] = m; if (m.gap) documentationGaps.push(m.gap); }
    });
    const injuries = [principalCond].concat(additional).filter(c => c && table.isInjury(c.code));
    const ec = gaps.externalCause(injuries, [principalCond].concat(additional).filter(Boolean).map(c => c.code), doc.text, encounter) || [];
    const externalCause = ec.map(x => Object.assign({ concerns: injuries[0] && injuries[0].code }, x));
    externalCause.filter(x => !x.documented).forEach(x => documentationGaps.push({
      concerns: x.concerns, missing: x.element,
      physician_query: gaps.query((injuries[0].spans[0] || {}).quote || injuries[0].term, x.ask + ' (' + x.element + ')', ['Documented in the record (please state)'])
    }));

    /* ---------- assemble the deterministic answer ---------- */
    const ev = c => c.spans.slice().sort((a, b) => (b.section === 'assessment') - (a.section === 'assessment') || a.start - b.start).slice(0, 3)
      .map(sp => ({ quote: doc.original.slice(sp.start, sp.end), start: sp.start, end: sp.end, section: SECTIONS.indexOf(sp.section) >= 0 ? sp.section : 'other' }));
    const entry = (c, isPrincipal) => {
      const e = {
        icd_code: c.code,
        description: table.desc(c.code),
        coding_system: 'ICD-10-AM',
        status: c.status === 'uncertain' ? 'uncertain' : (isPrincipal && seq.clarification ? 'provisional' : 'confirmed'),
        evidence: ev(c),
        reason: isPrincipal ? seq.reason : (c.reason || ('ACS 0002: documented and relevant to this encounter ("' + ((c.spans[0] || {}).quote || c.term) + '").')),
        source: 'engine',
        confidence: null
      };
      if (!isPrincipal) {
        e.affects = c.affects && c.affects.length ? c.affects : ['monitoring'];
        e.supports = c.supports || [];
        if (c.keptFor) e.reason = 'ACS 0002 with medical necessity: a symptom kept only because it is the sole justification for ' + c.keptFor + ' ("' + ((c.spans[0] || {}).quote || c.term) + '").';
      }
      e._cond = c;
      return e;
    };
    const res = {
      request_id: runOpts.requestId || crypto.randomUUID(),
      encounter_summary: '',
      primary_diagnosis: principalCond ? entry(principalCond, true) : null,
      secondary_diagnoses: additional.map(c => entry(c, false)),
      not_coded: [],
      medical_necessity: links.map(l => ({ service: l.service, kind: l.kind, supported_by: l.supported_by, status: l.status })),
      payer_requirements: [],
      documentation_gaps: documentationGaps,
      clarification_required: false,
      clarifications: [],
      coding_validation: { valid: true, errors: [], warnings: [] },
      nphies: null,
      audit: null
    };

    /* not coded, and why */
    if (o.include_not_coded !== false) {
      const nc = [];
      refused.filter(r => !r.promoted).forEach(r => {
        nc.push({ mention: r.mention, reason: REASON[r.assertion] || 'negated', icd_codes: (r.codes || []).filter(c => table.has(c)),
                  evidence: Number.isInteger(r.start) ? [{ quote: doc.original.slice(r.start, r.end), start: r.start, end: r.end, section: SECTIONS.indexOf(r.section) >= 0 ? r.section : 'other' }] : [] });
      });
      integral.filter(c => !coded.includes(c)).forEach(c => {
        nc.push({ mention: (c.spans[0] || {}).quote || c.term, reason: 'integral_symptom', icd_codes: [c.code], evidence: ev(c).slice(0, 1) });
      });
      cand.unresolved.forEach(u => {
        nc.push({ mention: u.phrase, reason: 'not_in_vocabulary', icd_codes: [], candidates: u.candidates.filter(c => table.has(c)),
                  evidence: [{ quote: doc.original.slice(u.start, u.end), start: u.start, end: u.end, section: 'assessment' }] });
      });
      res.not_coded = nc;
    }

    /* clarifications */
    if (seq.clarification) {
      res.clarification_required = true;
      res.clarifications.push({ type: seq.clarification.type, question: seq.clarification.question, options: seq.clarification.options });
    }
    if (!principalCond) {
      res.clarification_required = true;
      const thin = doc.text.replace(/\s+/g, ' ').trim().length < 40;
      res.clarifications.push({
        type: thin ? 'insufficient_documentation' : 'no_codable_diagnosis',
        question: thin
          ? 'The note is too short to code. What condition was chiefly responsible for this encounter, and what was done for it?'
          : 'The note documents no condition that can be coded as the reason for this encounter' + (refused.length ? ' (every condition it mentions is denied, uncertain or someone else\'s)' : '') + '. What was the reason for this encounter?',
        options: ['State the diagnosis or reason for encounter', 'Other (please specify)', 'Cannot be determined']
      });
    }

    const vctx = { doc, patient, policy, morphology: morph, specific, unsupported: unsupportedSpec,
                   integral: keptForNecessity.map(c => ({ code: c.code, service: c.keptFor })),
                   uncertain: uncertainNotes, externalCause, llmDisagreements: [] };

    /* ---------- 4 · optional adjudication: a proposal, validated or dropped ---------- */
    let llmAudit = null;
    let llmDisagreements = [];
    const adj = runOpts.adjudicator !== undefined ? runOpts.adjudicator : adjudicator;
    if (o.use_llm && adj) {
      s = process.hrtime.bigint();
      const out = await adj.adjudicate({ doc, res, coded, cand, patient, encounter, table, extractor, rx });
      lap('adjudicate', s);
      llmAudit = out.audit;
      if (out.apply) {
        const snapshot = { p: res.primary_diagnosis, s: res.secondary_diagnoses, c: res.clarification_required, q: res.clarifications, g: res.documentation_gaps };
        const before = stages.validate(res, vctx);
        out.apply(res, { entry, coded, seq });
        /* what the coder was told about a code the adjudicator replaced no longer applies */
        const now = new Set([res.primary_diagnosis].concat(res.secondary_diagnoses).filter(Boolean).map(d => d.icd_code));
        const keep = x => !x || now.has(x.code || x.concerns) || !(x.code || x.concerns);
        vctx.specific = specific.filter(keep); vctx.unsupported = unsupportedSpec.filter(keep);
        res.documentation_gaps = res.documentation_gaps.filter(g => now.has(g.concerns) || externalCause.some(x => x.concerns === g.concerns));
        const after = stages.validate(res, vctx);
        const fresh = after.errors.filter(e => !before.errors.some(b => b.code === e.code && b.concerns === e.concerns));
        llmDisagreements = (out.disagreements || []).slice();
        if (fresh.length) {
          res.primary_diagnosis = snapshot.p; res.secondary_diagnoses = snapshot.s;
          res.clarification_required = snapshot.c; res.clarifications = snapshot.q; res.documentation_gaps = snapshot.g;
          vctx.specific = specific; vctx.unsupported = unsupportedSpec;
          llmAudit.outcome = 'failed_validation'; llmAudit.used = false;
          llmDisagreements = [{ issue: 'LLM_DISAGREES_WITH_ENGINE', code: fresh[0].concerns,
            message: 'The adjudicator\'s proposal failed validation (' + fresh.map(e => e.code + (e.concerns ? ' ' + e.concerns : '')).join('; ') + '); the engine result is returned.',
            fix: 'No action needed; code from the engine result.' }];
        }
      } else {
        llmDisagreements = (out.disagreements || []).slice();
      }
    } else if (o.use_llm) {
      const why = llmStatus === 'off' ? 'no adjudicator is configured on this service' : 'the adjudicator is not permitted or not available here (' + llmStatus + ')';
      llmDisagreements.push({ issue: 'LLM_UNAVAILABLE', code: null, message: 'use_llm was requested but ' + why + '; the engine result is returned.',
                              fix: 'Configure RXDX_LLM_PROVIDER as described in api/README.md, or send use_llm=false.' });
      llmAudit = { requested: true, used: false, outcome: llmStatus === 'off' ? 'not_configured' : llmStatus };
    }
    vctx.llmDisagreements = llmDisagreements;

    /* ---------- 7 · validate ---------- */
    s = process.hrtime.bigint();
    res.payer_requirements = necessity.payerRequirements(req.payer || null, res.primary_diagnosis && res.primary_diagnosis.icd_code,
      [].concat(res.primary_diagnosis ? [res.primary_diagnosis.icd_code] : [], res.secondary_diagnoses.map(d => d.icd_code)), doc, offMds);
    res.coding_validation = stages.validate(res, vctx);
    lap('validate', s);

    /* ---------- confidence, from the signals the validator can see ---------- */
    const errFor = new Set(res.coding_validation.errors.map(e => String(e.concerns || '')).join(',').split(/,\s*/));
    const specIssue = new Set(specific.map(x => x.code).concat(unsupportedSpec.map(x => x.code)));
    [res.primary_diagnosis].concat(res.secondary_diagnoses).filter(Boolean).forEach(d => {
      const c = d._cond || { code: d.icd_code, term: '', spans: d.evidence.map(e => ({ start: e.start })), named: false };
      const f = confidence.features(c, {
        sentence: at => rx._stSentence(doc.text, at),
        specificityIssue: specIssue.has(d.icd_code),
        hasError: errFor.has(d.icd_code),
        llm: d._llm || null
      });
      d.confidence = confidence.score(f, calibration);
      if (runOpts.features) d._features = f;
    });

    /* ---------- 8 · assemble ---------- */
    res.nphies = o.nphies ? claimDiagnosis(res, encounter, nphiesCfg) : null;
    res.encounter_summary = summary(res, encounter, patient);
    lap('total', t0);
    res.audit = {
      content_version: contentVersion,
      engine_version: engineVersion,
      llm: llmAudit,
      received_chars: doc.original.length,
      ms: T.total,
      stage_ms: T,
      uncertain_diagnosis_policy: admitted ? policy : 'code_symptoms',
      calibration: calibration.fitted_on ? calibration.fitted_on : 'prior',
      arabic_chars_ignored: doc.arabic.chars
    };
    [res.primary_diagnosis].concat(res.secondary_diagnoses).filter(Boolean).forEach(d => {
      delete d._cond; delete d._llm;
      if (!runOpts.features) delete d._features;
    });
    return res;
  }

  function summary(res, encounter, patient) {
    const who = (typeof patient.age_years === 'number' ? patient.age_years + '-year-old ' : '') + (patient.sex || 'patient');
    const kind = { outpatient: 'Outpatient', emergency: 'Emergency', inpatient: 'Inpatient', day_case: 'Day-case' }[encounter] || 'Clinical';
    if (!res.primary_diagnosis) return kind + ' encounter, ' + who + ': no principal diagnosis could be coded; clarification requested.';
    const n = res.secondary_diagnoses.length, s = res.medical_necessity.length, g = res.documentation_gaps.length;
    return kind + ' encounter, ' + who + ': principal diagnosis ' + res.primary_diagnosis.description + ' (' + res.primary_diagnosis.icd_code + ')'
      + (res.clarification_required ? ' pending clarification' : '')
      + ', ' + n + ' additional diagnos' + (n === 1 ? 'is' : 'es') + ', ' + s + ' linked service' + (s === 1 ? '' : 's')
      + ', ' + g + ' documentation gap' + (g === 1 ? '' : 's') + '.';
  }

  return {
    run, stages, table, extractor, necessity, validator, calibration, nphiesCfg, policy, llmStatus,
    llm: llm ? { provider: llm.name, model: llm.model, status: llmStatus, timeoutMs: llm.timeoutMs || null } : null,
    createAdjudicator: l => createAdjudicator(l, { table, candidates: cands }),
    contentVersion, engineVersion, version: VERSION, formularyCount: formulary ? formulary.count : 0,
    confidence, sequencer, candidates: cands, gaps, rx
  };
}

module.exports = { createPipeline, ENCOUNTERS, SECTIONS, VERSION, SEPSIS };
