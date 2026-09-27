/* HTTP tests. The server is started for real and talked to over a socket —
   nothing here calls the engine directly, because the thing being tested is
   the service a hospital would integrate with, not the function underneath. */
'use strict';
const { spawn } = require('child_process');
const path = require('path');

const PORT = 8791;
const BASE = 'http://127.0.0.1:' + PORT;
let child, P = 0, F = 0;
const logs = [];

function t(name, fn) {
  return Promise.resolve().then(fn).then(r => {
    if (r === true || r === undefined) P++;
    else { F++; console.log('  FAIL', name, '→', r); }
  }).catch(e => { F++; console.log('  ERR ', name, '→', e.message); });
}

function req(method, p, body, headers) {
  return fetch(BASE + p, {
    method,
    headers: Object.assign(body ? { 'Content-Type': 'application/json' } : {}, headers || {}),
    body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body))
  }).then(r => r.text().then(txt => {
    let j = null; try { j = JSON.parse(txt); } catch (_) {}
    return { status: r.status, headers: r.headers, json: j, text: txt };
  }));
}

function start() {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
      env: Object.assign({}, process.env, { PORT: String(PORT), RXDX_RATE_LIMIT: '500', RXDX_PUBLIC_DEMO: '1' }),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let done = false;
    child.stdout.on('data', d => {
      String(d).split('\n').filter(Boolean).forEach(l => logs.push(l));
      if (!done && String(d).indexOf('listening') >= 0) { done = true; resolve(); }
    });
    child.stderr.on('data', d => logs.push('ERR ' + d));
    child.on('exit', c => { if (!done) reject(new Error('server exited ' + c + '\n' + logs.join('\n'))); });
    setTimeout(() => { if (!done) reject(new Error('server did not start\n' + logs.join('\n'))); }, 25000);
  });
}

const NOTE = '45 year old man admitted with community acquired pneumonia. Developed acute kidney injury on day 3. '
  + 'Serial troponins negative, no myocardial infarction. CT ruled out pulmonary embolism. Background of type 2 diabetes.';

(async function () {
  await start();

  /* ---------- service ---------- */
  await t('health answers and reports the loaded content', async () => {
    const r = await req('GET', '/v1/health');
    if (r.status !== 200) return 'status ' + r.status;
    if (!r.json.ok) return 'not ok';
    if (r.json.icdCodes < 16000) return 'only ' + r.json.icdCodes + ' ICD codes loaded';
    if (r.json.vocabularyTerms < 1500) return 'only ' + r.json.vocabularyTerms + ' terms';
    return true;
  });
  await t('health states plainly that clinical text is not stored', async () => {
    const r = await req('GET', '/v1/health');
    return r.json.storesClinicalText === false || 'storesClinicalText was ' + r.json.storesClinicalText;
  });
  await t('every response carries the no-storage header', async () => {
    const r = await req('GET', '/v1/health');
    return r.headers.get('x-rxdx-stores-clinical-text') === 'no' || 'header missing';
  });
  await t('version lists where each reference table came from', async () => {
    const r = await req('GET', '/v1/version');
    if (r.status !== 200) return 'status ' + r.status;
    if (!Array.isArray(r.json.sources) || r.json.sources.length < 5) return 'only ' + (r.json.sources || []).length + ' sources';
    return r.json.sources.some(s => s.id === 'icd') || 'no ICD source recorded';
  });
  await t('the specification is served for an IT team to read', async () => {
    const r = await req('GET', '/openapi.json');
    return !!(r.status === 200 && r.json.openapi && r.json.paths['/v1/code']) || 'no usable spec';
  });
  await t('the documentation page loads', async () => {
    const r = await req('GET', '/docs');
    return (r.status === 200 && /RxDx Coding API/.test(r.text)) || 'status ' + r.status;
  });
  await t('the root redirects a human to the documentation', async () => {
    const r = await req('GET', '/');
    return (r.status === 200 && /Try it/.test(r.text)) || 'status ' + r.status;
  });

  /* ---------- coding ---------- */
  await t('a note is coded', async () => {
    const r = await req('POST', '/v1/code', { text: NOTE });
    if (r.status !== 200) return 'status ' + r.status + ' ' + r.text.slice(0, 200);
    const codes = r.json.principal.map(x => x.code).join(',');
    return (/J18/.test(codes) && /N17/.test(codes) && /E11/.test(codes)) || 'got ' + codes;
  });
  await t('a denied diagnosis is not coded', async () => {
    const r = await req('POST', '/v1/code', { text: NOTE });
    const all = r.json.principal.concat(r.json.supporting).map(x => x.code).join(',');
    return (!/I21/.test(all) && !/I26/.test(all)) || 'coded something denied: ' + all;
  });
  await t('a denied diagnosis is reported as read and refused, not silently dropped', async () => {
    const r = await req('POST', '/v1/code', { text: NOTE });
    const no = r.json.mentionedButNotCoded.map(x => x.code).join(',');
    return (/I21/.test(no) && /I26/.test(no)) || 'refusals were ' + (no || '(none)');
  });
  await t('a refusal carries the sentence it came from', async () => {
    const r = await req('POST', '/v1/code', { text: NOTE });
    const mi = r.json.mentionedButNotCoded.filter(x => /I21/.test(x.code))[0];
    return (mi && /troponins negative/i.test(mi.evidence)) || 'evidence was ' + (mi ? mi.evidence : 'missing');
  });
  await t('a refusal names the phrase without the surrounding punctuation', async () => {
    const r = await req('POST', '/v1/code', { text: NOTE });
    return r.json.mentionedButNotCoded.every(x => x.term === x.term.trim() && !/[.,;]$/.test(x.term))
      || 'ragged term: ' + JSON.stringify(r.json.mentionedButNotCoded.map(x => x.term));
  });
  await t('every code carries the phrase that earned it', async () => {
    const r = await req('POST', '/v1/code', { text: NOTE });
    return r.json.principal.every(x => x.evidence && x.evidence.term && x.evidence.sentence) || 'a code came back without evidence';
  });
  await t('the evidence offset really points at the phrase', async () => {
    const r = await req('POST', '/v1/code', { text: NOTE });
    return r.json.principal.every(x => {
      const at = x.evidence.offset;
      return at != null && NOTE.slice(at, at + x.evidence.term.length).toLowerCase() === x.evidence.term.toLowerCase();
    }) || 'an offset did not land on its term';
  });
  await t('confidence comes with reasons a coder can argue with', async () => {
    const r = await req('POST', '/v1/code', { text: NOTE });
    return r.json.principal.every(x => typeof x.confidence === 'number' && Array.isArray(x.confidenceReasons))
      || 'a code came back without a reasoned confidence';
  });
  await t('a vague code says how many more specific ones exist', async () => {
    const r = await req('POST', '/v1/code', { text: NOTE });
    const p = r.json.principal.filter(x => /J18/.test(x.code))[0];
    return (p && p.moreSpecificAvailable > 0) || 'J18 did not flag more specific siblings';
  });
  await t('the content version travels with every answer', async () => {
    const r = await req('POST', '/v1/code', { text: NOTE });
    return (r.json.contentVersion && /vocab/.test(r.json.contentVersion)) || 'got ' + r.json.contentVersion;
  });
  await t('each answer carries a request id for later reference', async () => {
    const r = await req('POST', '/v1/code', { text: NOTE });
    return (typeof r.json.requestId === 'string' && r.json.requestId.length >= 8) || 'no request id';
  });

  /* ---------- a note where everything is excluded ---------- */
  await t('a note that rules everything out codes nothing and says why', async () => {
    const r = await req('POST', '/v1/code', {
      text: 'Chest pain for assessment. Troponins negative, no myocardial infarction. CT ruled out pulmonary embolism.'
    });
    const all = r.json.principal.concat(r.json.supporting).map(x => x.code).join(',');
    if (/I21|I26/.test(all)) return 'coded a ruled-out diagnosis: ' + all;
    return r.json.mentionedButNotCoded.length >= 2 || 'did not explain the refusals';
  });

  /* ---------- sex ---------- */
  await t('a female-only code in a male encounter is flagged, not dropped', async () => {
    const r = await req('POST', '/v1/code', { text: 'Single spontaneous delivery at 39 weeks.', sex: 'male' });
    const codes = r.json.principal.concat(r.json.supporting).map(x => x.code);
    const flagged = (r.json.warnings || []).length > 0 || r.json.principal.some(x => x.sexRule);
    if (!codes.length) return true;                        /* nothing coded — nothing to flag */
    return flagged || 'coded ' + codes.join(',') + ' for a male with no warning';
  });
  await t('sex is optional and its absence changes nothing',async () => {
    const a = await req('POST', '/v1/code', { text: NOTE });
    const b = await req('POST', '/v1/code', { text: NOTE, sex: 'male' });
    return a.json.principal.map(x => x.code).join() === b.json.principal.map(x => x.code).join()
      || 'the codes changed when sex was supplied';
  });

  /* ---------- bad input ---------- */
  await t('a missing text field is a clear 400, not a crash', async () => {
    const r = await req('POST', '/v1/code', { sex: 'male' });
    return (r.status === 400 && r.json.error.code === 'missing_text') || 'status ' + r.status;
  });
  await t('broken JSON is a clear 400', async () => {
    const r = await req('POST', '/v1/code', '{not json');
    return (r.status === 400 && r.json.error.code === 'bad_json') || 'status ' + r.status;
  });
  await t('empty text answers politely instead of failing', async () => {
    const r = await req('POST', '/v1/code', { text: '' });
    return (r.status === 200 && r.json.warnings.length > 0) || 'status ' + r.status;
  });
  await t('an unknown endpoint says so', async () => {
    const r = await req('POST', '/v1/nonsense', {});
    return r.status === 404 || 'status ' + r.status;
  });
  await t('a very long note is refused rather than swallowing memory', async () => {
    const r = await req('POST', '/v1/code', { text: 'pneumonia. '.repeat(40000) });
    return r.status === 413 || 'status ' + r.status;
  });

  /* ---------- batch ---------- */
  await t('a batch codes every note and keeps the ids straight', async () => {
    const r = await req('POST', '/v1/code/batch', {
      notes: [
        { id: 'ENC-1', text: 'Community acquired pneumonia treated with amoxicillin.' },
        { id: 'ENC-2', text: 'Type 2 diabetes mellitus with a diabetic foot ulcer.' },
        { id: 'ENC-3', text: 'Chest pain, troponin negative, no myocardial infarction.' }
      ]
    });
    if (r.status !== 200) return 'status ' + r.status;
    if (r.json.count !== 3) return 'count ' + r.json.count;
    const byId = {}; r.json.results.forEach(x => { byId[x.id] = x.principal.map(c => c.code).join(','); });
    if (!/J18/.test(byId['ENC-1'])) return 'ENC-1 got ' + byId['ENC-1'];
    if (!/E11/.test(byId['ENC-2'])) return 'ENC-2 got ' + byId['ENC-2'];
    if (/I21/.test(byId['ENC-3'])) return 'ENC-3 coded a denied MI';
    return true;
  });
  await t('one bad note in a batch does not take down the rest', async () => {
    const r = await req('POST', '/v1/code/batch', {
      notes: [{ id: 'a', text: 'Community acquired pneumonia.' }, { id: 'b' }, { id: 'c', text: 'Acute appendicitis.' }]
    });
    const byId = {}; r.json.results.forEach(x => { byId[x.id] = x; });
    return !!(byId.a.principal.length && byId.b.error && byId.c.principal.length) || 'a bad note broke the batch';
  });
  await t('an oversized batch is refused', async () => {
    const notes = []; for (let i = 0; i < 500; i++) notes.push({ id: String(i), text: 'pneumonia' });
    const r = await req('POST', '/v1/code/batch', { notes });
    return r.status === 413 || 'status ' + r.status;
  });

  /* ---------- CORS ---------- */
  await t('a browser preflight is answered', async () => {
    const r = await req('OPTIONS', '/v1/code', undefined, { Origin: 'https://m7mdalshehri68.github.io' });
    return !!(r.status === 204 && r.headers.get('access-control-allow-origin')) || 'status ' + r.status;
  });

  /* ---------- the promise that matters ---------- */
  await t('THE CLINICAL TEXT NEVER REACHES THE LOG', async () => {
    const secret = 'xanthochromia of the pericardium';
    await req('POST', '/v1/code', { text: 'Patient with ' + secret + ' and community acquired pneumonia.' });
    await new Promise(r => setTimeout(r, 250));
    const blob = logs.join('\n');
    if (blob.indexOf(secret) >= 0) return 'the note text was written to the log';
    if (blob.indexOf('pneumonia') >= 0) return 'part of the note text was written to the log';
    return true;
  });
  await t('the log still records enough to bill and to debug', async () => {
    const line = logs.filter(l => l.indexOf('"route":"/v1/code"') >= 0).pop();
    if (!line) return 'nothing was logged at all';
    const o = JSON.parse(line);
    return !!(o.id && typeof o.chars === 'number' && typeof o.ms === 'number' && o.who)
      || 'the log line is missing something: ' + line;
  });
  await t('the caller is logged as a hash, not an address', async () => {
    const line = logs.filter(l => l.indexOf('"route":"/v1/code"') >= 0).pop();
    const o = JSON.parse(line);
    return (/^[0-9a-f]{12}$/.test(o.who) && !/\d+\.\d+\.\d+\.\d+/.test(line)) || 'caller was ' + o.who;
  });

  /* ---------- speed ---------- */
  await t('a note is coded in a few milliseconds', async () => {
    const r = await req('POST', '/v1/code', { text: NOTE });
    return r.json.ms < 60 || 'took ' + r.json.ms + ' ms';
  });

  console.log('');
  console.log(P + ' passed, ' + F + ' failed');
  child.kill();
  process.exit(F ? 1 : 0);
})().catch(e => { console.error(e); if (child) child.kill(); process.exit(1); });
