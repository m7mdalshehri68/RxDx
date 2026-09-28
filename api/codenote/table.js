/* ══════════════════════════════════════════════════════════════════════
   THE CLOSED CODE SET

   Every code the coding pipeline returns must exist in the ICD-10-AM table the
   tool loaded, at the moment of the request, and must not be switched off by
   the hospital. Descriptions are read from that table and never written here.

   Built once from the engine's own ICD_MAP and AGE, so this view cannot drift
   from the tool. Nothing in this file knows a single code by heart except the
   classification's own chapter boundaries.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const crypto = require('crypto');

const STOP = new Set(('a an and or of the in on with without to for by from at as due other unspecified '
  + 'specified not elsewhere classified nos than which is are be its their any site sites part parts '
  + 'type use disease diseases disorder disorders condition conditions').split(' '));

function words(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w.length > 2 && !STOP.has(w));
}

/* "15–124" (years) as the AGE table writes it; "15 y – 124 y", "0 d – 1 y" as
   the formulary writes it. Both are read; either may refuse a code. */
function parseBand(s) {
  const txt = String(s || '').trim();
  let m = /^(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?)$/.exec(txt);
  if (m) return { lo: +m[1], hi: +m[2], txt: txt + ' years' };
  m = /^\s*(\d+(?:\.\d+)?)\s*(d|mo|y)\s*[–—-]\s*(\d+(?:\.\d+)?)\s*(d|mo|y)/i.exec(txt);
  if (!m) return null;
  const f = (v, u) => { v = parseFloat(v); u = u.toLowerCase(); return u === 'd' ? v / 365.25 : (u === 'mo' ? v / 12 : v); };
  return { lo: f(m[1], m[2]), hi: f(m[3], m[4]), txt };
}

function createTable(rx, opts) {
  opts = opts || {};
  const MAP = rx.ICD_MAP;
  const codes = Object.keys(MAP).sort();
  let coding = { off: {}, def: {} };
  try { coding = rx._itcCoding() || coding; } catch (_) {}
  const OFF = coding.off || {};

  /* ---------- manifestation (asterisk) codes and their etiology (dagger) ----------
     The table carries the dagger/asterisk convention inside its descriptions:
     "Cytomegaloviral pneumonitis (J17.1*)" names the manifestation a dagger code
     pairs with; "Cardiovascular syphilis (A52.0+)" names the etiology an
     asterisk code needs; "... in diseases classified elsewhere" is a
     manifestation whose etiology the note must supply. */
  const ASTERISK = Object.create(null);         /* code -> [dagger codes or ranges] */
  const expand = ref => {
    const c = ref.replace(/[-*+]/g, '');
    if (MAP[c]) return [c];
    return codes.filter(k => k === c || k.indexOf(c + '.') === 0 || (c.length === 3 && k.slice(0, 3) === c));
  };
  const rangeOf = s => {
    const m = /^([A-Z]\d{2}(?:\.\d{1,3})?)(?:-([A-Z]\d{2}(?:\.\d{1,3})?))?$/.exec(s.replace(/[-+*]$/, ''));
    return m ? { from: m[1], to: m[2] || m[1] } : null;
  };
  codes.forEach(code => {
    const d = MAP[code].ascii_desc || '';
    (d.match(/\b[A-Z]\d{2}(?:\.\d{1,3})?-?\*/g) || []).forEach(ref => {
      expand(ref).forEach(a => { (ASTERISK[a] = ASTERISK[a] || []).push({ from: code, to: code }); });
    });
  });
  codes.forEach(code => {
    const d = MAP[code].ascii_desc || '';
    const back = /\(([A-Z]\d{2}(?:\.\d{1,3})?-?(?:\s*[-–]\s*[A-Z]\d{2}(?:\.\d{1,3})?-?)?)\+\)/.exec(d);
    if (back) {
      const r = rangeOf(back[1].replace(/\s+/g, '').replace(/–/g, '-').replace(/-(?=-)/, ''));
      ASTERISK[code] = ASTERISK[code] || [];
      if (r) ASTERISK[code].push(r);
    }
    if (/\bin\b[^()]*\bclassified elsewhere\b/i.test(d)) ASTERISK[code] = ASTERISK[code] || [];
  });
  const inRange = (code, r) => {
    const a = r.from, b = r.to;
    const c3 = code.slice(0, a.length), c3b = code.slice(0, b.length);
    return c3 >= a && c3b <= b;
  };

  /* ---------- age bands: AGE (the tool's table) and the formulary's ---------- */
  const AGE = Object.create(null);
  Object.keys(rx.AGE || {}).forEach(c => { const b = parseBand(rx.AGE[c]); if (b) AGE[c.toUpperCase()] = b; });
  const AGE_FORMULARY = Object.create(null);
  (opts.formularyAges || []).forEach(([c, s]) => { const b = parseBand(s); if (b && !AGE_FORMULARY[c]) AGE_FORMULARY[c] = b; });

  /* ---------- a small inverted index over descriptions, for candidates ---------- */
  const INDEX = Object.create(null);
  codes.forEach(code => {
    if (OFF[code]) return;
    new Set(words(MAP[code].ascii_desc)).forEach(w => { (INDEX[w] = INDEX[w] || []).push(code); });
  });
  const VOCAB_WORDS = Object.keys(INDEX);

  const byRoot = Object.create(null);
  codes.forEach(c => { (byRoot[c.split('.')[0]] = byRoot[c.split('.')[0]] || []).push(c); });

  const fingerprint = crypto.createHash('sha256').update(codes.join(',')).digest('hex').slice(0, 12);

  const T = {
    size: codes.length,
    fingerprint,
    switchedOff: Object.keys(OFF),
    hospitalDefaults: Object.keys(coding.def || {}).length,

    /* 'ok' | 'not_in_table' | 'switched_off' */
    status(code) {
      const c = String(code || '').toUpperCase().trim();
      if (!MAP[c]) return 'not_in_table';
      if (OFF[c]) return 'switched_off';
      return 'ok';
    },
    has(code) { return T.status(code) === 'ok'; },
    desc(code) { const r = MAP[String(code || '').toUpperCase()]; return r ? r.ascii_desc : null; },
    rec(code) {
      const c = String(code || '').toUpperCase();
      const r = MAP[c];
      if (!r) return null;
      return {
        code: c,
        description: r.ascii_desc,
        sex: r.sex | 0,
        unacceptPdx: r.UnacceptPDx === 1,
        morphologyRequired: r.Morph_Code === 1,
        asterisk: !!ASTERISK[c],
        externalCause: T.isExternalCause(c),
        ageBands: [AGE[c] || AGE[c.split('.')[0]], AGE_FORMULARY[c] || AGE_FORMULARY[c.split('.')[0]]]
          .filter(Boolean).filter((b, i, a) => a.findIndex(x => x.lo === b.lo && x.hi === b.hi) === i)
      };
    },
    root(code) { return String(code).split('.')[0]; },
    siblings(code) {
      const c = String(code).toUpperCase();
      return (byRoot[T.root(c)] || []).filter(k => k !== c && !OFF[k]);
    },
    isVague(code) {
      return /unspecified|not specified|\bNOS\b/i.test(T.desc(code) || '');
    },
    isWithoutComplication(code) {
      return /without (?:mention of )?complication/i.test(T.desc(code) || '');
    },
    isAsterisk(code) { return !!ASTERISK[String(code).toUpperCase()]; },
    /* the daggers the table names for this manifestation; [] means "any etiology" */
    daggerRanges(code) { return ASTERISK[String(code).toUpperCase()] || []; },
    isDaggerFor(dagger, asterisk) {
      const rs = T.daggerRanges(asterisk);
      if (!rs.length) return !T.isAsterisk(dagger) && !/^[RVWXYZ]/.test(dagger) && !/^U[5-9]/.test(dagger);
      return rs.some(r => inRange(String(dagger).toUpperCase(), r));
    },
    daggerCandidates(asterisk, limit) {
      const rs = T.daggerRanges(asterisk);
      const out = [];
      rs.forEach(r => codes.forEach(c => { if (!OFF[c] && inRange(c, r) && out.indexOf(c) < 0) out.push(c); }));
      return out.slice(0, limit || 5);
    },
    /* chapter XX external causes, and the ICD-10-AM activity codes (U50–U73) */
    isExternalCause(code) {
      const c = String(code).toUpperCase();
      return /^[VWXY]\d/.test(c) || /^U(5\d|6\d|7[0-3])/.test(c);
    },
    isInjury(code) { return /^[ST]\d/.test(String(code).toUpperCase()) && !/^T(8[0-8])/.test(String(code).toUpperCase()); },
    isNeoplasm(code) { return /^C\d|^D[0-4]\d/.test(String(code).toUpperCase()); },
    /* codes from the table whose description shares the most words with `text` */
    search(text, opts2) {
      opts2 = opts2 || {};
      const ws = Array.from(new Set(words(text)));
      if (!ws.length) return [];
      const score = Object.create(null);
      ws.forEach(w => {
        const hits = INDEX[w] || [];
        /* a word the table spells longer ("neuropathy" inside "polyneuropathy") */
        const also = w.length >= 6 ? VOCAB_WORDS.filter(v => v !== w && v.length > w.length && v.indexOf(w) >= 0).slice(0, 6) : [];
        const seen = new Set();
        hits.concat(...also.map(v => INDEX[v])).forEach(c => {
          if (seen.has(c)) return; seen.add(c);
          if (opts2.within && opts2.within.indexOf(T.root(c)) < 0) return;
          score[c] = (score[c] || 0) + 1;
        });
      });
      const min = opts2.minWords || 1;
      return Object.keys(score).filter(c => score[c] >= min)
        .sort((a, b) => score[b] - score[a] || T.isVague(a) - T.isVague(b) || a.localeCompare(b))
        .slice(0, opts2.limit || 5)
        .map(c => ({ code: c, matched: score[c], of: ws.length }));
    },
    words
  };
  return T;
}

module.exports = { createTable, parseBand, words };
