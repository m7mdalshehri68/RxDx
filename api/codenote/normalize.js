/* ══════════════════════════════════════════════════════════════════════
   STAGE 1 · NORMALIZE

   Splits the note into sections and finds the abbreviations the tool's own
   vocabulary expands. It never rewrites the note: every offset the pipeline
   reports must point at the physician's own characters, so the text handed to
   the engine is the note with one change only — Arabic letters are replaced by
   spaces of the same length, so Arabic can neither be coded nor quoted, and
   every offset still lands on the same character of the original.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const ARABIC = /[؀-ۿݐ-ݿࡰ-ࣿﭐ-﷿ﹰ-﻿]/g;
const HAS_ARABIC = /[؀-ۿݐ-ݿࡰ-ࣿﭐ-﷿ﹰ-﻿]/;

/* Header words → section. Order matters only for readability; each header is
   matched as a whole word followed by a colon or dash. */
const HEADERS = [
  ['complaint', 'chief complaint|presenting complaint|presenting problem|reason for (?:visit|attendance|referral|admission)|complaint|c/o|cc|pc'],
  ['hpi', 'history of (?:the )?present(?:ing)? (?:illness|complaint)|hpi|hopi|hpc|subjective|history'],
  ['family_history', 'family history|fhx|fh'],
  ['social_history', 'social history|shx|sh'],
  ['pmh', 'past medical history|past history|medical history|past surgical history|pmhx|pmh|psh|background|comorbidities|co-morbidities|known conditions'],
  ['medications', 'current medications|regular medications|medications|medication|drug history|meds|dhx'],
  ['allergies', 'allergies|allergy'],
  ['examination', 'on examination|physical examination|examination|exam|o/e|oe|vital signs|vitals|objective'],
  ['investigations', 'investigations|laboratory|labs|results|bloods|imaging|radiology|ix'],
  ['assessment', 'assessment and plan|assessment & plan|a/p|final diagnosis|discharge diagnosis|principal diagnosis|working diagnosis|provisional diagnosis|diagnoses|diagnosis|impression|assessment|conclusion|problem list|dx|ddx'],
  ['plan', 'management plan|plan|management|treatment|disposition|follow[- ]?up|recommendations|advice']
];
/* A result written as "CXR: …", "CT head non-contrast: …", "Urine dipstick: …" */
const TEST_HEADER = /(?:^|[\n.;]\s*)\s*((?:erect |portable |repeat |urgent )?(?:cxr|chest x-?ray|x-?ray|xr|ct|cta|ctpa|mri|mra|ultrasound|uss?|echo(?:cardiogram)?|ecg|ekg|spirometry|urine dipstick|dipstick|urinalysis|abg|vbg|blood gas|colonoscopy|endoscopy|ogd|gastroscopy|biopsy|histology|culture|swab|fbc|cbc|u&e|lft|bloods)\b[^:.\n]{0,40}):/gi;

let HEADER_RE = null;
function headerRe() {
  if (HEADER_RE) return HEADER_RE;
  const alt = HEADERS.map(h => h[1]).join('|');
  HEADER_RE = new RegExp('(^|\\n|[.;]\\s+)[ \\t]*(' + alt + ')[ \\t]*(?::|—|–|-(?=\\s))', 'gi');
  return HEADER_RE;
}
function sectionOf(word) {
  const w = word.toLowerCase().replace(/\s+/g, ' ');
  for (const [name, alt] of HEADERS) {
    if (new RegExp('^(?:' + alt + ')$', 'i').test(w)) return name;
  }
  return 'other';
}

/* Sentences that start a plan after an inline "Impression: X." */
const PLAN_CUE = /^\s*(?:started|start|commenced?|given|gave|prescribed|referred|referral|arranged?|booked|admitted|admit|continue|continued|stop|stopped|discharged?|observed|kept|taken to theatre|reassured|advised|discussed|plan\b|review|follow|treated|managed|iv |oral |analgesia|safety[- ]net|nil by mouth|urgent|immediate|resuscitated|to\b|will\b|for\b|rice\b|physiotherapy|dietitian|talking therapy|surgical|repeat|check|monitor|ecg|ct\b|mri|ultrasound)/i;
/* a sentence that says something was done or will be done */
const PLAN_ANY = /\b\d+(?:\.\d+)?\s*(?:mg|g|mcg|micrograms?|units?|ml|mmol)\b|\b(?:nebuli[sz]er|infusion|tablets?|capsules?)\b|\b(?:given|started|prescribed|referred|referral|arranged|admitted|commenced|booked|continued?|stopped|discharged|requested|activated|advised|reassured|observed|scheduled|planned)\b/i;
const EXAM_CUE = /\b(?:bp\s*\d|hr\s*\d|rr\s*\d|spo2|sats?\s*\d|temp(?:erature)?\s*\d|gcs\s*\d|pulse\s*\d|examined|on examination|tender|crackles|wheeze|murmur|oedema|jvp|abdomen soft|chest clear|reflex|power \d)/i;
const IX_CUE = /\b(?:hba1c|troponin|creatinine|egfr|ferritin|haemoglobin|hemoglobin|hb\s*\d|mcv|tsh|t4|lipase|amylase|bilirubin|alp|alt|crp|esr|d-dimer|bnp|psa|inr|lactate|ketones|ph\s*\d|bicarbonate|glucose\s*\d|urate|cholesterol|culture|ana\b|anti-|c3\b|fsh|acr\b|dipstick|x-?ray|ct |mri|ultrasound|spirometry|fev1|colonoscopy|ecg)/i;
const PMH_CUE = /^\s*(?:known|background|history of|past history|previous(?:ly)?|pmh|with a background|ex-smoker|smoker|on (?:regular|long-term))/i;

function splitSentences(text, from, to) {
  const out = [];
  let s = from;
  const re = /[.!?](?=\s|$)|\n/g;
  re.lastIndex = from;
  let m;
  while ((m = re.exec(text)) && m.index < to) {
    const e = m.index + 1;
    if (text.slice(s, e).trim()) out.push([s, e]);
    s = e;
  }
  if (s < to && text.slice(s, to).trim()) out.push([s, to]);
  return out;
}

/* ---------- the stage ---------- */
function normalize(note, vocab) {
  const original = String(note == null ? '' : note);
  const arabicSpans = [];
  let m;
  const scan = new RegExp(ARABIC.source + '+', 'g');
  while ((m = scan.exec(original))) arabicSpans.push({ start: m.index, end: m.index + m[0].length });
  const text = original.replace(ARABIC, ' ');

  /* explicit headers */
  const marks = [];
  const re = headerRe(); re.lastIndex = 0;
  while ((m = re.exec(text))) {
    const hs = m.index + m[1].length + (m[0].slice(m[1].length).length - m[0].slice(m[1].length).trimStart().length);
    marks.push({ name: sectionOf(m[2]), hStart: hs, cStart: m.index + m[0].length, inline: !/\n\s*$/.test(text.slice(m.index + m[0].length, m.index + m[0].length + 2)) });
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  TEST_HEADER.lastIndex = 0;
  while ((m = TEST_HEADER.exec(text))) {
    const hs = m.index + m[0].indexOf(m[1]);
    if (!marks.some(k => Math.abs(k.hStart - hs) < 2)) marks.push({ name: 'investigations', hStart: hs, cStart: m.index + m[0].length, inline: true, test: true });
  }
  marks.sort((a, b) => a.hStart - b.hStart);

  /* Sections. A header on its own line owns everything to the next header. An
     inline header ("Impression: pneumonia. Started amoxicillin.") owns its
     sentence; an inline assessment also owns the sentences that still read as
     diagnoses, and what follows is plan unless it reads as a result or an
     examination. Unlabelled text is classified sentence by sentence. */
  const sections = [];
  const push = (name, start, end, header) => { if (end > start) sections.push({ name, start, end, header: header || null }); };
  const guess = (s, fallback) => {
    if (PMH_CUE.test(s)) return 'pmh';
    if (IX_CUE.test(s)) return 'investigations';
    if (EXAM_CUE.test(s)) return 'examination';
    return fallback;
  };
  const firstAt = marks.length ? marks[0].hStart : text.length;
  splitSentences(text, 0, firstAt).forEach(([a, b], i) => push(i === 0 ? 'complaint' : guess(text.slice(a, b), 'hpi'), a, b));
  marks.forEach((k, i) => {
    const next = i + 1 < marks.length ? marks[i + 1].hStart : text.length;
    const header = { start: k.hStart, end: k.cStart };
    const block = /^[ \t]*\n/.test(text.slice(k.cStart, next));
    if (block || !(k.test || k.name === 'assessment')) { push(k.name, k.cStart, next, header); return; }
    const sents = splitSentences(text, k.cStart, next);
    if (!sents.length) { push(k.name, k.cStart, next, header); return; }
    let j = 1;
    if (k.name === 'assessment') {
      while (j < sents.length) {
        const s = text.slice(sents[j][0], sents[j][1]);
        if (PLAN_CUE.test(s) || PLAN_ANY.test(s) || IX_CUE.test(s) || EXAM_CUE.test(s)) break;
        j++;
      }
    }
    push(k.name, k.cStart, sents[j - 1][1], header);
    const after = k.name === 'assessment' ? 'plan' : 'hpi';
    for (; j < sents.length; j++) {
      const s = text.slice(sents[j][0], sents[j][1]);
      push(PLAN_CUE.test(s) || PLAN_ANY.test(s) ? 'plan' : guess(s, after), sents[j][0], sents[j][1]);
    }
  });
  sections.sort((a, b) => a.start - b.start);

  const sectionAt = pos => {
    for (let i = sections.length - 1; i >= 0; i--) {
      const s = sections[i];
      if (pos >= s.start && pos < s.end) return s.name;
      if (s.header && pos >= s.header.start && pos < s.header.end) return s.name;
    }
    return 'other';
  };

  /* abbreviations the tool's vocabulary knows, expanded to the description of
     the code it maps them to — for the reader; the engine matches the note as
     written */
  const abbreviations = [];
  if (vocab && vocab.abbr) {
    const seen = new Set();
    const ab = /\b[A-Z][A-Za-z0-9]{1,5}\b/g;
    while ((m = ab.exec(text))) {
      const k = m[0].toLowerCase();
      if (seen.has(k) || !vocab.abbr[k]) continue;
      seen.add(k);
      abbreviations.push({ abbreviation: m[0], expansion: vocab.abbr[k], start: m.index, end: m.index + m[0].length });
    }
  }

  return {
    original, text, sections, sectionAt, abbreviations,
    arabic: { spans: arabicSpans, chars: arabicSpans.reduce((n, s) => n + s.end - s.start, 0) },
    sectionText(name) { return sections.filter(s => s.name === name).map(s => text.slice(s.start, s.end)).join(' '); },
    sectionsNamed(name) { return sections.filter(s => s.name === name); }
  };
}

module.exports = { normalize, HAS_ARABIC, splitSentences };
