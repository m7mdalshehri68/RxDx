/* ══════════════════════════════════════════════════════════════════════
   STAGE 7 · VALIDATE

   Runs on every response, whichever path produced it. It does not trust the
   stages before it: every code is looked up in the table again, every quote
   is compared character by character with the note at its offsets, and the
   assertion of every quoted span is read again with the engine's own rules.

   An error makes the response invalid. A warning is for the coder.
   Each issue says what is wrong, which diagnosis it concerns, and the fix a
   coder would make.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const ARABIC = /[؀-ۿݐ-ݿࡰ-ࣿﭐ-﷿ﹰ-﻿]/;
const NOT_THE_PATIENTS = { negated: 1, ruled_out: 1, family: 1, hypothetical: 1 };

function createValidator(table, extractor) {

  function run(res, ctx) {
    const errors = [], warnings = [];
    const issue = (list, code, concerns, message, fix, extra) =>
      list.push(Object.assign({ code, severity: list === errors ? 'error' : 'warning', concerns: concerns || null, message, fix }, extra || {}));
    const doc = ctx.doc;
    const dx = [].concat(res.primary_diagnosis ? [res.primary_diagnosis] : [], res.secondary_diagnoses || []);
    const patient = ctx.patient || {};

    /* ---------- principal ---------- */
    if (!res.primary_diagnosis) {
      issue(errors, 'NO_PRINCIPAL', null, 'No principal diagnosis could be assigned from what the note documents.',
            'Ask the physician for the condition chiefly responsible for this encounter, then code it.');
    } else {
      const p = res.primary_diagnosis, r = table.rec(p.icd_code);
      if (r && (r.unacceptPdx || r.asterisk || r.externalCause)) {
        issue(errors, 'PDX_NOT_ACCEPTABLE', p.icd_code,
              p.icd_code + ' cannot be the principal diagnosis: ' + (r.asterisk ? 'it is a manifestation (asterisk) code' : r.externalCause ? 'it is an external cause code' : 'the ICD-10-AM table marks it not acceptable as principal diagnosis') + '.',
              'Sequence the underlying condition that occasioned the encounter first; keep ' + p.icd_code + ' as an additional diagnosis if it still applies.');
      }
    }

    /* ---------- every diagnosis ---------- */
    const seen = Object.create(null);
    dx.forEach((d, i) => {
      const code = String(d.icd_code || '');
      const st = table.status(code);
      if (st !== 'ok') {
        issue(errors, 'CODE_NOT_IN_TABLE', code,
              code + (st === 'switched_off' ? ' is switched off in this hospital\'s configuration.' : ' does not exist in the ICD-10-AM table loaded by this service. ICD-10-CM and other code sets are not accepted.'),
              'Remove ' + code + ' and choose a code from the ICD-10-AM table.');
        return;
      }
      if (d.description !== table.desc(code)) {
        issue(errors, 'CODE_NOT_IN_TABLE', code, 'The description returned for ' + code + ' is not the table\'s description.', 'Use the description from the ICD-10-AM table.');
      }
      if (d.coding_system !== 'ICD-10-AM') {
        issue(errors, 'CODE_NOT_IN_TABLE', code, code + ' is labelled ' + d.coding_system + '; only ICD-10-AM is accepted.', 'Code in ICD-10-AM.');
      }

      /* evidence, verified character by character */
      const ev = d.evidence || [];
      if (!ev.length) {
        issue(errors, 'EVIDENCE_NOT_FOUND', code, code + ' carries no quote from the note.', 'Quote the words in the note that document ' + code + ', or remove it.');
      }
      let patientsOwn = 0;
      ev.forEach(e => {
        const ok = Number.isInteger(e.start) && Number.isInteger(e.end) && e.start >= 0 && e.end > e.start
          && e.end <= doc.original.length && doc.original.slice(e.start, e.end) === e.quote;
        if (!ok) {
          issue(errors, 'EVIDENCE_NOT_FOUND', code, 'The quote "' + String(e.quote || '').slice(0, 80) + '" is not in the note at ' + e.start + '–' + e.end + '.',
                'Re-quote the note exactly, or remove ' + code + ' if the note does not document it.');
          return;
        }
        const a = extractor.assertion(doc.text, e.start, e.end - e.start, doc.sectionAt(e.start));
        const status = a.status === 'uncertain' && d.status === 'uncertain' ? 'present' : a.status;
        if (!NOT_THE_PATIENTS[status] && status !== 'uncertain') patientsOwn++;
        e._assertion = a.status;
      });
      if (ev.length && !patientsOwn && ev.every(e => e._assertion)) {
        const s = ev[0]._assertion;
        issue(errors, 'NEGATED_OR_FAMILY_CODED', code,
              code + ' is quoted from words the note writes as ' + (s === 'family' ? 'someone else\'s condition' : s === 'uncertain' ? 'uncertain' : s === 'hypothetical' ? 'hypothetical' : 'absent or ruled out') + ' ("' + ev[0].quote + '").',
              'Remove ' + code + '. Only conditions the patient has are coded.');
      }
      ev.forEach(e => { delete e._assertion; });

      /* sex and age edits from the table */
      const r = table.rec(code);
      if (patient.sex && r.sex) {
        const want = patient.sex === 'male' ? 1 : 2;
        if ((r.sex === 1 && want === 2) || (r.sex === 2 && want === 1)) {
          issue(errors, 'SEX_EDIT', code, code + ' is ' + (r.sex === 1 ? 'male' : 'female') + '-only and the patient is ' + patient.sex + '.',
                'Correct the code, or correct the recorded sex if it is wrong.');
        } else if ((r.sex === 3 && want === 1) || (r.sex === 4 && want === 2)) {
          issue(warnings, 'SEX_EDIT', code, code + ' is recorded predominantly in ' + (r.sex === 3 ? 'females' : 'males') + '; the table allows it as an exception.',
                'No change needed if the note supports it; a line in the note helps the payer.');
        }
      }
      if (typeof patient.age_years === 'number') {
        (r.ageBands || []).forEach(b => {
          if (patient.age_years < b.lo - 1e-3 || patient.age_years > b.hi + 1e-3) {
            issue(errors, 'AGE_EDIT', code, code + ' is valid for ages ' + b.txt + ' and the patient is ' + patient.age_years + '.',
                  'Correct the code (the table has the age-appropriate code), or correct the recorded age.');
          }
        });
      }
      if (r.morphologyRequired) {
        const m = (ctx.morphology || {})[code] || {};
        issue(warnings, 'MORPHOLOGY_REQUIRED', code,
              code + ' requires a morphology code' + (m.documented ? '; the note states the histology ("' + m.histology + '")' : ' and the note does not state the histology') + '. The ICD-10-AM table loaded here holds no morphology codes.',
              m.documented ? 'Add the ICD-O morphology code for "' + m.histology + '" from the morphology classification.' : 'Query the physician for the histology (see documentation_gaps), then add the morphology code.');
      }
      if (seen[code]) issue(errors, 'DUPLICATE_CONDITION', code, code + ' is returned twice.', 'Keep one.');
      seen[code] = (seen[code] || 0) + 1;
      if (d.status === 'uncertain') {
        issue(warnings, 'UNCERTAIN_DIAGNOSIS', code, code + ' is documented as uncertain and coded as if established under the admitted-episode policy (' + (ctx.policy || '') + ').',
              'Confirm with the physician before the episode is finalised.');
      }
    });

    /* ---------- the list as a whole ---------- */
    const codes = dx.map(d => String(d.icd_code || '')).filter(c => table.has(c));
    const roots = Object.create(null);
    codes.forEach(c => { (roots[c.split('.')[0]] = roots[c.split('.')[0]] || []).push(c); });
    Object.keys(roots).forEach(r => {
      const fam = roots[r];
      if (fam.length < 2) return;
      if (fam.some(c => table.isVague(c) || table.isWithoutComplication(c))) {
        issue(errors, 'DUPLICATE_CONDITION', fam.join(', '), fam.join(' and ') + ' code the same condition twice (one of them is the unspecified or "without complication" member).',
              'Keep the most specific code the note supports and remove the other.');
      }
    });
    const diabetes = Object.keys(roots).filter(r => /^E1[0-4]$/.test(r));
    if (diabetes.length > 1) {
      issue(errors, 'DUPLICATE_CONDITION', diabetes.join(', '), 'Two types of diabetes are coded (' + diabetes.join(', ') + ') for one patient.',
            'Code the type the note documents, once; use combination codes for its complications.');
    }
    /* manifestation needs its etiology, sequenced before it */
    dx.forEach((d, i) => {
      const code = String(d.icd_code || '');
      if (!table.has(code) || !table.isAsterisk(code)) return;
      const before = dx.slice(0, i).map(x => x.icd_code);
      if (!before.some(b => table.isDaggerFor(b, code))) {
        const cands = table.daggerCandidates(code, 4);
        issue(errors, 'ASTERISK_WITHOUT_DAGGER', code,
              code + ' is a manifestation (asterisk) code and no etiology (dagger) code is sequenced before it.',
              'Code the underlying disease first' + (cands.length ? ' (the table pairs ' + code + ' with ' + cands.join(', ') + ')' : '') + ', then ' + code + '.');
      }
    });

    /* ---------- the coder's list ---------- */
    (ctx.specific || []).forEach(s => issue(warnings, 'UNSPECIFIED_WHEN_SPECIFIC_DOCUMENTED', s.code,
      s.code + ' is unspecified, and the note documents "' + s.quote + '", which the table codes more specifically as ' + s.better + ' (' + table.desc(s.better) + ').',
      'Replace ' + s.code + ' with ' + s.better + ' if the physician\'s words mean what the table says; the engine did not make this change on its own.'));
    (ctx.unsupported || []).forEach(s => issue(warnings, 'SPECIFICITY_NOT_SUPPORTED', s.code,
      s.code + ' (' + table.desc(s.code) + ') states ' + s.axis + ' that the note does not document ("' + s.quote + '").',
      'Query the physician (see documentation_gaps); until answered, use the member of the family the words support.'));
    (ctx.integral || []).forEach(s => issue(warnings, 'SYMPTOM_INTEGRAL_TO_DIAGNOSIS', s.code,
      s.code + ' is a symptom of a coded diagnosis and is kept only because it is the sole justification for ' + s.service + '.',
      'Remove ' + s.code + ' if the payer accepts ' + s.service + ' against the diagnosis; otherwise keep it for medical necessity.'));
    (ctx.uncertain || []).forEach(u => issue(warnings, 'UNCERTAIN_DIAGNOSIS', null,
      '"' + u.mention + '" is documented as uncertain (' + (u.cue || 'uncertain') + ') and is not coded; ' + (u.coded ? 'its documented symptoms are coded instead' : 'no symptom was coded in its place') + '.',
      'If the physician confirms it before the record closes, code it; otherwise leave it uncoded.', { mention: u.mention }));
    (ctx.externalCause || []).forEach(x => issue(warnings, 'EXTERNAL_CAUSE_EXPECTED', x.concerns,
      'An admitted injury needs ' + x.element + (x.documented ? '; the note mentions "' + x.quote + '" but no ' + x.element + ' code is assigned.' : ', and the note does not say ' + x.ask + '.'),
      x.documented ? 'Assign the ' + x.element + ' code from chapter XX for "' + x.quote + '".' : 'Query the physician for ' + x.ask + '.'));
    (res.medical_necessity || []).forEach(m => {
      if (m.status === 'supported') return;
      issue(warnings, 'SERVICE_WITHOUT_DIAGNOSIS', null,
            '"' + m.service + '" has ' + (m.status === 'needs_documentation' ? 'no coded diagnosis; only an uncoded finding explains it' : 'no supporting diagnosis in the note') + '.',
            m.status === 'needs_documentation' ? 'Ask the physician to document the indication, or code the finding that justifies it.' : 'Document the indication for "' + m.service + '", or confirm it was not done.',
            { service: m.service });
    });
    (ctx.llmDisagreements || []).forEach(x => issue(warnings, x.issue || 'LLM_DISAGREES_WITH_ENGINE', x.code || null, x.message, x.fix));

    /* ---------- nothing Arabic in any code, description or claim field ---------- */
    const claimText = [].concat(
      dx.map(d => d.icd_code + ' ' + d.description + ' ' + (d.reason || '')),
      (res.not_coded || []).map(n => n.mention + ' ' + (n.icd_codes || []).join(' ')),
      (res.medical_necessity || []).map(m => m.service),
      (res.documentation_gaps || []).map(g => g.missing + ' ' + g.physician_query),
      [res.encounter_summary || '']);
    if (claimText.some(t => ARABIC.test(t))) {
      issue(errors, 'ARABIC_IN_CLAIM_FIELD', null, 'A code, description or claim field contains Arabic text.', 'Claims carry English only; remove the Arabic text.');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  return { run };
}

module.exports = { createValidator };
