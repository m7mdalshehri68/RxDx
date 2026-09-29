/* RxDx UI prototype — shell, router, Note → Codes. Vanilla JS, no build, no network. */
(function () {
  'use strict';
  var I = RX.ICON;
  var store = { get: function (k) { try { return localStorage.getItem('rxui_' + k); } catch (_) { return null; } },
                set: function (k, v) { try { localStorage.setItem('rxui_' + k, v); } catch (_) {} } };
  var q = new URLSearchParams(location.search);

  var S = {
    lang: q.get('lang') || store.get('lang') || 'ar',
    theme: q.get('theme') || store.get('theme') || 'light',
    size: store.get('size') || 'normal',
    role: q.get('role') || store.get('role') || null,
    screen: 'note', collapsed: store.get('collapsed') === '1', drawer: false,
    online: false, outcome: 'down', pct: false, reviewCount: 7,
    note: { text: RX.NOTE, phase: 'empty', mode: 'edit', stale: false, via: 'offline', sel: null, ev: true, age: 55, sex: 'F', enc: 'op', ins: 'bupa',
            open: { 'E11.9': false, I10: false }, step: 0, freeze: false, mtab: 'codes', wait: 0 }
  };
  if (q.get('state')) S.note.text = RX.NOTE;

  function t(k) { return (RX.T[S.lang] && RX.T[S.lang][k]) || RX.T.en[k] || k; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── screens and navigation ── */
  var SCREENS = {
    search: ['s_search', 'search'], drugs: ['s_drugs', 'pill'], icd: ['s_icd', 'book'], note: ['s_note', 'note'], hx: ['s_hx', 'list'],
    er: ['s_er', 'bolt'], dis: ['s_dis', 'exit'], ind: ['s_ind', 'doc'], pa: ['s_pa', 'shield'], review: ['s_review', 'review'],
    struct: ['s_struct', 'braces'], calc: ['s_calc', 'calc'], help: ['s_help', 'help'], exec: ['s_exec', 'chart'], payers: ['s_payers', 'scale'],
    insights: ['s_insights', 'bulb'], clin: ['s_clin', 'users'], content: ['s_content', 'folder'], pilot: ['s_pilot', 'gauge'], vocab: ['s_vocab', 'words'],
    cc: ['s_cc', 'cog'], learn: ['s_learn', 'learn']
  };
  var NAV = {
    doctor: [['g_find', ['search', 'drugs', 'icd']], ['g_doc', ['note', 'hx', 'er', 'dis']], ['g_ref', ['ind', 'pa']], ['g_review', ['review']], ['g_tools', ['struct', 'calc']], ['g_help', ['help']]],
    mgmt: [['g_mgmt', ['exec', 'payers', 'insights', 'review', 'clin', 'content', 'pilot', 'vocab']]],
    it: [['g_it', ['cc', 'learn', 'content', 'insights']]]
  };
  var HOME = { doctor: 'note', mgmt: 'exec', it: 'cc' };

  function go(id) { location.hash = '#/' + id; }
  function route() {
    var h = (location.hash.match(/^#\/(\w+)/) || [])[1];
    S.screen = SCREENS[h] ? h : (S.role ? HOME[S.role] : 'note');
    S.drawer = false; render();
  }

  /* ── shell ── */
  function applyRoot() {
    var r = document.documentElement;
    r.lang = S.lang; r.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
    r.dataset.theme = S.theme; r.dataset.size = S.size;
  }
  function ribbon() {
    return '<div class="ribbon" role="note">' + I('lock') + '<b>RXDX</b><span>' + esc(t('ribbon')) + '</span></div>' +
      (S.online ? '<div class="online-warn" role="status">' + I('cloud') + '<span>' + esc(t('online_warn')) + '</span><button class="btn btn-sm btn-secondary" data-act="online-off">' + esc(t('turn_off')) + '</button></div>' : '');
  }
  function brand(dark) {
    return '<a class="brand" href="#/' + (S.role ? HOME[S.role] : '') + '"><span class="brand-tile">Rx</span><span class="brand-word"><b>RxDx</b><small>Clinical reference</small></span></a>';
  }
  function sidebar() {
    var h = '<aside class="side" aria-label="' + esc(t(S.role === 'doctor' ? 'doctor' : S.role)) + '">' + brand() + '<nav>';
    NAV[S.role].forEach(function (g) {
      h += '<div class="grp">' + esc(t(g[0])) + '</div>';
      g[1].forEach(function (id) {
        var m = SCREENS[id];
        h += '<button class="it" data-go="' + id + '"' + (S.screen === id ? ' aria-current="page"' : '') + ' title="' + esc(t(m[0])) + '">' + I(m[1]) + '<span>' + esc(t(m[0])) + '</span>' +
          (id === 'review' ? '<span class="cnt">' + S.reviewCount + '</span>' : '') + '</button>';
      });
    });
    h += '</nav><div class="foot"><button class="btn btn-icon btn-sm" data-act="collapse" aria-label="' + esc(t('collapse')) + '" title="' + esc(t('collapse')) + '">' + I('side') + '</button><small>Mohammed Alshehri</small></div></aside>';
    return h;
  }
  function topbar() {
    var m = SCREENS[S.screen];
    return '<header class="top"><button class="tbtn menu-btn" data-act="drawer" aria-label="Menu">' + I('menu') + '</button>' +
      '<h1><span class="crumb">RXDX</span>' + esc(t(m[0])) + '</h1><span class="sp"></span>' +
      '<button class="engine hide-m' + (S.online ? ' online' : '') + '" data-act="engine" aria-haspopup="menu"><i></i>' + esc(S.online ? t('online_waking') : t('offline')) + I('chev', 'ch') + '</button>' +
      '<button class="tbtn hide-m" data-act="palette" aria-label="' + esc(t('k_palette')) + '">' + I('search') + '<span class="kbd">⌘K</span></button>' +
      '<button class="tbtn" data-act="lang" lang="' + (S.lang === 'ar' ? 'en' : 'ar') + '">' + I('globe') + esc(t('lang')) + '</button>' +
      '<button class="tbtn hide-m" data-act="size" aria-pressed="' + (S.size === 'large') + '" aria-label="' + esc(t('larger')) + '" title="' + esc(t('larger')) + '">A±</button>' +
      '<button class="tbtn" data-act="theme" aria-label="' + esc(t('theme')) + '" title="' + esc(t('theme')) + '">' + I(S.theme === 'dark' ? 'sun' : 'moon') + '</button>' +
      '<span class="role hide-m">' + esc(t(S.role)) + '</span>' +
      '<button class="tbtn signout hide-m" data-act="signout">' + esc(t('signout')) + '</button></header>';
  }
  function gate() {
    var cards = [['doctor', 'stetho', 'Clinical workspace'], ['mgmt', 'building', 'Dashboard'], ['it', 'monitor', 'Control centre']];
    return '<main class="gate"><div class="gate-top"><button class="tbtn" data-act="lang">' + I('globe') + esc(t('lang')) + '</button>' +
      '<button class="tbtn" data-act="theme" aria-label="' + esc(t('theme')) + '">' + I(S.theme === 'dark' ? 'sun' : 'moon') + '</button></div>' +
      '<div class="gate-in">' + brand() + '<h2>' + esc(t('gate_h')) + '</h2><div class="gate-cards">' +
      cards.map(function (c, i) {
        return '<button class="gcard enter" style="--i:' + i + '" data-role="' + c[0] + '"><span class="gi">' + I(c[1]) + '</span><b>' + esc(t(c[0])) + '</b>' +
          '<span class="micro" lang="en">' + c[2] + '</span><p>' + esc(t(c[0] + '_d')) + '</p><span class="go">' + esc(t('enter')) + I('arrow', 'flip') + '</span></button>';
      }).join('') + '</div></div></main>';
  }

  function render() {
    applyRoot();
    var b = document.getElementById('app');
    if (!S.role) { b.innerHTML = ribbon() + gate(); bindCommon(b); return; }
    var view = S.screen === 'note' ? vNote() : (RX.screens[S.screen] || RX.screens.placeholder)(ctx);
    b.innerHTML = ribbon() + '<div class="shell' + (S.collapsed ? ' collapsed' : '') + (S.drawer ? ' drawer' : '') + '">' + sidebar() +
      '<div class="main">' + topbar() + '<main class="view" id="view">' + protoPanel() + view + '</main></div></div>' +
      '<div class="toasts" id="toasts" role="status" aria-live="polite"></div>';
    bindCommon(b);
    if (S.screen === 'note') mountNote(); else if (RX.screens[S.screen] && RX.screens[S.screen].mount) RX.screens[S.screen].mount(ctx);
  }

  /* ── common interactions ── */
  function bindCommon(root) {
    root.onclick = function (e) {
      var el = e.target.closest('[data-go],[data-act],[data-role]');
      if (!el) return;
      if (el.dataset.role) { S.role = el.dataset.role; store.set('role', S.role); go(HOME[S.role]); if (location.hash === '#/' + HOME[S.role]) route(); return; }
      if (el.dataset.go) { go(el.dataset.go); return; }
      var a = el.dataset.act;
      if (a === 'lang') { S.lang = S.lang === 'ar' ? 'en' : 'ar'; store.set('lang', S.lang); render(); }
      else if (a === 'theme') { S.theme = S.theme === 'dark' ? 'light' : 'dark'; store.set('theme', S.theme); render(); }
      else if (a === 'size') { S.size = S.size === 'large' ? 'normal' : 'large'; store.set('size', S.size); render(); }
      else if (a === 'collapse') { S.collapsed = !S.collapsed; store.set('collapsed', S.collapsed ? '1' : '0'); $('.shell').classList.toggle('collapsed', S.collapsed); drawLinks(); }
      else if (a === 'drawer') { S.drawer = !S.drawer; $('.shell').classList.toggle('drawer', S.drawer); }
      else if (a === 'signout') { S.role = null; store.set('role', ''); location.hash = ''; render(); }
      else if (a === 'engine') engineMenu(el);
      else if (a === 'online-off') { S.online = false; render(); }
      else if (a === 'palette') palette();
      else if (RX.actions[a]) RX.actions[a](el, e);
    };
  }
  RX.actions = {};

  function toast(msg, icon) {
    var box = $('#toasts'); if (!box) return;
    var el = document.createElement('div'); el.className = 'toast'; el.innerHTML = I(icon || 'check') + '<span>' + esc(msg) + '</span>';
    box.appendChild(el);
    setTimeout(function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 200); }, 2200);
  }
  function copy(text, msg) {
    var done = function () { toast(msg || t('copied'), 'copy'); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() { var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (_) {} ta.remove(); done(); }
  }
  function download(name, text, type) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }
  function closeFloats() { $$('.menu,.tip-panel').forEach(function (m) { m.remove(); }); }
  function floatAt(el, anchor, below) {
    document.body.appendChild(el);
    var r = anchor.getBoundingClientRect(), w = el.offsetWidth, rtl = S.lang === 'ar';
    var x = rtl ? r.right - w : r.left; x = Math.max(8, Math.min(x, innerWidth - w - 8));
    var y = below === false ? r.top - el.offsetHeight - 8 : r.bottom + 8;
    if (y + el.offsetHeight > innerHeight - 8) y = r.top - el.offsetHeight - 8;
    el.style.left = x + 'px'; el.style.top = (y + scrollY) + 'px';
  }
  function engineMenu(anchor) {
    closeFloats();
    var m = document.createElement('div'); m.className = 'menu'; m.setAttribute('role', 'menu'); m.style.width = '320px';
    m.innerHTML = '<div class="micro" style="padding:8px 10px 4px">' + esc(t('engine_menu_h')) + '</div>' +
      '<button role="menuitemradio" aria-checked="' + !S.online + '" data-v="0">' + I(S.online ? 'cpu' : 'check') + '<span><b style="display:block;font-weight:600">' + esc(t('offline')) + '</b><small style="color:var(--text-2)">' + esc(t('engine_off_d')) + '</small></span></button>' +
      '<button role="menuitemradio" aria-checked="' + S.online + '" data-v="1">' + I(S.online ? 'check' : 'cloud') + '<span><b style="display:block;font-weight:600">' + esc(t('engine_on_l')) + '</b><small style="color:var(--text-2)">' + esc(t('engine_on_d')) + '</small></span></button>';
    $$('button', m).forEach(function (b) { b.style.minHeight = '56px'; b.style.alignItems = 'flex-start'; b.style.padding = '10px'; });
    m.onclick = function (e) { var b = e.target.closest('button'); if (!b) return; S.online = b.dataset.v === '1'; closeFloats(); render(); };
    m.style.position = 'absolute'; floatAt(m, anchor);
    setTimeout(function () { document.addEventListener('click', function off(e) { if (!m.contains(e.target)) { closeFloats(); document.removeEventListener('click', off); } }); }, 0);
  }
  function dialog(html, onMount) {
    var s = document.createElement('div'); s.className = 'scrim'; s.innerHTML = '<div class="dialog" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(s);
    var close = function () { s.remove(); document.removeEventListener('keydown', key); };
    var key = function (e) { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', key);
    s.addEventListener('click', function (e) { if (e.target === s || e.target.closest('[data-close]')) close(); });
    if (onMount) onMount(s, close);
    var f = s.querySelector('input,button'); if (f) f.focus();
    return close;
  }

  /* ── command palette ── */
  function palette() {
    if ($('.cmdk')) return;
    var w = document.createElement('div'); w.className = 'cmdk';
    w.innerHTML = '<div class="cmdk-box" role="dialog" aria-modal="true" aria-label="' + esc(t('k_palette')) + '"><div class="cmdk-in">' + I('search') +
      '<input placeholder="' + esc(t('cmd_ph')) + '" aria-label="' + esc(t('cmd_ph')) + '"><span class="kbd">Esc</span></div><div class="cmdk-list" role="listbox"></div></div>';
    document.body.appendChild(w);
    var inp = $('input', w), list = $('.cmdk-list', w), items = [], act = 0;
    function build() {
      var v = inp.value.trim().toLowerCase(); items = [];
      var codes = RX.LIB.filter(function (c) { return !v || (c.code + ' ' + c.desc).toLowerCase().indexOf(v) >= 0; }).slice(0, 5);
      var drugs = RX.DRUGS.filter(function (d) { return !v || (d.n + ' ' + d.b).toLowerCase().indexOf(v) >= 0; }).slice(0, 4);
      var scr = Object.keys(SCREENS).filter(function (id) { return NAV[S.role || 'doctor'].some(function (g) { return g[1].indexOf(id) >= 0; }) && (!v || t(SCREENS[id][0]).toLowerCase().indexOf(v) >= 0 || RX.T.en[SCREENS[id][0]].toLowerCase().indexOf(v) >= 0); }).slice(0, 6);
      var h = '';
      if (codes.length) { h += '<div class="cmdk-g">' + esc(t('g_codes')) + '</div>'; codes.forEach(function (c) { items.push({ k: 'code', v: c }); h += '<button role="option" data-i="' + (items.length - 1) + '"><span class="code">' + c.code + '</span><span class="clin">' + esc(c.desc) + '</span><span class="h">' + esc(t('click_copy')) + '</span></button>'; }); }
      if (drugs.length) { h += '<div class="cmdk-g">' + esc(t('g_drugs')) + '</div>'; drugs.forEach(function (d) { items.push({ k: 'drug', v: d }); h += '<button role="option" data-i="' + (items.length - 1) + '">' + I('pill') + '<span class="clin">' + esc(d.n) + '</span><span class="h clin">' + esc(d.b) + '</span></button>'; }); }
      if (scr.length) { h += '<div class="cmdk-g">' + esc(t('g_screens')) + '</div>'; scr.forEach(function (id) { items.push({ k: 'screen', v: id }); h += '<button role="option" data-i="' + (items.length - 1) + '">' + I(SCREENS[id][1]) + '<span>' + esc(t(SCREENS[id][0])) + '</span></button>'; }); }
      list.innerHTML = h || '<div class="empty" style="padding:28px"><p>—</p></div>'; act = 0; mark();
    }
    function mark() { $$('button', list).forEach(function (b, i) { b.classList.toggle('act', i === act); if (i === act) b.scrollIntoView({ block: 'nearest' }); }); }
    function pick(i) { var it = items[i]; if (!it) return; close();
      if (it.k === 'code') copy(it.v.code, t('copied') + ' · ' + it.v.code);
      else if (it.k === 'drug') { RX.drugSel = it.v.n; go('drugs'); }
      else go(it.v); }
    function close() { w.remove(); }
    inp.oninput = build;
    inp.onkeydown = function (e) {
      if (e.key === 'ArrowDown') { act = Math.min(act + 1, items.length - 1); mark(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { act = Math.max(act - 1, 0); mark(); e.preventDefault(); }
      else if (e.key === 'Enter') pick(act);
      else if (e.key === 'Escape') close();
    };
    list.onclick = function (e) { var b = e.target.closest('button'); if (b) pick(+b.dataset.i); };
    w.onclick = function (e) { if (e.target === w) close(); };
    build(); inp.focus();
  }
  function shortcuts() {
    var rows = [[t('k_palette'), ['⌘', 'K']], [t('k_analyze'), ['⌘', '↵']], [t('k_jk'), ['J', 'K']], [t('k_e'), ['E']], [t('a_copy'), ['C']], [t('a_claim'), ['⇧', 'C']],
      [t('a_export'), ['X']], [t('a_review'), ['R']], [t('a_new'), ['N']], [t('k_help'), ['?']], [t('k_esc'), ['Esc']]];
    dialog('<header><h2>' + esc(t('shortcuts')) + '</h2></header><div class="body shortcuts"><dl>' + rows.map(function (r) {
      return '<dt>' + esc(r[0]) + '</dt><dd>' + r[1].map(function (k) { return '<span class="kbd">' + k + '</span>'; }).join('') + '</dd>';
    }).join('') + '</dl></div><footer><button class="btn btn-secondary" data-close>' + esc(t('cancel')) + '</button></footer>');
  }

  /* ── prototype state panel ── */
  function protoPanel() {
    if (S.screen !== 'note') return '';
    var ph = S.note.phase, cur = S.note.freeze ? 'anal' : ph === 'result' ? (S.note.via === 'fallback' ? 'down' : S.note.text.length > RX.NOTE.length + 20 ? 'long' : 'result') : ph === 'nodx' ? 'nodx' : ph === 'empty' ? 'empty' : '';
    var b = function (id, k) { return '<button data-act="ps" data-v="' + id + '" aria-pressed="' + (cur === id) + '">' + esc(t(k)) + '</button>'; };
    return '<div class="proto" role="toolbar" aria-label="' + esc(t('proto')) + '"><b>' + esc(t('proto')).toUpperCase() + '</b>' + b('empty', 'ps_empty') + b('anal', 'ps_anal') + b('result', 'ps_result') +
      b('nodx', 'ps_nodx') + b('down', 'ps_down') + b('long', 'ps_long') + '<button data-act="pct" aria-pressed="' + S.pct + '">' + esc(t('ps_pct')) + '</button><button class="x" data-act="shortcuts" aria-label="' + esc(t('shortcuts')) + '">?</button></div>';
  }
  RX.actions.shortcuts = shortcuts;
  RX.actions.pct = function () { S.pct = !S.pct; render(); };
  RX.actions.ps = function (el) {
    var v = el.dataset.v, n = S.note; stopTimers(); n.freeze = false; n.stale = false; S.online = false;
    if (v === 'empty') { n.text = ''; n.phase = 'empty'; n.mode = 'edit'; n.sel = null; render(); setTimeout(function () { var e = $('#editor'); if (e) e.focus(); }, 30); return; }
    if (v === 'anal') { n.text = RX.NOTE; n.freeze = true; n.mode = 'read'; n.via = 'offline'; runSteps(); return; }
    if (v === 'result') { n.text = RX.NOTE; n.via = 'offline'; finish(true); return; }
    if (v === 'nodx') { n.text = 'Follow-up visit. Feels better since the last review.\nResults discussed with her.\nContinue the same medication.'; n.via = 'offline'; finish(true); return; }
    if (v === 'long') { n.text = RX.NOTE + RX.LONG_TAIL; n.via = 'offline'; finish(true); return; }
    if (v === 'down') { n.text = RX.NOTE; S.online = true; S.outcome = 'down'; analyze(); }
  };

  /* ════════════ Note → Codes ════════════ */
  var timers = [];
  function stopTimers() { timers.forEach(clearTimeout); timers.forEach(clearInterval); timers = []; }
  function codeOf(c) { return RX.CODES.filter(function (x) { return x.code === c; })[0]; }
  function isSample(txt) { return txt.replace(/\s+/g, ' ').trim().indexOf(RX.NOTE.replace(/\s+/g, ' ')) === 0; }

  function segEl(name, val, opts) {
    return '<div class="seg" role="group" data-seg="' + name + '">' + opts.map(function (o) {
      return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (val === o[0]) + '">' + (o[2] ? '<i class="pay-dot" style="background:' + o[2] + '"></i>' : '') + esc(o[1]) + '</button>';
    }).join('') + '</div>';
  }

  function ranges(text, mode) {
    var out = [];
    function add(s, cls, attrs) { var i = text.indexOf(s); if (i < 0) return; for (var k = 0; k < out.length; k++) if (i < out[k][1] && i + s.length > out[k][0]) return; out.push([i, i + s.length, cls, attrs]); }
    if (mode === 'recog') RX.RECOG.forEach(function (w, n) { add(w, 'rec', 'style="animation-delay:' + (n * 35) + 'ms"'); });
    if (mode === 'final') {
      RX.CODES.forEach(function (c) { c.ev.forEach(function (s, j) { add(s, 'ev', 'data-code="' + c.code + '" data-ev="' + j + '" tabindex="0" role="button"'); }); });
      RX.NOTCODED.forEach(function (n, j) { add(n.span, n.reason === 'integral' ? 'nc int' : 'nc', 'data-nc="' + j + '" tabindex="0" role="button"'); });
    }
    return out.sort(function (a, b) { return a[0] - b[0]; });
  }
  function noteHTML(text, mode) {
    var r = mode === 'plain' ? [] : ranges(text, mode), h = '', p = 0;
    r.forEach(function (x) { h += esc(text.slice(p, x[0])) + '<mark class="' + (x[2] === 'rec' ? 'rec' : x[2]) + '" ' + x[3] + '>' + esc(text.slice(x[0], x[1])) + '</mark>'; p = x[1]; });
    return h + esc(text.slice(p));
  }

  function vNote() {
    var n = S.note, read = n.mode === 'read';
    var ins = [['bupa', 'Bupa', 'var(--teal)'], ['taw', 'Tawuniya', 'var(--coral)'], ['art', 'Al Rajhi', 'var(--gold)'], ['all', t('all3')]];
    var noteMode = n.phase === 'analysing' ? (n.step >= 2 ? 'final' : n.step >= 1 ? 'recog' : 'plain') : n.phase === 'result' ? 'final' : n.phase === 'waking' ? 'plain' : 'plain';
    var left = '<section class="card notecard" aria-label="' + esc(t('note_card')) + '">' +
      '<div class="nc-top"><span class="micro">' + esc(t('note_card')) + '</span>' +
      tb('paste', 'paste') + tb('upload', 'upload') + tb('sample', 'sample') + tb('clear', 'x') +
      '<input type="file" id="file" accept=".txt,.docx,text/plain" hidden></div>' +
      '<div class="nc-meta"><div class="field"><label for="age">' + esc(t('age')) + '</label><input id="age" class="input num" inputmode="numeric" value="' + n.age + '"></div>' +
      '<div class="field"><span class="label">' + esc(t('sex')) + '</span>' + segEl('sex', n.sex, [['F', t('female')], ['M', t('male')]]) + '</div>' +
      '<div class="field"><span class="label">' + esc(t('enc')) + '</span>' + segEl('enc', n.enc, [['op', t('op')], ['er', t('er')], ['ip', t('ip')]]) + '</div>' +
      '<div class="field"><span class="label">' + esc(t('insurer')) + '</span>' + segEl('ins', n.ins, ins) + '</div></div>' +
      (n.stale ? '<div class="stale">' + I('info') + esc(t('stale')) + '</div>' : '') +
      '<div class="editor-wrap">' + (read
        ? '<div class="note-read clin' + (n.ev ? '' : ' ev-off') + '" id="read" tabindex="0" lang="en">' + noteHTML(n.text, noteMode) + '</div>'
        : '<textarea id="editor" class="editor" lang="en" dir="ltr" spellcheck="false" placeholder="' + esc(t('placeholder')) + '">' + esc(n.text) + '</textarea>') + '</div>' +
      '<div class="nc-foot"><span class="count" id="count">' + n.text.length.toLocaleString('en-US') + ' ' + esc(t('chars')) + '</span>' +
      (read && n.phase !== 'analysing' ? '<button class="btn btn-ghost btn-sm" data-act="edit">' + I('edit') + esc(t('edit')) + '</button>' : '') +
      '<span class="sp"></span><button class="btn btn-primary" data-act="analyze" ' + (n.phase === 'analysing' || n.phase === 'waking' ? 'disabled' : '') + '>' + esc(t('analyze')) + '<span class="kbd">⌘↵</span></button></div></section>';
    return '<div class="ws" id="ws"><svg class="links" id="links" aria-hidden="true"></svg>' + left + '<section class="result" id="result" data-m="' + n.mtab + '" aria-live="polite">' + vResult() + '</section></div>' +
      '<div class="mbar"><button class="btn btn-primary" data-act="analyze">' + esc(t('analyze')) + '</button><button class="btn btn-secondary" data-act="copy">' + I('copy') + esc(t('copy')) + '</button><button class="btn btn-secondary" data-act="review">' + I('send') + esc(t('m_review')) + '</button></div>';
    function tb(a, ic) { return '<button class="btn btn-ghost btn-sm" data-act="' + a + '"' + (read && a !== 'sample' && a !== 'clear' ? '' : '') + '>' + I(ic) + '<span>' + esc(t(a)) + '</span></button>'; }
  }

  function railHTML() {
    var n = S.note, st = ['st1', 'st2', 'st3', 'st4', 'st5', 'st6'];
    return '<div class="card analysis enter"><div class="analysis-h">' + I('cpu') + '<b>' + esc(t('analysing')) + '</b><span class="t" id="rt">0.0 s</span><span class="sp"></span>' +
      '<button class="btn btn-ghost btn-sm" data-act="skip">' + esc(t('skip')) + '<span class="kbd">Esc</span></button></div>' +
      '<div class="rail"><div class="rail-track"><div class="rail-fill" id="rfill" style="width:' + (n.step / 6 * 100) + '%"></div></div><div class="rail-steps">' +
      st.map(function (k, i) { return '<span class="' + (i < n.step ? 'done' : i === n.step ? 'on' : '') + '">' + esc(t(k)) + '</span>'; }).join('') + '</div></div></div>' +
      skel();
  }
  function skel() {
    return '<div class="card" style="padding:22px"><div class="skel" style="width:40%;height:34px"></div><div class="skel" style="width:70%;height:16px;margin-top:14px"></div><div class="skel" style="width:55%;height:26px;margin-top:16px;border-radius:8px"></div></div>' +
      '<div class="card" style="padding:16px 18px"><div class="skel" style="width:60%;height:18px"></div></div><div class="card" style="padding:16px 18px"><div class="skel" style="width:48%;height:18px"></div></div>';
  }

  function conf(c) {
    var lvl = c.conf, frac = lvl === 'high' ? .9 : lvl === 'check' ? .58 : .3, C = 2 * Math.PI * 7;
    return '<span tabindex="0" role="img" class="conf ' + lvl + '" data-conf="' + c.code + '" aria-label=""' + esc(t('conf')) + ': ' + esc(t(lvl === 'check' ? 'checkc' : lvl)) + '">' +
      '<svg viewBox="0 0 18 18"><circle class="trk" cx="9" cy="9" r="7"/><circle class="val" cx="9" cy="9" r="7" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + (C * (1 - frac)).toFixed(2) + '"/></svg>' +
      esc(t(lvl === 'check' ? 'checkc' : lvl)) + (S.pct ? ' <span class="pct">' + c.pct + '%</span>' : '') + '</span>';
  }
  function quotes(c) { return '<div class="dx-ev">' + c.ev.map(function (s, j) { return '<button type="button" class="quote clin" data-q="' + c.code + '" data-ev="' + j + '">“' + esc(s) + '”</button>'; }).join('') + '</div>'; }
  function secH(k, n, extra) { return '<div class="sec-h"><h3>' + esc(t(k)) + '</h3>' + (n != null ? '<span class="n">' + n + '</span>' : '') + '<span class="sp"></span>' + (extra || '') + '</div>'; }

  function vResult() {
    var n = S.note, ph = n.phase;
    if (ph === 'empty') return '<div class="card enter"><div class="empty"><span class="ic">' + I('note') + '</span><h3>' + esc(t('empty_h')) + '</h3><p>' + esc(t('empty_p')) + '</p>' +
      '<button class="btn btn-secondary" data-act="sample" style="margin-top:8px">' + I('sample') + esc(t('sample')) + '</button></div></div>';
    if (ph === 'waking') return '<div class="card analysis enter"><div class="analysis-h wake"><span class="dot"></span><b>' + esc(t('waking')) + '</b><span class="t num" id="wt">' + n.wait + ' s</span><span class="sp"></span></div>' +
      '<div class="rail"><div class="rail-track"><div class="rail-fill" id="wfill" style="width:0%;background:var(--warning)"></div></div></div><p style="margin:12px 0 0;font-size:var(--fs-13);color:var(--text-2)">' + esc(t('waking_d')) + '</p></div>' + skel();
    if (ph === 'analysing') return railHTML();
    if (ph === 'nodx') return '<div class="card enter"><div class="empty"><span class="ic err">' + I('alert') + '</span><h3>' + esc(t('nodx_h')) + '</h3><p>' + esc(t('nodx_p')) + '</p></div></div>';
    if (ph === 'other') return '<div class="alert info enter">' + I('info') + '<div>' + esc(t('only_sample')) + ' <a href="../../index.html" style="color:var(--info);font-weight:600">' + esc(t('open_live')) + '</a></div></div>';
    /* result */
    var P = RX.CODES[0], add = RX.CODES.slice(1), i = 0;
    var via = n.via === 'fallback' ? '<span class="badge warn">' + I('cpu') + esc(t('fallback')) + '</span>' : n.via === 'online' ? '<span class="badge info">' + I('cloud') + esc(t('via_online')) + '</span>' : '';
    var h = '<div class="tabs mtabs" role="tablist">' + ['codes', 'evidence', 'gaps', 'insurer'].map(function (k) { return '<button role="tab" data-act="mtab" data-v="' + k + '" aria-selected="' + (n.mtab === k) + '">' + esc(t('m_' + k)) + '</button>'; }).join('') + '</div>';
    h += '<div data-sec="codes" style="flex-direction:column;gap:16px;display:flex">' + (via ? '<div class="enter" style="--i:0">' + via + '</div>' : '');
    h += secH('principal') +
      '<article class="card dx dx-principal enter" style="--i:' + (i++) + '" id="dx-' + P.code + '" data-code="' + P.code + '" tabindex="0">' +
      '<div class="dx-row"><div><div class="dx-code">' + P.code + '</div></div><div class="dx-badges"><span class="badge ok">' + I('check') + esc(t('confirmed')) + '</span>' + conf(P) + '</div></div>' +
      '<div class="dx-desc clin">' + esc(P.desc) + '</div>' + quotes(P) +
      '<div class="why"><b>' + esc(t('why')) + '</b><span>' + esc(P.why[S.lang]) + '</span><span class="rule">' + P.rule + '</span></div></article>';
    h += secH('additional', add.length);
    add.forEach(function (c) {
      var open = n.open[c.code];
      h += '<article class="card dx dx-add enter' + (open ? ' open' : '') + '" style="--i:' + (i++) + '" id="dx-' + c.code.replace('.', '_') + '" data-code="' + c.code + '">' +
        '<button type="button" class="dx-sum" data-act="toggle" data-v="' + c.code + '" aria-expanded="' + !!open + '"><span class="dx-code">' + c.code + '</span><span class="d"><span class="clin" style="display:block">' + esc(c.desc) + '</span><small>' + esc(t('supports')) + ': <span class="clin" style="display:inline">' + esc(c.supports) + '</span></small></span>' + conf(c) + I('chev', 'chev') + '</button>' +
        '<div class="dx-more"><div><div class="in"><dl class="kv"><dt>' + esc(t('evidence')) + '</dt><dd>' + quotes(c) + '</dd><dt>' + esc(t('supports')) + '</dt><dd class="clin">' + esc(c.supports) + '</dd>' +
        '<dt>' + esc(t('affects')) + '</dt><dd class="affects">' + c.affects.map(function (a) { return '<span class="tag">' + esc(t(a)) + '</span>'; }).join('') + '</dd></dl></div></div></div></article>';
    });
    h += '</div>';
    /* not coded */
    h += '<div data-sec="evidence" style="flex-direction:column;gap:16px;display:flex">' + secH('notcoded', RX.NOTCODED.length) +
      '<div class="card enter" style="--i:' + (i++) + '"><div class="nc-intro">' + esc(t('nc_intro')) + '</div><div class="nc-list">' +
      RX.NOTCODED.map(function (x, j) {
        var b = x.reason === 'family' ? 'info' : x.reason === 'integral' ? 'neutral' : 'neutral';
        return '<div class="nc-item" data-ncitem="' + j + '" tabindex="0" role="button"><span class="nc-ic">' + I(x.icon) + '</span><span><span class="what clin" style="display:block">' + esc(x.what) + '</span><span class="src clin">“' + esc(x.span) + '”' + (x.of ? ' → ' + x.of : '') + '</span></span><span class="badge ' + b + '">' + esc(t(x.reason)) + '</span></div>';
      }).join('') + '</div></div>';
    /* validation */
    var checks = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'];
    h += secH('validation', '6/6') + '<div class="card enter" style="--i:' + (i++) + '"><div class="checks" id="checks">' + checks.map(function (k) {
      return '<div class="chk" data-k="' + k + '"><span class="ci">' + I('check') + '</span><span>' + esc(t(k)) + '<small>' + esc(t('pass')) + '</small></span></div>';
    }).join('') + '</div></div></div>';
    /* gaps */
    h += '<div data-sec="gaps" style="flex-direction:column;gap:16px;display:flex">' + secH('gaps', RX.GAPS.length) + '<div class="card enter" style="--i:' + (i++) + '">' +
      RX.GAPS.map(function (g, j) {
        return '<div class="gap-item"><div class="gh"><span class="cchip" data-q="' + g.code + '" data-ev="-1">' + g.code + '</span><b class="clin">' + esc(g.text) + '</b></div>' +
          '<div class="query"><p class="clin"><span class="micro" style="display:block;margin-bottom:4px">' + esc(t('query')) + '</span>' + esc(g.q) + '</p>' +
          '<button class="btn btn-secondary btn-sm" data-act="cq" data-v="' + j + '">' + I('copy') + esc(t('copy')) + '</button></div></div>';
      }).join('') + '</div></div>';
    /* insurer */
    h += '<div data-sec="insurer" style="flex-direction:column;gap:16px;display:flex">' + askHTML(i++) + '</div>';
    /* actions */
    h += '<div class="actbar enter" style="--i:' + (i++) + '" role="toolbar">' +
      ab('copy', 'copy', 'a_copy', 'C') + ab('claim', 'doc', 'a_claim', '⇧C') +
      '<button class="btn btn-secondary btn-sm" data-act="export" aria-haspopup="menu" data-tip="' + esc(t('a_fhir') + ' · CSV') + '  X">' + I('download') + esc(t('a_export')) + I('chev') + '</button>' +
      ab('review', 'send', 'a_review', 'R') + ab('new', 'plus', 'a_new', 'N') + '<span class="sp"></span>' +
      '<button class="btn btn-primary btn-sm" data-act="final" data-tip="F">' + I('check') + esc(t('a_final')) + '</button></div>';
    return h;
    function ab(a, ic, k, key) { return '<button class="btn btn-secondary btn-sm" data-act="' + a + '" data-tip="' + esc(t(k)) + '  ' + key + '">' + I(ic) + '<span>' + esc(t(k)) + '</span></button>'; }
  }
  function askHTML(i) {
    var n = S.note, keys = n.ins === 'all' ? ['bupa', 'taw', 'art'] : [n.ins], total = 0, body = '';
    var name = { bupa: 'Bupa Arabia', taw: 'Tawuniya', art: 'Al Rajhi Takaful' };
    keys.forEach(function (k) {
      var set = RX.ASK[k];
      if (keys.length > 1) body += '<div style="padding:12px 18px 0"><span class="ins ' + k + '">' + name[k] + '</span></div>';
      set.groups.forEach(function (g) {
        body += '<div class="ask-grp">' + esc(g.g) + '</div>';
        g.items.forEach(function (it, j) {
          total++;
          body += '<button type="button" class="ask-item" data-act="write" data-ins="' + esc(it.ins) + '"><span class="dot"></span><span class="q clin">' + esc(it.q) + '<small>' + esc(it.hint) + '</small></span><span class="go">' + esc(t('write_here')) + I('arrow', 'flip') + '</span></button>';
        });
      });
      body += '<div class="ask-src">' + esc(t('src')) + ': <span class="clin" style="display:inline">' + esc(set.src) + '</span></div>';
    });
    var head = keys.length > 1 ? t('all3') : name[keys[0]];
    return secH('ask', total) + '<div class="card ask enter" style="--i:' + i + '"><div class="ask-h"><span class="ins ' + (keys.length > 1 ? 'bupa' : keys[0]) + '">' + esc(head) + '</span><span class="badge gold">' + I('flag') + total + ' ' + esc(t('open_items')) + '</span></div>' + body + '</div>';
  }

  /* ── analysis ── */
  function analyze() {
    var n = S.note, ed = $('#editor');
    if (ed) n.text = ed.value;
    if (!n.text.trim()) { if (ed) ed.focus(); return; }
    stopTimers(); n.mode = 'read'; n.stale = false; n.sel = null; n.freeze = false;
    if (S.online) {
      n.phase = 'waking'; n.wait = 0; render();
      var limit = S.outcome === 'down' ? 15 : 2, speed = S.outcome === 'down' ? 5 : 1; // the prototype runs the 15 s wait at 5×
      timers.push(setInterval(function () {
        n.wait++; var wt = $('#wt'), wf = $('#wfill');
        if (wt) wt.textContent = Math.min(n.wait, 15) + ' s'; if (wf) wf.style.width = Math.min(100, n.wait / 15 * 100) + '%';
        if (n.wait >= limit) { stopTimers(); n.via = S.outcome === 'down' ? 'fallback' : 'online'; runSteps(); }
      }, 1000 / speed));
      return;
    }
    n.via = 'offline'; runSteps();
  }
  function runSteps() {
    var n = S.note; n.phase = 'analysing'; n.step = 0; n.mode = 'read'; render();
    if (reduce) { finish(); return; }
    var t0 = performance.now();
    function tick() {
      n.step++;
      if (n.freeze && n.step >= 3) { n.step = 3; updRail(t0); return; }
      if (n.step >= 6) { finish(); return; }
      updRail(t0); timers.push(setTimeout(tick, 200));
    }
    timers.push(setTimeout(tick, 200));
  }
  function updRail(t0) {
    var n = S.note, f = $('#rfill'), rt = $('#rt');
    if (f) f.style.width = (n.step / 6 * 100) + '%';
    if (rt) rt.textContent = ((performance.now() - t0) / 1000).toFixed(1) + ' s';
    $$('.rail-steps span').forEach(function (s, i) { s.className = i < n.step ? 'done' : i === n.step ? 'on' : ''; });
    var r = $('#read'); if (r) r.innerHTML = noteHTML(n.text, n.step >= 2 ? 'final' : 'recog');
  }
  function finish(direct) {
    var n = S.note; stopTimers(); n.freeze = false; n.mode = 'read';
    if (isSample(n.text)) n.phase = 'result';
    else if (!/assessment|diagnos|impression|\bdx\b/i.test(n.text)) n.phase = 'nodx';
    else n.phase = 'other';
    n.sel = n.phase === 'result' ? 'M54.12' : null;
    render();
  }
  RX.actions.skip = function () { finish(); };

  function mountNote() {
    var n = S.note, ed = $('#editor');
    if (ed) {
      ed.oninput = function () { n.text = ed.value; $('#count').textContent = n.text.length.toLocaleString('en-US') + ' ' + t('chars'); if (n.phase === 'result') { n.stale = true; } };
      if (n.phase === 'empty' && !n.text) ed.focus();
    }
    $$('[data-seg]').forEach(function (g) {
      g.onclick = function (e) { var b = e.target.closest('button'); if (!b) return; n[g.dataset.seg] = b.dataset.v;
        if (ed) n.text = ed.value; render(); };
    });
    var age = $('#age'); if (age) age.onchange = function () { n.age = age.value.replace(/\D/g, '').slice(0, 3); };
    var file = $('#file'); if (file) file.onchange = function () {
      var f = file.files[0]; if (!f) return;
      if (/\.txt$/i.test(f.name) || f.type === 'text/plain') { var rd = new FileReader(); rd.onload = function () { n.text = String(rd.result); n.mode = 'edit'; n.phase = n.phase === 'result' ? 'result' : 'empty'; n.stale = n.phase === 'result'; render(); }; rd.readAsText(f); }
      else toast('.docx — ' + (S.lang === 'ar' ? 'يُقرأ في الأداة الحية' : 'read by the live tool'), 'info');
    };
    var read = $('#read');
    if (read) {
      read.onclick = function (e) {
        var m = e.target.closest('mark'); if (!m) return;
        if (m.dataset.code) { select(m.dataset.code, { card: true }); }
        else if (m.dataset.nc != null) selectNC(+m.dataset.nc, true);
      };
      read.onkeydown = function (e) { if (e.key === 'Enter' && e.target.matches('mark')) e.target.click(); };
      read.onscroll = function () { drawLinks(); };
    }
    var res = $('#result');
    if (res) res.addEventListener('click', function (e) {
      var qq = e.target.closest('[data-q]'); if (qq) { select(qq.dataset.q, { ev: +qq.dataset.ev }); return; }
      var ni = e.target.closest('[data-ncitem]'); if (ni) { selectNC(+ni.dataset.ncitem); return; }
      var card = e.target.closest('.dx'); if (card && !e.target.closest('button.dx-sum,.conf')) select(card.dataset.code, {});
    });
    $$('.conf').forEach(function (b) {
      var show = function () { confTip(b); }, hide = function () { closeFloats(); };
      b.onmouseenter = show; b.onfocus = show; b.onmouseleave = hide; b.onblur = hide;
    });
    if (n.phase === 'result') {
      $$('#checks .chk').forEach(function (c, i) { setTimeout(function () { c.classList.add('set', 'pass'); }, reduce ? 0 : 420 + i * 90); });
      if (n.sel) setTimeout(function () { select(n.sel, { quiet: true }); }, reduce ? 0 : 260);
    }
    if (n.phase === 'analysing' && n.freeze) updRail(performance.now() - 600);
  }

  function select(code, o) {
    o = o || {};
    var n = S.note; n.sel = code;
    $$('.dx').forEach(function (d) { d.classList.toggle('is-sel', d.dataset.code === code); });
    $$('#read mark.ev').forEach(function (m) { var on = m.dataset.code === code; m.classList.toggle('is-on', on); m.classList.toggle('dim', !on); });
    $$('#read mark.nc,.nc-item').forEach(function (m) { m.classList.remove('is-on'); });
    $$('.quote').forEach(function (qq) { qq.classList.toggle('is-on', qq.dataset.q === code); });
    var c = codeOf(code);
    if (c && c.role === 'additional' && !n.open[code] && !o.quiet) { n.open[code] = true; var card = $('.dx[data-code="' + code + '"]'); if (card) { card.classList.add('open'); card.querySelector('.dx-sum').setAttribute('aria-expanded', 'true'); } }
    var marks = $$('#read mark.ev[data-code="' + code + '"]');
    var target = o.ev != null && o.ev >= 0 ? marks.filter(function (m) { return +m.dataset.ev === o.ev; })[0] : marks[0];
    if (target && !o.card) { var rd = $('#read'), tr = target.getBoundingClientRect(), rr = rd.getBoundingClientRect(); if (tr.top < rr.top + 20 || tr.bottom > rr.bottom - 20) rd.scrollTop += tr.top - rr.top - rr.height / 3; }
    if (o.card) { var cd = $('.dx[data-code="' + code + '"]'); if (cd) cd.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); }
    setTimeout(function () { drawLinks(true); }, o.card && !reduce ? 380 : 20);
  }
  function selectNC(j, fromNote) {
    var n = S.note; n.sel = null; clearLinks();
    $$('.dx').forEach(function (d) { d.classList.remove('is-sel'); });
    $$('#read mark.ev').forEach(function (m) { m.classList.remove('is-on'); m.classList.add('dim'); });
    $$('#read mark.nc').forEach(function (m) { m.classList.toggle('is-on', +m.dataset.nc === j); });
    $$('.nc-item').forEach(function (m) { m.classList.toggle('is-on', +m.dataset.ncitem === j); });
    if (fromNote) { var it = $('.nc-item[data-ncitem="' + j + '"]'); if (it) it.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); }
    else { var mk = $('#read mark.nc[data-nc="' + j + '"]'); if (mk) mk.scrollIntoView({ block: 'nearest' }); }
  }
  function clearLinks() { var s = $('#links'); if (s) s.innerHTML = ''; }
  function drawLinks(anim) {
    var svg = $('#links'), ws = $('#ws'), n = S.note; if (!svg || !ws) return;
    svg.innerHTML = '';
    if (n.phase !== 'result' || !n.sel || !n.ev || innerWidth < 1200) return;
    var card = $('.dx[data-code="' + n.sel + '"]'), rd = $('#read'); if (!card || !rd) return;
    var W = ws.getBoundingClientRect(), C = card.getBoundingClientRect(), R = rd.getBoundingClientRect(), rtl = S.lang === 'ar';
    svg.setAttribute('viewBox', '0 0 ' + W.width + ' ' + W.height); svg.setAttribute('width', W.width); svg.setAttribute('height', W.height);
    var ex = (rtl ? C.right : C.left) - W.left, ey = Math.min(Math.max(C.top + 34, R.top), C.bottom - 10) - W.top;
    if (C.bottom < 70 || C.top > innerHeight) return;
    var h = '';
    $$('#read mark.ev[data-code="' + n.sel + '"]').forEach(function (m) {
      var rs = m.getClientRects(), r = rs[rs.length - 1] || m.getBoundingClientRect();
      var cy = r.top + r.height / 2; if (cy < R.top + 4 || cy > R.bottom - 4) return;
      var sx = (rtl ? R.left : R.right) - W.left, sy = cy - W.top, dx = ex - sx;
      var d = 'M' + sx + ' ' + sy + ' C' + (sx + dx * .55) + ' ' + sy + ' ' + (ex - dx * .45) + ' ' + ey + ' ' + ex + ' ' + ey;
      var len = Math.hypot(dx, ey - sy) * 1.2;
      h += '<path class="' + (anim ? 'draw' : '') + '" d="' + d + '" stroke-dasharray="' + len.toFixed(0) + '" style="--len:' + len.toFixed(0) + '"/><circle cx="' + sx + '" cy="' + sy + '" r="3"/>';
    });
    if (h) h += '<circle cx="' + ex + '" cy="' + ey + '" r="3.4"/>';
    svg.innerHTML = h;
  }
  function confTip(b) {
    closeFloats();
    var c = codeOf(b.dataset.conf), sig = ['sig1', c.signals[1] ? 'sig2' : 'sig2no', 'sig3', 'sig4'];
    var p = document.createElement('div'); p.className = 'tip-panel'; p.setAttribute('role', 'tooltip');
    p.innerHTML = '<h4>' + esc(t('sig_h')) + (S.pct ? ' · <span class="num">' + c.pct + '%</span>' : '') + '</h4><ul>' + sig.map(function (k, i) {
      var ok = c.signals[i]; return '<li>' + (ok ? I('check') : I('alert').replace('<svg', '<svg style="color:#e39a6a"')) + esc(t(k)) + '</li>';
    }).join('') + '</ul>';
    p.style.position = 'absolute'; floatAt(p, b);
  }

  /* note actions */
  RX.actions.analyze = analyze;
  RX.actions.sample = function () { var n = S.note; n.text = RX.NOTE; n.mode = 'edit'; if (n.phase !== 'result') n.phase = 'empty'; else n.stale = true; render(); var e = $('#editor'); if (e) e.focus(); };
  RX.actions.clear = function () { var n = S.note; stopTimers(); n.text = ''; n.mode = 'edit'; n.phase = 'empty'; n.stale = false; n.sel = null; render(); };
  RX.actions.paste = function () {
    var n = S.note;
    if (navigator.clipboard && navigator.clipboard.readText && window.isSecureContext) navigator.clipboard.readText().then(function (x) { n.text = x; n.mode = 'edit'; if (n.phase === 'result') n.stale = true; render(); }, function () { focusEd(); });
    else focusEd();
    function focusEd() { n.mode = 'edit'; render(); var e = $('#editor'); if (e) e.focus(); toast((navigator.platform.indexOf('Mac') >= 0 ? '⌘' : 'Ctrl') + '+V', 'paste'); }
  };
  RX.actions.upload = function () { $('#file').click(); };
  RX.actions.edit = function () { S.note.mode = 'edit'; render(); var e = $('#editor'); if (e) { e.focus(); } };
  RX.actions.toggle = function (el) { var c = el.dataset.v; S.note.open[c] = !S.note.open[c]; var card = el.closest('.dx'); card.classList.toggle('open', S.note.open[c]); el.setAttribute('aria-expanded', S.note.open[c]); setTimeout(drawLinks, 320); };
  RX.actions.mtab = function (el) { S.note.mtab = el.dataset.v; $('#result').dataset.m = el.dataset.v; $$('.mtabs button').forEach(function (b) { b.setAttribute('aria-selected', b === el); }); };
  RX.actions.cq = function (el) { copy(RX.GAPS[+el.dataset.v].q, t('copied')); };
  RX.actions.write = function (el) {
    var n = S.note; n.mode = 'edit'; n.stale = true; n.text = n.text.replace(/\s+$/, '') + '\n' + el.dataset.ins; render();
    var e = $('#editor'); if (!e) return; var i = e.value.indexOf('__', e.value.length - el.dataset.ins.length - 1);
    e.focus(); e.setSelectionRange(i, i + 2); e.scrollTop = e.scrollHeight;
  };
  var codesTxt = function () { return RX.CODES.map(function (c) { return c.code; }).join(', '); };
  RX.actions.copy = function () { if (S.note.phase !== 'result') return; copy(codesTxt(), t('t_copied') + ' · ' + codesTxt()); };
  RX.actions.claim = function () { copy(RX.CODES.map(function (c) { return (c.role === 'principal' ? 'Principal' : 'Additional') + ': ' + c.code + ' ' + c.desc; }).join('\n'), t('t_claim')); };
  RX.actions.review = function () { if (S.note.phase !== 'result') return; S.reviewCount++; var c = $('.side .it[data-go=review] .cnt'); if (c) c.textContent = S.reviewCount; toast(t('t_review'), 'send'); };
  RX.actions['new'] = RX.actions.clear;
  RX.actions.export = function (anchor) {
    closeFloats();
    var m = document.createElement('div'); m.className = 'menu'; m.setAttribute('role', 'menu');
    m.innerHTML = '<button role="menuitem" data-v="fhir">' + I('braces') + esc(t('a_fhir')) + '</button><button role="menuitem" data-v="csv">' + I('doc') + esc(t('a_csv')) + '</button>';
    m.onclick = function (e) { var b = e.target.closest('button'); if (!b) return; closeFloats(); exportAs(b.dataset.v); };
    m.style.position = 'absolute'; floatAt(m, anchor, false);
    setTimeout(function () { document.addEventListener('click', function off(e) { if (!m.contains(e.target)) { closeFloats(); document.removeEventListener('click', off); } }); }, 0);
  };
  function exportAs(kind) {
    var n = S.note;
    if (kind === 'csv') {
      var rows = [['code', 'description', 'role', 'evidence']].concat(RX.CODES.map(function (c) { return [c.code, c.desc, c.role, c.ev.join(' | ')]; }));
      download('rxdx-codes.csv', rows.map(function (r) { return r.map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(','); }).join('\n'), 'text/csv');
    } else {
      var bundle = { resourceType: 'Bundle', type: 'collection', entry: RX.CODES.map(function (c, i) { return { resource: {
        resourceType: 'Condition', id: 'dx-' + (i + 1),
        clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
        verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }] },
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'encounter-diagnosis' }] }],
        code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-am', code: c.code, display: c.desc }], text: c.desc },
        note: c.ev.map(function (s) { return { text: 'Evidence: "' + s + '"' }; }),
        extension: [{ url: 'https://rxdx/fhir/diagnosis-rank', valueString: c.role }] } }; }) };
      download('rxdx-conditions.fhir.json', JSON.stringify(bundle, null, 2), 'application/fhir+json');
    }
    toast(t('t_export'), 'download');
  }
  RX.actions.final = function () {
    var g = RX.GAPS.length, i = 0, k = S.note.ins === 'all' ? ['bupa', 'taw', 'art'] : [S.note.ins];
    k.forEach(function (x) { RX.ASK[x].groups.forEach(function (gr) { i += gr.items.length; }); });
    dialog('<header><h2>' + esc(t('fin_h')) + '</h2></header><div class="body"><p style="margin:0 0 14px">' + esc(t('fin_b').replace('{g}', g).replace('{i}', i)) + '</p>' +
      '<div class="field"><label for="why">' + esc(t('fin_reason')) + '</label><input id="why" class="input" maxlength="140" placeholder="' + esc(t('fin_ph')) + '"></div></div>' +
      '<footer><button class="btn btn-secondary" data-close>' + esc(t('cancel')) + '</button><button class="btn btn-primary" id="fin" disabled>' + esc(t('finalise_anyway')) + '</button></footer>',
      function (s, close) {
        var inp = $('#why', s), b = $('#fin', s); inp.focus();
        inp.oninput = function () { b.disabled = !inp.value.trim(); };
        inp.onkeydown = function (e) { if (e.key === 'Enter' && inp.value.trim()) b.click(); };
        b.onclick = function () { close(); toast(t('t_final')); };
      });
  };

  /* ── keyboard ── */
  document.addEventListener('keydown', function (e) {
    var mod = e.metaKey || e.ctrlKey, typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); if (S.role) palette(); return; }
    if (mod && e.key === 'Enter' && S.screen === 'note') { e.preventDefault(); analyze(); return; }
    if (e.key === 'Escape') { closeFloats(); if (S.note.phase === 'analysing' || S.note.phase === 'waking') finish(); return; }
    if (typing || mod || !S.role || $('.scrim,.cmdk')) return;
    if (e.key === '?') { shortcuts(); return; }
    if (S.screen !== 'note' || S.note.phase !== 'result') return;
    var order = RX.CODES.map(function (c) { return c.code; }), i = order.indexOf(S.note.sel);
    var k = e.key;
    if (k === 'j' || k === 'J') select(order[Math.min(i + 1, order.length - 1)], { card: true });
    else if (k === 'k' || k === 'K') select(order[Math.max(i - 1, 0)], { card: true });
    else if (k === 'e' || k === 'E') { S.note.ev = !S.note.ev; $('#read').classList.toggle('ev-off', !S.note.ev); drawLinks(); }
    else if (k === 'c') RX.actions.copy(); else if (k === 'C') RX.actions.claim();
    else if (k === 'x' || k === 'X') exportAs('fhir'); else if (k === 'r' || k === 'R') RX.actions.review();
    else if (k === 'n' || k === 'N') RX.actions.clear(); else if (k === 'f' || k === 'F') RX.actions.final();
  });
  var raf = 0;
  function onMove() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; drawLinks(false); }); }
  addEventListener('scroll', onMove, { passive: true }); addEventListener('resize', onMove);

  var ctx = { S: S, t: t, esc: esc, I: I, $: $, $$: $$, toast: toast, copy: copy, go: go, render: render, dialog: dialog, reduce: reduce };
  RX.app = ctx;
  addEventListener('hashchange', route);
  document.addEventListener('DOMContentLoaded', function () {
    var st = q.get('state');
    route();
    if (st && S.role && S.screen === 'note') { var b = document.createElement('button'); b.dataset.v = st; RX.actions.ps(b); }
  });
})();
