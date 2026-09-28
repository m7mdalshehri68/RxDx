/* ══════════════════════════════════════════════════════════════════════
   STAGE 3 · CANDIDATES

   For every coded condition the engine could not make fully specific, and for
   every phrase in the assessment the engine did not code at all, retrieve up
   to N codes from the ICD-10-AM table. Candidates come only from the table:
   the siblings of the engine's code, or codes whose own description shares
   the physician's words. A candidate is "documented" only when every word
   that distinguishes it from the engine's code is written in the note.

   Candidates are a proposal for the adjudicator and for the coder. The
   deterministic path never swaps a code on its own.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const QUALIFIER = new Set(('left right bilateral unilateral acute chronic subacute mild moderate severe primary secondary '
  + 'recurrent single episode early late stage grade type initial subsequent sequela').split(' '));
const NOISE = new Set(('patient year years month months week weeks day days hours hour today plan impression assessment diagnosis '
  + 'likely possible probable suspected known history review urgent routine for with and the of to on in at '
  + 'symptoms symptom features related associated controlled well moderate').split(' '));

function createCandidates(table) {
  const W = table.words;

  /* a description word is documented when the note carries it, or a longer or
     shorter form of it ("neuropathy" for "polyneuropathy") */
  const singular = w => w.replace(/(?:es|s)$/, '');
  function documented(word, bag) {
    if (bag.has(word)) return true;
    const s = singular(word);
    for (const w of bag) if (singular(w) === s) return true;
    return false;
  }

  /* the words a sibling adds to the engine's code — "anaemias" against
     "anaemia" adds nothing */
  function distinguishing(code, from) {
    const base = new Set(W(table.desc(from)).map(singular));
    return W(table.desc(code)).filter(w => !base.has(singular(w)));
  }

  /* siblings of an unspecified / "without complication" code, ranked by how much
     of what distinguishes them the note actually says */
  function forCondition(cond, context, limit) {
    const code = cond.code;
    const vague = table.isVague(code) || table.isWithoutComplication(code);
    if (!vague) return { vague: false, candidates: [] };
    const bag = new Set(W(context));
    const sibs = table.siblings(code).filter(s => !table.isAsterisk(s)).map(s => {
      const dist = distinguishing(s, code);
      const hit = dist.filter(w => documented(w, bag));
      return { code: s, distinguishing: dist, matched: hit, documented: dist.length > 0 && hit.length === dist.length };
    }).filter(s => s.distinguishing.length);
    sibs.sort((a, b) => (b.documented - a.documented) || (b.matched.length - a.matched.length)
      || (table.isVague(a.code) - table.isVague(b.code)) || a.code.localeCompare(b.code));
    return { vague: true, candidates: sibs.slice(0, limit) };
  }

  /* Assessment phrases no span covers: "diabetic peripheral neuropathy" when
     the engine only had "type 2 diabetes". */
  function unresolved(doc, coveredSpans, limit) {
    const out = [];
    doc.sectionsNamed('assessment').forEach(sec => {
      const text = doc.text.slice(sec.start, sec.end);
      const re = /[^,;.\n—–()]+/g;
      let m;
      while ((m = re.exec(text))) {
        let a = sec.start + m.index, b = a + m[0].length;
        const raw = doc.text.slice(a, b);
        /* an uncertain phrase is the uncertainty rule's business, not a gap */
        if (/^\s*(?:\d+[.)]\s*)?(?:likely|possible|possibly|probable|probably|suspected|query|\?|rule out|r\/o|to exclude|versus|vs|differential|consider)\b/i.test(raw)) continue;
        const lead = raw.length - raw.replace(/^\s*(?:\d+[.)]\s*)?(?:and|with|plus|also)?\s*/i, '').length;
        a += lead;
        b = a + doc.text.slice(a, b).replace(/\s+$/, '').length;
        if (b - a < 4) continue;
        /* a phrase that already holds a coded or refused mention is that
           mention's detail, handled as its specificity */
        if (coveredSpans.some(s => s.start < b && s.end > a)) continue;
        const content = W(doc.text.slice(a, b)).filter(w => !NOISE.has(w) && !QUALIFIER.has(w));
        if (content.length < 2) continue;
        const cands = table.search(content.join(' '), { limit, minWords: 2 });
        if (!cands.length) continue;
        out.push({ phrase: doc.original.slice(a, b), start: a, end: b, section: 'assessment', words: content, candidates: cands.map(c => c.code) });
      }
    });
    return out;
  }

  return { forCondition, unresolved, distinguishing, documented };
}

module.exports = { createCandidates };
