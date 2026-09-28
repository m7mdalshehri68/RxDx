/* ══════════════════════════════════════════════════════════════════════
   THE FORMULARY, AS INDICATIONS

   The hospital formulary the tool ships (data/idf-*.js) lists, for every drug,
   the ICD-10-AM codes it is indicated for. That is the medical-necessity link
   for a medication, and it is the hospital's own, not invented here.

   The formulary is read in a separate sandbox and reduced to what necessity
   needs — names and indicated codes — so the coding engine itself still never
   sees it (the parity check depends on that). The engine's own medication
   reader (_stMeds) is used to find drugs in a note: for that one call the
   reduced list is lent to the engine and taken back.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadFormulary(dataDir) {
  const t0 = Date.now();
  if (String(process.env.RXDX_FORMULARY || '1') === '0') return null;
  let files = [];
  try { files = fs.readdirSync(dataDir).filter(f => /^idf-\d+\.js$/.test(f)).sort(); } catch (_) { return null; }
  if (!files.length) return null;
  const box = { window: {} };
  vm.createContext(box);
  files.forEach(f => vm.runInContext(fs.readFileSync(path.join(dataDir, f), 'utf8'), box, { filename: f }));
  const lists = Object.keys(box.window).filter(k => /^IDF_\d+$/.test(k)).sort().map(k => box.window[k] || []);
  /* Kept small on purpose: names for the reader, and each drug's indicated
     codes as indexes into one shared list of code strings. */
  const drugs = [];
  const ages = [];
  const codeList = [], codeIdx = Object.create(null);
  const intern = c => { if (codeIdx[c] === undefined) { codeIdx[c] = codeList.length; codeList.push(c); } return codeIdx[c]; };
  const indicated = [];
  [].concat.apply([], lists).forEach(d => {
    const ids = new Set();
    (d.entries || []).forEach(e => (e.codes || []).forEach(c => {
      if (!c || !c.code) return;
      const code = String(c.code).toUpperCase();
      ids.add(intern(code));
      if (c.age) ages.push([code, String(c.age)]);
    }));
    drugs.push({ sn: String(d.sn || ''), tn: (d.tn || []).map(String) });
    indicated.push(Int32Array.from(ids));
  });
  const byName = Object.create(null);
  const salt = /^(?:hydrochloride|hcl|sodium|potassium|calcium|sulfate|sulphate|acid|maleate|mesylate|besylate|fumarate|succinate|tartrate|phosphate|citrate|acetate|base|bromide|chloride|oxide|dihydrochloride|disodium|nitrate|gluconate|carbonate)$/;
  drugs.forEach((d, i) => {
    const names = d.tn.map(n => n.toLowerCase())
      .concat(d.sn.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length >= 5 && !salt.test(t)));
    names.forEach(n => { if (n.length >= 4) (byName[n] = byName[n] || []).push(i); });
  });
  /* every product of the same generic shares its indications: "Aspirin" the
     brand and acetylsalicylic acid the generic are one drug */
  const bySn = Object.create(null);
  drugs.forEach((d, i) => { const k = d.sn.toLowerCase().trim(); if (k) (bySn[k] = bySn[k] || []).push(i); });
  const firstWords = new Set(drugs.map(d => d.sn.toLowerCase().split(/[^a-z0-9]+/)[0]).filter(Boolean));
  const tradeNames = new Set([].concat.apply([], drugs.map(d => d.tn.map(n => n.toLowerCase()))));
  /* "Aspirin" is also the brand of acetylsalicylic acid ("ASPIRIN ADULT TAB
     300MG"): a word of a product's name joins that product's generic */
  const byBrandWord = Object.create(null);
  drugs.forEach((d, i) => d.tn.forEach(n => n.toLowerCase().split(/[^a-z]+/).forEach(w => {
    if (w.length >= 5) (byBrandWord[w] = byBrandWord[w] || []).push(i);
  })));
  const lookup = name => {
    const ids = new Set();
    (byName[name] || []).concat(byBrandWord[name] || []).forEach(i => { ids.add(i); (bySn[drugs[i].sn.toLowerCase().trim()] || []).forEach(j => ids.add(j)); });
    const codes = new Set();
    let generic = '';
    ids.forEach(i => { indicated[i].forEach(k => codes.add(codeList[k])); if (!generic) generic = drugs[i].sn.toLowerCase(); });
    return { codes: Array.from(codes), generic: generic || name, trade: tradeNames.has(name), first: firstWords.has(name) };
  };
  return { drugs, lookup, ages, count: drugs.length, loadMs: Date.now() - t0 };
}

/* Words the formulary's ingredient lists contain that, in a clinical note, are
   almost never a medicine: "stroke team activated", "alcohol related",
   "herpes zoster", "whiplash-associated". */
const NOT_A_MEDICINE = new Set(('activated alcohol associated zoster herpes influenza hepatitis human virus vaccine '
  + 'respiratory syncytial house pollen venom grass mixed tetanus diphtheria pertussis measles mumps rubella '
  + 'varicella rabies typhoid cholera pneumococcal meningococcal papilloma rotavirus poliomyelitis yellow').split(' '));

function createMedicationReader(engine, formulary, icdWords) {
  const rx = engine.load().rx;
  return function medications(text) {
    if (!formulary) return [];
    const low = ' ' + text.toLowerCase().replace(/\s+/g, ' ') + ' ';
    const held = global.IDF;
    let names = [];
    try { global.IDF = formulary.drugs; names = rx._stMeds(text, low) || []; }
    catch (_) { names = []; }
    finally { global.IDF = held; }
    return names.filter(n => {
      if (NOT_A_MEDICINE.has(n)) return false;
      const e = formulary.lookup(n);
      /* an ingredient word that is also a diagnosis word counts only when it
         names a product or begins a generic name ("insulin glargine") */
      return !(icdWords && icdWords.has(n)) || e.trade || e.first;
    }).map(n => {
      const e = formulary.lookup(n);
      return { name: n, indicated: e.codes, generic: e.generic };
    });
  };
}

module.exports = { loadFormulary, createMedicationReader };
