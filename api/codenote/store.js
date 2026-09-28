/* ══════════════════════════════════════════════════════════════════════
   THE AUDIT TRAIL AND CODER FEEDBACK — codes only

   Neither store ever holds text from a note. The audit record of a request is
   its id, when it ran, which content answered it, the codes it returned, the
   validation codes it raised, and its timings. Feedback is a request id, a
   code, accept or reject, and a reason from a fixed list: there is no free-
   text field, so there is nothing a coder could paste a note into.

   Both live in memory (bounded) and, when RXDX_AUDIT_FILE / RXDX_FEEDBACK_FILE
   are set, are appended to those files one JSON line at a time.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const crypto = require('crypto');

const REASONS = ['correct', 'not_documented', 'wrong_code', 'more_specific_available', 'less_specific_required',
                 'sequencing', 'negated_or_family', 'duplicate', 'clinical_edit', 'other'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE = /^[A-Z]\d{2}(?:\.\d{1,4})?$/;

function appender(file) {
  if (!file) return null;
  return line => { try { fs.appendFileSync(file, JSON.stringify(line) + '\n', { mode: 0o600 }); } catch (_) { /* the response must not fail because a disk did */ } };
}

function createAuditStore(opts) {
  opts = opts || {};
  const max = opts.max || 5000;
  const map = new Map();
  const write = appender(opts.file);
  function record(res, route) {
    const dx = [res.primary_diagnosis].concat(res.secondary_diagnoses || []).filter(Boolean);
    const r = {
      request_id: res.request_id,
      t: new Date().toISOString(),
      route,
      principal: res.primary_diagnosis ? res.primary_diagnosis.icd_code : null,
      codes: dx.map(d => d.icd_code),
      sources: dx.map(d => d.source),
      not_coded: (res.not_coded || []).map(n => n.reason),
      services: (res.medical_necessity || []).map(m => m.status),
      clarification_required: !!res.clarification_required,
      valid: res.coding_validation.valid,
      errors: res.coding_validation.errors.map(e => e.code),
      warnings: res.coding_validation.warnings.map(e => e.code),
      content_version: res.audit.content_version,
      engine_version: res.audit.engine_version,
      llm: res.audit.llm ? { provider: res.audit.llm.provider || null, model: res.audit.llm.model || null, outcome: res.audit.llm.outcome, used: !!res.audit.llm.used } : null,
      received_chars: res.audit.received_chars,
      ms: res.audit.ms
    };
    map.set(r.request_id, r);
    if (map.size > max) map.delete(map.keys().next().value);
    if (write) write(r);
    return r;
  }
  return { record, get: id => map.get(id) || null, size: () => map.size };
}

function createFeedbackStore(opts) {
  opts = opts || {};
  const max = opts.max || 20000;
  const items = [];
  const write = appender(opts.file);

  /* → { item } or { status, error } */
  function add(body, audit, table) {
    const bad = (status, code, message, extra) => ({ status, error: Object.assign({ code, message }, extra || {}) });
    if (!body || typeof body !== 'object' || Array.isArray(body)) return bad(400, 'bad_request', 'Send a JSON object.');
    const allowed = ['request_id', 'code', 'decision', 'accept', 'reason', 'replacement_code'];
    const extra = Object.keys(body).filter(k => allowed.indexOf(k) < 0);
    if (extra.length) return bad(400, 'unknown_field', 'Feedback stores codes only; unknown field(s): ' + extra.join(', ') + '.', { fields: extra });
    if (typeof body.request_id !== 'string' || !UUID.test(body.request_id)) return bad(400, 'bad_request_id', 'request_id must be the uuid a /v1/code-note response returned.');
    const code = String(body.code || '').toUpperCase().trim();
    if (!CODE.test(code)) return bad(400, 'bad_code', 'code must be an ICD-10-AM code such as E11.9.');
    if (!table.has(code)) return bad(422, 'code_not_in_table', code + ' is not in the ICD-10-AM table this service loaded.');
    let decision = body.decision;
    if (decision === undefined && typeof body.accept === 'boolean') decision = body.accept ? 'accept' : 'reject';
    if (decision !== 'accept' && decision !== 'reject') return bad(400, 'bad_decision', 'decision must be "accept" or "reject".');
    const reason = body.reason === undefined ? (decision === 'accept' ? 'correct' : null) : body.reason;
    if (REASONS.indexOf(reason) < 0) return bad(400, 'bad_reason', 'reason must be one of ' + REASONS.join(', ') + '.');
    let replacement = null;
    if (body.replacement_code !== undefined && body.replacement_code !== null) {
      replacement = String(body.replacement_code).toUpperCase().trim();
      if (!CODE.test(replacement) || !table.has(replacement)) return bad(422, 'code_not_in_table', 'replacement_code must be a code in the ICD-10-AM table.');
    }
    const a = audit.get(body.request_id);
    const item = {
      feedback_id: crypto.randomUUID(),
      t: new Date().toISOString(),
      request_id: body.request_id,
      code, decision, reason, replacement_code: replacement,
      request_known: !!a,
      code_was_returned: !!(a && a.codes.indexOf(code) >= 0),
      role: a ? (a.principal === code ? 'principal' : a.codes.indexOf(code) >= 0 ? 'secondary' : 'not_returned') : 'unknown',
      content_version: a ? a.content_version : null
    };
    items.push(item);
    if (items.length > max) items.shift();
    if (write) write(item);
    return { item };
  }

  /* for the tool's Coder Review queue and for vocabulary review: counts per
     code, and each rejection in the queue's own buckets */
  function exportAll() {
    const byCode = {};
    items.forEach(i => {
      const e = byCode[i.code] = byCode[i.code] || { code: i.code, accepted: 0, rejected: 0, reasons: {}, replaced_by: {} };
      if (i.decision === 'accept') e.accepted++; else e.rejected++;
      if (i.decision === 'reject') e.reasons[i.reason] = (e.reasons[i.reason] || 0) + 1;
      if (i.replacement_code) e.replaced_by[i.replacement_code] = (e.replaced_by[i.replacement_code] || 0) + 1;
    });
    const bucket = r => ({ more_specific_available: 'spec', less_specific_required: 'spec', not_documented: 'doc',
      wrong_code: 'conf2', negated_or_family: 'conf2', clinical_edit: 'conf2', duplicate: 'conf2', sequencing: 'conf2' }[r] || 'conf');
    return {
      product: 'RxDx', kind: 'coder-feedback', exported: new Date().toISOString(), count: items.length,
      codes: Object.keys(byCode).sort().map(k => byCode[k]),
      review_queue: items.filter(i => i.decision === 'reject').map(i => ({
        key: bucket(i.reason) + '|' + i.code, bucket: bucket(i.reason), code: i.code, reason: i.reason,
        replacement_code: i.replacement_code, request_id: i.request_id, t: i.t }))
    };
  }
  return { add, exportAll, size: () => items.length, REASONS };
}

module.exports = { createAuditStore, createFeedbackStore, REASONS };
