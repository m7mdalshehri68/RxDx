/* usage: node design/check_language.js [index.html]
   needs puppeteer-core, and Chrome: set CHROME_PATH, or install @sparticuz/chromium on Linux.
   With the screen in Arabic, click through History Builder and the emergency
   module the way a doctor would, generate both notes, and check that not one
   Arabic character reached the note, the codes or a copied value. Then switch
   to English and back and check nothing Arabic is left on an English screen. */
const puppeteer = require('puppeteer-core');
const path = require('path');
const html = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
async function chrome() {
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, args: ['--allow-file-access-from-files'] };
  const c = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
  return { executablePath: await c.executablePath(), args: [...c.args, '--allow-file-access-from-files'] };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const AR = /[؀-ۿ]/;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };

(async () => {
  const browser = await puppeteer.launch(Object.assign(await chrome(), { headless: true, defaultViewport: { width: 1440, height: 900 } }));
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', async d => { await (d.type() === 'prompt' ? d.accept('test reason for the check') : d.dismiss()); });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('rx_lang', 'ar'); } catch (_) {} });
  await page.goto('file://' + (html[0] === '/' ? '' : '/') + html.replace(/\\/g, '/'), { waitUntil: 'load', timeout: 120000 });
  await sleep(800);
  ok(await page.evaluate(() => document.documentElement.dir === 'rtl' && rxLangNow() === 'ar'), 'starts in Arabic, right to left');
  await page.evaluate(() => rxEnter('doctor'));
  await sleep(400);

  /* History Builder, everything a doctor taps */
  const hx = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    switchTab('hx');
    const i = document.getElementById('hx-input'); i.value = 'Chest pain'; hxRender(); await wait(300);
    document.getElementById('hx-age').value = '54'; hxWho(); hxSex('Male'); await wait(200);
    const clicks = [];
    /* these are the elements whose own words are copied into the note */
    const tap = sel => { const els = [...document.querySelectorAll(sel)].slice(0, 3); els.forEach(e => { e.click(); clicks.push(e.textContent.trim()); }); };
    tap('#panel-hx .hx-chip[onclick*="hxQ"]');
    tap('#panel-hx #hx-neg .hx-neg');
    tap('#hx-plan-quick .hx-neg');
    tap('#hx-fam .hx-neg');
    /* the Present / Absent answer buttons are labels only: the note takes the row's data-t */
    [...document.querySelectorAll('#panel-hx .hx-qb')].slice(0, 3).forEach(b => b.click());
    await wait(200);
    const onscreenArabic = clicks.filter(t => /[؀-ۿ]/.test(t));
    try { hxGenerate('final'); } catch (e) { }
    await wait(500);
    const vals = [...document.querySelectorAll('#panel-hx input, #panel-hx textarea, #panel-hx select')].map(e => e.value).filter(Boolean);
    return { note: document.getElementById('hx-out').value, vals, clicks: clicks.length, onscreenArabic };
  });
  ok(hx.note.length > 200, 'History Builder produced a note (' + hx.note.length + ' chars)');
  ok(!AR.test(hx.note), 'History Builder note has no Arabic: ' + (hx.note.match(/.{0,30}[؀-ۿ].{0,30}/) || [''])[0]);
  ok(!hx.vals.some(v => AR.test(v)), 'no Arabic in any History Builder field value: ' + hx.vals.filter(v => AR.test(v)).slice(0, 3).join(' | '));
  ok(hx.clicks >= 6, 'clicked ' + hx.clicks + ' chips, negatives and answers');
  ok(hx.onscreenArabic.length === 0, 'chips that write into the note stay in English on screen: ' + hx.onscreenArabic.join(', '));

  /* Emergency module, every step */
  const ed = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    switchTab('ed');
    const c = document.getElementById('ed-cc'); c.value = 'Chest pain'; edOnComplaint(); await wait(200);
    for (let n = 1; n <= 9; n++) {
      edStep(n); await wait(80);
      const pane = document.querySelector('#ed-panes .ed-pane[data-step="' + n + '"]');
      if (!pane) continue;
      const groups = {};
      pane.querySelectorAll('.hx-neg[data-v], .hx-neg[data-p]').forEach(e => { const g = e.parentElement; if (!groups[g.id || Math.random()]) { groups[g.id || Math.random()] = 1; e.click(); } });
      pane.querySelectorAll('.hx-qb').forEach((b, k) => { if (k < 4) b.click(); });
      pane.querySelectorAll('select').forEach(s => { if (s.options.length > 1) { s.selectedIndex = 1; s.dispatchEvent(new Event('change', { bubbles: true })); } });
    }
    await wait(200);
    try { edGenerate('final'); } catch (e) { }
    await wait(500);
    const vals = [...document.querySelectorAll('#panel-ed input, #panel-ed textarea, #panel-ed select')].map(e => e.value).filter(Boolean);
    return { note: document.getElementById('ed-out').value, vals };
  });
  ok(ed.note.length > 200, 'emergency note produced (' + ed.note.length + ' chars)');
  ok(!AR.test(ed.note), 'emergency note has no Arabic: ' + (ed.note.match(/.{0,30}[؀-ۿ].{0,30}/) || [''])[0]);
  ok(!ed.vals.some(v => AR.test(v)), 'no Arabic in any emergency field value: ' + ed.vals.filter(v => AR.test(v)).slice(0, 3).join(' | '));

  /* Note -> codes, and the copy text */
  const nc = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    let copied = [];
    navigator.clipboard.writeText = t => { copied.push(t); return Promise.resolve(); };
    switchTab('note');
    document.getElementById('note-input').value = 'Known type 2 diabetes and hypertension. Denies fever. Impression: community acquired pneumonia.';
    analyzeNote(); await wait(400);
    const btn = [...document.querySelectorAll('#note-out button')].find(b => /copyText|copyAll|codes/i.test(b.getAttribute('onclick') || ''));
    if (btn) btn.click();
    await wait(200);
    return { copied, codes: document.querySelectorAll('#note-out .code-mono, #note-out .icd-code').length };
  });
  ok(nc.copied.length > 0 && !nc.copied.some(t => AR.test(t)), 'copied codes carry no Arabic (' + nc.copied.length + ' copies)');

  /* round trip: English, then Arabic again */
  await page.evaluate(() => rxLang('en'));
  await sleep(300);
  const en = await page.evaluate(() => {
    const left = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const p = n.parentElement;
      if (!p || !(p.offsetWidth || p.offsetHeight) || p.closest('.rx-lang')) continue;
      if (/[؀-ۿ]/.test(n.nodeValue)) left.push(n.nodeValue.trim().slice(0, 60));
    }
    document.querySelectorAll('[placeholder],[title]').forEach(e => { ['placeholder', 'title'].forEach(a => { const v = e.getAttribute(a); if (v && /[؀-ۿ]/.test(v) && (e.offsetWidth || e.offsetHeight)) left.push('@' + a + ' ' + v.slice(0, 50)); }); });
    return { dir: document.documentElement.dir, left };
  });
  ok(en.dir === 'ltr', 'English is left to right');
  ok(en.left.length === 0, 'no Arabic left on the English screen: ' + en.left.slice(0, 6).join(' | '));
  await page.evaluate(() => { rxLang('ar'); switchTab('hx'); });
  await sleep(300);
  ok(await page.evaluate(() => document.documentElement.dir === 'rtl' && /[؀-ۿ]/.test(document.getElementById('rx-title').textContent)), 'back to Arabic, title translated again');
  ok(errs.length === 0, 'no page errors: ' + errs.slice(0, 3).join(' | '));
  console.log(pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e.stack); process.exit(1); });
