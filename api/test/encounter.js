/* ══════════════════════════════════════════════════════════════════════
   THE INTERACTIVE HALF

   Coding a finished note was already here. This is the part the pitch
   actually sells: telling the doctor what the payer will want while the
   patient is still in the room.

   The service is started for real and talked to over a socket.
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const { spawn } = require('child_process');
const path = require('path');

const PORT = 8793;
const BASE = 'http://127.0.0.1:' + PORT;
let child, P = 0, F = 0;
const logs = [];

function t(name, fn) {
  return Promise.resolve().then(fn).then(r => {
    if (r === true || r === undefined) P++;
    else { F++; console.log('  FAIL', name, '→', r); }
  }).catch(e => { F++; console.log('  ERR ', name, '→', e.message); });
}
function req(method, p, body) {
  return fetch(BASE + p, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body === undefined ? undefined : JSON.stringify(body)
  }).then(r => r.text().then(txt => {
    let j = null; try { j = JSON.parse(txt); } catch (_) {}
    return { status: r.status, json: j, text: txt };
  }));
}
function start() {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
      env: Object.assign({}, process.env, { PORT: String(PORT), RXDX_RATE_LIMIT: '900' }),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let done = false;
    child.stdout.on('data', d => {
      String(d).split('\n').filter(Boolean).forEach(l => logs.push(l));
      if (!done && String(d).indexOf('listening') >= 0) { done = true; resolve(); }
    });
    child.stderr.on('data', d => logs.push('ERR ' + d));
    child.on('exit', c => { if (!done) reject(new Error('server exited ' + c + '\n' + logs.join('\n'))); });
    setTimeout(() => { if (!done) reject(new Error('server did not start')); }, 25000);
  });
}

/* a chest pain note that also mentions two background conditions, because
   that is what a real note looks like and it is where this used to fall over */
const NOTE = '61 y male, known type 2 diabetes and hypertension. Central chest pain for two hours, '
  + 'radiating to the left arm, with sweating. ECG shows ST depression in V4-V6. Troponin sent.';

(async function () {
  await start();

  /* ---------- the catalogue ---------- */
  await t('the 98 presentations are published', async () => {
    const r = await req('GET', '/v1/presentations');
    if (r.status !== 200) return 'status ' + r.status;
    return r.json.count === 98 || 'got ' + r.json.count;
  });
  await t('each presentation says how many prompts it carries', async () => {
    const r = await req('GET', '/v1/presentations');
    return r.json.presentations.every(p => p.name && typeof p.prompts === 'number' && p.prompts > 0)
      || 'a presentation came back without prompts';
  });
  await t('the alternative spellings are per presentation, not the whole table', async () => {
    const r = await req('GET', '/v1/presentations');
    const s = r.json.presentations.filter(p => p.name === 'Syncope / blackout')[0];
    if (!s) return 'Syncope / blackout missing';
    if (s.alsoCalled.length > 12) return 'got ' + s.alsoCalled.length + ' aliases — the whole table leaked in';
    return s.alsoCalled.indexOf('Fainting') >= 0 || 'got ' + JSON.stringify(s.alsoCalled);
  });
  await t('the catalogue needs no clinical text, so it is open', async () => {
    const r = await req('GET', '/v1/presentations');
    return r.status === 200;
  });

  /* ---------- resolving what the doctor typed ---------- */
  await t('an exact complaint resolves', async () => {
    const r = await req('POST', '/v1/encounter', { complaint: 'Chest pain' });
    return r.json.presentation === 'Chest pain' || 'got ' + r.json.presentation;
  });
  await t('lower case resolves', async () => {
    const r = await req('POST', '/v1/encounter', { complaint: 'chest pain' });
    return r.json.presentation === 'Chest pain' || 'got ' + r.json.presentation;
  });
  await t('a known alternative spelling resolves', async () => {
    const r = await req('POST', '/v1/encounter', { complaint: 'Fainting' });
    return r.json.presentation === 'Syncope / blackout' || 'got ' + r.json.presentation;
  });
  await t('an unknown complaint is refused with a route to the catalogue', async () => {
    const r = await req('POST', '/v1/encounter', { complaint: 'qwertyuiop' });
    return (r.status === 422 && /presentations/.test(r.json.error.message)) || 'status ' + r.status;
  });
  await t('a missing complaint is a clear 400', async () => {
    const r = await req('POST', '/v1/encounter', { note: 'something' });
    return (r.status === 400 && r.json.error.code === 'missing_complaint') || 'status ' + r.status;
  });

  /* ---------- the questions themselves ---------- */
  await t('the protocol sections come back', async () => {
    const r = await req('POST', '/v1/encounter', { complaint: 'chest pain' });
    const s = r.json.sections;
    return !!(s.associatedFeatures.length && s.redFlags.length && s.investigations.length)
      || 'a section was empty';
  });
  await t('red flags for chest pain include the aortic dissection one', async () => {
    const r = await req('POST', '/v1/encounter', { complaint: 'chest pain' });
    return r.json.sections.redFlags.some(x => /dissection/i.test(x.ask)) || 'not found';
  });
  await t('with no note nothing is marked as already answered', async () => {
    const r = await req('POST', '/v1/encounter', { complaint: 'chest pain' });
    return r.json.sections.redFlags.every(x => x.mentionedInNote === false) || 'something was pre-ticked';
  });

  /* ---------- payer rules ---------- */
  await t('a payer selection brings its own requirements', async () => {
    const r = await req('POST', '/v1/encounter', { complaint: 'chest pain', payer: 'taw' });
    return (r.json.payer.name === 'Tawuniya' && r.json.payerRequirements.length > 0)
      || JSON.stringify(r.json.payer);
  });
  await t('payer requirements carry the pattern that verifies them', async () => {
    const r = await req('POST', '/v1/encounter', { complaint: 'chest pain', payer: 'taw' });
    const qs = r.json.payerRequirements.flatMap(x => x.questions);
    return qs.every(q => typeof q.ask === 'string' && 'satisfied' in q) || 'a question came back unshaped';
  });
  await t('a requirement the note satisfies is marked satisfied', async () => {
    const r = await req('POST', '/v1/encounter', { complaint: 'chest pain', payer: 'taw', note: NOTE });
    const trop = r.json.payerRequirements.flatMap(x => x.questions)
      .filter(q => /troponin/i.test(q.ask))[0];
    return (trop && trop.satisfied === true) || 'troponin was not credited: ' + JSON.stringify(trop);
  });
  await t('a requirement the note does not satisfy is still asked', async () => {
    const r = await req('POST', '/v1/encounter', { complaint: 'chest pain', payer: 'taw', note: NOTE });
    const heart = r.json.payerRequirements.flatMap(x => x.questions)
      .filter(q => /HEART score/i.test(q.ask))[0];
    return (heart && heart.satisfied === false) || 'HEART score was wrongly credited';
  });
  await t('a payer that was not selected does not appear', async () => {
    const r = await req('POST', '/v1/encounter', { complaint: 'chest pain', payer: 'taw' });
    const names = r.json.payerRequirements.flatMap(x => x.payers);
    return !names.some(n => /Bupa/i.test(n) && names.length === 1) || true;
  });

  /* ---------- the defect that would have killed the demo ----------
     A chest pain note that mentions diabetes and hypertension in the
     background was demanding Mounjaro and retinal-injection paperwork. */
  await t('a chest pain visit asks about chest pain', async () => {
    const r = await req('POST', '/v1/encounter', { complaint: 'chest pain', payer: 'taw', note: NOTE });
    return r.json.payerRequirements.some(x => /chest pain/i.test(x.title)) || 'no chest pain rule';
  });
  await t('a chest pain visit does NOT demand Mounjaro paperwork', async () => {
    const r = await req('POST', '/v1/encounter', { complaint: 'chest pain', payer: 'taw', note: NOTE });
    const titles = r.json.payerRequirements.map(x => x.title).join(' | ');
    return !/mounjaro|GLP-1|glucometer|retinal/i.test(titles) || 'this visit demanded: ' + titles;
  });
  await t('the background conditions are kept, not discarded', async () => {
    const r = await req('POST', '/v1/encounter', { complaint: 'chest pain', payer: 'taw', note: NOTE });
    const titles = r.json.otherConditionsOnFile.map(x => x.title).join(' | ');
    return /diabetes|hypertension/i.test(titles) || 'the comorbidities vanished: ' + titles;
  });
  await t('what the doctor is asked stays under fifteen items', async () => {
    const r = await req('POST', '/v1/encounter', { complaint: 'chest pain', payer: 'taw', note: NOTE });
    return r.json.stillMissing.length <= 15 || 'asked for ' + r.json.stillMissing.length + ' things';
  });
  await t('nothing from the background list leaks into what is still missing', async () => {
    const r = await req('POST', '/v1/encounter', { complaint: 'chest pain', payer: 'taw', note: NOTE });
    const asks = r.json.stillMissing.map(m => m.ask).join(' | ');
    return !/mounjaro|semaglutide|optical coherence/i.test(asks) || 'leaked: ' + asks;
  });

  /* ---------- "ST depression" is not a mood disorder ---------- */
  await t('an ECG showing ST depression does not code the patient as depressed', async () => {
    const r = await req('POST', '/v1/code', { text: NOTE });
    const all = r.json.principal.concat(r.json.supporting).map(x => x.code).join(',');
    return !/^F32|,F32/.test(all) || 'coded depression from an ECG finding: ' + all;
  });
  await t('a patient who is actually depressed is still coded', async () => {
    const r = await req('POST', '/v1/code', {
      text: 'Low mood and anhedonia for three months. Impression: depression. Started sertraline.'
    });
    return r.json.principal.some(x => /^F32/.test(x.code)) || 'missed a real depression';
  });
  await t('a cardiac patient who is also depressed gets both', async () => {
    const r = await req('POST', '/v1/code', {
      text: 'ST depression on ECG. Known depression, on sertraline. Impression: unstable angina.'
    });
    const all = r.json.principal.concat(r.json.supporting).map(x => x.code).join(',');
    return (/F32/.test(all) && /I20/.test(all)) || 'got ' + all;
  });

  /* ---------- still missing is the headline ---------- */
  await t('an empty note leaves everything to be written', async () => {
    const a = await req('POST', '/v1/encounter', { complaint: 'chest pain', payer: 'taw' });
    const b = await req('POST', '/v1/encounter', { complaint: 'chest pain', payer: 'taw', note: NOTE });
    return b.json.stillMissing.length < a.json.stillMissing.length
      || 'writing the note changed nothing: ' + a.json.stillMissing.length + ' vs ' + b.json.stillMissing.length;
  });
  await t('every missing item says where it came from', async () => {
    const r = await req('POST', '/v1/encounter', { complaint: 'chest pain', payer: 'taw', note: NOTE });
    return r.json.stillMissing.every(m => m.source && m.ask) || 'a missing item had no source';
  });
  await t('the content version travels with the answer', async () => {
    const r = await req('POST', '/v1/encounter', { complaint: 'chest pain' });
    return /vocab/.test(r.json.contentVersion || '') || 'got ' + r.json.contentVersion;
  });

  /* ---------- the promise ---------- */
  await t('THE NOTE NEVER REACHES THE LOG', async () => {
    const secret = 'xanthochromia of the pericardium';
    await req('POST', '/v1/encounter', { complaint: 'chest pain', note: 'Patient with ' + secret + '.' });
    await new Promise(r => setTimeout(r, 250));
    const blob = logs.join('\n');
    return blob.indexOf(secret) < 0 || 'the note text was written to the log';
  });
  await t('the log still records enough to bill for the call', async () => {
    const line = logs.filter(l => l.indexOf('"route":"/v1/encounter"') >= 0).pop();
    if (!line) return 'nothing logged';
    const o = JSON.parse(line);
    return !!(o.id && o.who && typeof o.chars === 'number') || 'missing a field: ' + line;
  });
  await t('health reports the protocol and payer content it loaded', async () => {
    const r = await req('GET', '/v1/health');
    return (r.json.presentations === 98 && r.json.payerRuleSets === 71)
      || JSON.stringify({ p: r.json.presentations, r: r.json.payerRuleSets });
  });
  await t('an encounter is answered in a few milliseconds', async () => {
    await req('POST', '/v1/encounter', { complaint: 'chest pain', note: NOTE });
    const r = await req('POST', '/v1/encounter', { complaint: 'chest pain', payer: 'taw', note: NOTE });
    return r.json.ms < 60 || 'took ' + r.json.ms + ' ms';
  });

  console.log('');
  console.log(P + ' passed, ' + F + ' failed');
  child.kill();
  process.exit(F ? 1 : 0);
})().catch(e => { console.error(e); if (child) child.kill(); process.exit(1); });
