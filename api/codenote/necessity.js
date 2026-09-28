/* ══════════════════════════════════════════════════════════════════════
   STAGE 6 · MEDICAL NECESSITY

   Every investigation, procedure, referral and medication the note plans is
   linked to the coded diagnosis that justifies it:
     · medications — through the hospital formulary's own indications;
     · everything else — through services.json, a table the hospital owns.
   A service no coded diagnosis explains is flagged, never silently dropped.

   When a payer is named, that payer's still-unanswered documentation comes
   from the tool's own rule matcher (_vsRules, the function rxEncounter uses),
   with the requirement sets the hospital switched off left out.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const SERVICE_SECTIONS = { plan: 1, investigations: 1, assessment: 1, other: 1 };
const MED_SECTIONS = { plan: 1, assessment: 1, other: 1 };

function esc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* "I20-I25", "E11", "E11.2", "*" */
function supportsCode(spec, code) {
  const c = String(code).toUpperCase(), root = c.split('.')[0];
  return spec.some(s => {
    if (s === '*') return true;
    const m = /^([A-Z]\d{0,2}(?:\.\d+)?)-([A-Z]\d{0,2}(?:\.\d+)?)$/.exec(s);
    if (m) {
      const lo = m[1], hi = m[2];
      return root.slice(0, lo.split('.')[0].length) >= lo.split('.')[0] && root.slice(0, hi.split('.')[0].length) <= hi.split('.')[0];
    }
    return c === s || c.indexOf(s) === 0;
  });
}

function loadCatalogue(file) {
  const f = file || process.env.RXDX_SERVICES || path.join(__dirname, 'services.json');
  const cat = JSON.parse(fs.readFileSync(f, 'utf8'));
  const services = (cat.services || []).map(s => ({
    name: s.name, kind: s.kind, supports: s.supports || [],
    re: new RegExp('(^|[^a-z0-9])(' + (s.match || [s.name]).map(esc).sort((a, b) => b.length - a.length).join('|') + ')(?=$|[^a-z0-9])', 'gi')
  }));
  const referrals = ((cat.referrals || {}).specialties || []).map(sp => {
    const alt = sp.match.map(esc).sort((a, b) => b.length - a.length).join('|');
    const forms = ((cat.referrals || {}).match || []).map(t => t.replace('{s}', '(?:' + alt + ')'));
    return { name: sp.name, supports: sp.supports || [], re: new RegExp('(^|[^a-z0-9])(' + forms.join('|') + ')(?=$|[^a-z0-9])', 'gi') };
  });
  return { version: cat.version || 'unversioned', services, referrals };
}

function createNecessity(engine, table, extractor, medications, catalogue) {
  const rx = engine.load().rx;
  const cat = catalogue || loadCatalogue();

  /* A service counts when it is planned or done in this encounter: not
     negated ("no X-ray indicated"), not conditional ("referral if no
     response"), not stopped ("stop ibuprofen"). */
  function stands(doc, start, len) {
    const c = rx._stCtx(doc.text, start, len);
    if (rx.ST_NEG.test(c.before)) return false;
    if (/^\s*(?:is |was )?(?:not (?:indicated|needed|required|done)|declined|refused)/i.test(c.after)) return false;
    if (/^[^.;]{0,30}\b(?:if|should|unless)\b/i.test(c.after) || /\b(?:if|should|consider|may need)\s+(?:[a-z-]+\s+){0,3}$/i.test(c.before)) return false;
    if (/\b(?:stop|stopped|discontinue[ds]?|withhold|withheld|hold|avoid|allergic to|allergy to)\s+(?:[a-z-]+\s+){0,2}$/i.test(c.before)) return false;
    if (/^\s*(?:stopped|discontinued|withheld)\b/i.test(c.after)) return false;
    return true;
  }

  function detect(doc) {
    const out = [];
    const taken = [];
    const overlaps = (a, b) => taken.some(t => a < t[1] && b > t[0]);
    const add = (o) => { if (overlaps(o.start, o.end)) return; taken.push([o.start, o.end]); out.push(o); };
    cat.referrals.forEach(r => {
      r.re.lastIndex = 0; let m;
      while ((m = r.re.exec(doc.text))) {
        const start = m.index + m[1].length, end = start + m[2].length;
        const section = doc.sectionAt(start);
        if (SERVICE_SECTIONS[section] && stands(doc, start, end - start)) {
          add({ service: 'Referral: ' + r.name, kind: 'referral', supports: r.supports, start, end, section, quote: doc.original.slice(start, end) });
        }
        if (r.re.lastIndex === m.index) r.re.lastIndex++;
      }
    });
    cat.services.forEach(s => {
      s.re.lastIndex = 0; let m;
      while ((m = s.re.exec(doc.text))) {
        const start = m.index + m[1].length, end = start + m[2].length;
        const section = doc.sectionAt(start);
        if (SERVICE_SECTIONS[section] && stands(doc, start, end - start) && !out.some(o => o.service === s.name)) {
          add({ service: s.name, kind: s.kind, supports: s.supports, start, end, section, quote: doc.original.slice(start, end) });
        }
        if (s.re.lastIndex === m.index) s.re.lastIndex++;
      }
    });
    const current = [];
    medications(doc.text).forEach(md => {
      const re = new RegExp('(^|[^a-z0-9])(' + esc(md.name) + ')(?=$|[^a-z0-9])', 'gi');
      let m, planned = null, any = null;
      while ((m = re.exec(doc.text))) {
        const start = m.index + m[1].length, end = start + m[2].length;
        const section = doc.sectionAt(start);
        const o = { start, end, section };
        if (!any && stands(doc, start, end - start)) any = o;
        if (!planned && MED_SECTIONS[section] && stands(doc, start, end - start)) planned = o;
      }
      const roots = new Set(md.indicated.map(c => c.split('.')[0]));
      const entry = h => {
        /* "Ferrous sulphate", not "Ferrous": the next word, if it is the salt */
        let q = doc.original.slice(h.start, h.end);
        const tail = /^\s+(sulphate|sulfate|fumarate|gluconate|sodium|potassium|hydrochloride|acetate|citrate|acid)\b/i.exec(doc.original.slice(h.end, h.end + 20));
        if (tail) q += tail[0];
        return { service: q.charAt(0).toUpperCase() + q.slice(1), kind: 'medication', indicated: md.indicated, roots,
                 start: h.start, end: h.start + q.length, section: h.section, quote: doc.original.slice(h.start, h.start + q.length) };
      };
      if (planned) add(entry(planned));
      else if (any) current.push(entry(any));
    });
    out.sort((a, b) => a.start - b.start);
    return { planned: out, current };
  }

  /* An analgesic the formulary lists for pain (R52) is justified by an injury
     or a musculoskeletal condition: the formulary indexes the symptom, the
     claim carries the condition that causes it. */
  const justifies = (svc, code) => {
    if (svc.kind !== 'medication') return supportsCode(svc.supports, code);
    if (svc.indicated.indexOf(code) >= 0 || svc.roots.has(code.split('.')[0])) return true;
    return svc.roots.has('R52') && /^[STM]\d/.test(code);
  };

  /* coded: [{code}] in sequence order; mentions: not-coded findings that could
     explain a service (integral symptoms, uncertain diagnoses) */
  function link(services, coded, mentions) {
    return services.map(s => {
      const by = coded.filter(c => justifies(s, c.code)).map(c => c.code);
      if (by.length) return { service: s.service, kind: s.kind, supported_by: by, status: 'supported', span: s };
      const could = (mentions || []).filter(m => (m.codes || []).some(c => justifies(s, c)));
      return { service: s.service, kind: s.kind, supported_by: [], status: could.length ? 'needs_documentation' : 'unsupported',
               could: could, span: s };
    });
  }

  /* ---------- payer ---------- */
  function payerRequirements(payer, principal, all, doc, offSets) {
    if (!payer) return [];
    let m;
    try { m = rx._vsRules(null, principal ? [principal] : [], all, payer, doc.text); } catch (_) { return []; }
    const off = new Set(offSets || []);
    const out = [];
    (m.visit || []).forEach(r => {
      if (off.has(r.t)) return;
      (r.q || []).forEach(q => {
        if (q.opt) return;
        let sat = rx._vsSatisfies(doc.text, q.ev);
        out.push({ requirement: r.t, ask: q.q, satisfied: sat === true });
      });
    });
    return out;
  }

  return { detect, link, payerRequirements, justifies, catalogueVersion: cat.version, supportsCode };
}

module.exports = { createNecessity, loadCatalogue, supportsCode };
