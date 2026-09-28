/* ══════════════════════════════════════════════════════════════════════
   STAGE 5 · SEQUENCE — principal and additional diagnoses

   ACS 0001 (principal): for an admitted episode, the condition established
   after study to be chiefly responsible for the admission; for a non-admitted
   encounter, the condition chiefly responsible for this encounter. A
   definitive diagnosis replaces its presenting symptom; a chapter R symptom is
   principal only when no definitive diagnosis is documented; a pre-existing
   condition is principal only when the encounter is about it. Never principal:
   codes the table marks UnacceptPDx, manifestation (asterisk) codes, external
   causes.

   ACS 0002 (additional): a documented condition is coded when it affects this
   encounter — treatment, investigation, monitoring, or a documented
   comorbidity that changes risk.

   Two conditions that each reasonably meet ACS 0001 are not decided here:
   the physician is asked.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const BACKGROUND = /\b(?:known|background of|with a background|background|pmh|past medical history|history of|long[- ]standing|established|on (?:long-term|regular))\b[^.;]{0,60}$/i;
const SUBORDINATE = /\b(?:with|due to|secondary to|complicated by|causing|caused by|from|in the setting of|on (?:a )?background|associated with|leading to|resulting in|following|after|because of)\b/i;
const COORDINATE = /^[\s,;&/+]*(?:and|plus|as well as|&|\+|,|;|\/)?[\s,;&/+]*$/i;
const SEPSIS = /^(?:A40|A41|A02\.1|A20\.7|A21\.7|A22\.7|A24\.1|A26\.7|A32\.7|A39\.[1-4]|A42\.7|A54\.8|B00\.7|B37\.7|R65)/;

function createSequencer(table, rx) {
  const quoteOf = c => (c.spans[0] && c.spans[0].quote) || c.term;

  function isBackground(doc, c) {
    return c.spans.every(s => {
      if (s.section === 'pmh') return true;
      const ctx = rx._stCtx(doc.text, s.start, s.end - s.start);
      return BACKGROUND.test(ctx.before);
    });
  }
  function assessmentPos(c) {
    const a = c.spans.filter(s => s.section === 'assessment').map(s => s.start);
    return a.length ? Math.min.apply(null, a) : null;
  }
  const eligible = c => {
    const r = table.rec(c.code) || {};
    return table.has(c.code) && !r.unacceptPdx && !r.asterisk && !r.externalCause;
  };
  const whyNot = c => {
    const r = table.rec(c.code) || {};
    if (r.asterisk) return 'a manifestation (asterisk) code, never principal';
    if (r.externalCause) return 'an external cause code, never principal';
    if (r.unacceptPdx) return 'marked in the table as not acceptable as principal diagnosis';
    return null;
  };

  /* ---------- principal ---------- */
  function choose(doc, conds, encounter) {
    const setting = encounter === 'inpatient' || encounter === 'day_case' ? 'admitted episode' : 'non-admitted encounter';
    conds.forEach(c => {
      c.background = isBackground(doc, c);
      c.assessmentAt = assessmentPos(c);
      c.named = c.named || c.assessmentAt !== null;
      c.eligible = eligible(c);
    });
    const pool = conds.filter(c => c.eligible);
    const byPos = (a, b) => ((a.assessmentAt === null ? 1e9 : a.assessmentAt) - (b.assessmentAt === null ? 1e9 : b.assessmentAt)) || (a.firstAt - b.firstAt);
    const tiers = [
      ['named', pool.filter(c => c.named && !c.symptom && !(c.background && c.assessmentAt === null)).sort(byPos)],
      ['named_symptom', pool.filter(c => c.named && c.symptom).sort(byPos)],
      ['definitive', pool.filter(c => !c.named && !c.symptom && !c.background).sort(byPos)],
      ['symptom', pool.filter(c => !c.named && c.symptom && c.enginePrincipal !== false).sort((a, b) => (b.enginePrincipal - a.enginePrincipal) || (b.engine.conf || 0) - (a.engine.conf || 0))],
      ['background', pool.filter(c => c.background && !c.symptom).sort(byPos)]
    ];
    let tier = null, list = [];
    for (const [name, l] of tiers) { if (l.length) { tier = name; list = l; break; } }
    if (!list.length) return { principal: null, tier: null, clarification: null, setting };

    let principal = list[0];
    let rule = 'ACS 0001';
    let clarification = null;

    /* one phrase, two codes: sepsis goes first (ACS 0110) */
    const samePhrase = list.filter(c => c !== principal && c.spans.some(s => principal.spans.some(t => t.start === s.start)));
    if (samePhrase.length) {
      const sep = [principal].concat(samePhrase).find(c => SEPSIS.test(c.code));
      if (sep) { principal = sep; rule = 'ACS 0110 with ACS 0001'; }
    }

    /* two named definitive diagnoses written as equals: ask */
    if (tier === 'named' && list.length > 1 && rule === 'ACS 0001') {
      const second = list.find(c => c !== principal && !c.background && !samePhrase.includes(c) && c.assessmentAt !== null);
      if (second && principal.assessmentAt !== null) {
        const a = principal.spans.find(s => s.start === principal.assessmentAt);
        const b = second.spans.find(s => s.start === second.assessmentAt);
        const between = a && b && a.end <= b.start ? doc.text.slice(a.end, b.start) : null;
        const sameLine = between !== null && !/\n/.test(between);
        if (between !== null && sameLine && !SUBORDINATE.test(between) && COORDINATE.test(between.replace(/\b(?:acute|chronic|severe|mild|moderate|left|right|bilateral|community[- ]acquired|uncomplicated|complicated)\b/gi, ''))) {
          clarification = {
            type: 'principal_ambiguous',
            question: 'The assessment names ' + quoteOf(principal) + ' and ' + quoteOf(second)
              + ' together. Which of these was chiefly responsible for this ' + (setting === 'admitted episode' ? 'admission' : 'encounter') + '?',
            options: [
              principal.code + ' ' + table.desc(principal.code),
              second.code + ' ' + table.desc(second.code),
              'Other (please specify)',
              'Cannot be determined — both equally'
            ],
            concerns: [principal.code, second.code]
          };
        }
      }
    }

    /* the reason: the rule, the words, and why it beats the rest */
    const q = quoteOf(principal);
    let reason;
    if (rule.indexOf('0110') >= 0) {
      reason = rule + ' (' + setting + '): "' + q + '" documents sepsis with its localised infection in one phrase; the systemic infection is sequenced first and the localised infection follows as an additional diagnosis.';
    } else if (tier === 'named') {
      reason = rule + ' (' + setting + '): the assessment names ' + table.desc(principal.code) + ' ("' + q + '")'
        + (list.length > 1 ? ' first' : '') + ', so it is taken as chiefly responsible for this ' + (setting === 'admitted episode' ? 'admission' : 'encounter') + '.';
    } else if (tier === 'named_symptom') {
      reason = rule + ' (' + setting + '): no definitive diagnosis is established in the assessment; the symptom it names ("' + q + '") is chiefly responsible for this encounter. A chapter R code is principal only in that case.';
    } else if (tier === 'definitive') {
      reason = rule + ' (' + setting + '): the note documents ' + table.desc(principal.code) + ' ("' + q + '") as the diagnosis established for this encounter; no assessment names another.';
    } else if (tier === 'symptom') {
      reason = rule + ' (' + setting + '): no definitive diagnosis is documented, so the presenting symptom ("' + q + '") is principal. A definitive diagnosis, once documented, replaces it.';
    } else {
      reason = rule + ' (' + setting + '): the only condition documented is pre-existing ("' + q + '"); it is principal only because nothing else in the note occasioned the encounter.';
    }
    const others = conds.filter(c => c !== principal);
    const beats = others.map(c => {
      let why = whyNot(c);
      if (!why && c.symptom) why = 'a symptom, and a diagnosis is documented';
      if (!why && c.background && !c.named) why = 'a pre-existing condition documented in the history';
      if (!why && samePhrase.includes(c)) why = 'the localised infection from the same phrase';
      if (!why && c.named && principal.named) why = 'named after it in the assessment';
      if (!why && !c.named && principal.named) why = 'not named in the assessment';
      if (!why) why = 'documented after it';
      return c.code + ' (' + why + ')';
    });
    if (beats.length) reason += ' It outranks ' + beats.join('; ') + '.';
    if (clarification) reason += ' Provisional: the assessment gives two conditions equal weight, so the physician is asked.';
    return { principal, tier, rule, reason, clarification, setting };
  }

  /* ---------- additional diagnoses (ACS 0002) ---------- */
  function affects(doc, c, links, meds) {
    const a = new Set();
    const supports = [];
    links.forEach(l => {
      if (l.supported_by.indexOf(c.code) < 0) return;
      supports.push(l.service);
      a.add(l.kind === 'medication' || l.kind === 'referral' || l.kind === 'therapy' ? 'treatment' : 'investigation');
    });
    (meds || []).forEach(m => { if (m.roots && m.roots.has(c.code.split('.')[0])) a.add('treatment'); });
    const sentences = c.spans.map(s => rx._stSentence(doc.text, s.start)).join(' ');
    if (/\b(?:monitor|observ|review|follow[- ]?up|controlled|control|stable|readings?|continue)\w*/i.test(sentences)) a.add('monitoring');
    if (c.background || /^(?:F17|Z72\.0|Z8[0-9]|Z9[1-9])/.test(c.code)) a.add('risk');
    if (!a.size && c.named) a.add('monitoring');
    return { affects: Array.from(a), supports };
  }

  function additional(doc, conds, principal, links, meds) {
    return conds.filter(c => c !== principal).sort((a, b) => {
      if (a.named !== b.named) return a.named ? -1 : 1;
      return (a.assessmentAt === null ? a.firstAt : a.assessmentAt) - (b.assessmentAt === null ? b.firstAt : b.assessmentAt);
    }).map(c => {
      const f = affects(doc, c, links, meds);
      const bits = [];
      if (f.affects.indexOf('treatment') >= 0) bits.push('it is treated in this encounter');
      if (f.affects.indexOf('investigation') >= 0) bits.push('it justifies ' + f.supports.filter(Boolean).slice(0, 3).join(', '));
      if (f.affects.indexOf('monitoring') >= 0) bits.push('it is assessed or monitored');
      if (f.affects.indexOf('risk') >= 0) bits.push('it is a current comorbidity that the physician recorded');
      const reason = f.affects.length
        ? 'ACS 0002: coded as an additional diagnosis because ' + bits.join('; ') + ' ("' + quoteOf(c) + '").'
        : null;
      return Object.assign(c, { affects: f.affects, supports: f.supports, reason });
    });
  }

  return { choose, additional, isBackground, eligible };
}

module.exports = { createSequencer, SEPSIS };
