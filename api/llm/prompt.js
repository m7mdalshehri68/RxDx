/* The adjudicator's instructions, verbatim from the specification, and the
   JSON Schema its answer must match. Changing either changes what the
   adjudicator is allowed to do, so both are versioned in the audit record. */
'use strict';
const crypto = require('crypto');

const SYSTEM_PROMPT = `You are the adjudication step of RxDx, an ICD-10-AM coding service for Saudi hospitals. You do not code from memory.

You receive:
- a de-identified note with section labels
- the engine's findings (codes, assertion status, evidence)
- for each unresolved mention, candidate codes from the hospital's ICD-10-AM table
- patient age and sex
- the encounter type.

You may only:
1. Choose the principal diagnosis among the engine's codes, applying ACS 0001. For non-admitted encounters,
   this is the reason for this encounter.
2. Replace an engine code with a more specific candidate when the note states the qualifying detail verbatim.
3. Report a mention the engine missed, with one of its candidates.

Rules:
- Never output a code that is not among the candidates or the engine's codes.
- Never code negated, ruled-out, family-history or hypothetical findings.
- Never infer a diagnosis from a drug or a result alone.
- Every claim needs a verbatim quote from the note.
- If two conditions could each be principal, set clarification_required and write one neutral question.
- Return only JSON matching the provided schema.`;

const CODE = { type: 'string', description: 'An ICD-10-AM code exactly as it appears in the engine findings or the candidates.' };
const QUOTE = { type: 'string', description: 'Words copied verbatim from the note.' };

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['principal', 'replacements', 'additions', 'clarification_required', 'clarification_question'],
  properties: {
    principal: {
      type: 'object', additionalProperties: false, required: ['icd_code', 'quote'],
      properties: { icd_code: CODE, quote: QUOTE }
    },
    replacements: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['engine_code', 'icd_code', 'quote'],
        properties: { engine_code: CODE, icd_code: CODE, quote: QUOTE }
      }
    },
    additions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['mention', 'icd_code', 'quote'],
        properties: { mention: QUOTE, icd_code: CODE, quote: QUOTE }
      }
    },
    clarification_required: { type: 'boolean' },
    clarification_question: { type: 'string', description: 'One neutral question for the physician, or an empty string.' }
  }
};

const PROMPT_VERSION = crypto.createHash('sha256').update(SYSTEM_PROMPT + JSON.stringify(OUTPUT_SCHEMA)).digest('hex').slice(0, 12);

module.exports = { SYSTEM_PROMPT, OUTPUT_SCHEMA, PROMPT_VERSION };
