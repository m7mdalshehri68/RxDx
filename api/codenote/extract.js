/* ══════════════════════════════════════════════════════════════════════
   STAGE 2 · EXTRACT

   The RxDx engine is the first and authoritative pass. This stage asks it what
   it coded and what it refused, then does two things the engine does not:

   1. collects every verbatim span that supports each code, with its section,
      so the evidence a coder sees is the physician's own words at exact offsets;
   2. names the assertion status of every mention — present, negated, family,
      historical, uncertain, hypothetical — by reading the engine's own
      negation rules in the engine's own order, so the explanation is the
      engine's reason, not a second opinion.

   Two checks are added on top, both of which can only remove a code, never
   add one: a mention inside a "Family history:" section belongs to a relative,
   and a condition written only as history ("history of", "previous", "s/p")
   is history.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const FAMILY_WORD = /^(?:family history|father|mother|brother|sister|son|daughter|grandfather|grandmother|uncle|aunt|cousin|sibling|parent|relative|husband|wife|partner|contact)$/i;
const HYPOTHETICAL_WORD = /^(?:risk of|screening for|if|should|would|may|might)$/i;
/* "history of", "previous", "s/p" in front of the phrase, in the same clause.
   Not "old" (a 6 month old boy) and not "past" (for the past year). */
const HISTORY_BEFORE = /\b(?:past (?:medical )?history of|history of|h\/o|previous(?:ly)?|prior|s\/p|status post|treated for|in remission from)\s+(?:[a-z-]+\s+){0,3}$/i;

function termsByCode(rx) {
  const by = Object.create(null);
  rx._buildNoteIndexes().probTerms.forEach(t => { (by[t.code] = by[t.code] || []).push(t.term); });
  return by;
}

function createExtractor(engine, table) {
  const rx = engine.load().rx;
  let TERMS = null;
  const terms = code => { if (!TERMS) TERMS = termsByCode(rx); return TERMS[code] || []; };

  /* ---------- why the engine did or did not accept a mention ----------
     Same rules, same order as _stActive, returning which one fired. */
  function assertion(text, start, len, section) {
    if (section === 'family_history') return { status: 'family', cue: 'Family history section' };
    const c = rx._stCtx(text, start, len);
    let m = rx.ST_NEG.exec(c.before);
    if (m) {
      const w = m[1].toLowerCase();
      if (/ruled out|rules out|excluded|excludes/.test(w)) return { status: 'ruled_out', cue: m[1] };
      if (w === 'resolved') return { status: 'historical', cue: m[1] };
      return { status: 'negated', cue: m[1] };
    }
    m = /^\s*[:\-—]?\s*(no|nil|none|negative|absent|denied)\b/i.exec(c.after);
    if (m) return { status: 'negated', cue: m[1] };
    m = /^[^,;]{0,40}\b(ruled out|excluded|resolved|settled|absent|negative|not (?:present|found|seen)|has resolved|no longer|improved and gone|cleared)\b/i.exec(c.after);
    if (m) {
      if (/ruled out|excluded/i.test(m[1])) return { status: 'ruled_out', cue: m[1] };
      if (/resolved|settled|no longer|cleared|improved/i.test(m[1])) return { status: 'historical', cue: m[1] };
      return { status: 'negated', cue: m[1] };
    }
    m = rx.ST_ATTRIB.exec(c.clause);
    if (m) {
      if (FAMILY_WORD.test(m[1])) return { status: 'family', cue: m[1] };
      if (HYPOTHETICAL_WORD.test(m[1])) return { status: 'hypothetical', cue: m[1] };
      return { status: 'uncertain', cue: m[1] };
    }
    m = rx.ST_HYPO.exec(c.before);
    if (m) {
      if (HYPOTHETICAL_WORD.test(m[1])) return { status: 'hypothetical', cue: m[1] };
      return { status: 'uncertain', cue: m[1] };
    }
    /* the pipeline's own, stricter reading: history is not the present */
    m = HISTORY_BEFORE.exec(c.before);
    if (m) return { status: 'historical', cue: m[0].trim().split(/\s+/).slice(0, 2).join(' ') };
    return { status: 'present', cue: null };
  }

  /* Every place a term occurs in the text, with the offsets of the words
     themselves (the engine's matcher carries the boundary characters). */
  function occurrences(text, term) {
    let re;
    try { re = rx._wordRe(term); } catch (_) { return []; }
    const g = new RegExp(re.source, re.flags.indexOf('g') >= 0 ? re.flags : re.flags + 'g');
    const out = [];
    let m;
    while ((m = g.exec(text))) {
      const raw = m[0];
      const lead = raw.length - raw.replace(/^[^A-Za-z0-9]+/, '').length;
      const start = m.index + lead;
      out.push({ start, end: start + term.length, raw, rawAt: m.index });
      g.lastIndex = Math.max(m.index + 1, start + term.length);
    }
    return out;
  }

  function spansFor(code, doc) {
    const text = doc.text, low = text.toLowerCase();
    const out = [];
    terms(code).forEach(term => {
      if (low.indexOf(term) < 0) return;
      if (!rx._termAllowed(term, text)) return;
      occurrences(text, term).forEach(o => {
        const section = doc.sectionAt(o.start);
        const engineActive = rx._stActive(text, o.raw, o.rawAt);
        const a = assertion(text, o.start, o.end - o.start, section);
        /* where the engine accepted the mention, only the pipeline's two
           stricter readings (family section, history) can overrule it */
        const status = engineActive ? (a.status === 'family' || a.status === 'historical' ? a.status : 'present') : (a.status === 'present' ? 'negated' : a.status);
        out.push({ code, term, start: o.start, end: o.end, quote: doc.original.slice(o.start, o.end),
                   section, engineActive, assertion: status, cue: a.cue });
      });
    });
    /* one span per place in the text: the longest phrase wins */
    out.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    return out.filter((s, i) => !out.some((t, j) => j !== i && t.start <= s.start && t.end >= s.end && (t.end - t.start) > (s.end - s.start)));
  }

  /* ══════════════════════════════════════════════════════════════════ */
  function extract(doc, opts) {
    opts = opts || {};
    const found = engine.problems(doc.text);          /* THE authoritative pass */
    const conditions = [];
    const dropped = [];

    found.forEach(p => {
      if (!table.has(p.code)) return;                  /* closed set, even for the engine */
      let spans = spansFor(p.code, doc);
      let active = spans.filter(s => s.engineActive);
      if (!active.length && typeof p.offset === 'number' && p.offset >= 0) {
        /* the engine's own offset, as a last resort */
        const end = p.offset + p.term.length;
        active = [{ code: p.code, term: p.term, start: p.offset, end, quote: doc.original.slice(p.offset, end),
                    section: doc.sectionAt(p.offset), engineActive: true, assertion: 'present', cue: null }];
      }
      const present = active.filter(s => s.assertion === 'present');
      const cond = {
        code: p.code, term: p.term, engine: p,
        named: p.named, symptom: p.symptom, enginePrincipal: p.principal,
        spans: present.length ? present : active,
        allSpans: spans,
        assertion: present.length ? 'present' : (active[0] ? active[0].assertion : 'present'),
        firstAt: Math.min.apply(null, (present.length ? present : active).map(s => s.start).concat([1e9]))
      };
      if (cond.assertion === 'family' || cond.assertion === 'historical') dropped.push(cond);
      else conditions.push(cond);
    });

    /* a span inside a longer phrase that earned a different code is that
       code's evidence, not this one's — unless it is all this code has */
    const all = [];
    conditions.forEach(c => c.spans.forEach(s => all.push(s)));
    conditions.forEach(c => {
      const own = c.spans.filter(s => !all.some(t => t.code !== c.code && t.start <= s.start && t.end >= s.end && (t.end - t.start) > (s.end - s.start)));
      if (own.length) c.spans = own;
    });

    /* what the engine read and set aside */
    const coded = new Set(conditions.map(c => c.code));
    const refused = [];
    const seenMention = new Set();
    (opts.refusals === false ? [] : engine.refused(doc.text)).forEach(r => {
      if (coded.has(r.code) || !table.has(r.code)) return;
      const start = r.offset, end = r.offset + String(r.term).length;
      if (doc.original.slice(start, end).toLowerCase() !== String(r.term).toLowerCase()) return;
      const section = doc.sectionAt(start);
      const a = assertion(doc.text, start, end - start, section);
      const key = start + ':' + end;
      const existing = refused.find(x => x.key === key);
      if (existing) { if (existing.codes.indexOf(r.code) < 0) existing.codes.push(r.code); return; }
      if (seenMention.has(r.term.toLowerCase() + '|' + a.status)) return;
      seenMention.add(r.term.toLowerCase() + '|' + a.status);
      refused.push({ key, mention: doc.original.slice(start, end), codes: [r.code], start, end, section,
                     assertion: a.status === 'present' ? 'negated' : a.status, cue: a.cue });
    });
    dropped.forEach(c => {
      const s = c.spans[0] || {};
      refused.push({ key: 'd' + c.code, mention: s.quote || c.term, codes: [c.code], start: s.start, end: s.end,
                     section: s.section, assertion: c.assertion, cue: s.cue, droppedByPipeline: true });
    });

    return { conditions, refused };
  }

  return { extract, assertion, spansFor, occurrences, terms };
}

module.exports = { createExtractor };
