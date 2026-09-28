/* A small validator for the JSON Schema subset api/openapi.json uses
   (OpenAPI 3.0: $ref, allOf, nullable, type, enum, required, properties,
   additionalProperties, items, minItems, maxItems, minimum, maximum,
   minLength, pattern, format uuid). No dependency, so the test that every
   response matches the published schema runs anywhere the service runs. */
'use strict';
const fs = require('fs');
const path = require('path');

const SPEC = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'openapi.json'), 'utf8'));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolve(ref) {
  const parts = ref.replace(/^#\//, '').split('/');
  let o = SPEC;
  parts.forEach(p => { o = o[p]; });
  if (!o) throw new Error('unresolved $ref ' + ref);
  return o;
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  return typeof v;
}

function check(schema, v, at, errs) {
  if (schema.$ref) return check(resolve(schema.$ref), v, at, errs);
  if (v === null) {
    if (schema.nullable) return;
    if (schema.allOf && schema.nullable) return;
    errs.push(at + ': null is not allowed');
    return;
  }
  if (schema.allOf) schema.allOf.forEach(s => check(s, v, at, errs));
  if (schema.type) {
    const t = typeOf(v);
    const ok = schema.type === t || (schema.type === 'number' && t === 'integer');
    if (!ok) { errs.push(at + ': expected ' + schema.type + ', got ' + t); return; }
  }
  if (schema.enum && schema.enum.indexOf(v) < 0) errs.push(at + ': ' + JSON.stringify(v) + ' is not one of ' + schema.enum.join('|'));
  if (typeof v === 'string') {
    if (schema.minLength !== undefined && v.length < schema.minLength) errs.push(at + ': shorter than ' + schema.minLength);
    if (schema.pattern && !new RegExp(schema.pattern).test(v)) errs.push(at + ': ' + JSON.stringify(v) + ' does not match ' + schema.pattern);
    if (schema.format === 'uuid' && !UUID.test(v)) errs.push(at + ': not a uuid');
  }
  if (typeof v === 'number') {
    if (schema.minimum !== undefined && v < schema.minimum) errs.push(at + ': below ' + schema.minimum);
    if (schema.maximum !== undefined && v > schema.maximum) errs.push(at + ': above ' + schema.maximum);
  }
  if (Array.isArray(v)) {
    if (schema.minItems !== undefined && v.length < schema.minItems) errs.push(at + ': fewer than ' + schema.minItems + ' items');
    if (schema.maxItems !== undefined && v.length > schema.maxItems) errs.push(at + ': more than ' + schema.maxItems + ' items');
    if (schema.items) v.forEach((x, i) => check(schema.items, x, at + '[' + i + ']', errs));
  }
  if (typeOf(v) === 'object') {
    (schema.required || []).forEach(k => { if (!(k in v)) errs.push(at + ': missing ' + k); });
    const props = schema.properties || {};
    Object.keys(v).forEach(k => {
      if (props[k]) check(props[k], v[k], at + '.' + k, errs);
      else if (schema.additionalProperties === false) errs.push(at + ': unexpected property ' + k);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') check(schema.additionalProperties, v[k], at + '.' + k, errs);
    });
  }
}

/* → [] when valid, else the list of problems */
function validate(schemaName, value) {
  const errs = [];
  check({ $ref: '#/components/schemas/' + schemaName }, value, schemaName, errs);
  return errs;
}

module.exports = { validate, SPEC };
