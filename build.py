#!/usr/bin/env python3
"""Ensambla index.html (Vercel) y la vista previa a partir de src/."""
import sys, pathlib
R = pathlib.Path(__file__).parent
src = R / 'src'
CDN = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',
]
def build(cdn):
    head = (src/'head.html').read_text(); body = (src/'body.html').read_text()
    js = '\n'.join((src/f).read_text().replace("if (typeof module !== 'undefined') module.exports = Q;", '') for f in ['models.js','core.js','ui1.js','ui2.js','ui3.js'])
    libs = '\n'.join(f'<script src="{u}"></script>' for u in cdn)
    return head, body, libs, js
head, body, libs, js = build(CDN)
content = f"{head}\n{body}\n{libs}\n<script>\n{js}\n</script>\n"
full = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>\n'
        + head + '\n</head>\n<body>\n' + body + '\n' + libs + '\n<script>\n' + js + '\n</script>\n</body>\n</html>\n')
(R/'index.html').write_text(full)
(R/'preview.html').write_text(content)
if len(sys.argv) > 1:  # versión de prueba con librerías locales
    loc = [f'/lib/{u.split("/")[-1]}' for u in CDN]
    h,b,l,j = build(loc)
    (R/'test.html').write_text(full.replace(libs, l))
print('ok', len(full)//1024, 'KB')
