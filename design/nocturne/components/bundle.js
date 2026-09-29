/* @ds-bundle: {"format":4,"namespace":"Nocturne","components":[{"name":"Button"},{"name":"FloatButton"},{"name":"GlassPanel"},{"name":"StatusPill"},{"name":"VitalTile"},{"name":"Waveform"},{"name":"RingGauge"},{"name":"HoloPortrait"},{"name":"NavBar"},{"name":"Field"},{"name":"Icon"}]} */
/* RxDx Nocturne components. Classic script: reads window.React, assigns window.Nocturne. */
(function () {
  "use strict";

  function R() { return window.React; }
  function h() { var r = R(); return r.createElement.apply(r, arguments); }
  function cx() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
    return out.join(" ");
  }
  function omit(obj, keys) {
    var o = {};
    for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k) && keys.indexOf(k) < 0) o[k] = obj[k];
    return o;
  }
  var seq = 0;
  function useUid(prefix) {
    var ref = R().useRef(null);
    if (ref.current === null) ref.current = prefix + (++seq);
    return ref.current;
  }

  /* ── Icon ─────────────────────────────────────────────────────── */
  var ICONS = {"heart-pulse":[["path","M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"],["path","M3 12.5h4.5l1.5-2.5 2.5 5 2-4 1.5 1.5H21"]],"activity":[["path","M3 12h3.5l2.5-7 5 14 2.5-7H21"]],"droplet":[["path","M12 3.2c3 3.4 6 7 6 10.6a6 6 0 0 1-12 0C6 10.2 9 6.6 12 3.2z"],["path","M9.2 14.5a2.9 2.9 0 0 0 2.3 2.6"]],"thermometer":[["path","M10 13.8V4.5a2 2 0 0 1 4 0v9.3a4 4 0 1 1-4 0z"],["path","M12 17V9"]],"calendar":[["rect",3.5,5,17,15.5,3],["path","M3.5 10h17"],["path","M8 3v4"],["path","M16 3v4"],["path","M8 14.5h2.5"],["path","M13.5 14.5H16"]],"clock":[["circle",12,12,8.5],["path","M12 7.5V12l3 2"]],"video":[["rect",2.5,6.5,13,11,3],["path","M15.5 10.5l6-3v9l-6-3z"]],"message":[["path","M7 3.5h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6l-4.5 3.5v-3.5H7a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3z"]],"phone":[["path","M6.6 3.5h2.6l1.6 4.2-2 1.4a11.5 11.5 0 0 0 6.1 6.1l1.4-2 4.2 1.6v2.6a2 2 0 0 1-2.2 2A16.6 16.6 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z"]],"stethoscope":[["path","M6.5 3.5H5a1 1 0 0 0-1 1V9a5 5 0 0 0 10 0V4.5a1 1 0 0 0-1-1h-1.5"],["path","M9 14v1.5a5 5 0 0 0 10 0V13"],["circle",19,11,2]],"pill":[["path","M8.5 20.5 20.5 8.5a4.24 4.24 0 0 0-6-6L2.5 14.5a4.24 4.24 0 0 0 6 6z"],["path","M8.5 8.5l6 6"]],"dna":[["path","M7 3c0 4.5 10 4.5 10 9s-10 4.5-10 9"],["path","M17 3c0 4.5-10 4.5-10 9s10 4.5 10 9"],["path","M8.5 6h7"],["path","M8.5 18h7"]],"shield-check":[["path","M12 3.2 19 6v5.6c0 4.3-2.9 7.6-7 9.2-4.1-1.6-7-4.9-7-9.2V6z"],["path","M9 12.2l2.1 2.1 4-4.2"]],"user":[["circle",12,8,4],["path","M4.5 20.5a7.5 7.5 0 0 1 15 0"]],"bell":[["path","M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"],["path","M10 20.5a2.2 2.2 0 0 0 4 0"]],"search":[["circle",11,11,6.5],["path","M20 20l-4.4-4.4"]],"globe":[["circle",12,12,8.5],["path","M3.5 12h17"],["path","M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5s1.2-6.1 3.6-8.5z"]],"map-pin":[["path","M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"],["circle",12,10,2.4]],"arrow-right":[["path","M4.5 12h15"],["path","M13.5 6l6 6-6 6"]],"plus":[["path","M12 5v14"],["path","M5 12h14"]]};

  function Icon(props) {
    var size = props.size || 20;
    var parts = ICONS[props.name] || [];
    var kids = parts.map(function (p, i) {
      if (p[0] === "path") return h("path", { key: i, d: p[1] });
      if (p[0] === "circle") return h("circle", { key: i, cx: p[1], cy: p[2], r: p[3] });
      return h("rect", { key: i, x: p[1], y: p[2], width: p[3], height: p[4], rx: p[5] });
    });
    if (props.title) kids.unshift(h("title", { key: "t" }, props.title));
    return h("svg", {
      className: cx("nc-icon", props.className), width: size, height: size, viewBox: "0 0 24 24",
      fill: "none", stroke: "currentColor", strokeWidth: props.strokeWidth || 1.6,
      strokeLinecap: "round", strokeLinejoin: "round", style: props.style,
      role: props.title ? "img" : undefined, "aria-hidden": props.title ? undefined : true, focusable: "false"
    }, kids);
  }
  Icon.names = Object.keys(ICONS);
  function iconNode(x, size) { return typeof x === "string" ? h(Icon, { name: x, size: size }) : x; }

  /* ── Button ───────────────────────────────────────────────────── */
  function Button(props) {
    var rest = omit(props, ["variant", "size", "icon", "iconEnd", "className", "children", "as"]);
    var tag = props.as || (props.href ? "a" : "button");
    if (tag === "button" && rest.type == null) rest.type = "button";
    rest.className = cx("nc-btn", "nc-btn-" + (props.variant || "primary"), "nc-btn-" + (props.size || "md"), props.className);
    return h(tag, rest,
      props.icon ? iconNode(props.icon, 18) : null,
      props.children != null ? h("span", { className: "nc-btn-label" }, props.children) : null,
      props.iconEnd ? iconNode(props.iconEnd, 18) : null);
  }

  /* ── FloatButton ──────────────────────────────────────────────── */
  function FloatButton(props) {
    var rest = omit(props, ["icon", "label", "tone", "pulse", "tip", "badge", "className"]);
    if (rest.type == null) rest.type = "button";
    rest.className = cx("nc-fab", "nc-fab-" + (props.tone || "cyan"), props.pulse && "nc-fab-pulse", props.className);
    rest["aria-label"] = props.label;
    return h("button", rest,
      iconNode(props.icon, 22),
      props.badge != null ? h("span", { className: "nc-fab-badge", "aria-hidden": true }, props.badge) : null,
      props.tip === false ? null : h("span", { className: cx("nc-fab-tip", props.tip === "end" && "nc-fab-tip-end"), "aria-hidden": true }, props.label));
  }

  /* ── GlassPanel ───────────────────────────────────────────────── */
  function GlassPanel(props) {
    var rest = omit(props, ["as", "strength", "glow", "pad", "className", "children"]);
    rest.className = cx("nc-glass",
      props.strength === "strong" && "nc-glass-strong",
      props.glow && props.glow !== "none" && "nc-glow-" + props.glow,
      "nc-pad-" + (props.pad || "md"), props.className);
    return h(props.as || "div", rest, props.children);
  }

  /* ── StatusPill ───────────────────────────────────────────────── */
  var GLYPH = {
    stable: "M5.5 12.5l4 4L18.5 7.5",
    watch: "M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6zM12 14.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z",
    critical: "M12 5v8.5M12 18.5v.3",
    offline: "M6.5 12h11",
    info: "M12 11v6.5M12 6.8v.3"
  };
  var LABEL = { stable: "Stable", live: "Live", watch: "Watch", critical: "Critical", offline: "Offline", info: "Info" };

  function StatusPill(props) {
    var status = props.status || "stable";
    var glyph = status === "live"
      ? h("span", { className: "nc-dot", "aria-hidden": true })
      : h("svg", { viewBox: "0 0 24 24", width: 14, height: 14, fill: "none", stroke: "currentColor", strokeWidth: 2.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false" }, h("path", { d: GLYPH[status] || GLYPH.info }));
    return h("span", { className: cx("nc-pill", "nc-pill-" + status, props.size === "sm" && "nc-pill-sm", props.className), role: props.role, title: props.title },
      glyph, h("span", null, props.children != null ? props.children : LABEL[status]));
  }

  /* ── Sparkline (inside VitalTile) ─────────────────────────────── */
  function Sparkline(props) {
    var data = props.data || [];
    var id = useUid("nc-spark-");
    if (data.length < 2) return null;
    var min = Math.min.apply(null, data), max = Math.max.apply(null, data), span = (max - min) || 1;
    var pts = data.map(function (v, i) { return [i / (data.length - 1) * 100, 28 - (v - min) / span * 22]; });
    var line = "M" + pts.map(function (p) { return p[0].toFixed(2) + " " + p[1].toFixed(2); }).join("L");
    var last = pts[pts.length - 1];
    return h("div", { className: "nc-spark", "aria-hidden": true },
      h("svg", { viewBox: "0 0 100 32", preserveAspectRatio: "none" },
        h("defs", null, h("linearGradient", { id: id, x1: 0, y1: 0, x2: 0, y2: 1 },
          h("stop", { offset: 0, stopColor: "currentColor", stopOpacity: 0.3 }),
          h("stop", { offset: 1, stopColor: "currentColor", stopOpacity: 0 }))),
        h("path", { d: line + "L100 32L0 32Z", fill: "url(#" + id + ")" }),
        h("path", { d: line, fill: "none", stroke: "currentColor", strokeWidth: 2, vectorEffect: "non-scaling-stroke", strokeLinejoin: "round", strokeLinecap: "round" })),
      h("span", { className: "nc-spark-dot", style: { left: last[0] + "%", top: (last[1] / 32 * 100) + "%" } }));
  }

  /* ── VitalTile ────────────────────────────────────────────────── */
  function VitalTile(props) {
    var rest = omit(props, ["label", "value", "unit", "icon", "status", "statusLabel", "trend", "accent", "footnote", "children", "className", "pad", "size"]);
    rest.pad = props.pad || "md";
    rest.className = cx("nc-vital", "nc-accent-" + (props.accent || "cyan"), props.size === "sm" && "nc-vital-sm", props.className);
    return h(GlassPanel, rest,
      h("div", { className: "nc-vital-head" },
        props.icon ? h("span", { className: "nc-vital-ic" }, iconNode(props.icon, 18)) : null,
        h("span", { className: "nc-vital-label" }, props.label),
        props.status ? h(StatusPill, { status: props.status, size: "sm" }, props.statusLabel) : null),
      h("div", { className: "nc-vital-read" },
        h("span", { className: "nc-vital-value" }, props.value),
        props.unit ? h("span", { className: "nc-vital-unit" }, props.unit) : null),
      props.trend ? h(Sparkline, { data: props.trend }) : null,
      props.children,
      props.footnote ? h("div", { className: "nc-vital-foot" }, props.footnote) : null);
  }

  /* ── Waveform ─────────────────────────────────────────────────── */
  // One beat is 50 units wide on a 36-unit baseline: flat, P wave, QRS, T wave.
  var BEAT = "l7 0q3 -5 6 0l3 0l2 4l3 -30l3 38l2 -12l5 0q5 -10 10 0l9 0";
  function Waveform(props) {
    var bpm = props.bpm || 72;
    var d = "M0 36";
    for (var i = 0; i < 8; i++) d += BEAT;
    return h("div", {
      className: cx("nc-wave", "nc-tone-" + (props.tone || "emerald"), props.live === false && "is-paused", props.grid === false && "no-grid", props.className),
      style: Object.assign({ height: props.height || 56 }, props.style),
      role: "img", "aria-label": props.label || ("ECG trace, " + bpm + " beats per minute")
    },
      h("svg", { viewBox: "0 0 200 60", preserveAspectRatio: "none", "aria-hidden": true, focusable: "false" },
        h("g", { className: "nc-wave-track", style: { animationDuration: (240 / bpm).toFixed(3) + "s" } }, h("path", { d: d }))));
  }

  /* ── RingGauge ────────────────────────────────────────────────── */
  function RingGauge(props) {
    var min = props.min || 0, max = props.max == null ? 100 : props.max;
    var v = Math.max(0, Math.min(1, (props.value - min) / ((max - min) || 1)));
    var C = 2 * Math.PI * 52, size = props.size || 148;
    return h("div", {
      className: cx("nc-ring", "nc-tone-" + (props.tone || "cyan"), props.className),
      style: Object.assign({ width: size, height: size, "--c": C.toFixed(2), "--ring-scale": (size / 148).toFixed(3) }, props.style),
      role: "meter", "aria-valuenow": props.value, "aria-valuemin": min, "aria-valuemax": max,
      "aria-label": props.label
    },
      h("svg", { viewBox: "0 0 120 120", "aria-hidden": true, focusable: "false" },
        h("circle", { className: "nc-ring-track", cx: 60, cy: 60, r: 52 }),
        h("circle", { className: "nc-ring-ticks", cx: 60, cy: 60, r: 44 }),
        h("circle", { className: "nc-ring-val", cx: 60, cy: 60, r: 52, strokeDasharray: C.toFixed(2), strokeDashoffset: (C * (1 - v)).toFixed(2), transform: "rotate(-90 60 60)" })),
      h("div", { className: "nc-ring-center" },
        h("span", { className: "nc-ring-value" }, props.display != null ? props.display : props.value, props.unit ? h("small", null, props.unit) : null),
        props.label ? h("span", { className: "nc-ring-label" }, props.label) : null));
  }

  /* ── HoloPortrait ─────────────────────────────────────────────── */
  // The built-in figure: a clinician's bust as a wireframe light-form. No face is drawn.
  var BODY = "M128 158C128 172 127 180 124 188C100 196 70 204 52 222C36 238 30 262 28 290L22 400H278L272 290C270 262 264 238 248 222C230 204 200 196 176 188C173 180 172 172 172 158Z";
  var HEAD = "M150 54C177 54 193 77 193 106C193 137 175 163 150 163C125 163 107 137 107 106C107 77 123 54 150 54Z";
  var HAIR = "M106 108C101 72 122 48 151 48C181 48 199 72 194 108C190 90 180 79 165 76C149 73 131 78 119 91C113 97 109 102 106 108Z";
  function HoloFigure(props) {
    var u = useUid("nc-holo-");
    var fill = u + "f", dots = u + "d", clip = u + "c", headGlow = u + "h", scan = u + "s", sweep = u + "w";
    var rings = [[76, 33], [92, 40], [108, 43], [124, 41], [140, 34]].map(function (r, i) {
      return h("path", { key: "r" + i, d: "M" + (150 - r[1]) + " " + r[0] + "A" + r[1] + " 6 0 0 0 " + (150 + r[1]) + " " + r[0] });
    });
    var bodyLines = [232, 262, 296, 332, 368].map(function (y, i) {
      return h("path", { key: "b" + i, d: "M0 " + y + "Q150 " + (y + 16) + " 300 " + y });
    });
    return h("svg", { className: "nc-holo-svg", viewBox: "0 0 300 400", role: "img", "aria-label": props.title, focusable: "false" },
      h("defs", null,
        h("linearGradient", { id: fill, x1: 0, y1: 0, x2: 0, y2: 1 },
          h("stop", { offset: 0, stopColor: "currentColor", stopOpacity: 0.42 }),
          h("stop", { offset: 0.55, stopColor: "currentColor", stopOpacity: 0.14 }),
          h("stop", { offset: 1, stopColor: "currentColor", stopOpacity: 0 })),
        h("radialGradient", { id: headGlow, cx: 0.42, cy: 0.36, r: 0.7 },
          h("stop", { offset: 0, stopColor: "currentColor", stopOpacity: 0.5 }),
          h("stop", { offset: 1, stopColor: "currentColor", stopOpacity: 0.06 })),
        h("pattern", { id: dots, width: 6, height: 6, patternUnits: "userSpaceOnUse" },
          h("circle", { cx: 1.5, cy: 1.5, r: 0.9, fill: "currentColor", fillOpacity: 0.55 })),
        h("pattern", { id: scan, width: 4, height: 4, patternUnits: "userSpaceOnUse" },
          h("rect", { width: 4, height: 1, fill: "currentColor", fillOpacity: 0.22 })),
        h("linearGradient", { id: sweep, x1: 0, y1: 0, x2: 0, y2: 1 },
          h("stop", { offset: 0, stopColor: "currentColor", stopOpacity: 0 }),
          h("stop", { offset: 0.5, stopColor: "currentColor", stopOpacity: 0.55 }),
          h("stop", { offset: 1, stopColor: "currentColor", stopOpacity: 0 })),
        h("clipPath", { id: clip }, h("path", { d: BODY }), h("path", { d: HEAD }), h("path", { d: HAIR }))),
      h("g", { className: "nc-holo-solid" },
        h("path", { d: BODY, fill: "url(#" + fill + ")" }),
        h("path", { d: HEAD, fill: "url(#" + headGlow + ")" }),
        h("path", { d: HAIR, fill: "currentColor", fillOpacity: 0.3 })),
      h("g", { clipPath: "url(#" + clip + ")", className: "nc-holo-mesh" },
        h("rect", { width: 300, height: 400, fill: "url(#" + dots + ")" }),
        h("rect", { width: 300, height: 400, fill: "url(#" + scan + ")", className: "nc-holo-scanfill" }),
        h("rect", { width: 300, height: 90, y: -90, fill: "url(#" + sweep + ")", className: "nc-holo-sweepfill" }),
        rings, bodyLines,
        h("path", { d: "M150 54V163" }),
        h("path", { d: "M150 54C132 70 128 90 128 108S132 146 150 163" }),
        h("path", { d: "M150 54C168 70 172 90 172 108S168 146 150 163" })),
      h("g", { className: "nc-holo-lines" },
        h("path", { d: BODY }), h("path", { d: HEAD }),
        h("path", { d: HAIR, className: "nc-holo-soft" }),
        // ears
        h("path", { d: "M107 100c-6 0-8 6-7 12s4 12 9 12M193 100c6 0 8 6 7 12s-4 12-9 12", className: "nc-holo-soft" }),
        // collar and lapels
        h("path", { d: "M132 190L150 234L168 190" }),
        h("path", { d: "M124 188L109 232L126 238L112 252L146 302" }),
        h("path", { d: "M176 188L191 232L174 238L188 252L154 302" }),
        h("path", { d: "M150 302V400" }),
        // stethoscope
        h("path", { d: "M130 194C116 220 106 252 110 282C112 296 116 304 120 309" }),
        h("path", { d: "M170 194C184 218 192 244 190 262C189 272 184 278 178 280" }),
        h("circle", { cx: 122, cy: 318, r: 9 }), h("circle", { cx: 122, cy: 318, r: 3.5 }),
        // pocket, pens and the clinic cross
        h("rect", { x: 178, y: 296, width: 42, height: 34, rx: 4 }),
        h("path", { d: "M190 282V300M199 286V300" }),
        h("path", { d: "M84 262h14M91 255v14" }),
        h("circle", { cx: 150, cy: 326, r: 2.4 }), h("circle", { cx: 150, cy: 356, r: 2.4 }), h("circle", { cx: 150, cy: 386, r: 2.4 })));
  }

  function HoloPortrait(props) {
    var size = props.size || 360;
    var alt = props.alt || (props.name ? props.name + ", shown as a hologram" : "Doctor hologram");
    return h("figure", { className: cx("nc-holo", props.className), style: Object.assign({ "--holo-w": size + "px" }, props.style) },
      h("div", { className: "nc-holo-stage" },
        h("div", { className: "nc-holo-beam", "aria-hidden": true }),
        h("div", { className: "nc-holo-orbit", "aria-hidden": true }, h("i"), h("i"), h("i")),
        h("div", { className: cx("nc-holo-figure", props.src && "has-img") },
          props.src ? h("img", { src: props.src, alt: alt }) : h(HoloFigure, { title: alt }),
          props.src ? h("span", { className: "nc-holo-scan", "aria-hidden": true }) : null,
          props.src ? h("span", { className: "nc-holo-sweep", "aria-hidden": true }) : null),
        h("div", { className: "nc-holo-base", "aria-hidden": true }, h("i"), h("i"), h("i"))),
      (props.name || props.role) ? h("figcaption", { className: "nc-holo-cap" },
        h("span", { className: "nc-holo-who" },
          props.name ? h("span", { className: "nc-holo-name" }, props.name) : null,
          props.role ? h("span", { className: "nc-holo-role" }, props.role) : null),
        props.status ? h(StatusPill, { status: props.status, size: "sm" }, props.statusLabel) : null) : null);
  }

  /* ── NavBar ───────────────────────────────────────────────────── */
  function NavBar(props) {
    var items = props.items || [];
    return h("nav", { className: cx("nc-nav", props.className), "aria-label": props.label || "Main", style: props.style },
      props.brand ? h("div", { className: "nc-nav-brand" }, props.brand) : null,
      h("ul", { className: "nc-nav-links" }, items.map(function (it, i) {
        return h("li", { key: i }, h("a", {
          href: it.href || "#", onClick: it.onClick,
          className: it.active ? "is-active" : undefined, "aria-current": it.active ? "page" : undefined
        }, it.label));
      })),
      props.actions ? h("div", { className: "nc-nav-actions" }, props.actions) : null);
  }

  /* ── Field ────────────────────────────────────────────────────── */
  function Field(props) {
    var auto = useUid("nc-field-");
    var id = props.id || auto;
    var rest = omit(props, ["label", "hint", "icon", "trailing", "shape", "className", "id", "invalid", "style"]);
    return h("div", { className: cx("nc-field", props.shape === "pill" && "nc-field-pill", props.invalid && "is-invalid", props.className), style: props.style },
      props.label ? h("label", { className: "nc-field-label", htmlFor: id }, props.label) : null,
      h("div", { className: "nc-field-box" },
        props.icon ? h("span", { className: "nc-field-ic" }, iconNode(props.icon, 18)) : null,
        h("input", Object.assign({
          id: id, className: "nc-field-input", "aria-invalid": props.invalid || undefined,
          "aria-describedby": props.hint ? id + "-hint" : undefined
        }, rest)),
        props.trailing ? h("span", { className: "nc-field-trail" }, props.trailing) : null),
      props.hint ? h("div", { className: "nc-field-hint", id: id + "-hint" }, props.hint) : null);
  }

  var api = {
    Button: Button, FloatButton: FloatButton, GlassPanel: GlassPanel, StatusPill: StatusPill,
    VitalTile: VitalTile, Waveform: Waveform, RingGauge: RingGauge, HoloPortrait: HoloPortrait,
    NavBar: NavBar, Field: Field, Icon: Icon
  };
  window.Nocturne = Object.assign(window.Nocturne || {}, api);
})();
