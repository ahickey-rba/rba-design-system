#!/usr/bin/env python3
"""Regenerate the logo manifest embedded in logo-library.html.

    ./tools/logos-sync.py            # sync, then report what changed
    ./tools/logos-sync.py --check    # report only, touch nothing (exit 1 if stale)

WHY THIS EXISTS
---------------
assets/logo-library/ holds 79 logos, each shipping six files: three colorways in
SVG and PNG. That is well over 400 paths, and writing them into the page by hand is
how the grid and the folder drift apart. This script walks the folder and rewrites
the JSON block the page renders from, so the page cannot claim a logo the folder does
not have.

The manifest stores only a name, a category and a dark flag per logo. The six paths
are derived in app.js from the name and category, because the naming is a contract:
    assets/logo-library/<category>/<name>.svg          color vector
    assets/logo-library/<category>/<name>.png          color raster, 512px
    assets/logo-library/<category>/<name>-black.svg    one-color black vector
    assets/logo-library/<category>/<name>-black.png    one-color black raster
    assets/logo-library/<category>/<name>-white.svg    one-color white vector
    assets/logo-library/<category>/<name>-white.png    one-color white raster
A logo missing any of the six is dropped with a warning rather than shipped broken.

THE DARK FLAG
-------------
A sixth of these marks are white-on-transparent — Cargill, Best Buy, Toro, Post
Consumer Brands. RBA's site only ever carried the reversed cut of them, so their
"color" file is white and renders as an empty box on a light tile. The flag is
measured here from the artwork rather than guessed from the filename, and the page
gives those tiles a dark stage. Measuring it at sync time means a logo swapped later
gets re-measured instead of inheriting a stale assumption. (The white colorway needs
no flag: in that mode every tile goes dark.)

DISPLAY NAMES
-------------
Filenames are slugs; NAMES below is the override table for every case where
title-casing the slug gets it wrong — .NET, AWS, BCU, dbt, Node.js. Anything absent
falls through to the generic rule, so an added logo shows up with a sane name and
can be corrected here later.
"""

import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(ROOT, 'assets', 'logo-library')
PAGE = os.path.join(ROOT, 'logo-library.html')

BEGIN = '  <script type="application/json" id="logo-manifest">'
END = '  </script>'

# Order is the order the chips appear in, and the order the grid renders.
#
# RBA's own marks are deliberately absent. The page says at the top that they live
# under Logos, and listing them here too would contradict that on the same screen.
# The harvested RBA artwork is still on disk as _rba-brand/ — the leading underscore
# keeps it out of this list and out of the download bundles.
CATEGORIES = [
    ('partnerships',   'Partnerships'),
    ('platforms',      'Platforms'),
    ('clients',        'Clients'),
    ('certifications', 'Certifications'),
    ('community',      'Community'),
]

# Slugs whose display name title-casing would mangle.
NAMES = {
    'aws': 'AWS', 'aws--provider': 'AWS — Provider', 'aws-logo': 'AWS',
    'bcu': 'BCU', 'bcu-alt': 'BCU (alt)',
    'bigcommerce': 'BigCommerce', 'bigcommerce--partner': 'BigCommerce — Partner',
    'bcrf': 'BCRF', 'breast-cancer-research-foundation': 'Breast Cancer Research Foundation',
    'cios-against-cancer': 'CIOs Against Cancer',
    'dbt': 'dbt Labs', 'dotnet': '.NET',
    'github': 'GitHub', 'hb-fuller': 'H.B. Fuller',
    'javascript': 'JavaScript', 'lels': 'LELS',
    'microsoft-365': 'Microsoft 365', 'microsoft-365-alt': 'Microsoft 365 (alt)',
    'microsoft-365-waffle-icons': 'Microsoft 365 app icons',
    'nodejs': 'Node.js', 'openai': 'OpenAI',
    'nutrition-incentive-hub-gscn': 'Nutrition Incentive Hub (GSCN)',
    'pavsa': 'PAVSA', 'power-bi': 'Power BI', 'power-bi-legacy': 'Power BI (legacy)',
    'sitecore-experience-commerce': 'Sitecore Experience Commerce',
    'umbraco-platinum-partner-badge': 'Umbraco Platinum Partner badge',
    'wordpress': 'WordPress', 'best-buy': 'Best Buy',
    # From the Logo library deck.
    'ch-robinson': 'C.H. Robinson', 'isc2': 'ISC2',
    'unitedhealthcare': 'UnitedHealthcare',
    'university-of-south-dakota': 'University of South Dakota',
    'umbraco-certified-master': 'Umbraco Certified Master',
    'umbraco-gold-partner': 'Umbraco Gold Partner',
    'wex': 'WEX', 'mutual-of-omaha': 'Mutual of Omaha',
    # Certification badges. The credential's own name, not the issuer's.
    'pmp': 'PMP', 'pmi-acp': 'PMI-ACP', 'cissp': 'CISSP', 'csm': 'CSM',
    'aws-certified-solutions-architect': 'AWS Certified Solutions Architect',
    'microsoft-certified-expert': 'Microsoft Certified — Expert',
    'microsoft-certified-associate': 'Microsoft Certified — Associate',
}

SUFFIX = {'alt': '(alt)', 'alt2': '(alt 2)', 'legacy': '(legacy)',
          'white': '(white)', 'blue': '(blue)', 'cropped': '(cropped)'}


def display_name(slug):
    if slug in NAMES:
        return NAMES[slug]
    # "sitecore--gold-partner" -> "Sitecore — Gold Partner"
    head, sep, tail = slug.partition('--')
    def words(s):
        out = []
        for w in s.split('-'):
            if not w:
                continue
            out.append(SUFFIX[w] if w in SUFFIX else w[0].upper() + w[1:])
        return ' '.join(out)
    return words(head) + (' — ' + words(tail) if sep else '')


def is_light(png):
    """True when the artwork would vanish on a white tile.

    Mean brightness alone gets this wrong. A mark traced from a PNG that carried an
    opaque white background is mostly white by area, but the logo drawn on it is dark
    and reads fine — put that on a dark stage and you get a white box floating in it.
    What actually distinguishes a reversed mark is that it has no dark content at all:
    Cargill and Toro are white and nothing else, while BigCommerce and Coveo are dark
    marks that merely sit on white.
    """
    try:
        from PIL import Image
        import numpy as np
    except ImportError:
        return '-white' in png
    a = np.array(Image.open(png).convert('RGBA'))
    rgb, alpha = a[:, :, :3].astype(float), a[:, :, 3]
    ink = alpha >= 128
    if not ink.any():
        return False
    lum = (0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2])[ink]
    has_dark = (lum < 128).mean() > 0.02
    return bool(not has_dark and lum.mean() > 190)


def collect():
    logos, warnings = [], []
    for ci, (slug, _label) in enumerate(CATEGORIES):
        folder = os.path.join(LIB, slug)
        if not os.path.isdir(folder):
            warnings.append(f'{slug}/ is missing')
            continue
        names = sorted(f[:-4] for f in os.listdir(folder)
                       if f.endswith('.svg') and not f.endswith(('-black.svg', '-white.svg')))
        for n in names:
            wanted = [f'{n}.svg', f'{n}.png', f'{n}-black.svg', f'{n}-black.png',
                      f'{n}-white.svg', f'{n}-white.png']
            missing = [w for w in wanted if not os.path.exists(os.path.join(folder, w))]
            if missing:
                warnings.append(f'{slug}/{n}: missing {", ".join(missing)} — not listed')
                continue
            entry = {'n': n, 't': display_name(n), 'c': ci}
            if is_light(os.path.join(folder, f'{n}.png')):
                entry['d'] = 1
            logos.append(entry)
    return logos, warnings


def render(logos):
    cats = [{'s': s, 'l': l} for s, l in CATEGORIES]
    payload = {'categories': cats, 'logos': logos}
    # One logo per line: a 117-entry array on a single line is unreviewable in a diff,
    # and this block is committed.
    lines = ['{', '"categories": ' + json.dumps(cats, separators=(',', ':')) + ',', '"logos": [']
    lines += ['  ' + json.dumps(x, separators=(',', ':')) + (',' if i < len(logos) - 1 else '')
              for i, x in enumerate(logos)]
    lines += [']', '}']
    return '\n'.join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true', help='report only; exit 1 if stale')
    args = ap.parse_args()

    logos, warnings = collect()
    for w in warnings:
        print('warn  ' + w, file=sys.stderr)
    if not logos:
        print('error: no logos found under assets/logo-library/', file=sys.stderr)
        return 1

    page = open(PAGE, encoding='utf-8').read()
    i, j = page.find(BEGIN), page.find(END, page.find(BEGIN))
    if i < 0 or j < 0:
        print(f'error: could not find the #logo-manifest block in {PAGE}', file=sys.stderr)
        return 1

    block = BEGIN + '\n' + render(logos) + '\n'
    new = page[:i] + block + page[j:]

    counts = {}
    for x in logos:
        counts[CATEGORIES[x['c']][1]] = counts.get(CATEGORIES[x['c']][1], 0) + 1
    summary = ', '.join(f'{v} {k.lower()}' for k, v in counts.items())

    if new == page:
        print(f'ok    logo-library.html is current — {len(logos)} logos ({summary})')
        return 1 if (args.check and warnings) else 0
    if args.check:
        print('stale logo-library.html does not match assets/logo-library/', file=sys.stderr)
        return 1
    open(PAGE, 'w', encoding='utf-8').write(new)
    dark = sum(1 for x in logos if x.get('d'))
    print(f'wrote logo-library.html — {len(logos)} logos ({summary}); '
          f'{dark} flagged as light artwork needing a dark tile')
    return 0


if __name__ == '__main__':
    sys.exit(main())
