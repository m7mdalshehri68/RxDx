/* RxDx interface language, Arabic or English.
   Only the interface is translated: codes, code descriptions, protocols,
   payer questions and anything the doctor types stay in English, and keep
   their own left-to-right direction inside Arabic screens. The dictionary is
   matched on whole strings, so a clinical phrase is never half-translated. */
(function () {
  var AR = window.RX_I18N_AR || {};
  var PATS = (window.RX_I18N_AR_PAT || []).map(function (p) { return [new RegExp('^' + p[0] + '$'), p[1]]; });
  var REV = null;
  var ORIG_TEXT = new WeakMap(), ORIG_EL = new WeakMap(), ORIG_ATTR = new WeakMap();
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1, NOSCRIPT: 1 };
  var INLINE = { B: 1, STRONG: 1, I: 1, EM: 1, SPAN: 1, SMALL: 1, SUB: 1, SUP: 1, BR: 1, U: 1, MARK: 1 };
  var CODE_CLASS = /(^|\s)(code-mono|icd-code|code-badge|uni-code|hx-chip-code|itc-c|itc-code|drug-code|noi18n)(\s|$)/;
  var HAS_AR = /[؀-ۿ]/;
  var lang = 'ar';
  try { var s = localStorage.getItem('rx_lang'); if (s === 'en' || s === 'ar') lang = s; } catch (_) {}

  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  function lookup(key) {
    if (!key) return null;
    if (Object.prototype.hasOwnProperty.call(AR, key)) return AR[key];
    for (var i = 0; i < PATS.length; i++) { if (PATS[i][0].test(key)) return key.replace(PATS[i][0], PATS[i][1]); }
    return null;
  }
  /* Arabic back to English, for text the app itself copied while the screen was
     Arabic (a button that restores its own label after "Copied", for example) */
  function reverse(key) {
    if (!REV) {
      REV = {};
      for (var k in AR) if (Object.prototype.hasOwnProperty.call(AR, k) && !Object.prototype.hasOwnProperty.call(REV, AR[k])) REV[AR[k]] = k;
    }
    return Object.prototype.hasOwnProperty.call(REV, key) ? REV[key] : null;
  }
  /* Some interface text is also data: a quick-pick chip whose words are copied
     into the note, a History Builder negative that becomes "no chest pain". Those
     stay in English, or Arabic would end up inside the clinical note. */
  function skipped(el) {
    if (!el || el.nodeType !== 1) return false;
    if (SKIP_TAGS[el.tagName] || el.isContentEditable) return true;
    if (el.hasAttribute('data-noi18n')) return true;
    var c = el.getAttribute('class');
    if (c && CODE_CLASS.test(c)) return true;
    var oc = el.getAttribute('onclick');
    if (oc && /\b(hxQ|mdsSet)\(/.test(oc)) return true;
    if (c && /(^|\s)hx-neg(\s|$|-on)/.test(c) && el.closest && el.closest('#panel-hx')) return true;
    return false;
  }
  /* an <option> without a value submits its text: pin the English value first */
  function pinOption(el) {
    if (el.tagName === 'OPTION' && !el.hasAttribute('value')) el.setAttribute('value', el.textContent);
  }
  function inlineOnly(el) {
    for (var i = 0; i < el.childNodes.length; i++) {
      var k = el.childNodes[i];
      if (k.nodeType === 3) continue;
      if (k.nodeType !== 1 || !INLINE[k.tagName] || skipped(k) || !inlineOnly(k)) return false;
    }
    return true;
  }
  function trAttrs(el) {
    var list = ['placeholder', 'title', 'aria-label'];
    for (var i = 0; i < list.length; i++) {
      var a = list[i], v = el.getAttribute(a);
      if (v === null) continue;
      var o = ORIG_ATTR.get(el);
      if (lang === 'ar') {
        if (o && o[a] && o[a].ar === v) continue;
        var t = lookup(norm(v));
        if (t) { o = o || {}; o[a] = { en: v, ar: t }; ORIG_ATTR.set(el, o); el.setAttribute(a, t); }
      } else if (o && o[a]) {
        if (v === o[a].ar) el.setAttribute(a, o[a].en);
        delete o[a];
      } else if (HAS_AR.test(v)) {
        var e = reverse(norm(v));
        if (e) el.setAttribute(a, e);
      }
    }
  }
  /* English that stays English (codes, descriptions, payer questions) keeps its own
     direction, so "Serial ECG — done and reported?" does not get its question mark
     moved to the front on an Arabic screen */
  function keepLtr(node) {
    var p = node.parentElement;
    if (p && !p.hasAttribute('dir') && /[A-Za-z]{2}/.test(node.nodeValue)) p.setAttribute('dir', 'auto');
  }
  function edges(v, t) { var m = /^(\s*)[\s\S]*?(\s*)$/.exec(v); return m[1] + t + m[2]; }
  function trText(node) {
    var v = node.nodeValue, o = ORIG_TEXT.get(node);
    if (lang === 'ar') {
      if (o && v === o.ar) return;
      if (!v || !/[A-Za-z]/.test(v)) return;
      var t = lookup(norm(v));
      if (!t) { keepLtr(node); return; }
      var nv = edges(v, t);
      ORIG_TEXT.set(node, { en: v, ar: nv });
      node.nodeValue = nv;
    } else if (o) {
      if (v === o.ar) node.nodeValue = o.en;
      ORIG_TEXT.delete(node);
    } else if (v && HAS_AR.test(v)) {
      var e = reverse(norm(v));
      if (e) node.nodeValue = edges(v, e);
    }
  }
  /* a sentence split by <b> or <br> is translated as one sentence, never word by word */
  function trElement(el) {
    var o = ORIG_EL.get(el);
    if (lang === 'ar') {
      if (o && el.textContent === o.ar) return true;
      if (el.children.length === 0 || !inlineOnly(el)) return false;
      var t = lookup(norm(el.textContent));
      if (!t) return false;
      ORIG_EL.set(el, { en: el.innerHTML, ar: t });
      el.textContent = t;
      return true;
    }
    if (o) {
      if (el.textContent === o.ar) el.innerHTML = o.en;
      ORIG_EL.delete(el);
      return true;
    }
    return false;
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { var p = root.parentElement; if (p && !hasSkippedAncestor(p)) trText(root); return; }
    if (root.nodeType !== 1 || hasSkippedAncestor(root)) return;
    var stack = [root];
    while (stack.length) {
      var el = stack.pop();
      if (el.nodeType !== 1 || skipped(el)) continue;
      if (lang === 'ar') pinOption(el);
      trAttrs(el);
      if (trElement(el)) continue;
      for (var i = el.childNodes.length - 1; i >= 0; i--) {
        var k = el.childNodes[i];
        if (k.nodeType === 3) trText(k); else if (k.nodeType === 1) stack.push(k);
      }
    }
  }
  function hasSkippedAncestor(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) if (skipped(e)) return true;
    return false;
  }
  function applyDir() {
    var h = document.documentElement;
    h.setAttribute('lang', lang);
    h.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    var btns = document.querySelectorAll('.rx-lang');
    for (var i = 0; i < btns.length; i++) btns[i].textContent = lang === 'ar' ? 'English' : 'العربية';
  }
  var obs = null;
  function start() {
    applyDir();
    walk(document.body);
    if (typeof MutationObserver === 'undefined' || obs) return;
    obs = new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.type === 'characterData') { walk(m.target); continue; }
        if (m.type === 'attributes') { if (!hasSkippedAncestor(m.target)) trAttrs(m.target); continue; }
        for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
        if (lang === 'ar' && m.target && m.target.nodeType === 1 && ORIG_EL.has(m.target)) {
          var o = ORIG_EL.get(m.target);
          if (m.target.textContent !== o.ar) { ORIG_EL.delete(m.target); walk(m.target); }
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
  }
  window.rxLang = function (to) {
    lang = to === 'en' || to === 'ar' ? to : (lang === 'ar' ? 'en' : 'ar');
    try { localStorage.setItem('rx_lang', lang); } catch (_) {}
    applyDir();
    walk(document.body);
  };
  window.rxLangNow = function () { return lang; };
  /* messages in alert/confirm/prompt: whole message first, then paragraph by paragraph */
  window.rxT = function (s) {
    if (lang !== 'ar' || typeof s !== 'string') return s;
    var t = lookup(norm(s));
    if (t) return t;
    var parts = s.split(/(\n+)/), hit = false;
    for (var i = 0; i < parts.length; i += 2) {
      var p = lookup(norm(parts[i]));
      if (!p) {
        /* a bulleted line keeps its bullet */
        var b = /^(\s*[-•]\s+)([\s\S]+)$/.exec(parts[i]);
        if (b) { var q = lookup(norm(b[2])); if (q) p = b[1] + q; }
      }
      if (p) { parts[i] = p; hit = true; }
    }
    return hit ? parts.join('') : s;
  };
  var _alert = window.alert, _confirm = window.confirm, _prompt = window.prompt;
  if (_alert) window.alert = function (m) { return _alert.call(window, window.rxT(m)); };
  if (_confirm) window.confirm = function (m) { return _confirm.call(window, window.rxT(m)); };
  if (_prompt) window.prompt = function (m, d) { return _prompt.call(window, window.rxT(m), d); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  /* before the first paint, so an Arabic screen never flashes in English layout */
  applyDir();
})();
