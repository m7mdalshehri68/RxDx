/* PRIVACY: a canary string sent inside notes must never appear in any log,
   any file, or any error output — on every route, on every error path, with
   the audit trail and feedback written to disk, and with the adjudicator on.

   What is checked:
     · everything the service prints (stdout and stderr);
     · the audit and feedback files it writes;
     · every file created or changed during the run in the repository and in
       the system temporary directory;
     · every response that is not a 200 (error output).
   A 200 response may quote the note back to the caller who sent it; that is
   the answer, not a log. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { start, runner } = require('./_server.js');

const { t, done } = runner('privacy');
const CANARY = 'QZXCANARY' + crypto.randomBytes(6).toString('hex').toUpperCase();
const REPO = path.join(__dirname, '..', '..');
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rxdx-privacy-'));
const AUDIT = path.join(DIR, 'audit.jsonl'), FEEDBACK = path.join(DIR, 'feedback.jsonl');
const T0 = Date.now();

function walk(dir, out, depth) {
  if (depth > 6) return out;
  let list = [];
  try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
  list.forEach(e => {
    if (e.name === '.git' || e.name === 'node_modules') return;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out, depth + 1);
    else if (e.isFile()) { try { if (fs.statSync(f).mtimeMs >= T0 - 1000) out.push(f); } catch (_) {} }
  });
  return out;
}

(async () => {
  /* an adjudicator that fails, so its error path runs too */
  const fake = http.createServer((q, s) => { q.on('data', () => {}); q.on('end', () => { s.writeHead(500); s.end('model error'); }); });
  await new Promise(r => fake.listen(0, '127.0.0.1', r));
  const S = await start(8831, { RXDX_AUDIT_FILE: AUDIT, RXDX_FEEDBACK_FILE: FEEDBACK, RXDX_LLM_PROVIDER: 'hospital',
                                RXDX_LLM_URL: 'http://127.0.0.1:' + fake.address().port + '/', RXDX_LLM_TIMEOUT_MS: '1000' });
  const errorBodies = [];
  const call = async (method, p, body, headers) => {
    const r = await S.req(method, p, body, headers);
    if (r.status !== 200) errorBodies.push(r.status + ' ' + r.text);   /* the body only: the path is the caller's own */
    return r;
  };
  const N = (x, extra) => Object.assign({ clinical_note: x, encounter_type: 'outpatient' }, extra || {});

  /* the canary in every place a note can carry it */
  const ok1 = await call('POST', '/v1/code-note', N('Cough and fever. ' + CANARY + ' reported by family. Impression: community acquired pneumonia, ' + CANARY + '. Started ' + CANARY + ' 500 mg.'));
  await call('POST', '/v1/code-note', N('Impression: ' + CANARY + ' syndrome and ' + CANARY + ' disease.', { options: { use_llm: true } }));
  await call('POST', '/v1/code-note', N('Mr Canary ' + CANARY + '. Impression: pneumonia.'));                 /* 422 */
  await call('POST', '/v1/code-note', N(CANARY + ' ID 1087654321. Impression: pneumonia.'));                  /* 422 */
  await call('POST', '/v1/code-note', N(CANARY + ' ' + 'x'.repeat(270 * 1024)));                               /* 413 */
  await call('POST', '/v1/code-note', '{"clinical_note": "' + CANARY + ' pneumonia", ');                        /* bad JSON */
  await call('POST', '/v1/code-note', { clinical_note: CANARY + ' pneumonia', encounter_type: CANARY });        /* 400 */
  await call('POST', '/v1/code-note', Object.assign(N(CANARY + ' pneumonia'), { note_ref: CANARY }));           /* unknown field */
  await call('POST', '/v1/code-note', N(CANARY + ' pneumonia', { coding_system: CANARY }));                    /* coding system */
  await call('POST', '/v1/code-note/batch', { defaults: { encounter_type: 'outpatient' }, notes: [
    { id: 'a', clinical_note: 'Impression: ' + CANARY + ' and pneumonia.' }, { id: 'b', clinical_note: 'Mrs Test ' + CANARY }, { id: 'c', clinical_note: 7 }] });
  await call('POST', '/v1/feedback', { request_id: ok1.json.request_id, code: 'J18.9', decision: 'reject', reason: CANARY });
  await call('POST', '/v1/feedback', { request_id: ok1.json.request_id, code: 'J18.9', decision: 'reject', reason: 'other', comment: CANARY });
  await call('POST', '/v1/feedback', { request_id: ok1.json.request_id, code: 'J18.9', decision: 'accept', reason: 'correct' });
  await call('GET', '/v1/feedback');
  await call('GET', '/v1/audit/' + ok1.json.request_id);
  await call('POST', '/v1/code', { text: 'Pneumonia. ' + CANARY });
  await call('POST', '/v1/code/batch', { notes: [{ id: '1', text: 'Asthma ' + CANARY }] });
  await call('POST', '/v1/encounter', { complaint: 'Chest pain', note: CANARY + ' chest pain', payer: 'bupa' });
  await call('POST', '/v1/encounter', { complaint: 'Chest pain', note: 'chest pain', payer: CANARY });
  await call('POST', '/v1/encounter', { complaint: CANARY });                                                   /* 422 unknown complaint */
  await call('GET', '/v1/' + CANARY);                                                                           /* 404 */
  await S.stop();
  fake.close();

  const logs = S.logs.join('\n');
  await t('the canary never appears in anything the service printed', () => (S.logs.length > 3 && logs.indexOf(CANARY) < 0) || 'found in the log');
  await t('the audit trail on disk holds no text', () => {
    const a = fs.existsSync(AUDIT) ? fs.readFileSync(AUDIT, 'utf8') : '';
    return (a.length > 0 && a.indexOf(CANARY) < 0 && !/pneumonia/i.test(a)) || (a ? 'found in the audit file' : 'no audit file written');
  });
  await t('the feedback file on disk holds codes only', () => {
    const f = fs.existsSync(FEEDBACK) ? fs.readFileSync(FEEDBACK, 'utf8') : '';
    return (f.length > 0 && f.indexOf(CANARY) < 0) || (f ? 'found in the feedback file' : 'no feedback file written');
  });
  await t('no file created or changed during the run carries the canary', () => {
    const files = walk(REPO, [], 0).concat(walk(os.tmpdir(), [], 0));
    const hit = files.filter(f => { try { const st = fs.statSync(f); return st.size < 64 * 1024 * 1024 && fs.readFileSync(f, 'utf8').indexOf(CANARY) >= 0; } catch (_) { return false; } });
    return !hit.length || hit.slice(0, 5).join(', ');
  });
  await t('no error response repeats the canary or carries a stack trace', () => {
    const leak = errorBodies.filter(b => b.indexOf(CANARY) >= 0);
    const stack = errorBodies.filter(b => /\n\s+at\s|at [A-Za-z_$][\w$.]*\s\(.*:\d+:\d+\)/.test(b));
    return (errorBodies.length >= 8 && !leak.length && !stack.length) || (leak.concat(stack).slice(0, 2).join(' || ') || 'only ' + errorBodies.length + ' error responses');
  });
  fs.rmSync(DIR, { recursive: true, force: true });
  process.exit(done() ? 1 : 0);
})().catch(e => { console.log('ERR', e && e.stack); process.exit(1); });
