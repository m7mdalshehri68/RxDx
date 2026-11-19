/* usage: node design/check_soap.js [index.html]
   needs puppeteer-core, and Chrome: set CHROME_PATH, or install @sparticuz/chromium on Linux.
   For every complaint in History Builder, fill every field a doctor can see with
   a marker of its own, answer every symptom and examination row, add a working
   diagnosis and a differential, generate, and check that the SOAP and SOCRATES
   layouts each carry every marker, invent nothing, leave no empty label and
   carry no Arabic. Then the same for the emergency record, on a sample. */
const puppeteer = require('puppeteer-core');
const path = require('path');
const html = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
async function chrome() {
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, args: ['--allow-file-access-from-files'] };
  const c = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
  return { executablePath: await c.executablePath(), args: [...c.args, '--allow-file-access-from-files'] };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };

/* checks shared by both layouts */
function problems(txt) {
  const p = [];
  if (/undefined|\bnull\b|\[object|NaN/.test(txt)) p.push('a placeholder leaked: ' + (txt.match(/.{0,30}(undefined|\bnull\b|\[object|NaN).{0,20}/) || [''])[0]);
  if (/not documented/i.test(txt)) p.push('"not documented" printed');
  if (/[؀-ۿ]/.test(txt)) p.push('Arabic in the note');
  const L = txt.split('\n');
  L.forEach((l, i) => {
    if (/:\s*$/.test(l) && !(L[i + 1] && /^\s+\S/.test(L[i + 1]))) p.push('empty label: "' + l + '"');
  });
  return p;
}

(async () => {
  const browser = await puppeteer.launch(Object.assign(await chrome(), { headless: true, defaultViewport: { width: 1280, height: 900 } }));
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  /* the checkpoint asks OK = go back, Cancel = finalise with a reason: finalise */
  page.on('dialog', async d => { const ty = d.type(); await (ty === 'prompt' ? d.accept('reviewed by the doctor') : ty === 'confirm' ? d.dismiss() : d.accept()); });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('rx_lang', 'en'); localStorage.removeItem('rxdx_hxdraft'); } catch (_) {} });
  await page.goto('file://' + (html[0] === '/' ? '' : '/') + html.replace(/\\/g, '/'), { waitUntil: 'load', timeout: 120000 });
  await sleep(800);
  await page.evaluate(() => { try { rxEnter('doctor'); } catch (_) {} switchTab('hx'); });
  const list = await page.evaluate(() => Object.keys(PRESENTATIONS));
  ok(list.length > 50, list.length + ' complaints to check');

  let checked = 0;
  for (let k = 0; k < list.length; k++) {
    const cc = list[k];
    const r = await page.evaluate(async (cc, k) => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const vis = e => !!(e && (e.offsetWidth || e.offsetHeight || e.getClientRects().length));
      hxClear(); await wait(10);
      const i = document.getElementById('hx-input'); i.value = cc; hxRender(); await wait(10);
      document.getElementById('hx-age').value = '34'; hxWho(); hxSex(k % 2 ? 'Female' : 'Male'); await wait(10);
      const markers = [];
      let n = 0;
      const skip = /^(hx-input|hx-age|hx-dx|hx-out|hx-duration-n|hx-clinic|hx-pa-look)$/;
      document.querySelectorAll('#panel-hx input[type="text"], #panel-hx input:not([type]), #panel-hx textarea').forEach(e => {
        if (!e.id || skip.test(e.id) || !vis(e) || e.closest('#hx-docbody') || e.closest('.hx-detail')) return;
        const v = 'mk' + (++n) + 'z'; e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); markers.push(v);
      });
      const dn = document.getElementById('hx-duration-n'); if (dn) { dn.value = '3'; const u = document.getElementById('hx-duration-u'); if (u) u.value = 'days'; hxDurSync('hx-duration'); }
      const site = document.getElementById('hx-site'); if (site && vis(site) && site.options.length > 1) { site.selectedIndex = 1; }
      [...document.querySelectorAll('#hx-assoc .hx-qrow')].forEach((row, j) => { const b = row.querySelector('.hx-qb[data-v="' + (j % 2 ? '2' : '1') + '"]'); b && b.click(); });
      [...document.querySelectorAll('#hx-exam .hx-qrow')].forEach((row, j) => {
        const b = row.querySelector('.hx-qb[data-v="' + (j % 3 === 0 ? '2' : '1') + '"]'); b && b.click();
        if (j % 3 === 0) { const d = row.querySelector('.hx-detail input'); if (d) { const v = 'dt' + j + 'z'; d.value = v; d.dispatchEvent(new Event('input', { bubbles: true })); markers.push(v); } }
      });
      const flags = document.querySelectorAll('#hx-red input[type="checkbox"]');
      if (flags.length && k % 2) { flags[0].checked = true; flags[0].dispatchEvent(new Event('change', { bubbles: true })); }
      else if (flags.length) hxRedNone();
      const g = document.querySelector('#hx-gen-q .hx-neg'); if (g) g.click();
      const pq = document.querySelector('#hx-preg-q .hx-neg'); if (pq && vis(pq)) pq.click();
      const lmp = document.getElementById('hx-preg-lmp'); if (lmp && vis(lmp)) { lmp.value = '2026-10-01'; markers.push('2026-10-01'); }
      let codes = []; try { codes = _hxRank(cc).map(x => x.code_id).slice(0, 2); } catch (_) {}
      if (!codes.length) codes = ['R69'];
      codes.forEach(c => { try { hxDxAdd(c); } catch (_) {} });
      if (codes[1]) hxDxToDiff(String(codes[1]).toUpperCase());
      await wait(10);
      try { hxGenerate('final'); } catch (e) { return { err: 'hxGenerate threw: ' + e.message }; }
      const t = window._noteTxt.hx;
      if (!t) return { err: 'no layouts after Generate' };
      document.querySelector('#hx-fmt button[data-f="socrates"]').click();
      const a = document.getElementById('hx-out').value === t.socrates;
      document.querySelector('#hx-fmt button[data-f="soap"]').click();
      const b = document.getElementById('hx-out').value === t.soap;
      const dx = (window._hxDx || []).map(x => x.desc), ddx = (window._hxDiff || []).map(x => x.desc);
      return { soap: t.soap, soc: t.socrates, markers, tabs: a && b, dx, ddx, preg: !!(pq && vis(pq)) };
    }, cc, k);
    if (r.err) { ok(false, cc + ': ' + r.err); continue; }
    checked++;
    const lo = s => s.toLowerCase();
    const missS = r.markers.filter(m => lo(r.soap).indexOf(lo(m)) < 0), missC = r.markers.filter(m => lo(r.soc).indexOf(lo(m)) < 0);
    ok(!missS.length, cc + ': SOAP lost ' + missS.join(', '));
    ok(!missC.length, cc + ': SOCRATES lost ' + missC.join(', '));
    ok(/3-day history/.test(r.soap) && /3 days/.test(r.soc), cc + ': duration');
    const pS = problems(r.soap), pC = problems(r.soc);
    ok(!pS.length, cc + ' SOAP: ' + pS.join(' | '));
    ok(!pC.length, cc + ' SOCRATES: ' + pC.join(' | '));
    ok(r.tabs, cc + ': the box follows the tab');
    const order = ['SUBJECTIVE', 'OBJECTIVE', 'ASSESSMENT', 'PLAN'].map(h => r.soap.split('\n').indexOf(h)).filter(i => i >= 0);
    ok(order.every((v, i) => !i || v > order[i - 1]) && order.length >= 3, cc + ': sections in order ' + order.join(','));
    if (r.dx[0]) ok(r.soap.indexOf('Primary Diagnosis: ' + r.dx[0]) >= 0, cc + ': primary diagnosis');
    if (r.ddx[0]) ok(r.soap.indexOf('Differential Diagnosis: ' + r.ddx[0]) >= 0 && r.soc.indexOf('DIFFERENTIAL DIAGNOSIS: ' + r.ddx[0]) >= 0, cc + ': differential');
    if (r.preg) ok(/Pregnancy Status: /.test(r.soap) && /PREGNANCY STATUS: /.test(r.soc), cc + ': pregnancy status');
  }
  ok(checked === list.length, 'every complaint generated (' + checked + ' of ' + list.length + ')');

  /* emergency record, a sample of complaints */
  const edList = list.filter((_, i) => i % Math.max(1, Math.floor(list.length / 12)) === 0).slice(0, 12);
  for (const cc of edList) {
    const r = await page.evaluate(async cc => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const vis = e => !!(e && (e.offsetWidth || e.offsetHeight || e.getClientRects().length));
      switchTab('ed'); edClear(); await wait(10);
      const c = document.getElementById('ed-cc'); c.value = cc; try { edOnComplaint(); } catch (_) {} await wait(20);
      const markers = []; let n = 0;
      for (let s = 1; s <= 9; s++) {
        try { edStep(s); } catch (_) {} await wait(5);
        document.querySelectorAll('#panel-ed input[type="text"], #panel-ed input:not([type]), #panel-ed textarea').forEach(e => {
          if (!e.id || /^(ed-cc|ed-dx|ed-out|ed-sbar|ed-just|ed-return-q|ed-wu-q|ed-rf-q)$/.test(e.id) || e.value || !vis(e)) return;
          const v = 'em' + (++n) + 'z'; e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); markers.push({ id: e.id, v });
        });
      }
      window._edDx = [{ code: 'R69', desc: 'Illness, unspecified' }];
      try { edGenerate('final'); } catch (e) { return { err: 'edGenerate threw: ' + e.message }; }
      const t = window._noteTxt.ed;
      if (!t) return { err: 'no layouts' };
      /* only what the record itself prints is expected in the SOAP layout */
      const inRecord = markers.filter(m => t.socrates.indexOf(m.v) >= 0);
      return { soap: t.soap, soc: t.socrates, inRecord, all: markers.length };
    }, cc);
    if (r.err) { ok(false, 'ED ' + cc + ': ' + r.err); continue; }
    const miss = r.inRecord.filter(m => r.soap.indexOf(m.v) < 0).map(m => m.id);
    ok(!miss.length, 'ED ' + cc + ': SOAP lost what the record prints: ' + miss.join(', '));
    const pS = problems(r.soap);
    ok(!pS.length, 'ED ' + cc + ' SOAP: ' + pS.join(' | '));
    ok(r.inRecord.length >= Math.min(5, r.all), 'ED ' + cc + ': the record printed ' + r.inRecord.length + ' of ' + r.all + ' fields');
  }
  ok(errs.length === 0, 'no page errors: ' + errs.slice(0, 3).join(' | '));
  console.log(pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e.stack); process.exit(1); });
