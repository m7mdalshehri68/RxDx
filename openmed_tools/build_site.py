#!/usr/bin/env python3
"""
Build the web version from the single-file version.

RxDx.html is one file you can double-click with no server — that is its whole
point, and it stays. But 16 MB in one file is awkward to host, slow to update,
and impossible to cache in pieces. This splits the two big reference tables out
into ordinary <script> files loaded before the app.

Classic scripts run in order and block, so by the time the app's own script
runs, IDF and ICD are already defined. No async, no init changes, no risk.

    python3 build_site.py RxDx.html ./site
"""
import json, os, re, sys

MAX = 9 * 1024 * 1024          # keep every piece under a 10 MB upload limit

def carve(html, name):
    """Cut `const NAME = [...];` out of the html and return (html, value)."""
    m = re.search(r'const\s+' + name + r'\s*=\s*\[', html)
    if not m:
        sys.exit('could not find ' + name)
    start = m.end() - 1
    d, j = 0, start
    while True:
        c = html[j]
        if c == '[': d += 1
        elif c == ']':
            d -= 1
            if d == 0: break
        elif c in '"\'':
            q = c; j += 1
            while html[j] != q or html[j-1] == '\\': j += 1
        j += 1
    end = html.index(';', j) + 1
    return html[:m.start()] + html[end:], json.loads(html[start:j+1])

def chunk(rows, name, out):
    """Write rows as one or more .js files, each under MAX."""
    parts, cur, size = [], [], 0
    for r in rows:
        s = len(json.dumps(r, ensure_ascii=False))
        if cur and size + s > MAX:
            parts.append(cur); cur, size = [], 0
        cur.append(r); size += s
    if cur: parts.append(cur)
    files = []
    for i, p in enumerate(parts, 1):
        fn = '%s-%d.js' % (name.lower(), i)
        with open(os.path.join(out, 'data', fn), 'w', encoding='utf-8') as f:
            f.write('window.%s_%d=%s;' % (name, i, json.dumps(p, ensure_ascii=False, separators=(',', ':'))))
        files.append((fn, len(p)))
    return files

def main():
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(os.path.join(out, 'data'), exist_ok=True)
    html = open(src, encoding='utf-8').read()
    before = len(html)

    html, idf = carve(html, 'IDF')
    html, icd = carve(html, 'ICD')

    idf_files = chunk(idf, 'IDF', out)
    icd_files = chunk(icd, 'ICD', out)

    tags = ''.join('<script src="data/%s"></script>\n' % f for f, _ in idf_files + icd_files)
    join = ('<script>\n'
            'var IDF=[].concat(%s);\n'
            'var ICD=[].concat(%s);\n'
            '%s\n'
            '</script>\n' % (
              ','.join('window.IDF_%d' % i for i in range(1, len(idf_files) + 1)),
              ','.join('window.ICD_%d' % i for i in range(1, len(icd_files) + 1)),
              ''.join('window.IDF_%d=null;' % i for i in range(1, len(idf_files) + 1)) +
              ''.join('window.ICD_%d=null;' % i for i in range(1, len(icd_files) + 1))))

    # the reference tables must exist before the app's own script is parsed
    anchor = html.rindex('<script>')
    html = html[:anchor] + tags + join + html[anchor:]

    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(html)

    print('single file  %.2f MB' % (before / 1048576))
    print('index.html   %.2f MB' % (len(html) / 1048576))
    for f, n in idf_files + icd_files:
        p = os.path.join(out, 'data', f)
        print('  data/%-12s %6.2f MB  %5d rows' % (f, os.path.getsize(p) / 1048576, n))
    big = [f for f, _ in idf_files + icd_files
           if os.path.getsize(os.path.join(out, 'data', f)) > MAX] \
          + (['index.html'] if len(html) > MAX else [])
    print('\nevery piece under 9 MB:', 'yes' if not big else 'NO — ' + ', '.join(big))

if __name__ == '__main__':
    main()
