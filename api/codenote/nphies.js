/* ══════════════════════════════════════════════════════════════════════
   NPHIES ADAPTER — Claim.diagnosis entries

   Sequence, principal/secondary type and code format all come from
   api/nphies.config.json (or RXDX_NPHIES_CONFIG). Nothing about NPHIES is
   hard-coded here. The adapter writes only a valid, unambiguous result: a
   response with a validation error or an open clarification returns null.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

function loadNphiesConfig(file) {
  const f = file || process.env.RXDX_NPHIES_CONFIG || path.join(__dirname, '..', 'nphies.config.json');
  const c = JSON.parse(fs.readFileSync(f, 'utf8'));
  ['diagnosisSystem', 'codeFormat', 'typeSystem', 'principalType', 'secondaryType'].forEach(k => {
    if (!c[k]) throw new Error('NPHIES configuration is missing ' + k);
  });
  return c;
}

function claimDiagnosis(res, encounter, cfg) {
  if (!res || !res.primary_diagnosis || !res.coding_validation || !res.coding_validation.valid || res.clarification_required) return null;
  const fmt = code => cfg.codeFormat === 'undotted' ? String(code).replace('.', '') : String(code);
  const list = [res.primary_diagnosis].concat(res.secondary_diagnoses || []);
  const start = Number.isInteger(cfg.startSequence) ? cfg.startSequence : 1;
  return {
    diagnosis: list.map((d, i) => {
      const coding = { system: cfg.diagnosisSystem, code: fmt(d.icd_code) };
      if (cfg.includeDisplay) coding.display = d.description;
      const e = {
        sequence: start + i,
        diagnosisCodeableConcept: { coding: [coding] },
        type: [{ coding: [{ system: cfg.typeSystem, code: i === 0 ? cfg.principalType : cfg.secondaryType }] }]
      };
      const oa = cfg.onAdmission && cfg.onAdmission[encounter];
      if (oa && cfg.onAdmissionSystem) e.onAdmission = { coding: [{ system: cfg.onAdmissionSystem, code: oa }] };
      return e;
    })
  };
}

module.exports = { loadNphiesConfig, claimDiagnosis };
