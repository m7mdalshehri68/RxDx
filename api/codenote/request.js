/* ══════════════════════════════════════════════════════════════════════
   WHAT /v1/code-note ACCEPTS

   Age and sex, never identity. A request that carries a name, a national ID
   or Iqama number, a medical record number, a phone number, an email address
   or a date of birth — as a field or inside the note — is refused with 422
   before anything is coded. The refusal names the kind of identifier and
   where it was found; it never repeats the value.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const ENCOUNTERS = ['outpatient', 'emergency', 'inpatient', 'day_case'];
const PAYERS = ['bupa', 'taw', 'art'];
const TOP = ['clinical_note', 'encounter_type', 'patient', 'payer', 'options', 'coding_system'];
const PATIENT = ['age_years', 'sex'];
const OPTIONS = ['use_llm', 'max_candidates', 'include_not_coded', 'nphies', 'coding_system'];
const IDENTITY_KEY = /^(?:name|first_?name|last_?name|full_?name|patient_?name|family_?name|given_?name|middle_?name|national_?id|nid|iqama(?:_?(?:no|number|id))?|id_?number|mrn|medical_?record(?:_?(?:no|number))?|file_?(?:no|number)|hospital_?number|phone|mobile|telephone|tel|email|e_?mail|dob|date_?of_?birth|birth_?date|address|passport|patient_?id|member_?id|policy_?number|insurance_?(?:id|number)|identity)$/i;

/* identifiers inside free text: kind → pattern */
const IN_TEXT = [
  ['national_id_or_iqama', /(?<![\d.])[12]\d{9}(?![\d.])/],
  ['phone', /(?:\+|00)966[\s-]?5\d(?:[\s-]?\d){7}(?!\d)|(?<![\d.])05\d(?:[\s-]?\d){7}(?!\d)/],
  ['email', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
  ['medical_record_number', /\b(?:mrn|medical record(?: number| no)?|file (?:no|number)|hospital (?:no|number))\s*[:#.]?\s*[A-Z]{0,3}\d{4,}/i],
  ['national_id_or_iqama', /\b(?:national id|iqama(?: number| no)?|id (?:number|no))\s*[:#.]?\s*\d{6,}/i],
  ['name', /\b(?:patient name|name)\s*:\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/],
  ['name', /\b(?:Mr|Mrs|Ms|Miss)\.?\s+[A-Z][a-z]{1,}/],
  ['date_of_birth', /\b(?:dob|d\.o\.b\.?|date of birth)\s*[:]?\s*\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}/i]
];

function identifiersIn(text) {
  const found = [];
  IN_TEXT.forEach(([kind, re]) => { if (re.test(text) && found.indexOf(kind) < 0) found.push(kind); });
  return found;
}

function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }

/* → { req } or { status, error: { code, message, ... } } */
function parseCodeNote(body, limits) {
  limits = limits || {};
  const maxBytes = limits.maxNoteBytes || 256 * 1024;
  const bad = (status, code, message, extra) => ({ status, error: Object.assign({ code, message }, extra || {}) });
  if (!isObj(body)) return bad(400, 'bad_request', 'Send a JSON object.');

  /* identity, anywhere a key could carry it */
  const idKeys = [];
  const scan = (o, where) => { if (isObj(o)) Object.keys(o).forEach(k => { if (IDENTITY_KEY.test(k)) idKeys.push(where + k); }); };
  scan(body, ''); scan(body.patient, 'patient.'); scan(body.options, 'options.');
  if (idKeys.length) {
    return bad(422, 'identifier_present', 'This service accepts age and sex only. Remove the identifying fields and send the request again.', { fields: idKeys });
  }
  const unknown = Object.keys(body).filter(k => TOP.indexOf(k) < 0);
  if (unknown.length) return bad(400, 'unknown_field', 'Unknown field(s): ' + unknown.join(', ') + '.', { fields: unknown });

  const cs = body.coding_system !== undefined ? body.coding_system : (isObj(body.options) ? body.options.coding_system : undefined);
  if (cs !== undefined && !/^icd[- ]?10[- ]?am$/i.test(String(cs))) {
    return bad(400, 'unsupported_coding_system', 'Only ICD-10-AM is supported. ICD-10-CM and other code sets are not.');
  }

  if (typeof body.clinical_note !== 'string' || !body.clinical_note.trim()) {
    return bad(400, 'missing_clinical_note', 'Send {"clinical_note": "…", "encounter_type": "outpatient"}.');
  }
  if (Buffer.byteLength(body.clinical_note, 'utf8') > maxBytes) {
    return bad(413, 'too_large', 'The note is larger than this service accepts (' + Math.round(maxBytes / 1024) + ' KB).');
  }
  if (ENCOUNTERS.indexOf(body.encounter_type) < 0) {
    return bad(400, 'bad_encounter_type', 'encounter_type must be one of ' + ENCOUNTERS.join(', ') + '.');
  }

  let patient = {};
  if (body.patient !== undefined && body.patient !== null) {
    if (!isObj(body.patient)) return bad(400, 'bad_patient', 'patient must be an object with age_years and sex.');
    const extra = Object.keys(body.patient).filter(k => PATIENT.indexOf(k) < 0);
    if (extra.length) return bad(422, 'identifier_present', 'patient accepts age_years and sex only.', { fields: extra.map(k => 'patient.' + k) });
    const a = body.patient.age_years;
    if (a !== undefined && a !== null && !(typeof a === 'number' && isFinite(a) && a >= 0 && a <= 130)) {
      return bad(400, 'bad_age', 'patient.age_years must be a number from 0 to 130.');
    }
    const s = body.patient.sex;
    if (s !== undefined && s !== null && s !== 'male' && s !== 'female') return bad(400, 'bad_sex', 'patient.sex must be "male" or "female".');
    patient = {};
    if (typeof a === 'number') patient.age_years = a;
    if (s) patient.sex = s;
  }

  const payer = body.payer === undefined || body.payer === null ? null : body.payer;
  if (payer !== null && PAYERS.indexOf(payer) < 0) return bad(400, 'bad_payer', 'payer must be one of ' + PAYERS.join(', ') + ', or null.');

  const options = { use_llm: false, max_candidates: 5, include_not_coded: true, nphies: false };
  if (body.options !== undefined && body.options !== null) {
    if (!isObj(body.options)) return bad(400, 'bad_options', 'options must be an object.');
    const extra = Object.keys(body.options).filter(k => OPTIONS.indexOf(k) < 0);
    if (extra.length) return bad(400, 'unknown_field', 'Unknown option(s): ' + extra.join(', ') + '.', { fields: extra.map(k => 'options.' + k) });
    const o = body.options;
    for (const k of ['use_llm', 'include_not_coded', 'nphies']) {
      if (o[k] !== undefined && typeof o[k] !== 'boolean') return bad(400, 'bad_options', 'options.' + k + ' must be true or false.');
      if (o[k] !== undefined) options[k] = o[k];
    }
    if (o.max_candidates !== undefined) {
      if (!Number.isInteger(o.max_candidates) || o.max_candidates < 1 || o.max_candidates > 10) return bad(400, 'bad_options', 'options.max_candidates must be an integer from 1 to 10.');
      options.max_candidates = o.max_candidates;
    }
  }

  const kinds = identifiersIn(body.clinical_note);
  if (kinds.length) {
    return bad(422, 'identifier_present', 'The note appears to contain a patient identifier (' + kinds.join(', ').replace(/_/g, ' ')
      + '). Remove it and send the note again: this service codes de-identified text only.', { kinds, fields: ['clinical_note'] });
  }

  return { req: { clinical_note: body.clinical_note, encounter_type: body.encounter_type, patient, payer, options } };
}

module.exports = { parseCodeNote, identifiersIn, ENCOUNTERS, PAYERS };
