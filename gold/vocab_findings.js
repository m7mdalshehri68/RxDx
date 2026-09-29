/* Vocabulary terms that may name a finding rather than the condition.

   The engine codes a note by matching vocabulary terms (SYN in index.html,
   built into probTerms by _buildNoteIndexes). Most terms name the condition
   they code. Some name a symptom, a sign, a result or a risk factor instead —
   "cold intolerance" codes E03.9 hypothyroidism — and a note that mentions
   only that finding is then coded with the disease.

   This lists the terms worth a coder's review: every term whose code is
   outside chapter R and whose words share no content word with the code's
   ICD-10-AM description. It changes nothing in the engine.

     node gold/vocab_findings.js                  CSV to stdout
     node gold/vocab_findings.js --out FILE       CSV to FILE

   Columns: term, code, description, in_gold (the term appears in a note of
   gold/corpus.json, matched the way the engine matches it), gold_notes.

   Rules, kept deliberately simple so a reviewer can predict them:
   · content words are words of 3+ letters that are not in STOP below;
   · two words are shared when they are equal once a plural s/es is dropped,
     or when both have 6+ letters and the same first 6 (diabetic / diabetes,
     asthmatic / asthma), so spelling variants do not bury real findings;
   · an abbreviation is a single token of 5 characters or fewer that has a
     digit or hyphen, is in the engine's own _ABBR_CASE list, or never occurs
     as a word in any ICD-10-AM description — except the few lay words in
     LAY, which are words, not abbreviations. Abbreviations are left out: they
     can never share a word with a description, so they would all be listed.
   The terms left out as abbreviations are printed to stderr. */
'use strict';
const fs = require('fs');
const path = require('path');
const { load, makeEnv } = require('../tests/_harness.js');

const STOP = new Set(('a an and or of the in on with without to for by from at as due other unspecified specified '
  + 'not elsewhere classified nos than which is are be its their any site sites part parts type use disease '
  + 'diseases disorder disorders condition conditions').split(' '));
const LAY = new Set(['piles', 'obese', 'hives', 'scald', 'stye', 'boil', 'corn']);

const { code } = load();
makeEnv();
(0, eval)(code + ';Object.assign(global,{__v:{_buildNoteIndexes,_wordRe,ICD_MAP,_ABBR_CASE}});');
const { _buildNoteIndexes, _wordRe, ICD_MAP, _ABBR_CASE } = global.__v;

const tokens = s => String(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const content = s => tokens(s).filter(w => w.length >= 3 && !STOP.has(w));
const singular = w => w.replace(/(?:es|s)$/, '');
const shared = (a, b) => singular(a) === singular(b) || (a.length >= 6 && b.length >= 6 && a.slice(0, 6) === b.slice(0, 6));

const icdWords = new Set();
Object.keys(ICD_MAP).forEach(c => tokens(ICD_MAP[c].ascii_desc).forEach(w => icdWords.add(w)));
const isAbbreviation = t => !/\s/.test(t) && t.length <= 5 && !LAY.has(t)
  && (/[0-9-]/.test(t) || !!_ABBR_CASE[t] || !icdWords.has(t));

const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus.json'), 'utf8'));
function goldNotes(term) {
  let re;
  try { re = _wordRe(term); } catch (_) { return []; }
  return corpus.filter(n => { re.lastIndex = 0; return re.test(n.note); }).map(n => n.id);
}

const csv = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

const terms = _buildNoteIndexes().probTerms.filter(t => !/^R/.test(t.code) && ICD_MAP[t.code]);
const skipped = terms.filter(t => isAbbreviation(t.term));
const rows = terms.filter(t => !isAbbreviation(t.term)).filter(t => {
  const desc = content(ICD_MAP[t.code].ascii_desc);
  return !content(t.term).some(w => desc.some(d => shared(w, d)));
}).sort((a, b) => a.code.localeCompare(b.code) || a.term.localeCompare(b.term))
  .map(t => { const g = goldNotes(t.term); return [t.term, t.code, ICD_MAP[t.code].ascii_desc, g.length ? 'yes' : 'no', g.join(' ')]; });

const out = [['term', 'code', 'description', 'in_gold', 'gold_notes']].concat(rows).map(r => r.map(csv).join(',')).join('\n') + '\n';
const i = process.argv.indexOf('--out');
if (i > 0 && process.argv[i + 1]) fs.writeFileSync(process.argv[i + 1], out);
else process.stdout.write(out);
process.stderr.write(terms.length + ' terms outside chapter R · ' + rows.length + ' listed · ' + rows.filter(r => r[3] === 'yes').length
  + ' of them in the gold corpus · ' + skipped.length + ' left out as abbreviations: ' + skipped.map(t => t.term).join(' ') + '\n');
