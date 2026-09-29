/* RxDx landing — language, the self-typing demo, evidence lines, section reveals. No libraries, no network. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (_) { return null; } }

  /* ── language ── */
  var EN = {
    ribbon: 'Runs in your browser — patient text is not saved or sent automatically',
    n_how: 'How it works', n_ev: 'Evidence', n_ins: 'Insurers', n_priv: 'Privacy', n_acc: 'Accuracy', n_api: 'API', langbtn: 'العربية', open: 'Open RxDx', how: 'See how it works',
    eyebrow: 'For Saudi hospitals · Bupa Arabia, Tawuniya and Al Rajhi Takaful',
    h1: 'Turn clinical notes into <em>codes you can defend.</em>',
    sub: 'RxDx reads the note, codes it to ICD-10-AM, shows the sentence behind every code and what the insurer will ask — before the patient leaves.',
    heronote: 'Runs in your browser. No account, no upload.', paused: 'Paused',
    d_title: 'Note → Codes', d_engine: 'Offline engine', d_f: 'Female', d_op: 'Outpatient', analyze: 'Analyze', d_empty: 'The codes appear here with the sentence behind each one',
    d_pr: 'Principal diagnosis', d_conf: 'Confirmed', d_add: 'Additional', d_nc: 'Not coded', r_denied: 'Denied', r_family: 'Family history', r_ruled: 'Ruled out', r_unc: 'Uncertain', r_int: 'Integral symptom',
    k1: 'Evidence', h_ev: 'Evidence for every code', l_ev: 'Select a code and the sentence that earned it lights up in the note. Nothing is coded without a phrase you can point to.',
    p1: 'One click from code to sentence', p2: 'Why this is the principal diagnosis, in one line', p3: 'A confidence level with the signals behind it',
    k2: 'Transparency', h_nc: 'What we did not code', l_nc: "A denied finding or a mother's cancer is not the patient's diagnosis. RxDx lists what it set aside and why, so a coder checks the judgement instead of redoing it.",
    l_nc2: 'denied or excluded findings kept out of the codes on the labelled corpus.',
    k3: 'Insurers', h_ins: 'Before the patient leaves', l_ins: "Choose the insurer and see what it will ask that the note does not answer yet. Each item opens the place where it should be written — and nothing stops the doctor from finalising.",
    l_ins2: 'requirement sets and', l_ins3: "questions, from the insurers' published protocols.",
    k4: 'Language', h_bi: 'Arabic first, English one click away', l_bi: 'The interface opens in Arabic, right to left. Notes, codes and payer questions stay in English, so nothing Arabic can reach a claim.',
    k5: 'Privacy', h_pr: 'Runs in the browser', l_pr: 'Patient text stays on the device. No account, no upload, no name or file number — age and sex only. The online coding service is optional, off by default, and says so for as long as it is on.',
    dev: 'This browser', f1: 'Note', f1s: 'Not saved', f2: 'Engine', f3: 'Codes', cloud: 'Online coding service — optional', off: 'Off by default',
    k6: 'Accuracy', h_acc: 'Measured, not claimed', l_acc: '60 hand-labelled clinical notes. Run it yourself: node gold/measure.js', acc_l: 'F1 at ICD category level',
    t_cat: 'ICD category', t_full: 'Full code', t_p: 'Precision', t_r: 'Recall',
    caveat: 'Internal evidence: the labels were written by the author of the vocabulary. An independent audit by a certified coder is the next step.',
    k7: 'Integration', h_api: 'API for hospital systems', l_api: 'The same engine over HTTP. The service loads the same file the browser does, so the tool and the API cannot give different answers. It stores no clinical text.',
    h_final: 'Code the next note with the evidence beside it.', proto: 'Try the UI prototype', foot: 'Does not replace a clinical coder’s judgement.',
    s1: 'Reading the note', s2: 'Finding conditions', s3: 'Setting aside what is denied or family history', s4: 'Choosing the principal diagnosis', s5: "Matching to the hospital's ICD-10-AM list", s6: 'Validating',
    why_M: 'Principal: the assessment names it and the plan treats it — MRI, physiotherapy, pregabalin. Rule ACS 0001.',
    why_E: 'Additional: supports HbA1c and metformin. Complications and control are not documented, so it stays unspecified.',
    why_I: 'Additional: supports amlodipine.'
  };
  var AR = {
    s1: 'قراءة الملاحظة', s2: 'إيجاد الحالات', s3: 'استبعاد المنفي والتاريخ العائلي', s4: 'اختيار التشخيص الرئيسي', s5: 'المطابقة مع قائمة المستشفى', s6: 'التحقق',
    why_M: 'رئيسي: التقييم يسمّيه والخطة تعالجه — رنين مغناطيسي وعلاج طبيعي وبريجابالين. القاعدة ACS 0001.',
    why_E: 'إضافي: يدعم HbA1c والميتفورمين. المضاعفات ودرجة الضبط غير موثّقة، لذا يبقى غير محدد.',
    why_I: 'إضافي: يدعم الأملوديبين.'
  };
  $$('[data-t]').forEach(function (el) { if (!(el.dataset.t in AR)) AR[el.dataset.t] = el.innerHTML; });
  var lang = root.lang === 'en' ? 'en' : 'ar';
  function T(k) { return (lang === 'en' ? EN : AR)[k] || EN[k] || ''; }
  function applyLang() {
    root.lang = lang; root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    $$('[data-t]').forEach(function (el) { el.innerHTML = T(el.dataset.t); });
    document.title = lang === 'ar' ? 'RxDx — أكواد تستطيع الدفاع عنها' : 'RxDx — codes you can defend';
    $('#lang').setAttribute('lang', lang === 'ar' ? 'en' : 'ar');
    renderIns(); exSelect(exCur);
  }
  $('#lang').onclick = function () { lang = lang === 'ar' ? 'en' : 'ar'; store('rxl_lang', lang); applyLang(); demo.restart(); };
  $('#theme').onclick = function () { var d = root.dataset.theme === 'dark' ? 'light' : 'dark'; root.dataset.theme = d; store('rxl_theme', d); };
  addEventListener('scroll', function () { $('#hdr').classList.toggle('scrolled', scrollY > 8); }, { passive: true });

  /* ── the demo ── */
  var NOTE = [
    ['55-year-old woman with '], ['neck pain radiating to the left arm', 'M'], [' for 3 weeks, with '], ['numbness in the left thumb', 'x'], ['.\nKnown '],
    ['type 2 diabetes on metformin', 'E'], [' and '], ['hypertension on amlodipine', 'I'], ['.\n'], ['No trauma', 'N'], ['. '], ['No fever', 'n'], ['.\n'],
    ['Mother had breast cancer', 'N'], ['.\nExamination: '], ['reduced left biceps reflex', 'M'], ['.\n'], ['Assessment: cervical radiculopathy', 'M'],
    ['.\nPlan: MRI cervical spine, '], ['physiotherapy', 'B'], [', pregabalin, '], ['HbA1c', 'E'], ['.']
  ];
  var TOTAL = NOTE.reduce(function (a, s) { return a + s[0].length; }, 0);
  var box = $('#dtext'), body = $('#dbody'), svg = $('#dlinks'), demoEl = $('#demo');
  var spans = [];
  function build() {
    box.innerHTML = ''; spans = [];
    NOTE.forEach(function (s) { var el = document.createElement(s[1] ? 'span' : 'span'); if (s[1]) { el.className = 'w'; el.dataset.k = s[1]; } box.appendChild(el); spans.push(el); });
    var c = document.createElement('span'); c.className = 'caret'; box.appendChild(c);
  }
  var paused = false, gen = 0;
  function wait(ms, g) {
    return new Promise(function (res, rej) {
      var left = ms, last = performance.now();
      (function f(now) {
        if (g !== gen) return rej('stop');
        if (!paused && !document.hidden) left -= now - last;
        last = now; if (left <= 0) res(); else requestAnimationFrame(f);
      })(last);
    });
  }
  function cards(on) { ['#c-p', '#c-e', '#c-i', '#c-n', '#c-b'].forEach(function (id) { $(id).classList.toggle('in', !!on); $(id).classList.remove('sel'); }); }
  function links(keys, target, cls) {
    var W = body.getBoundingClientRect(), N = $('#dnote').getBoundingClientRect(), C = $(target).getBoundingClientRect(), rtl = lang === 'ar';
    if (innerWidth < 980) return;
    svg.setAttribute('viewBox', '0 0 ' + W.width + ' ' + W.height);
    var ex = (rtl ? C.right : C.left) - W.left, ey = C.top + Math.min(30, C.height / 2) - W.top, h = '';
    spans.forEach(function (s) {
      if (keys.indexOf(s.dataset.k) < 0) return;
      var r = s.getClientRects(); r = rtl ? r[0] : r[r.length - 1]; if (!r) return;
      var sx = (rtl ? N.left : N.right) - W.left, sy = r.top + r.height / 2 - W.top, dx = ex - sx, len = Math.hypot(dx, ey - sy) * 1.2;
      h += '<path class="' + (cls || '') + '" d="M' + sx + ' ' + sy + ' C' + (sx + dx * .55) + ' ' + sy + ' ' + (ex - dx * .45) + ' ' + ey + ' ' + ex + ' ' + ey + '" stroke-dasharray="' + len.toFixed(0) + '" stroke-dashoffset="' + (reduce ? 0 : len.toFixed(0)) + '" style="transition:stroke-dashoffset .5s cubic-bezier(.2,.8,.2,1)"/>' +
        '<circle cx="' + sx + '" cy="' + sy + '" r="3"/>';
    });
    h += '<circle cx="' + ex + '" cy="' + ey + '" r="3.4"/>';
    svg.innerHTML = h;
    requestAnimationFrame(function () { $$('path', svg).forEach(function (p) { if (!p.classList.contains('nc')) p.style.strokeDashoffset = 0; else p.style.strokeDashoffset = 0; }); });
  }
  function mark(keys, cls, on) { spans.forEach(function (s) { if (keys.indexOf(s.dataset.k) >= 0) s.classList.toggle(cls, on !== false); }); }
  function select(id, keys) { $$('.d-card').forEach(function (c) { c.classList.toggle('sel', '#' + c.id === id); }); spans.forEach(function (s) { s.classList.toggle('on', keys.indexOf(s.dataset.k) >= 0); }); links(keys, id, keys[0] === 'N' ? 'nc' : ''); }
  function finalFrame() {
    build(); NOTE.forEach(function (s, i) { spans[i].textContent = s[0]; if (s[1]) spans[i].classList.add(s[1] === 'N' || s[1] === 'n' ? 'neg' : 'lit'); });
    $('.caret', box).remove(); $('#dcnt').textContent = TOTAL + ' chars'; $('#dempty').style.opacity = 0; cards(true); select('#c-p', ['M']);
  }

  var demo = {
    start: async function () {
      var g = ++gen;
      try {
        while (true) {
          build(); cards(false); svg.innerHTML = ''; $('#dempty').style.opacity = 1; $('#drail').classList.remove('on'); $('#dfill').style.width = '0%';
          await wait(700, g);
          /* type the note; each recognised phrase lights up in place as it completes */
          var typed = 0;
          for (var i = 0; i < NOTE.length; i++) {
            var s = NOTE[i][0], el = spans[i];
            for (var j = 0; j < s.length; j += 2) {
              el.textContent = s.slice(0, j + 2); typed += Math.min(2, s.length - j);
              $('#dcnt').textContent = typed + ' chars';
              await wait(s[j] === '\n' ? 90 : 14, g);
            }
            if (NOTE[i][1] && NOTE[i][1] !== 'n' && NOTE[i][1] !== 'N') { (function (e) { setTimeout(function () { e.classList.add('lit'); }, 60); })(el); }
            if (NOTE[i][1] === 'N' || NOTE[i][1] === 'n') { (function (e) { setTimeout(function () { e.classList.add('lit'); }, 60); })(el); }
          }
          var caret = $('.caret', box); if (caret) caret.remove();
          await wait(450, g);
          /* analyse: the real steps, 1.2 s */
          $('#dan').classList.add('press'); await wait(180, g); $('#dan').classList.remove('press');
          $('#drail').classList.add('on');
          var t0 = performance.now();
          for (var k = 1; k <= 6; k++) {
            $('#dstep').textContent = T('s' + k); $('#dfill').style.width = (k / 6 * 100) + '%'; $('#dtime').textContent = ((performance.now() - t0) / 1000).toFixed(1) + ' s';
            if (k === 3) { mark(['N', 'n'], 'lit', false); mark(['N', 'n'], 'neg'); }
            await wait(200, g);
          }
          $('#dtime').textContent = '1.2 s';
          await wait(160, g); $('#drail').classList.remove('on'); $('#dempty').style.opacity = 0;
          /* the result assembles, tied to its sentences */
          $('#c-p').classList.add('in'); await wait(260, g); select('#c-p', ['M']); await wait(1500, g);
          $('#c-e').classList.add('in'); await wait(220, g); select('#c-e', ['E']); await wait(1100, g);
          $('#c-i').classList.add('in'); await wait(220, g); select('#c-i', ['I']); await wait(1000, g);
          $('#c-n').classList.add('in'); await wait(220, g); select('#c-n', ['N']); await wait(1300, g);
          $('#c-b').classList.add('in'); await wait(220, g); select('#c-b', ['B']); await wait(1300, g);
          select('#c-p', ['M']); await wait(3200, g);
          /* ease out and loop */
          demoEl.style.transition = 'opacity .4s'; demoEl.style.opacity = .35; await wait(420, g); demoEl.style.opacity = 1; svg.innerHTML = '';
        }
      } catch (e) { if (e !== 'stop') throw e; }
    },
    restart: function () { gen++; if (reduce) { finalFrame(); return; } setTimeout(function () { demo.start(); }, 30); }
  };
  demoEl.addEventListener('mouseenter', function () { paused = true; demoEl.classList.add('paused'); });
  demoEl.addEventListener('mouseleave', function () { paused = false; demoEl.classList.remove('paused'); });
  demoEl.addEventListener('focus', function () { paused = true; demoEl.classList.add('paused'); });
  demoEl.addEventListener('blur', function () { paused = false; demoEl.classList.remove('paused'); });
  addEventListener('resize', function () { var s = $('.d-card.sel'); if (s) { var k = { 'c-p': ['M'], 'c-e': ['E'], 'c-i': ['I'], 'c-n': ['N'], 'c-b': ['B'] }[s.id]; links(k, '#' + s.id, s.id === 'c-n' ? 'nc' : ''); } });

  /* ── evidence explorer ── */
  var EXN = [['55-year-old woman with '], ['neck pain radiating to the left arm', 'M54.12'], ['. Known '], ['type 2 diabetes on metformin', 'E11.9'], [' and '], ['hypertension on amlodipine', 'I10'],
    ['. Examination: '], ['reduced left biceps reflex', 'M54.12'], ['. '], ['Assessment: cervical radiculopathy', 'M54.12'], ['. Plan: MRI, physiotherapy, pregabalin, '], ['HbA1c', 'E11.9'], ['.']];
  $('#exnote').innerHTML = EXN.map(function (s) { return s[1] ? '<mark data-c="' + s[1] + '">' + s[0] + '</mark>' : s[0]; }).join('');
  var exCur = 'M54.12';
  function exSelect(c) {
    exCur = c;
    $$('#exnote mark').forEach(function (m) { m.classList.toggle('on', m.dataset.c === c); });
    $$('.ex-codes button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.c === c); });
    $('#exwhy').textContent = T({ 'M54.12': 'why_M', 'E11.9': 'why_E', I10: 'why_I' }[c]);
  }
  $('.ex-codes').onclick = function (e) { var b = e.target.closest('button'); if (b) exSelect(b.dataset.c); };
  $('#exnote').onclick = function (e) { var m = e.target.closest('mark'); if (m) exSelect(m.dataset.c); };

  /* ── insurer ── */
  var INS = {
    bupa: { src: 'Bupa Prerequisites, p.4', items: [['Physiotherapy: duration, primary cause and initial management', 'Detailed history'], ['Examination: range of motion, reflexes, strength', 'Physical examination findings'], ['Red flags: progressive arm weakness; gait or bladder change', 'Record present or absent']] },
    taw: { src: 'Tawuniya MDS · Physiotherapy', items: [['Yellow flags or red flag signs', 'Duration already written: 3 weeks'], ['Documented failure of medical therapy and of home exercise, for at least 4 to 6 weeks', 'What was tried, and for how long'], ['The modalities requested match this diagnosis in the clinical guidelines', 'Name the modalities']] },
    art: { src: 'Tawuniya MDS · Physiotherapy (applied by Al Rajhi Takaful)', items: [['Yellow flags or red flag signs', 'Duration already written: 3 weeks'], ['Documented failure of medical therapy and of home exercise, for at least 4 to 6 weeks', 'What was tried, and for how long']] }
  };
  var insCur = 'bupa';
  function renderIns() {
    var d = INS[insCur];
    $('#inslist').innerHTML = d.items.map(function (x, i) { return '<div class="ins-item" style="animation-delay:' + (i * 40) + 'ms"><i></i><p>' + x[0] + '<small>' + x[1] + '</small></p></div>'; }).join('');
    $('#inssrc').innerHTML = (lang === 'ar' ? 'المصدر: ' : 'Source: ') + '<span class="clin" style="display:inline">' + d.src + '</span>';
    $$('#instabs button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.p === insCur); });
  }
  $('#instabs').onclick = function (e) { var b = e.target.closest('button'); if (b) { insCur = b.dataset.p; renderIns(); } };

  /* ── reveals, the count, the data line ── */
  var counted = false;
  function countUp() {
    if (counted) return; counted = true; var el = $('#bignum'), t0 = performance.now(), dur = reduce ? 0 : 1100;
    (function f(now) { var p = dur ? Math.min(1, (now - t0) / dur) : 1, k = 1 - Math.pow(1 - p, 3); el.textContent = (99.3 * k).toFixed(1); if (p < 1) requestAnimationFrame(f); })(t0);
  }
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); if (en.target.querySelector && en.target.querySelector('#bignum')) countUp(); io.unobserve(en.target); } }); }, { threshold: .18 });
    $$('.reveal').forEach(function (r) { io.observe(r); });
  } else { $$('.reveal').forEach(function (r) { r.classList.add('in'); }); countUp(); }
  var secs = $('#secs'), run = $('#spinerun'), dot = $('#spinedot');
  function spine() {
    var r = secs.getBoundingClientRect(), H = r.height, p = Math.max(0, Math.min(1, (innerHeight * .55 - r.top) / H));
    run.setAttribute('y2', (p * H).toFixed(0)); dot.setAttribute('cy', (p * H).toFixed(0)); dot.style.opacity = p > 0 && p < 1 ? 1 : 0;
  }
  addEventListener('scroll', function () { requestAnimationFrame(spine); }, { passive: true }); spine();

  applyLang();
  if (reduce) finalFrame(); else {
    var started = false, dio = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { if (es[0].isIntersecting && !started) { started = true; demo.start(); } }, { threshold: .2 }) : null;
    if (dio) dio.observe(demoEl); else demo.start();
  }
})();
