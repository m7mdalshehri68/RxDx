"""Apply the RxDx clinical review design to every build of the tool.

    python3 design/apply_design.py <html> [<html> ...]

Idempotent: the injected blocks carry ids and are replaced on every run.
Nothing inside the app script is changed, so the engine, the tests and the
API parity check are untouched.
"""
import base64, json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
FONTS = HERE / 'fonts'

ARABIC = ('U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,'
          'U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC')
LATIN = ('U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,'
         'U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD')


def font_css():
    out = []
    def face(family, file, weight, rng):
        data = base64.b64encode((FONTS / file).read_bytes()).decode()
        out.append("@font-face{font-family:'%s';font-style:normal;font-display:swap;font-weight:%d;"
                   "src:url(data:font/woff2;base64,%s) format('woff2');unicode-range:%s}" % (family, weight, data, rng))
    for w in (400, 500, 600, 700):
        face('IBM Plex Sans Arabic', 'ibm-plex-sans-arabic-arabic-%d-normal.woff2' % w, w, ARABIC)
        face('IBM Plex Sans Arabic', 'ibm-plex-sans-arabic-latin-%d-normal.woff2' % w, w, LATIN)
    for w in (400, 600):
        face('JetBrains Mono', 'jetbrains-mono-latin-%d-normal.woff2' % w, w, LATIN)
    return '\n'.join(out)


def i18n_js():
    d = json.loads((HERE / 'i18n_ar.json').read_text(encoding='utf-8'))
    pats = d.pop('__patterns__', [])
    runtime = (HERE / 'i18n.js').read_text(encoding='utf-8')
    return ('window.RX_I18N_AR=' + json.dumps(d, ensure_ascii=False, separators=(',', ':')) + ';\n'
            'window.RX_I18N_AR_PAT=' + json.dumps(pats, ensure_ascii=False, separators=(',', ':')) + ';\n'
            + runtime)


def logical(css):
    """Physical left/right become start/end, so the same rules serve Arabic.
    In English the result renders exactly as before."""
    for a, b in [
        (r'(?<![\w-])margin-left(\s*:)', r'margin-inline-start\1'),
        (r'(?<![\w-])margin-right(\s*:)', r'margin-inline-end\1'),
        (r'(?<![\w-])padding-left(\s*:)', r'padding-inline-start\1'),
        (r'(?<![\w-])padding-right(\s*:)', r'padding-inline-end\1'),
        (r'(?<![\w-])border-left(-(?:color|width|style))?(\s*:)', r'border-inline-start\1\2'),
        (r'(?<![\w-])border-right(-(?:color|width|style))?(\s*:)', r'border-inline-end\1\2'),
        (r'text-align(\s*:\s*)left\b', r'text-align\1start'),
        (r'text-align(\s*:\s*)right\b', r'text-align\1end'),
        (r'(?<![\w-])float(\s*:\s*)left\b', r'float\1inline-start'),
        (r'(?<![\w-])float(\s*:\s*)right\b', r'float\1inline-end'),
    ]:
        css = re.sub(a, b, css)

    def block(m):
        sel, decl = m.group(1), m.group(2)
        if re.search(r'translate|rotate|scale', decl):
            return m.group(0)
        decl = re.sub(r'(?<![\w-])left(\s*:\s*)(?!50%)', r'inset-inline-start\1', decl)
        decl = re.sub(r'(?<![\w-])right(\s*:\s*)(?!50%)', r'inset-inline-end\1', decl)
        return sel + '{' + decl + '}'
    return re.sub(r'([^{}]+)\{([^{}]*)\}', block, css)


MOON = ('<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>')
LANG_BTN = '<button class="rxt-btn rx-lang" data-noi18n onclick="rxLang()" title="Language">English</button>'
RIBBON = ('<div class="rx-ribbon" id="rx-ribbon"><b>RXDX</b><i>•</i>'
          '<span>Runs in your browser — patient text is not saved or sent automatically</span></div>\n')
GATE_TOP = ('<div class="rxg-top">' + LANG_BTN +
            '<button class="rxt-btn" onclick="rxTheme()" title="Theme">' + MOON + '</button></div>')


def apply(path):
    p = pathlib.Path(path)
    h = p.read_text(encoding='utf-8')

    # 1. remove what an earlier run injected
    h = re.sub(r'<style id="rx-fonts">[\s\S]*?</style>\n?', '', h)
    h = re.sub(r'<style id="rx-theme">[\s\S]*?</style>\n?', '', h)
    h = re.sub(r'<script id="rx-i18n">[\s\S]*?</script>\n?', '', h)

    # 2. the existing style blocks speak in start/end instead of left/right
    app_at = h.find('const IDF')
    app_start = h.rfind('<script>', 0, app_at) if app_at >= 0 else h.find('<script src="data/')
    if app_start < 0:
        raise SystemExit('could not find where the app script starts in ' + path)
    head, tail = h[:app_start], h[app_start:]
    head = re.sub(r'(<style[^>]*>)([\s\S]*?)(</style>)', lambda m: m.group(1) + logical(m.group(2)) + m.group(3), head)

    # 3. markup: language button, theme icon, ribbon
    old_theme = '<button class="rxt-btn" onclick="rxTheme()" title="Theme">🌓</button>'
    if old_theme in head:
        head = head.replace(old_theme, LANG_BTN + '<button class="rxt-btn" onclick="rxTheme()" title="Theme">' + MOON + '</button>')
    if 'class="rxg-top"' not in head:
        head = head.replace('<div id="rx-gate">', '<div id="rx-gate">\n' + GATE_TOP, 1)
    if 'id="rx-ribbon"' not in head:
        head = head.replace('<div id="rx-shell">', RIBBON + '<div id="rx-shell">', 1)

    # 4. fonts, theme and language, after every other style block and before the app
    theme = (HERE / 'theme.css').read_text(encoding='utf-8')
    inject = ('<style id="rx-fonts">' + font_css() + '</style>\n'
              '<style id="rx-theme">' + theme + '</style>\n'
              '<script id="rx-i18n">' + i18n_js() + '</script>\n')
    p.write_text(head + inject + tail, encoding='utf-8')
    print('%-60s %9d bytes' % (p.name, p.stat().st_size))


if __name__ == '__main__':
    for f in sys.argv[1:]:
        apply(f)
