/* ══════════════════════════════════════════════════════════════════════
   DOCUMENTATION GAPS AND PHYSICIAN QUERIES

   When the note does not support a more specific code, the unspecified code
   stands and the missing element is reported, with a query the physician can
   answer. Queries are non-leading: every option is a description read from
   the table, listed in code order (not in the order that would pay more), and
   every query ends with "Other" and "Cannot be determined".
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const AXES = [
  ['laterality', /\b(?:left|right|bilateral|unilateral)\b/i],
  ['acuity', /\b(?:acute|chronic|subacute)\b/i],
  ['severity', /\b(?:mild|moderate|severe)\b/i],
  ['stage', /\b(?:stage|grade)\b/i],
  ['type', /\btype\s+(?:[12]|i{1,2})\b/i],
  ['complications', /\bwith\b.*\b(?:complication|coma|ketoacidosis|lactic acidosis|haemorrhage|perforation|obstruction|gangrene|abscess|neuropathy|nephropathy|retinopathy|angiopathy|ulcer)/i],
  ['control status', /\bpoor control\b|\bcontrolled\b/i],
  ['episode', /\b(?:recurrent|single episode|first episode)\b/i],
  ['cause', /\b(?:due to|secondary to|bacterial|viral|streptococc\w*|staphylococc\w*|haemophilus|klebsiella|pseudomonas|mycoplasma|escherichia|induced)\b/i]
];
/* words that, in the note, settle an axis */
const SETTLED = {
  laterality: /\b(?:left|right|bilateral|unilateral|lt|rt)\b/i,
  acuity: /\b(?:acute|chronic|subacute|acutely|long[- ]standing)\b/i,
  severity: /\b(?:mild|moderate|severe)\b/i,
  stage: /\b(?:stage|grade)\s*\w/i,
  type: /\btype\s*(?:[12]|i{1,2})\b/i,
  episode: /\b(?:recurrent|single|first)\b/i
};

function createGaps(table) {
  function axes(code) {
    const own = table.desc(code) || '';
    const sib = table.siblings(code).map(c => table.desc(c) || '');
    return AXES.filter(([, re]) => sib.some(d => re.test(d)) && !re.test(own)).map(([n]) => n);
  }

  function query(quote, missing, options) {
    const opts = options.concat(['Other (please specify)', 'Cannot be determined clinically']);
    return 'The note documents "' + quote + '". From your clinical findings, can you document the ' + missing
      + '? Options: ' + opts.map((o, i) => '(' + String.fromCharCode(97 + i) + ') ' + o).join('; ') + '.';
  }

  /* a code the note could not make specific */
  function specificity(c, candidates, contextText) {
    const code = c.code;
    const vague = table.isVague(code) || table.isWithoutComplication(code);
    if (!vague) return null;
    const sibs = table.siblings(code).filter(s => !table.isAsterisk(s));
    if (!sibs.length) return null;
    if ((candidates || []).some(k => k.documented)) return null;      /* documented: a coding issue, not a gap */
    const ax = axes(code).filter(a => !(SETTLED[a] && SETTLED[a].test(contextText || '')));
    let missing;
    if (table.isWithoutComplication(code)) missing = ax.filter(a => a === 'complications' || a === 'control status').join(' or ') || 'complications';
    else if (/site not specified|unspecified site/i.test(table.desc(code) || '')) missing = 'site';
    else if (ax.length) missing = ax.join(', ');
    else {
      const named = sibs.filter(s => !/^other\b/i.test(table.desc(s) || '')).sort().slice(0, 3).map(s => table.desc(s));
      missing = named.length ? 'the specific form (the table distinguishes: ' + named.join('; ') + ')' : 'the specific form';
    }
    if (missing === 'site') {
      return { concerns: code, missing, physician_query: query((c.spans[0] || {}).quote || c.term, 'site', ['State the site']) };
    }
    const options = sibs.slice().sort().slice(0, 4).map(s => table.desc(s));
    return { concerns: code, missing, physician_query: query((c.spans[0] || {}).quote || c.term, missing, options) };
  }

  /* the code asserts something the words do not say: bare "diabetes" coded
     as type 2, "peptic ulcer" coded as acute */
  const ASSERTS = [
    { axis: 'type of diabetes', code: /^E1[01]/, desc: /\btype [12]\b/i, words: /\btype\s*(?:1|2|i|ii|one|two)\b|\bt[12]dm\b|\biddm\b|\bniddm\b|\bjuvenile\b|\binsulin[- ]dependent\b/i, options: ['E10', 'E11', 'E13', 'E14'] },
    { axis: 'acuity', code: /./, desc: /^acute\b/i, words: /\bacute\b|\bsudden\b|\bacutely\b|\bhyperacute\b/i },
    { axis: 'acuity', code: /./, desc: /^chronic\b/i, words: /\bchronic\b|\blong[- ]standing\b|\bpersistent\b|\bknown\b/i },
    { axis: 'laterality', code: /./, desc: /\b(?:left|right)\b/i, words: /\b(?:left|right|lt|rt)\b/i }
  ];
  /* does the family distinguish this axis at all? (every I21 is acute; K27 is
     acute, chronic or unspecified) */
  function familyDistinguishes(code, re) {
    return table.siblings(code).some(s => !re.test(table.desc(s) || ''));
  }
  function unsupported(c, contextText, wholeNote) {
    const d = table.desc(c.code) || '';
    const q = (c.spans[0] || {}).quote || c.term;
    for (const a of ASSERTS) {
      if (!a.code.test(c.code) || !a.desc.test(d)) continue;
      if (!familyDistinguishes(c.code, a.desc) && !a.options) continue;
      /* the type of diabetes may be written anywhere in the note; acuity and
         side must be written where the condition is */
      if (a.words.test(a.options ? wholeNote : contextText)) continue;
      let options;
      if (a.options) options = a.options.map(r => { const k = r + c.code.slice(3); return table.has(k) ? k + ' ' + table.desc(k) : null; }).filter(Boolean);
      else options = table.siblings(c.code).filter(s => !table.isAsterisk(s)).sort().slice(0, 4).map(s => s + ' ' + table.desc(s));
      options = options.filter(o => o.indexOf(c.code + ' ') !== 0);
      const listed = [c.code + ' ' + d].concat(options).slice(0, 5).sort();     /* code order, not the order that pays */
      return { axis: a.axis, quote: q,
               gap: { concerns: c.code, missing: a.axis, physician_query: query(q, a.axis, listed) } };
    }
    return null;
  }

  /* neoplasms whose code needs a morphology (Morph_Code = 1) */
  const HISTOLOGY = /\b(?:carcinoma|hepatocellular|cholangiocarcinoma|adenocarcinoma|squamous cell|small cell|non-small cell|ductal|lobular|transitional cell|urothelial carcinoma|basal cell|melanoma|sarcoma|lymphoma|leukaemia|leukemia|myeloma|carcinoid|neuroendocrine|glioma|glioblastoma|astrocytoma|mesothelioma|seminoma|teratoma|adenoma|carcinoma in situ|histology|histopathology|biopsy (?:shows|showed|confirmed|revealed))\b/i;
  function morphology(c, text) {
    const r = table.rec(c.code);
    if (!r || !r.morphologyRequired) return null;
    const m = HISTOLOGY.exec(text);
    return { documented: !!m, histology: m ? m[0] : null,
             gap: m ? null : { concerns: c.code, missing: 'histology (morphology) of the neoplasm',
                              physician_query: query((c.spans[0] || {}).quote || c.term, 'histological type of this neoplasm, as reported by pathology',
                                                     ['Histology reported (please state the type and behaviour)', 'Histology awaited']) } };
  }

  /* admitted injuries: external cause, place of occurrence, activity */
  const MECHANISM = /\b(?:fell|fall|falls|tripped|slipped|collision|rta|road traffic|motor vehicle|mvc|car|motorcycle|bicycle|pedestrian|assault(?:ed)?|struck|hit by|punched|kicked|stabbed|stab|gunshot|burn(?:ed|t)?|scald(?:ed)?|bite|bitten|crush(?:ed)?|dog|machinery|sports? injury|inverted|twisted|lifting)\b/i;
  const PLACE = /\b(?:at home|home|in the house|kitchen|bathroom|garden|at work|workplace|factory|construction site|school|street|road|highway|farm|shop|mall|playground|sports? (?:field|ground|centre)|gym|swimming pool|mosque|hospital|nursing home|care home)\b/i;
  const ACTIVITY = /\b(?:playing|football|soccer|basketball|sport|running|walking|working|driving|cycling|riding|climbing|cooking|cleaning|lifting|swimming|sleeping|leisure|exercise|training)\b/i;
  function externalCause(injuries, codedAll, text, encounter) {
    if (!(encounter === 'inpatient' || encounter === 'day_case') || !injuries.length) return null;
    if (!table.size) return null;
    const hasEC = codedAll.some(c => /^[VWXY]/.test(c));
    const hasPlace = codedAll.some(c => /^Y92/.test(c));
    const hasActivity = codedAll.some(c => /^U(5\d|6\d|7[0-3])/.test(c));
    const miss = [];
    if (!hasEC) miss.push(['external cause', MECHANISM, 'how the injury happened (mechanism and intent)']);
    if (!hasPlace) miss.push(['place of occurrence', PLACE, 'where it happened']);
    if (!hasActivity) miss.push(['activity', ACTIVITY, 'what the patient was doing']);
    return miss.map(([name, re, ask]) => {
      const m = re.exec(text);
      return { element: name, documented: !!m, quote: m ? m[0] : null, ask };
    });
  }

  return { specificity, unsupported, morphology, externalCause, axes, query };
}

module.exports = { createGaps };
