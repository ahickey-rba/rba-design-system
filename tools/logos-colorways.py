#!/usr/bin/env python3
"""Build the six files a logo-library entry ships, from one colour vector.

    ./tools/logos-colorways.py clients/toro path/to/toro.svg
    ./tools/logos-colorways.py --from-json replacements.json

WHY THIS EXISTS
---------------
assets/logo-library/README.md tells contributors to "drop the four files into
assets/logo-library/<category>/" — but it never said how to make them, so the
original six-file set was built by an ad-hoc script that did not survive. That is
how the library ended up with hand-cut colorways nobody can reproduce. This is
that step, written down: give it one colour vector and it emits the whole set,
matching the naming contract logos-sync.py and app.js both depend on.

    <name>.svg  <name>.png  <name>-black.svg  <name>-black.png
                            <name>-white.svg  <name>-white.png

TRIMMING
--------
Every viewBox is trimmed tight to the artwork, because the grid sizes logos on
their box and transparent padding makes one tile's mark look smaller than its
neighbour's. There is no bbox API in rsvg, so the artwork is rendered large, the
alpha bounding box is measured in pixels, and that rectangle is mapped back into
user units and written as a new viewBox. Changing a viewBox is a pure crop in user
space, so nested transforms inside the file are unaffected.

THE ONE-COLOUR CUTS
-------------------
Not by recolouring fills. A logo with a baked-in white background would turn into
a solid black rectangle, and the hole in a ring device would fill in. Instead ink
is taken as *opaque and not near-white* and traced as a single flat layer, so
white behaves as knockout — which is what a one-colour logo should do anyway.

Where knocking white out would consume the whole mark (artwork that is white and
nothing else, like the reversed cuts this library inherited), there is nothing to
knock out, so the mark is kept whole and inverts instead.

Requires: rsvg-convert, potrace, numpy, pillow.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(ROOT, 'assets', 'logo-library')

TRIM_PX = 2400      # render height used to measure the artwork's bounding box
TRACE_PX = 2400     # render height used to trace the one-colour cuts
PNG_LONG = 512      # long edge of every PNG the library ships
NEAR_WHITE = 235    # luminance at or above this counts as knockout, not ink


def need(*tools):
    missing = [t for t in tools if not shutil.which(t)]
    if missing:
        sys.exit(f'missing required tool(s): {", ".join(missing)}')


def render(svg, out, height=None, long_edge=None, background=None):
    cmd = ['rsvg-convert']
    if height:
        cmd += ['-h', str(height)]
    if background:
        cmd += ['-b', background]
    cmd += [svg, '-o', out]
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(f'rsvg-convert failed on {svg}: '
                           f'{r.stderr.decode()[:200]}')
    if long_edge:
        fit(out, long_edge)


def fit(png, long_edge):
    """Scale a PNG so its long edge is exactly long_edge, preserving alpha."""
    from PIL import Image
    im = Image.open(png).convert('RGBA')
    w, h = im.size
    s = long_edge / max(w, h)
    im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    im.save(png)


def viewbox(svg_text):
    m = re.search(r'\bviewBox\s*=\s*["\']\s*([-\d.eE]+)[,\s]+([-\d.eE]+)'
                  r'[,\s]+([-\d.eE]+)[,\s]+([-\d.eE]+)\s*["\']', svg_text)
    if not m:
        return None
    return [float(x) for x in m.groups()]


def split_head(svg_text):
    """The root <svg ...> tag and everything after it."""
    start = svg_text.index('<svg')
    end = svg_text.index('>', start)
    return svg_text[:end], svg_text[end:]


# CSS absolute units, in px. Logo files in the wild use pt (Illustrator) and mm
# (Inkscape) as often as px, and a parser that only accepts px silently returns
# None — which is what sent the Python wordmark down the wrong code path.
UNITS = {'': 1.0, 'px': 1.0, 'pt': 96 / 72, 'pc': 16.0,
         'mm': 96 / 25.4, 'cm': 96 / 2.54, 'in': 96.0}


def root_dim(head, attr):
    """(value, unit) of a width/height on the root tag, or None."""
    m = re.search(rf'\b{attr}\s*=\s*["\']\s*([\d.eE+-]+)\s*'
                  rf'(px|pt|pc|mm|cm|in|)\s*["\']', head)
    if not m:
        return None
    try:
        return float(m.group(1)), m.group(2)
    except ValueError:
        return None


def root_px(head, attr):
    """A root width/height converted to px, or None."""
    d = root_dim(head, attr)
    if not d:
        return None
    value, unit = d
    return value * UNITS.get(unit, 1.0)


def set_viewbox(svg_text, box, vb):
    """Crop the root viewBox to box, keeping the aspect width/height encoded.

    A viewBox and a width/height pair need not agree: Commons' Cargill file maps a
    square 194x194 user space onto a 215x96 canvas, so the artwork is deliberately
    stretched. Dropping width/height there squashes the wordmark back to square.
    Scale them by the same proportion as the crop instead, so the non-uniform
    mapping survives.
    """
    head, rest = split_head(svg_text)
    new = 'viewBox="{:.4f} {:.4f} {:.4f} {:.4f}"'.format(*box)
    if re.search(r'\bviewBox\s*=', head):
        head = re.sub(r'\bviewBox\s*=\s*["\'][^"\']*["\']', new, head, count=1)
    else:
        head = head.replace('<svg', '<svg ' + new, 1)

    dw, dh = root_dim(head, 'width'), root_dim(head, 'height')
    if dw and dh and vb and vb[2] and vb[3]:
        # Scale by the same proportion as the crop, keeping the original unit so a
        # file authored in mm or pt stays that size rather than silently becoming px.
        (ow, uw), (oh, uh) = dw, dh
        nw, nh = ow * box[2] / vb[2], oh * box[3] / vb[3]
        head = re.sub(r'\bwidth\s*=\s*["\'][^"\']*["\']',
                      f'width="{nw:.4f}{uw}"', head, count=1)
        head = re.sub(r'\bheight\s*=\s*["\'][^"\']*["\']',
                      f'height="{nh:.4f}{uh}"', head, count=1)
    else:
        # Nothing to preserve: the viewBox alone carries the aspect.
        head = re.sub(r'\s\b(width|height)\s*=\s*["\'][^"\']*["\']', '', head)
    return head + rest


def alpha_bbox(png):
    import numpy as np
    from PIL import Image
    a = np.array(Image.open(png).convert('RGBA'))
    ink = a[:, :, 3] >= 8
    if not ink.any():
        return None
    ys, xs = np.where(ink)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def trim(src_svg, dest_svg):
    """Write src_svg to dest_svg with its viewBox cropped tight to the artwork."""
    text = open(src_svg, encoding='utf-8', errors='replace').read()
    vb = viewbox(text)
    with tempfile.TemporaryDirectory() as td:
        probe = os.path.join(td, 'probe.png')
        render(src_svg, probe, height=TRIM_PX)
        from PIL import Image
        pw, ph = Image.open(probe).size
        bb = alpha_bbox(probe)
    if bb is None:
        shutil.copyfile(src_svg, dest_svg)
        return False
    x0, y0, x1, y1 = bb
    if vb is None:
        # No viewBox: user space is defined by the root width/height, NOT by the
        # size we happened to render at. Reading it as pixel space cropped the
        # Python wordmark (486x144 user units, rendered 8100px wide) to a viewBox
        # of "87 51 7433 2143" — a region entirely outside the artwork, so the
        # file came out blank.
        head, _ = split_head(text)
        ow, oh = root_px(head, 'width'), root_px(head, 'height')
        vb = ([0.0, 0.0, ow, oh] if ow and oh
              else [0.0, 0.0, float(pw), float(ph)])
    vx, vy, vw, vh = vb
    sx, sy = vw / pw, vh / ph
    box = [vx + x0 * sx, vy + y0 * sy, (x1 - x0) * sx, (y1 - y0) * sy]
    # Already tight (within a rendered pixel)? leave the file byte-identical.
    tight = x0 <= 1 and y0 <= 1 and x1 >= pw - 1 and y1 >= ph - 1
    open(dest_svg, 'w', encoding='utf-8').write(
        text if tight else set_viewbox(text, box, vb))
    return not tight


def ink_mask(png):
    """(mask, inverted) — True where the one-colour cut should put ink.

    Ink is opaque and not near-white, so white reads as knockout. If that leaves
    nothing, the artwork is a reversed cut with no dark content at all, and the
    whole silhouette becomes the ink instead.
    """
    import numpy as np
    from PIL import Image
    a = np.array(Image.open(png).convert('RGBA'))
    rgb, alpha = a[:, :, :3].astype(float), a[:, :, 3]
    opaque = alpha >= 128
    lum = (0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2])
    mask = opaque & (lum < NEAR_WHITE)
    if mask.sum() < 0.02 * max(1, opaque.sum()):
        return opaque, True
    return mask, False


def trace(mask, dest_svg, fill):
    """potrace a boolean mask into a flat single-colour SVG."""
    import numpy as np
    from PIL import Image
    h, w = mask.shape
    # potrace treats black as ink; PBM wants 1 = black
    img = Image.fromarray(np.where(mask, 0, 255).astype('uint8'), 'L').convert('1')
    with tempfile.TemporaryDirectory() as td:
        pbm = os.path.join(td, 'm.pbm')
        raw = os.path.join(td, 'm.svg')
        img.save(pbm)
        r = subprocess.run(['potrace', '-s', '-o', raw, '--flat',
                            '--turdsize', '2', '--alphamax', '1.0',
                            '--opttolerance', '0.2', pbm], capture_output=True)
        if r.returncode != 0:
            raise RuntimeError(f'potrace failed: {r.stderr.decode()[:200]}')
        text = open(raw, encoding='utf-8').read()

    # potrace emits pt-based width/height plus a black fill; normalise both so the
    # file behaves like every other vector in the library.
    text = re.sub(r'\s\b(width|height)\s*=\s*["\'][^"\']*["\']', '', text, count=2)
    if 'viewBox' not in text:
        text = text.replace('<svg', f'<svg viewBox="0 0 {w} {h}"', 1)
    text = re.sub(r'fill\s*=\s*["\']#?0000?0?0?["\']', f'fill="{fill}"', text)
    if 'fill=' not in text:
        text = text.replace('<g ', f'<g fill="{fill}" ', 1)
    text = re.sub(r'<!--.*?-->', '', text, flags=re.S)
    open(dest_svg, 'w', encoding='utf-8').write(text)


def build(slug, src, dry=False):
    category, name = slug.split('/', 1)
    outdir = os.path.join(LIB, category)
    os.makedirs(outdir, exist_ok=True)
    made = []

    with tempfile.TemporaryDirectory() as td:
        colour = os.path.join(outdir, f'{name}.svg')
        staged = os.path.join(td, 'colour.svg')
        cropped = trim(src, staged)

        big = os.path.join(td, 'big.png')
        render(staged, big, height=TRACE_PX)
        mask, inverted = ink_mask(big)

        black = os.path.join(td, 'black.svg')
        white = os.path.join(td, 'white.svg')
        trace(mask, black, '#000000')
        trace(mask, white, '#ffffff')

        targets = [
            (staged, colour),
            (black, os.path.join(outdir, f'{name}-black.svg')),
            (white, os.path.join(outdir, f'{name}-white.svg')),
        ]
        if dry:
            print(f'  would write {len(targets)} svg + 3 png  '
                  f'(trimmed={cropped}, inverted={inverted})')
            return []
        for a, b in targets:
            shutil.copyfile(a, b)
            made.append(b)
        for svg in [t[1] for t in targets]:
            png = svg[:-4] + '.png'
            render(svg, png, height=PNG_LONG * 3, long_edge=PNG_LONG)
            made.append(png)

    return made


def main():
    need('rsvg-convert', 'potrace')
    try:
        import numpy, PIL  # noqa: F401
    except ImportError:
        sys.exit('needs numpy and pillow: pip install numpy pillow')

    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('slug', nargs='?', help='e.g. clients/toro')
    ap.add_argument('source', nargs='?', help='colour SVG to build from')
    ap.add_argument('--from-json', help='{slug: {src: path}} batch file')
    ap.add_argument('--base', default='.', help='resolve JSON src paths against this')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    jobs = []
    if a.from_json:
        spec = json.load(open(a.from_json))
        for slug, s in spec.items():
            if slug.startswith('_'):
                continue
            jobs.append((slug, os.path.join(a.base, s['src'])))
    elif a.slug and a.source:
        jobs.append((a.slug, a.source))
    else:
        ap.error('give a slug and source, or --from-json')

    total = 0
    for slug, src in jobs:
        if not os.path.exists(src):
            print(f'{slug:<48} ! missing source {src}')
            continue
        try:
            made = build(slug, src, dry=a.dry_run)
        except Exception as e:
            print(f'{slug:<48} ! {type(e).__name__}: {e}')
            continue
        total += len(made)
        print(f'{slug:<48} {len(made)} file(s)')
    print(f'\n{total} files written')


if __name__ == '__main__':
    main()
