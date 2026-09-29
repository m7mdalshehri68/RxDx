/* RxDx UI prototype — the screens beside Note → Codes */
(function () {
  'use strict';
  RX.screens = {};
  var A = function () { return RX.app; };
  function h(k) { return A().t(k); }
  function e(s) { return A().esc(s); }
  function ic(n, c) { return RX.ICON(n, c); }

  /* ── Find: Search, ICD-10, Formulary ── */
  function editTags(c) {
    return c.e.map(function (k) {
      if (k.indexOf('age:') === 0) return '<span class="tag">' + e(h('e_age')) + ' <span class="num" style="margin-inline-start:4px">' + k.slice(4) + '</span></span>';
      var cls = k === 'e_nopdx' ? ' style="color:var(--warning-ink);border-color:color-mix(in srgb,var(--warning) 35%,transparent)"' : k === 'e_morph' ? ' style="color:var(--info);border-color:color-mix(in srgb,var(--info) 30%,transparent)"' : k === 'e_f' ? ' style="color:var(--gold-ink)"' : '';
      return '<span class="tag"' + cls + '>' + e(h(k)) + '</span>';
    }).join('');
  }
  function findView(kind) {
    var ph = kind === 'icd' ? 'icd_ph' : 'search_ph';
    var count = kind === 'icd' ? '16,953 ' + h('codes_n') : '16,953 ' + h('codes_n') + ' · 1,548 ' + h('drugs_n');
    return '<label class="search">' + ic('search') + '<input id="find" autocomplete="off" value="' + e(RX.findQ || '') + '" placeholder="' + e(h(ph)) + '" aria-label="' + e(h(ph)) + '"><span class="count">' + count + '</span></label>' +
      '<div id="found"></div>';
  }
  function found(kind) {
    var v = (RX.findQ || '').trim().toLowerCase(), out = '';
    var codes = RX.LIB.filter(function (c) { return !v || (c.code + ' ' + c.desc).toLowerCase().indexOf(v) >= 0; });
    var drugs = kind === 'search' ? RX.DRUGS.filter(function (d) { return v && (d.n + ' ' + d.b + ' ' + d.cls).toLowerCase().indexOf(v) >= 0; }) : [];
    if (!codes.length && !drugs.length) return '<div class="card enter" style="margin-top:18px"><div class="empty"><span class="ic">' + ic('search') + '</span><h3>' + (A().S.lang === 'ar' ? 'لا نتائج' : 'No results') + '</h3><p>' + (A().S.lang === 'ar' ? 'جرّب كلمة أخرى أو جزءاً من الكود.' : 'Try another word or part of the code.') + '</p></div></div>';
    out += '<div class="results"><div class="micro" style="margin:4px 2px"><span class="num">' + (codes.length + drugs.length) + '</span> ' + e(h('results_for')) + ' · ' + e(h('click_copy')) + '</div>';
    codes.forEach(function (c, i) {
      out += '<button class="card rcard lift enter" style="--i:' + i + '" data-copy="' + c.code + '"><span class="code">' + c.code + '</span><span><span class="d clin" style="display:block">' + e(c.desc) + '</span><span class="tags">' + editTags(c) + '</span></span><span class="cp">' + ic('copy') + '<span>' + e(h('copy')) + '</span></span></button>';
    });
    drugs.forEach(function (d, i) {
      out += '<button class="card rcard lift enter" style="--i:' + (codes.length + i) + '" data-drug="' + e(d.n) + '"><span class="code" style="color:var(--teal)">' + ic('pill') + '</span><span><span class="d clin" style="display:block">' + e(d.n) + '</span><span class="tags"><span class="tag clin">' + e(d.b) + '</span><span class="tag clin">' + e(d.cls) + '</span></span></span><span class="cp">' + ic('arrow', 'flip') + '</span></button>';
    });
    return out + '</div>';
  }
  function mountFind(kind) {
    var inp = document.getElementById('find'), box = document.getElementById('found');
    var up = function () { box.innerHTML = found(kind); };
    inp.oninput = function () { RX.findQ = inp.value; up(); };
    box.onclick = function (ev) {
      var b = ev.target.closest('[data-copy]');
      if (b) { A().copy(b.dataset.copy, h('copied') + ' · ' + b.dataset.copy); b.classList.add('copied'); b.querySelector('.cp span').textContent = h('copied'); return; }
      var d = ev.target.closest('[data-drug]'); if (d) { RX.drugSel = d.dataset.drug; A().go('drugs'); }
    };
    up(); inp.focus();
  }
  RX.screens.search = function () { return findView('search'); };
  RX.screens.search.mount = function () { mountFind('search'); };
  RX.screens.icd = function () { return findView('icd'); };
  RX.screens.icd.mount = function () { mountFind('icd'); };

  RX.screens.drugs = function () {
    var sel = RX.drugSel || RX.DRUGS[0].n, d = RX.DRUGS.filter(function (x) { return x.n === sel; })[0] || RX.DRUGS[0];
    return '<label class="search">' + ic('search') + '<input id="dq" placeholder="' + e(h('drug_ph')) + '" aria-label="' + e(h('drug_ph')) + '"><span class="count">1,548 ' + e(h('drugs_n')) + '</span></label>' +
      '<div class="drugs"><div class="card dlist" id="dlist">' + RX.DRUGS.map(function (x) {
        return '<button data-n="' + e(x.n) + '"' + (x.n === d.n ? ' aria-current="true"' : '') + '><b class="clin">' + e(x.n) + '</b><small class="clin">' + e(x.b) + '</small></button>';
      }).join('') + '</div>' +
      '<div class="card enter" style="overflow:hidden"><div class="card-b" style="padding:22px"><div class="micro clin">' + e(d.cls) + ' · SFDA</div><h2 class="clin" style="margin:8px 0 4px;font:700 var(--fs-28)/1.2 var(--sans);letter-spacing:-.02em">' + e(d.n) + '</h2>' +
      '<div style="color:var(--text-2);font-size:var(--fs-13)">' + e(h('brands')) + ': <span class="clin" style="display:inline">' + e(d.b) + '</span></div></div>' +
      '<div class="micro" style="padding:14px 22px 6px;border-top:1px solid var(--border)">' + e(h('indications')) + '</div>' +
      d.ind.map(function (x, i) {
        return '<div class="acc' + (i === 0 ? ' open' : '') + '"><button data-acc aria-expanded="' + (i === 0) + '"><span class="clin">' + e(x.t) + '</span>' + ic('chev', 'chev') + '</button><div class="dx-more"><div><div class="in" style="padding:0 18px 16px"><div class="chips">' +
          x.c.map(function (c) { return '<button class="cchip" data-copy="' + c + '">' + c + '</button>'; }).join('') + '</div></div></div></div></div>';
      }).join('') + '</div></div>';
  };
  RX.screens.drugs.mount = function () {
    var list = document.getElementById('dlist');
    list.onclick = function (ev) { var b = ev.target.closest('button'); if (b) { RX.drugSel = b.dataset.n; A().render(); } };
    document.getElementById('view').addEventListener('click', function (ev) {
      var a = ev.target.closest('[data-acc]'); if (a) { var p = a.parentNode; p.classList.toggle('open'); a.setAttribute('aria-expanded', p.classList.contains('open')); }
      var c = ev.target.closest('[data-copy]'); if (c) A().copy(c.dataset.copy, h('copied') + ' · ' + c.dataset.copy);
    });
    var dq = document.getElementById('dq');
    dq.oninput = function () { var v = dq.value.toLowerCase(); Array.prototype.forEach.call(list.children, function (b) { b.hidden = v && b.textContent.toLowerCase().indexOf(v) < 0; }); };
  };

  /* ── History Builder ── */
  var HX = { step: 2, a: { dur: '3 weeks', rad: 'Left arm', num: true, weak: null, rf_weak: null, rf_gait: null, rf_bladder: null, rf_fever: 'no', rf_trauma: 'no', dm: true, htn: true,
    rom: '', refl: 'Reduced left biceps reflex', power: '', dx: 'Cervical radiculopathy', cause: '', init: '', plan: ['MRI cervical spine', 'Physiotherapy', 'Pregabalin', 'HbA1c'] }, ins: 'bupa' };
  var STEPS = ['hs1', 'hs2', 'hs3', 'hs4', 'hs5', 'hs6', 'hs7', 'hs8', 'hs9'];
  function leaveItems() {
    var a = HX.a, L = [
      { q: 'Duration of the complaint', ok: !!a.dur, step: 0, f: 'dur', ins: ['bupa', 'taw', 'art'] },
      { q: 'Primary cause of the complaint', ok: !!a.cause, step: 6, f: 'cause', ins: ['bupa'] },
      { q: 'Initial management given', ok: !!a.init, step: 7, f: 'init', ins: ['bupa', 'taw', 'art'] },
      { q: 'Examination: range of motion, reflexes, strength', ok: !!(a.rom && a.refl && a.power), step: 4, f: 'rom', ins: ['bupa'] },
      { q: 'Red flags: progressive arm weakness', ok: a.rf_weak != null, step: 2, f: 'rf_weak', ins: ['bupa', 'taw', 'art'] },
      { q: 'Red flags: gait or bladder change', ok: a.rf_gait != null && a.rf_bladder != null, step: 2, f: 'rf_gait', ins: ['bupa', 'taw', 'art'] },
      { q: 'Associated radiculopathy stated', ok: !!a.dx, step: 5, f: 'dx', ins: ['taw', 'art'] }
    ];
    return L.filter(function (x) { return x.ins.indexOf(HX.ins) >= 0; });
  }
  function chip(f, v, label, neg) { var on = Array.isArray(HX.a[f]) ? HX.a[f].indexOf(v) >= 0 : HX.a[f] === v; return '<button class="chip' + (neg ? ' neg' : '') + '" data-f="' + f + '" data-v="' + e(v) + '" aria-pressed="' + on + '">' + e(label) + '</button>'; }
  function yn(f, label) { return '<div class="yn hx-q" data-field="' + f + '"><span class="label clin">' + e(label) + '</span><div class="seg" role="group">' +
    ['yes', 'no'].map(function (v) { return '<button data-f="' + f + '" data-v="' + v + '" aria-pressed="' + (HX.a[f] === v) + '">' + e(h(v)) + '</button>'; }).join('') + '</div></div>'; }
  function txt(f, label, ph) { return '<div class="hx-q" data-field="' + f + '"><label class="label clin" for="f-' + f + '">' + e(label) + '</label><input class="input clin" id="f-' + f + '" data-t="' + f + '" value="' + e(HX.a[f] || '') + '" placeholder="' + e(ph || '') + '"></div>'; }
  function stepBody(i) {
    var a = HX.a;
    switch (i) {
      case 0: return txt('dur', 'Duration', 'e.g. 3 weeks') + '<div class="hx-q"><span class="label clin">Radiation</span><div class="chips">' + chip('rad', 'Left arm', 'Left arm') + chip('rad', 'Right arm', 'Right arm') + chip('rad', 'None', 'None') + '</div></div>' +
        '<div class="hx-q"><span class="label clin">Onset</span><div class="chips">' + chip('onset', 'Gradual', 'Gradual') + chip('onset', 'Sudden', 'Sudden') + '</div></div>';
      case 1: return '<div class="hx-q"><span class="label clin">Numbness</span><div class="chips">' + chip('numsite', 'Left thumb', 'Left thumb') + chip('numsite', 'Index finger', 'Index finger') + chip('numsite', 'None', 'None') + '</div></div>' +
        '<div class="hx-q"><span class="label clin">Weakness</span><div class="chips">' + chip('weak', 'Grip', 'Grip') + chip('weak', 'Elbow flexion', 'Elbow flexion') + chip('weak', 'None', 'None') + '</div></div>';
      case 2: return yn('rf_weak', 'Progressive arm weakness') + yn('rf_gait', 'Gait change') + yn('rf_bladder', 'Bladder or bowel change') + yn('rf_fever', 'Fever') + yn('rf_trauma', 'Trauma');
      case 3: return '<div class="hx-q"><span class="label clin">Known conditions</span><div class="chips">' + chip('bg', 'Type 2 diabetes on metformin', 'Type 2 diabetes on metformin') + chip('bg', 'Hypertension on amlodipine', 'Hypertension on amlodipine') + '</div></div>' +
        '<div class="hx-q"><span class="label clin">Family history</span><div class="chips">' + chip('fh', 'Mother had breast cancer', 'Mother: breast cancer') + chip('fh', 'None', 'None') + '</div></div>';
      case 4: return txt('rom', 'Neck range of motion', 'e.g. limited in extension and left rotation') + txt('refl', 'Reflexes', '') + txt('power', 'Upper limb strength', 'e.g. power 5/5 both arms');
      case 5: return txt('dx', 'Assessment', '');
      case 6: return txt('cause', 'Primary cause, if known', 'e.g. suspected C5–C6 disc prolapse') + txt('sev', 'Severity or functional impact', '');
      case 7: return txt('init', 'Initial management given', 'e.g. paracetamol and activity advice for 2 weeks') + '<div class="hx-q"><span class="label clin">Plan</span><div class="chips">' +
        ['MRI cervical spine', 'Physiotherapy', 'Pregabalin', 'HbA1c', 'X-ray cervical spine'].map(function (p) { return chip('plan', p, p); }).join('') + '</div></div>';
      default: return '<pre class="gen card" id="gen">' + e(generated()) + '</pre><div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn btn-secondary" data-hx="copygen">' + ic('copy') + e(h('copy')) + '</button><button class="btn btn-primary" data-hx="tocodes">' + e(h('to_codes')) + ic('arrow', 'flip') + '</button></div>';
    }
  }
  function generated() {
    var a = HX.a, L = [];
    L.push('55-year-old woman with neck pain radiating to the ' + (a.rad || 'arm').toLowerCase() + ' for ' + (a.dur || '__') + '.');
    L.push('Known type 2 diabetes on metformin and hypertension on amlodipine.');
    var rf = [['rf_weak', 'progressive arm weakness'], ['rf_gait', 'gait change'], ['rf_bladder', 'bladder or bowel change'], ['rf_fever', 'fever'], ['rf_trauma', 'trauma']];
    var neg = rf.filter(function (r) { return a[r[0]] === 'no'; }).map(function (r) { return r[1]; });
    if (neg.length) L.push('No ' + neg.join(', no ') + '.');
    L.push('Examination: ' + [a.rom, a.refl, a.power].filter(Boolean).join('; ') + '.');
    L.push('Assessment: ' + (a.dx || '__').toLowerCase() + (a.cause ? ', ' + a.cause : '') + '.');
    if (a.init) L.push('Initial management: ' + a.init + '.');
    L.push('Plan: ' + (a.plan || []).join(', ') + '.');
    return L.join('\n');
  }
  RX.screens.hx = function () {
    var items = leaveItems(), open = items.filter(function (x) { return !x.ok; }).length;
    var strip = '<div class="steps" role="tablist">' + STEPS.map(function (k, i) {
      return '<button class="step' + (i < HX.step ? ' done' : i === HX.step ? ' cur' : '') + '" data-step="' + i + '" role="tab" aria-selected="' + (i === HX.step) + '"><span class="n">' + (i < HX.step ? '✓' : i + 1) + '</span>' + e(h(k)) + '</button>' +
        (i === 7 ? '<button class="step leave" data-step="7" title="' + e(h('hx_leave_h')) + '"><span class="n">' + open + '</span>' + e(h('hx_leave')) + '</button>' : '');
    }).join('') + '</div>';
    var ins = [['bupa', 'Bupa'], ['taw', 'Tawuniya'], ['art', 'Al Rajhi']];
    return '<div class="hx-top"><div class="field"><span class="label">' + e(h('hx_complaint')) + '</span><div class="chips"><button class="chip" aria-pressed="true"><span class="clin">Neck pain</span></button><button class="chip clin">Back pain</button><button class="chip clin">Chest pain</button></div></div>' +
      '<div class="field"><label class="label" for="hage">' + e(h('age')) + '</label><input id="hage" class="input num" value="55"></div><div class="field"><span class="label">' + e(h('sex')) + '</span><div class="seg"><button aria-pressed="true">' + e(h('female')) + '</button><button>' + e(h('male')) + '</button></div></div></div>' +
      strip + '<div class="grid2" style="margin-top:16px"><section class="card enter"><div class="card-h"><span class="micro">' + (HX.step + 1) + ' / 9</span><h2>' + e(h(STEPS[HX.step])) + '</h2></div><div class="card-b" id="hxbody">' + stepBody(HX.step) + '</div>' +
      (HX.step < 8 ? '<div class="nc-foot" style="border-top:1px solid var(--border)">' + (HX.step ? '<button class="btn btn-secondary" data-hx="back">' + e(h('back')) + '</button>' : '') + '<span class="sp" style="flex:1"></span><button class="btn btn-primary" data-hx="next">' + e(h(HX.step === 7 ? 'generate' : 'next')) + ic('arrow', 'flip') + '</button></div>' : '') + '</section>' +
      '<aside class="card enter" style="--i:1;position:sticky;top:112px"><div class="card-h" style="flex-wrap:wrap">' + ic('flag').replace('<svg', '<svg style="width:18px;height:18px;color:var(--gold)"') + '<h2>' + e(h('hx_leave_h')) + '</h2><span class="sp" style="flex:1"></span>' +
      (open ? '<span class="badge gold">' + open + ' ' + e(h('open_items')) + '</span>' : '<span class="badge ok">' + ic('check') + e(h('hx_done')) + '</span>') + '</div><div class="card-b"><p style="margin:0 0 12px;color:var(--text-2);font-size:var(--fs-13)">' + e(h('hx_leave_p')) + '</p>' +
      '<div class="seg" data-hxins>' + ins.map(function (x) { return '<button data-v="' + x[0] + '" aria-pressed="' + (HX.ins === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      items.map(function (x) { return '<button class="leave-item' + (x.ok ? ' ok' : '') + '" data-open="' + x.step + '" data-fld="' + x.f + '"><span class="dot"></span><span class="clin">' + e(x.q) + '</span></button>'; }).join('') + '</div></aside></div>';
  };
  RX.screens.hx.mount = function () {
    var v = document.getElementById('view');
    v.onclick = function (ev) {
      var s = ev.target.closest('[data-step]'); if (s) { HX.step = +s.dataset.step; A().render(); return; }
      var o = ev.target.closest('[data-open]'); if (o) { HX.step = +o.dataset.open; A().render(); var f = document.querySelector('[data-field="' + o.dataset.fld + '"]'); if (f) { f.classList.add('flash'); var i = f.querySelector('input,button'); if (i) i.focus(); f.scrollIntoView({ block: 'center', behavior: 'smooth' }); } return; }
      var ins = ev.target.closest('[data-hxins] button'); if (ins) { HX.ins = ins.dataset.v; A().render(); return; }
      var c = ev.target.closest('[data-f]');
      if (c) { var f2 = c.dataset.f, val = c.dataset.v;
        if (f2 === 'plan') { var i2 = HX.a.plan.indexOf(val); if (i2 >= 0) HX.a.plan.splice(i2, 1); else HX.a.plan.push(val); }
        else HX.a[f2] = HX.a[f2] === val && !/^rf_/.test(f2) ? null : val;
        A().render(); return; }
      var b = ev.target.closest('[data-hx]'); if (!b) return;
      var a = b.dataset.hx;
      if (a === 'next') HX.step = Math.min(8, HX.step + 1); else if (a === 'back') HX.step = Math.max(0, HX.step - 1);
      else if (a === 'copygen') { A().copy(generated()); return; }
      else if (a === 'tocodes') { A().S.note.text = generated(); A().S.note.mode = 'edit'; A().S.note.phase = 'empty'; A().go('note'); return; }
      A().render();
    };
    Array.prototype.forEach.call(v.querySelectorAll('[data-t]'), function (inp) {
      inp.onchange = function () { HX.a[inp.dataset.t] = inp.value.trim(); A().render(); };
    });
  };

  /* ── Executive dashboard ── */
  function spark(pts, w) {
    w = w || 200; var H = 40, mx = Math.max.apply(null, pts), mn = Math.min.apply(null, pts), sp = mx - mn || 1;
    var P = pts.map(function (v, i) { return [(i / (pts.length - 1)) * w, H - 4 - ((v - mn) / sp) * (H - 10)]; });
    var d = 'M' + P.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L');
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><path class="a" d="' + d + 'L' + w + ' ' + H + 'L0 ' + H + 'Z"/><path class="l" d="' + d + '"/></svg>';
  }
  var ET = 0;
  RX.screens.exec = function () {
    var S = A().S, ar = S.lang === 'ar';
    var K = [['kpi1', 1284, '', '+18%', [620, 700, 760, 820, 900, 1010, 1120, 1284]], ['kpi2', 99.1, '%', '+0.4', [97.8, 98.1, 98.4, 98.2, 98.7, 98.9, 99, 99.1]],
      ['kpi3', 312, '', '−22%', [520, 488, 450, 431, 402, 370, 344, 312]], ['kpi4', 68, '%', '+11', [41, 44, 49, 53, 57, 61, 64, 68]]];
    var gaps = [['Cause of radiculopathy or back pain', 64], ['Diabetes complications and control', 58], ['Red flags recorded', 47], ['Laterality', 33], ['Initial management and duration', 29]];
    return '<div class="page-h"><div class="tabs" role="tablist" style="flex:1;min-width:0">' + ['et1', 'et2', 'et3', 'et4', 'et5', 'et6'].map(function (k, i) { return '<button role="tab" data-et="' + i + '" aria-selected="' + (ET === i) + '">' + e(h(k)) + '</button>'; }).join('') + '</div>' +
      '<span class="demo-flag">' + ic('info') + e(h('demo')) + '</span></div>' +
      (ET === 0 ? '<div class="kpis">' + K.map(function (k, i) {
        return '<div class="card kpi lift enter" style="--i:' + i + '"><div class="micro">' + e(h(k[0])) + '</div><div class="v"><span data-count="' + k[1] + '" data-dec="' + (k[1] % 1 ? 1 : 0) + '">0</span>' + k[2] + '</div>' +
          '<span class="dl up">' + ic(k[3][0] === '−' ? 'chev' : 'chev').replace('<svg', '<svg style="width:14px;height:14px;transform:rotate(' + (k[3][0] === '−' ? '0' : '180') + 'deg)"') + '<span class="num">' + k[3] + '</span> <span style="color:var(--text-2);font-weight:500">' + e(h('vs_last')) + '</span></span>' + spark(k[4]) + '</div>';
      }).join('') + '</div>' +
      '<div class="grid2" style="margin-top:20px"><section class="card enter" style="--i:4"><div class="card-h"><h2>' + e(h('top_gaps')) + '</h2></div><div class="card-b"><div class="bars">' + gaps.map(function (g) {
        return '<div class="bar"><span class="clin">' + e(g[0]) + '</span><span class="tr"><span class="fl" data-w="' + g[1] + '"></span></span><span class="v">' + g[1] + '</span></div>'; }).join('') + '</div></div></section>' +
      '<section class="card enter" style="--i:5"><div class="card-h"><h2>' + e(h('by_dept')) + '</h2></div><table class="tbl"><thead><tr><th>' + (ar ? 'القسم' : 'Department') + '</th><th lang="en">F1</th><th>' + (ar ? 'نواقص' : 'Gaps') + '</th></tr></thead><tbody>' +
      [['Emergency', '98.9', 104], ['Internal medicine', '99.4', 82], ['Orthopaedics', '99.1', 61], ['Obstetrics', '98.7', 38]].map(function (r) { return '<tr><td class="clin">' + r[0] + '</td><td class="num">' + r[1] + '%</td><td class="num">' + r[2] + '</td></tr>'; }).join('') + '</tbody></table></section></div>'
      : '<div class="card enter"><div class="empty"><span class="ic">' + ic('chart') + '</span><h3>' + e(h(['et1', 'et2', 'et3', 'et4', 'et5', 'et6'][ET])) + '</h3><p>' + e(h('not_in_proto')) + '</p></div></div>');
  };
  RX.screens.exec.mount = function () {
    var v = document.getElementById('view');
    v.onclick = function (ev) { var b = ev.target.closest('[data-et]'); if (b) { ET = +b.dataset.et; A().render(); } };
    countUp(v);
    setTimeout(function () { Array.prototype.forEach.call(v.querySelectorAll('.fl'), function (f) { f.style.width = f.dataset.w + '%'; }); }, 60);
  };
  function countUp(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-count]'), function (el) {
      var to = +el.dataset.count, dec = +el.dataset.dec, t0 = performance.now(), dur = A().reduce ? 0 : 900;
      (function f(now) { var p = dur ? Math.min(1, (now - t0) / dur) : 1, k = 1 - Math.pow(1 - p, 3);
        el.textContent = (to * k).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }); if (p < 1) requestAnimationFrame(f); })(t0);
    });
  }

  /* ── Payer protocols ── */
  var PT = 5;
  RX.screens.payers = function () {
    var tabs = ['pt1', 'pt2', 'pt3', 'pt4', 'pt5', 'pt6', 'pt7', 'pt8', 'pt9'], ar = A().S.lang === 'ar';
    var body;
    if (PT === 0) {
      var P = [['bupa', 'Bupa Arabia', 159, 540, 54], ['taw', 'Tawuniya', 71, 189, 38], ['art', 'Al Rajhi Takaful', 18, 58, 43]];
      body = '<div class="kpis" style="grid-template-columns:repeat(3,1fr)">' + P.map(function (p, i) { return '<div class="card kpi enter lift" style="--i:' + i + '"><span class="ins ' + p[0] + '">' + p[1] + '</span><div class="v"><span data-count="' + p[2] + '" data-dec="0">0</span></div><div style="color:var(--text-2);font-size:var(--fs-13)">' + e(h('sets')) + ' · <span class="num">' + p[3] + '</span> ' + e(h('questions')) + ' · <span class="num">' + p[4] + '</span> ' + e(h('services_req')) + '</div></div>'; }).join('') + '</div>';
    } else if (PT === 5) {
      body = '<section class="card enter"><div class="card-h"><h2>' + e(h('pt6')) + '</h2><span class="sp" style="flex:1"></span><span class="ins bupa">Bupa</span><span class="ins taw">Tawuniya</span><span class="ins art">Al Rajhi</span></div>' +
        '<div style="overflow:auto"><table class="tbl matrix"><thead><tr><th>' + e(h('service')) + '</th><th style="text-align:center"><span class="ins bupa">Bupa</span></th><th style="text-align:center"><span class="ins taw">Tawuniya</span></th><th style="text-align:center"><span class="ins art">Al Rajhi</span></th></tr></thead><tbody>' +
        RX.MATRIX.map(function (r) { var diff = !(r[1] === r[2] && r[2] === r[3]);
          return '<tr' + (diff ? ' class="diff"' : '') + '><td class="clin">' + e(r[0]) + '</td>' + [1, 2, 3].map(function (j) { return r[j] ? '<td class="y">' + ic('check') + '<span class="sr" style="position:absolute;clip:rect(0 0 0 0)">' + (ar ? 'يلزم طلب' : 'Request needed') + '</span></td>' : '<td class="n">—</td>'; }).join('') + '</tr>'; }).join('') +
        '</tbody></table></div><div class="ask-src">' + (ar ? 'المصدر: بروتوكولات الشركات الثلاث المحللة في preauth/PA.json. الخط البرتقالي يعني أن الشركات تختلف.' : 'Source: the three payer protocols parsed in preauth/PA.json. A coral edge marks a row where payers differ.') + '</div></section>';
    } else body = '<div class="card enter"><div class="empty"><span class="ic">' + ic('scale') + '</span><h3>' + e(h(tabs[PT])) + '</h3><p>' + e(h('not_in_proto')) + '</p></div></div>';
    return '<div class="tabs" role="tablist" style="margin-bottom:18px">' + tabs.map(function (k, i) { return '<button role="tab" data-pt="' + i + '" aria-selected="' + (PT === i) + '">' + e(h(k)) + '</button>'; }).join('') + '</div>' + body;
  };
  RX.screens.payers.mount = function () { var v = document.getElementById('view'); v.onclick = function (ev) { var b = ev.target.closest('[data-pt]'); if (b) { PT = +b.dataset.pt; A().render(); } }; countUp(v); };

  /* ── Coder review ── */
  var RQ = { sec: 1, item: 0, decided: {} };
  var QUEUE = {
    0: [{ c: 'R07.4', d: 'Chest pain, unspecified', dept: 'Emergency', why: 'One sentence of history; no examination recorded.', note: 'Chest pain since morning.\nPlan: ECG, troponin.', ev: ['Chest pain'] }],
    1: [{ c: 'E11.9', d: 'Type 2 diabetes mellitus without complication', dept: 'Internal medicine', why: 'Specificity not met: complications and control are not documented.', note: RX.NOTE, ev: ['type 2 diabetes on metformin', 'HbA1c'] },
        { c: 'J45.9', d: 'Asthma, unspecified', dept: 'Emergency', why: 'Severity not stated; "wheeze" matched without the word asthma in the assessment.', note: 'Wheeze and cough for 2 days, known asthmatic.\nAssessment: exacerbation.\nPlan: salbutamol nebuliser.', ev: ['known asthmatic', 'Wheeze'] }],
    2: [{ c: 'I10', d: 'Essential (primary) hypertension', dept: 'Cardiology', why: 'The note says "BP controlled" but the plan starts a second agent.', note: 'Hypertension, BP controlled.\nPlan: add losartan 50 mg.', ev: ['Hypertension'] }],
    3: [{ c: 'M54.2', d: 'Cervicalgia', dept: 'Orthopaedics', why: 'Radiation to the arm is documented; M54.12 may be more specific.', note: 'Neck pain radiating to the right arm.\nAssessment: neck pain.', ev: ['Neck pain', 'radiating to the right arm'] }],
    4: [{ c: '—', d: 'Procedure without a code', dept: 'Surgery', why: '"Wound debridement" is written in the plan with no procedure code.', note: 'Infected wound, left foot.\nPlan: wound debridement today.', ev: ['wound debridement'] }]
  };
  RX.screens.review = function () {
    var secs = ['rq1', 'rq2', 'rq3', 'rq4', 'rq5'], list = QUEUE[RQ.sec], it = list[RQ.item] || list[0], key = RQ.sec + '-' + RQ.item, dec = RQ.decided[key];
    var noteH = e(it.note); it.ev.forEach(function (s) { noteH = noteH.replace(e(s), '<mark class="ev is-on">' + e(s) + '</mark>'); });
    return '<div class="rev"><nav class="card rev-secs" aria-label="' + e(h('s_review')) + '">' + secs.map(function (k, i) { return '<button data-sec="' + i + '" aria-current="' + (RQ.sec === i) + '">' + e(h(k)) + '<span class="cnt">' + QUEUE[i].length + '</span></button>'; }).join('') + '</nav>' +
      '<div class="card rev-list">' + list.map(function (x, i) { return '<button data-item="' + i + '" aria-current="' + (RQ.item === i) + '"><div class="m"><span class="cchip">' + x.c + '</span><span class="tag clin">' + x.dept + '</span>' + (RQ.decided[RQ.sec + '-' + i] ? '<span class="badge ok">' + ic('check') + e(h(RQ.decided[RQ.sec + '-' + i])) + '</span>' : '') + '</div><div class="s clin">' + e(x.why) + '</div></button>'; }).join('') + '</div>' +
      '<section class="card enter"><div class="card-h"><span class="micro">' + e(h('suggested')) + '</span><span class="sp" style="flex:1"></span><span class="badge warn">' + ic('alert') + e(h(secs[RQ.sec])) + '</span></div>' +
      '<div class="card-b"><div style="display:flex;gap:14px;align-items:baseline;flex-wrap:wrap"><span class="dx-code" style="font-size:28px">' + it.c + '</span><span class="clin" style="font-weight:500">' + e(it.d) + '</span></div>' +
      '<p class="clin" style="color:var(--text-2);font-size:var(--fs-13);margin:10px 0 14px">' + e(it.why) + '</p>' +
      '<div class="note-read clin card" style="min-height:0;padding:14px 16px;background:var(--surface-2);box-shadow:none;font-size:14.5px">' + noteH + '</div>' +
      '<div style="margin-top:16px">' + (dec ? '<div class="alert ok">' + ic('check') + '<div><b>' + e(h('t_decided')) + '</b> · ' + e(h(dec)) + '<br><span style="color:var(--text-2)">' + e(h('teaches')) + '</span></div></div>'
        : '<div class="decide"><button class="btn btn-primary" data-dec="accept">' + ic('check') + e(h('accept')) + '</button><button class="btn btn-secondary" data-dec="change">' + ic('edit') + e(h('change')) + '</button><button class="btn btn-danger" data-dec="reject">' + ic('x') + e(h('reject')) + '</button></div>' +
          '<div class="reason" id="reason" hidden><input class="input" id="rsn" placeholder="' + e(h('reason_ph')) + '"><button class="btn btn-primary" id="rec" disabled>' + e(h('record')) + '</button></div><p style="margin:10px 0 0;font-size:var(--fs-12);color:var(--text-2)">' + e(h('teaches')) + '</p>') + '</div></div></section></div>';
  };
  RX.screens.review.mount = function () {
    var v = document.getElementById('view'), pending = null;
    v.onclick = function (ev) {
      var s = ev.target.closest('[data-sec]'); if (s) { RQ.sec = +s.dataset.sec; RQ.item = 0; A().render(); return; }
      var i = ev.target.closest('[data-item]'); if (i) { RQ.item = +i.dataset.item; A().render(); return; }
      var d = ev.target.closest('[data-dec]'); if (d) { pending = d.dataset.dec; var r = document.getElementById('reason'); r.hidden = false; document.getElementById('rsn').focus();
        Array.prototype.forEach.call(v.querySelectorAll('[data-dec]'), function (b) { b.setAttribute('aria-pressed', b === d); b.style.outline = b === d ? '2px solid var(--teal)' : ''; }); return; }
      if (ev.target.closest('#rec')) { RQ.decided[RQ.sec + '-' + RQ.item] = pending; A().S.reviewCount = Math.max(0, A().S.reviewCount - 1); A().render(); A().toast(h('t_decided')); }
    };
    v.addEventListener('input', function (ev) { if (ev.target.id === 'rsn') document.getElementById('rec').disabled = !ev.target.value.trim(); });
  };

  RX.screens.placeholder = function (ctx) {
    return '<div class="card enter"><div class="empty"><span class="ic">' + ic('doc') + '</span><h3>' + e(h(({ er: 's_er', dis: 's_dis', ind: 's_ind', pa: 's_pa', struct: 's_struct', calc: 's_calc', help: 's_help', insights: 's_insights', clin: 's_clin', content: 's_content', pilot: 's_pilot', vocab: 's_vocab', cc: 's_cc', learn: 's_learn' })[ctx.S.screen] || 's_help')) +
      '</h3><p>' + e(h('not_in_proto')) + '</p><a class="btn btn-secondary" href="../../index.html" style="margin-top:8px">' + e(h('open_live')) + '</a></div></div>';
  };
})();
