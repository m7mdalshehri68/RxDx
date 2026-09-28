/* ══════════════════════════════════════════════════════════════════════
   STAGE 4 · ADJUDICATE (optional, off by default)

   The LLM's answer is a proposal. It may only:
     1. choose the principal among the engine's codes;
     2. replace an engine code with one of the candidates sent for it, when
        its quote carries every word that distinguishes the candidate;
     3. add a code for a mention the engine missed, from that mention's
        candidates.
   Every quote is found verbatim in the note and read again with the engine's
   negation rules. Anything else is rejected and reported. If the answer is
   late, malformed or refused, or the merged result fails validation, the
   engine's result is returned with a warning.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const { deidentify } = require('../llm/index.js');

const ARABIC = /[؀-ۿݐ-ݿࡰ-ࣿﭐ-﷿ﹰ-﻿]/;
const NOT_THE_PATIENTS = { negated: 1, ruled_out: 1, family: 1, hypothetical: 1, uncertain: 1 };

function createAdjudicator(llm, deps) {
  const { table, candidates } = deps;

  function input({ doc, res, cand, patient, encounter }) {
    const findings = [res.primary_diagnosis].concat(res.secondary_diagnoses).filter(Boolean).map((d, i) => ({
      icd_code: d.icd_code, description: d.description, role: i === 0 && res.primary_diagnosis ? 'principal' : 'additional',
      assertion: d.status === 'uncertain' ? 'uncertain' : 'present', evidence: d.evidence.map(e => deidentify(e.quote))
    }));
    const byCode = {};
    Object.keys(cand.byCode).forEach(k => {
      const list = (cand.byCode[k].candidates || []).map(c => ({ icd_code: c.code, description: table.desc(c.code) }));
      if (list.length) byCode[k] = list;
    });
    return {
      note: doc.sections.map(s => ({ section: s.name, text: deidentify(doc.text.slice(s.start, s.end)).trim() })).filter(s => s.text),
      engine_findings: findings,
      not_coded: (res.not_coded || []).map(n => ({ mention: deidentify(n.mention), reason: n.reason })),
      candidates_for_engine_codes: byCode,
      unresolved_mentions: cand.unresolved.map(u => ({ mention: deidentify(u.phrase), candidates: u.candidates.map(c => ({ icd_code: c, description: table.desc(c) })) })),
      patient: { age_years: typeof patient.age_years === 'number' ? patient.age_years : null, sex: patient.sex || null },
      encounter_type: encounter
    };
  }

  /* the quote, found in the physician's own text, and what it asserts */
  function locate(doc, extractor, quote, admitted) {
    const q = String(quote || '');
    if (q.trim().length < 3 || ARABIC.test(q)) return null;
    let at = doc.original.indexOf(q);
    while (at >= 0) {
      const a = extractor.assertion(doc.text, at, q.length, doc.sectionAt(at));
      if (!NOT_THE_PATIENTS[a.status] || (admitted && a.status === 'uncertain')) {
        return { quote: q, start: at, end: at + q.length, section: doc.sectionAt(at), assertion: a.status };
      }
      at = doc.original.indexOf(q, at + 1);
    }
    return { rejected: 'the quote is not in the note, or the note writes it as negated, uncertain, hypothetical or someone else\'s' };
  }

  const singular = w => w.replace(/(?:es|s)$/, '');
  function names(code, quote) {
    /* the quote must name the condition, not a drug or a result that implies it */
    const qw = new Set(table.words(quote).map(singular));
    return table.words(table.desc(code)).some(w => w.length >= 4 && qw.has(singular(w)));
  }

  async function adjudicate(ctx) {
    const { doc, res, cand, encounter, extractor } = ctx;
    const admitted = encounter === 'inpatient' || encounter === 'day_case';
    const payload = input(ctx);
    const user = 'Adjudicate this encounter. The input is JSON:\n' + JSON.stringify(payload);
    const audit = { provider: llm.name, model: llm.model, prompt_version: llm.promptVersion, requested: true, used: false,
                    outcome: null, ms: 0, deidentified: true, sent_chars: user.length, accepted: 0, rejected: 0 };
    const disagreements = [];
    const out = await llm.ask(user);
    audit.ms = out.ms;
    audit.outcome = out.outcome;
    if (out.model) audit.model = out.model;
    if (out.outcome !== 'answered') {
      disagreements.push({ issue: 'LLM_UNAVAILABLE', code: null,
        message: 'The adjudicator did not return a usable answer (' + out.outcome + (out.outcome === 'timeout' ? ' after ' + llm.timeoutMs + ' ms' : '') + '); the engine result is returned.',
        fix: 'No action needed; code from the engine result.' });
      return { audit, disagreements };
    }
    const p = out.json;
    if (!p || typeof p !== 'object' || !p.principal || !Array.isArray(p.replacements) || !Array.isArray(p.additions) || typeof p.clarification_required !== 'boolean') {
      audit.outcome = 'invalid_output';
      disagreements.push({ issue: 'LLM_UNAVAILABLE', code: null, message: 'The adjudicator\'s answer did not match its schema; the engine result is returned.', fix: 'No action needed.' });
      return { audit, disagreements };
    }
    audit.used = true;

    const engineCodes = [res.primary_diagnosis].concat(res.secondary_diagnoses).filter(Boolean).map(d => d.icd_code);
    const reject = (code, what, why) => { audit.rejected++; disagreements.push({ code, message: 'The adjudicator proposed ' + what + '; rejected: ' + why + '.', fix: 'No action needed; the engine\'s code stands.' }); };
    const plan = { principal: null, replacements: [], additions: [], clarification: null };

    /* 1 · principal */
    const pc = String(p.principal.icd_code || '').toUpperCase();
    if (pc && pc !== (res.primary_diagnosis && res.primary_diagnosis.icd_code)) {
      const r = table.rec(pc);
      const at = locate(doc, extractor, p.principal.quote, admitted);
      if (engineCodes.indexOf(pc) < 0) reject(pc, pc + ' as principal', 'it is not one of the engine\'s codes');
      else if (!r || r.unacceptPdx || r.asterisk || r.externalCause) reject(pc, pc + ' as principal', 'the table does not accept it as principal diagnosis');
      else if (!at || at.rejected) reject(pc, pc + ' as principal', at ? at.rejected : 'no verbatim quote');
      else plan.principal = { code: pc, span: at };
    }
    /* 2 · replacements */
    p.replacements.forEach(x => {
      const from = String(x.engine_code || '').toUpperCase(), to = String(x.icd_code || '').toUpperCase();
      const offered = ((cand.byCode[from] || {}).candidates || []).map(c => c.code);
      if (engineCodes.indexOf(from) < 0) return reject(to, 'replacing ' + from, from + ' is not one of the engine\'s codes');
      if (offered.indexOf(to) < 0 || !table.has(to)) return reject(to, from + ' → ' + to, to + ' was not among the candidates sent for ' + from);
      const at = locate(doc, extractor, x.quote, admitted);
      if (!at || at.rejected) return reject(to, from + ' → ' + to, at ? at.rejected : 'no verbatim quote');
      const dist = candidates.distinguishing(to, from);
      const bag = new Set(table.words(at.quote));
      if (!dist.length || !dist.every(w => candidates.documented(w, bag))) return reject(to, from + ' → ' + to, 'its quote does not state what distinguishes ' + to + ' (' + dist.join(', ') + ')');
      plan.replacements.push({ from, to, span: at });
    });
    /* 3 · additions */
    const offeredAll = new Set([].concat.apply([], cand.unresolved.map(u => u.candidates)));
    p.additions.forEach(x => {
      const code = String(x.icd_code || '').toUpperCase();
      if (!offeredAll.has(code) || !table.has(code)) return reject(code, 'adding ' + code, 'it was not among the candidates for an unresolved mention');
      if (engineCodes.some(c => c.split('.')[0] === code.split('.')[0])) return reject(code, 'adding ' + code, 'the condition is already coded');
      const at = locate(doc, extractor, x.quote, admitted);
      if (!at || at.rejected) return reject(code, 'adding ' + code, at ? at.rejected : 'no verbatim quote');
      if (!names(code, at.quote)) return reject(code, 'adding ' + code, 'the quote does not name the condition (a drug or a result alone is not a diagnosis)');
      if (table.isAsterisk(code)) return reject(code, 'adding ' + code, 'a manifestation code needs its etiology, which the adjudicator may not add');
      plan.additions.push({ code, span: at, mention: String(x.mention || '').slice(0, 200) });
    });
    /* clarification: one neutral question */
    if (p.clarification_required && !res.clarification_required) {
      const q = String(p.clarification_question || '').trim();
      if (q && q.length <= 400 && !ARABIC.test(q)) plan.clarification = q;
      else reject(null, 'a clarification', 'the question was empty, too long or not in English');
    }
    audit.accepted = (plan.principal ? 1 : 0) + plan.replacements.length + plan.additions.length + (plan.clarification ? 1 : 0);

    /* ---------- apply: new objects only, so the engine result can be restored ---------- */
    function apply(r, helpers) {
      const clone = d => Object.assign({}, d, { evidence: d.evidence.map(e => Object.assign({}, e)) });
      let list = [r.primary_diagnosis].concat(r.secondary_diagnoses).filter(Boolean).map(clone);
      list.forEach(d => { d.source = 'engine+llm'; d._llm = 'agree'; });
      plan.replacements.forEach(x => {
        const d = list.find(e => e.icd_code === x.from);
        if (!d) return;
        d.icd_code = x.to; d.description = table.desc(x.to); d._llm = 'disagree'; delete d._cond;
        d.evidence = [{ quote: x.span.quote, start: x.span.start, end: x.span.end, section: x.span.section }].concat(d.evidence).slice(0, 3);
        d.reason = 'Adjudicated: the note states "' + x.span.quote + '", which the table codes as ' + x.to + ' rather than the engine\'s ' + x.from + '. ' + d.reason;
        disagreements.push({ code: x.to, message: 'The adjudicator replaced the engine\'s ' + x.from + ' with ' + x.to + ' ("' + x.span.quote + '").', fix: 'Confirm the more specific code against the note.' });
      });
      if (plan.principal) {
        const i = list.findIndex(e => e.icd_code === plan.principal.code);
        if (i > 0) {
          const old = list[0], np = list.splice(i, 1)[0];
          np.reason = 'ACS 0001, adjudicated: ' + np.description + ' ("' + plan.principal.span.quote + '") is taken as chiefly responsible for this encounter; the engine had ranked ' + old.icd_code + ' first.';
          np._llm = 'disagree'; delete np.affects; delete np.supports;
          old.affects = old.affects || ['monitoring']; old.supports = old.supports || [];
          old.reason = 'ACS 0002: documented and relevant to this encounter; sequenced after the adjudicated principal.';
          old._llm = 'disagree';
          list.unshift(np);
          disagreements.push({ code: np.icd_code, message: 'The adjudicator chose ' + np.icd_code + ' as principal; the engine had chosen ' + old.icd_code + '.', fix: 'Confirm which condition occasioned the encounter.' });
        }
      }
      plan.additions.forEach(x => {
        list.push({ icd_code: x.code, description: table.desc(x.code), coding_system: 'ICD-10-AM', status: 'confirmed',
          evidence: [{ quote: x.span.quote, start: x.span.start, end: x.span.end, section: x.span.section }],
          reason: 'ACS 0002, adjudicated: the note documents "' + x.span.quote + '", which the engine\'s vocabulary did not code.',
          source: 'llm', confidence: null, affects: ['monitoring'], supports: [], _llm: 'disagree' });
        disagreements.push({ code: x.code, message: 'The adjudicator added ' + x.code + ' for "' + x.span.quote + '", which the engine did not code.', fix: 'Confirm the code against the note.' });
      });
      if (r.primary_diagnosis) { r.primary_diagnosis = list.shift(); delete r.primary_diagnosis.affects; delete r.primary_diagnosis.supports; }
      r.secondary_diagnoses = list.map(d => { d.affects = d.affects || ['monitoring']; d.supports = d.supports || []; return d; });
      if (plan.clarification) {
        r.clarification_required = true;
        r.clarifications = r.clarifications.concat([{ type: 'principal_ambiguous', question: plan.clarification,
          options: [r.primary_diagnosis].concat(r.secondary_diagnoses).filter(Boolean).slice(0, 3).map(d => d.icd_code + ' ' + d.description)
            .concat(['Other (please specify)', 'Cannot be determined']) }]);
        if (r.primary_diagnosis) r.primary_diagnosis.status = 'provisional';
      }
    }
    return { audit, disagreements, apply };
  }

  return { adjudicate, input };
}

module.exports = { createAdjudicator };
