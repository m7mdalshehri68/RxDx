/* ══════════════════════════════════════════════════════════════════════
   RxDx coding engine — server side

   This file does NOT reimplement the coding logic. It loads the very same
   script that runs in the doctor's browser (../index.html) and calls the same
   functions. That is deliberate: an API that reimplements the engine drifts
   away from the tool within a month, and then two answers exist for the same
   note and nobody can say which one is right. Here there is one engine and
   one measurement, and test/parity.js fails the build if they ever disagree.

   The drug formulary is not loaded. Coding a note needs the ICD table and the
   vocabulary, not 1,548 medicines, so the service starts in well under a
   second and holds about 90 MB instead of 400.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = process.env.RXDX_HTML || path.join(ROOT, 'index.html');
const DATA = path.join(ROOT, 'data');

/* ---------- a browser-shaped shell, just enough for the script to load ----------
   The app script decorates a page on startup. None of that matters here, but it
   must not throw, so every call it makes lands somewhere harmless. */
function stubElement(id) {
  const o = {
    id, value: '', innerHTML: '', textContent: '', className: '', checked: false,
    style: {}, options: [], dataset: {},
    parentNode: { insertBefore() {}, removeChild() {} },
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild() {}, insertBefore() {}, removeChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    focus() {}, blur() {}, click() {}, scrollIntoView() {},
    getAttribute: () => null, setAttribute() {}, removeAttribute() {},
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 })
  };
  return o;
}

/* Node 21+ ships a real read-only `navigator`, so a plain assignment throws.
   Define over it instead of fighting it. */
function put(name, value) {
  try { global[name] = value; }
  catch (_) { Object.defineProperty(global, name, { value, writable: true, configurable: true }); }
}

function installShell(seed) {
  const store = Object.create(null);
  global.document = {
    getElementById: id => store[id] || (store[id] = stubElement(id)),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: t => stubElement('_' + t),
    createTextNode: () => stubElement('_text'),
    addEventListener() {}, removeEventListener() {},
    body: { classList: { add() {}, remove() {}, toggle: () => true }, appendChild() {}, style: {} },
    documentElement: { classList: { add() {}, remove() {} }, style: {}, setAttribute() {} },
    head: { appendChild() {} }
  };
  put('window', global);
  put('navigator', { clipboard: { writeText() {} }, onLine: false, userAgent: 'rxdx-api', language: 'en' });
  put('location', { href: '', reload() {}, origin: '' });
  const mem = Object.create(null);
  /* The hospital's Control Centre configuration goes where the tool keeps it,
     so the engine's own itcLoad() reads it exactly as the browser would. */
  if (seed) for (const k in seed) mem[k] = String(seed[k]);
  const shim = {
    getItem: k => (mem[k] === undefined ? null : mem[k]),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: k => { delete mem[k]; },
    clear: () => { for (const k in mem) delete mem[k]; },
    key: () => null, length: 0
  };
  put('localStorage', shim);
  put('sessionStorage', Object.assign({}, shim, { _s: {} }));
  put('alert', () => {});
  put('confirm', () => false);
  put('prompt', () => '');
  put('setInterval', () => 0);
  put('clearInterval', () => {});
  put('setTimeout', (fn, ms) => { if (typeof fn === 'function' && (!ms || ms < 500)) { try { fn(); } catch (_) {} } return 0; });
  put('clearTimeout', () => {});
  put('requestAnimationFrame', () => 0);
  put('fetch', () => Promise.reject(new Error('no network in the coding engine')));
  put('Blob', function () {});
  if (!global.URL) put('URL', { createObjectURL: () => '', revokeObjectURL() {} });
  put('matchMedia', () => ({ matches: false, addListener() {}, addEventListener() {} }));
  return store;
}

/* ---------- load ---------- */
function readIcd() {
  if (!fs.existsSync(DATA)) return '';
  return fs.readdirSync(DATA)
    .filter(f => /^icd-\d+\.js$/.test(f)).sort()
    .map(f => fs.readFileSync(path.join(DATA, f), 'utf8')).join('\n');
}

let E = null;   /* the loaded engine */

/* ---------- the hospital's configuration ----------
   RXDX_CONFIG points at the file Control Centre → Audit → Export writes
   ({product:'RxDx', kind:'configuration', cfg, itc}). It carries the codes the
   hospital switched off, its default codes for unqualified phrases and the
   payer requirement sets it does not contract for. A file that is named but
   cannot be read stops the service: running with a configuration other than
   the one the hospital approved would answer differently from its own tool. */
function readConfig() {
  const file = String(process.env.RXDX_CONFIG || '').trim();
  if (!file) return null;
  let raw, pkg;
  try { raw = fs.readFileSync(file, 'utf8'); pkg = JSON.parse(raw); }
  catch (_) { throw new Error('RXDX_CONFIG is set but the file could not be read as JSON'); }
  if (!pkg || pkg.product !== 'RxDx' || !pkg.itc || typeof pkg.itc !== 'object') {
    throw new Error('RXDX_CONFIG is not an RxDx configuration export (product RxDx, with itc)');
  }
  const itc = pkg.itc;
  return {
    file: path.basename(file),
    facility: String(pkg.facility || (itc.integ && itc.integ.fac) || ''),
    exported: String(pkg.exported || ''),
    revision: (itc.meta && itc.meta.rev) || 0,
    sha256: require('crypto').createHash('sha256').update(raw).digest('hex').slice(0, 16),
    seed: { rxdx_itc_v1: JSON.stringify(itc), rxdx_cfg_v1: JSON.stringify(pkg.cfg || {}) },
    itc
  };
}

function load() {
  if (E) return E;
  const t0 = Date.now();
  const html = fs.readFileSync(HTML, 'utf8');

  /* Single-file build carries the tables inline; the web build keeps them in
     data/*.js and loads them first, exactly as a browser would. */
  let code;
  const inline = html.indexOf('const IDF');
  if (inline >= 0) {
    code = html.slice(html.lastIndexOf('<script>', inline) + 8, html.indexOf('</script>', inline));
  } else {
    const last = html.lastIndexOf('<script>');
    const app = html.slice(last + 8, html.indexOf('</script>', last));
    const icd = readIcd();
    if (!icd) throw new Error('split build found but data/icd-*.js is missing next to ' + HTML);
    code = icd
      + '\nvar ICD=[].concat.apply([],Object.keys(global).filter(k=>/^ICD_\\d+$/.test(k)).sort().map(k=>global[k]));'
      + '\nvar IDF=[];\n' + app;
  }

  const config = readConfig();
  installShell(config && config.seed);
  /* `const` inside an eval is scoped to that eval, so the exports have to be
     hoisted out in the same string. */
  (0, eval)(code + ';Object.assign(global,{__rx:{_stProblems,_stActive,_buildNoteIndexes,'
    + '_termAllowed,_wordRe,_stSentence,ICD_MAP,SYN,CONTENT_REG,PRESENTATIONS,'
    + 'PA,cxCanon,cxAllNames,rxEncounter,'
    /* read-only helpers the /v1/code-note pipeline uses to explain the engine's
       answer — never to reach a different one */
    + 'ICD,AGE,_stCtx,ST_NEG,ST_ATTRIB,ST_HYPO,_stImpression,_stIsSymptom,_stIsVague,'
    + '_stMeds,_vsRules,_vsSatisfies,_vsResolve,_vsPayerName,_ABBR_CASE,STRUCT_LABS,'
    + 'itcLoad,_itcCoding}});');

  const rx = global.__rx;
  E = {
    rx,
    loadMs: Date.now() - t0,
    icdCount: Object.keys(rx.ICD_MAP).length,
    synCount: Object.keys(rx.SYN).length,
    termCount: (() => { try { return rx._buildNoteIndexes().probTerms.length; } catch (_) { return 0; } })(),
    presentationCount: (() => { try { return Object.keys(rx.PRESENTATIONS).length; } catch (_) { return 0; } })(),
    payerRuleCount: (() => { try { return (rx.PA.req || []).length; } catch (_) { return 0; } })(),
    contentVersion: contentVersion(rx.CONTENT_REG),
    config: config ? { file: config.file, facility: config.facility, exported: config.exported,
                       revision: config.revision, sha256: config.sha256 } : null
  };
  return E;
}

/* One short string that identifies exactly which reference content answered a
   request. A coder disputing a code six months from now needs this. */
function contentVersion(reg) {
  try {
    const v = (reg || []).filter(b => b.id === 'icd' || b.id === 'vocab')
      .map(b => b.id + ':' + (b.v || '?')).join(' | ');
    return v || 'unversioned';
  } catch (_) { return 'unversioned'; }
}

/* ---------- sex plausibility ----------
   The master table marks 1 male only, 2 female only, 3 and 4 "predominantly,
   exception allowed". A conflict is reported, never silently dropped: the note
   may be right and the sex field wrong, and that is the doctor's call. */
const SEX_LABEL = { 1: 'male only', 2: 'female only', 3: 'usually female', 4: 'usually male' };
function sexConflict(code, sex) {
  if (!sex) return null;
  const s = ((load().rx.ICD_MAP[code] || {}).sex) | 0;
  const want = sex === 'male' ? 1 : sex === 'female' ? 2 : 0;
  if (!want || !s) return null;
  if ((s === 1 && want === 2) || (s === 2 && want === 1)) {
    return { severity: 'error', message: 'this code is ' + SEX_LABEL[s] + ' and the encounter is ' + sex };
  }
  if ((s === 3 && want === 1) || (s === 4 && want === 2)) {
    return { severity: 'note', message: 'this code is ' + SEX_LABEL[s] + '; recorded in ' + sex + ' as an exception' };
  }
  return null;
}

/* ---------- what the note mentions but the engine refused to code ----------
   This is the half of the answer that proves the tool is safe. "No myocardial
   infarction" must not produce I21, and a reviewer should be able to see that
   the phrase was read, understood and set aside — not simply missed. */
function refused(text) {
  const rx = load().rx;
  const low = ' ' + text.toLowerCase().replace(/\s+/g, ' ') + ' ';
  const idx = rx._buildNoteIndexes();
  const seen = Object.create(null);
  const out = [];
  for (let i = 0; i < idx.probTerms.length; i++) {
    const t = idx.probTerms[i];
    const term = String(t.term || '');
    if (term.length < 3) continue;
    if (low.indexOf(term.toLowerCase()) < 0) continue;      /* cheap gate first */
    if (!rx._termAllowed(term, text)) continue;
    let re;
    try { re = rx._wordRe(term); } catch (_) { continue; }
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      if (!rx._stActive(text, m[0], m.index)) {
        const key = t.code + '|' + term;
        if (!seen[key]) {
          seen[key] = 1;
          /* the word-boundary match carries the surrounding punctuation; the
             reader wants the phrase, not the regex */
          const raw = m[0];
          const lead = raw.length - raw.replace(/^[^A-Za-z0-9]+/, '').length;
          out.push({
            code: t.code,
            description: (rx.ICD_MAP[t.code] || {}).ascii_desc || '',
            term: raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9)]+$/g, ''),
            offset: m.index + lead,
            reason: 'the note denies or excludes this',
            evidence: sentenceAt(rx, text, m.index)
          });
        }
      }
      if (!re.global) break;
      if (re.lastIndex === m.index) re.lastIndex++;
    }
  }
  return out;
}

/* The engine matches on word boundaries, so the index it reports is the index
   of the boundary character, one short of the word itself. Anyone using the
   offset to highlight the phrase in the original note would be off by one on
   almost every code, so it is corrected here rather than left for each caller
   to rediscover. */
function trueOffset(text, term, at) {
  if (typeof at !== 'number' || at < 0 || !term) return null;
  const t = String(term).toLowerCase();
  if (text.slice(at, at + t.length).toLowerCase() === t) return at;
  const near = text.toLowerCase().indexOf(t, Math.max(0, at - 4));
  return near >= 0 && near - at <= 8 ? near : at;
}

function sentenceAt(rx, text, at) {
  try { const s = rx._stSentence(text, at); if (s) return String(s).trim(); } catch (_) {}
  const a = Math.max(0, text.lastIndexOf('.', at) + 1);
  let b = text.indexOf('.', at); if (b < 0) b = text.length;
  return text.slice(a, b + 1).trim();
}

/* ══════════════════════════════════════════════════════════════════════
   THE ONE FUNCTION THE API EXISTS FOR
   ══════════════════════════════════════════════════════════════════════ */
function codeNote(text, opts) {
  const t0 = process.hrtime.bigint();
  const rx = load().rx;
  const clean = String(text == null ? '' : text);
  opts = opts || {};
  const sex = opts.sex === 'male' || opts.sex === 'female' ? opts.sex : null;

  if (clean.trim().length < 3) {
    return {
      principal: [], supporting: [], mentionedButNotCoded: [],
      warnings: [{ severity: 'note', message: 'nothing to read: the text is empty' }],
      contentVersion: load().contentVersion,
      ms: Number(process.hrtime.bigint() - t0) / 1e6
    };
  }

  const low = ' ' + clean.toLowerCase().replace(/\s+/g, ' ') + ' ';
  const found = rx._stProblems(clean, low) || [];
  const warnings = [];

  const shape = x => {
    const w = sexConflict(x.code, sex);
    if (w) warnings.push(Object.assign({ code: x.code }, w));
    return {
      code: x.code,
      description: x.desc || '',
      confidence: typeof x.conf === 'number' ? Math.round(x.conf * 100) / 100 : null,
      /* why this confidence, in words a coder can argue with */
      confidenceReasons: (x.why || []).map(p => ({ direction: p[0] === '+' ? 'up' : 'down', reason: p[1] })),
      evidence: { term: x.term || '', offset: trueOffset(clean, x.term, x.at), sentence: x.evidence || '' },
      mentions: x.hits || 1,
      moreSpecificAvailable: x.vague ? x.vague : 0,
      sexRule: w ? w.message : null
    };
  };

  const principal = found.filter(x => x.principal !== false).map(shape);
  const supporting = found.filter(x => x.principal === false).map(shape);
  const notCoded = opts.explainRefusals === false ? [] : refused(clean);

  if (!principal.length && !supporting.length) {
    warnings.push({
      severity: 'note',
      message: notCoded.length
        ? 'every diagnosis this text mentions is denied or excluded in the note itself'
        : 'no diagnosis in this text matched the vocabulary'
    });
  }

  return {
    principal,
    supporting,
    mentionedButNotCoded: notCoded,
    warnings,
    contentVersion: load().contentVersion,
    ms: Math.round(Number(process.hrtime.bigint() - t0) / 1e4) / 100
  };
}

/* ══════════════════════════════════════════════════════════════════════
   THE INTERACTIVE PART

   Coding a finished note is the easy half. The half that earns the money is
   telling the doctor, while the patient is still in the room, which sentence
   the payer is going to want and is not there yet.

   Nothing here is generated. The questions come from two places already in
   the product: the 98 presentations extracted from national clinical
   protocols, and the 71 pre-authorisation rule sets taken from the published
   protocols of three Saudi insurers. This function selects and checks; it
   does not invent a single question.
   ══════════════════════════════════════════════════════════════════════ */

/* Resolve whatever the caller typed onto one of the 98 presentation names. */
function resolveComplaint(text) {
  const rx = load().rx;
  const raw = String(text || '').trim();
  if (!raw) return null;
  if (rx.PRESENTATIONS[raw]) return raw;
  /* the product already knows 234 accepted spellings for these 98 things */
  try { const c = rx.cxCanon(raw); if (c && rx.PRESENTATIONS[c]) return c; } catch (_) {}
  const low = raw.toLowerCase();
  const keys = Object.keys(rx.PRESENTATIONS);
  let hit = keys.find(k => k.toLowerCase() === low);
  if (hit) return hit;
  hit = keys.find(k => k.toLowerCase().indexOf(low) >= 0 || low.indexOf(k.toLowerCase()) >= 0);
  return hit || null;
}

/* cxAllNames returns the whole alias table as [spelling, canonical] pairs,
   not the aliases of one presentation — group it once rather than per call. */
let _ALIAS = null;
function aliasIndex() {
  if (_ALIAS) return _ALIAS;
  _ALIAS = Object.create(null);
  try {
    (load().rx.cxAllNames() || []).forEach(pair => {
      if (!Array.isArray(pair)) return;
      const spelling = pair[0], canonical = pair[1];
      if (!spelling || !canonical || spelling === canonical) return;
      (_ALIAS[canonical] = _ALIAS[canonical] || []).push(spelling);
    });
  } catch (_) {}
  return _ALIAS;
}

function listPresentations() {
  const rx = load().rx;
  const idx = aliasIndex();
  return Object.keys(rx.PRESENTATIONS).sort().map(name => {
    const p = rx.PRESENTATIONS[name] || {};
    return {
      name,
      alsoCalled: idx[name] || [],
      prompts: (p.assoc || []).length + (p.red || []).length + (p.ix || []).length
    };
  });
}

/* Has the note already said this? For a payer question the rule carries its
   own pattern, so the answer is exact. For a protocol prompt there is no
   pattern, so we fall back to the words that carry meaning in it and say
   plainly, in the field name, that this is a weaker signal. */
const STOP_W = new Set(('and or the a an of in on with for to at if any is are was were not no '
  + '其 per within done reported state which state').split(' '));
function mentions(note, prompt) {
  const low = ' ' + String(note || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
  const words = String(prompt || '').toLowerCase()
    .replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/).filter(w => w.length > 3 && !STOP_W.has(w));
  if (!words.length) return false;
  return words.some(w => low.indexOf(w) >= 0);
}
function satisfies(note, evPattern) {
  if (!evPattern) return null;
  try { return new RegExp(evPattern, 'i').test(String(note || '')); }
  catch (_) { return null; }
}

/* ---------- which payer rules belong to THIS visit ----------
   A chest pain note that mentions "known type 2 diabetes and hypertension" in
   the background was pulling in the rules for GLP-1 agonists, Mounjaro,
   glucometers and retinal injections — twenty-four requirements for a visit
   about chest pain. A doctor shown that list closes the window, and a product
   that gets closed is worth nothing.

   So the rules are split. What the presenting complaint or a principal
   diagnosis triggers is this visit's business. What only a background mention
   triggers is the patient's other conditions: real, but not what the doctor
   is documenting right now, and it belongs to the coder rather than the
   consultation. */
function matchRules(presentation, principalCodes, allCodes, payer) {
  const rx = load().rx;
  const req = (rx.PA && rx.PA.req) || [];
  const hasCode = (list, codes) => Array.isArray(list) && list.some(p => {
    const pr = String(p).split('.')[0];
    return codes.some(c => c === p || String(c).split('.')[0] === pr);
  });
  const visit = [], background = [];
  req.forEach(r => {
    if (payer && Array.isArray(r.pay) && r.pay.indexOf(payer) < 0) return;
    const byComplaint = !!(presentation && Array.isArray(r.cx) && r.cx.indexOf(presentation) >= 0);
    const byCode = hasCode(r.px, allCodes);
    if (!byComplaint && !byCode) return;
    /* The complaint the caller supplied is the reason for the encounter, and
       it is the only reliable signal of one. "Known type 2 diabetes" in the
       first line of a chest pain note is history, but the coder still earns
       E11.9 as a principal code from it — so ranking on codes alone puts
       Mounjaro paperwork in front of a doctor treating chest pain.
       When a complaint is given, it decides. Codes only decide when it is not. */
    if (presentation ? byComplaint : hasCode(r.px, principalCodes)) visit.push(r);
    else background.push(r);
  });
  return { visit, background };
}

function payerName(id) {
  const rx = load().rx;
  const p = ((rx.PA && rx.PA.payers) || []).filter(x => x.id === id)[0];
  return p ? p.n : id;
}

/* ---------- the endpoint's engine ----------
   This does not reimplement the question logic. rxEncounter lives in the same
   script the doctor's browser runs, so the screen in the tool and this
   endpoint answer from one function. The only work done here is adding what
   HTTP needs and the timing. */
function askEncounter(opts) {
  const t0 = process.hrtime.bigint();
  const rx = load().rx;
  opts = opts || {};
  const out = rx.rxEncounter({
    complaint: opts.complaint,
    payer: opts.payer,
    note: opts.note,
    sex: opts.sex
  });
  if (!out || out.error) {
    return out || { error: { code: 'engine_error', message: 'no answer' } };
  }
  out.contentVersion = load().contentVersion;
  out.ms = Math.round(Number(process.hrtime.bigint() - t0) / 1e4) / 100;
  return out;
}

module.exports = {
  load, codeNote, refused, sexConflict, contentVersion,
  askEncounter, listPresentations, resolveComplaint
};
