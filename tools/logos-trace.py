#!/usr/bin/env python3
"""Trace a raster logo into a layered colour SVG.

    ./tools/logos-trace.py source.png out.svg
    ./tools/logos-trace.py source.png out.svg --colors 3 --kill-white

The companion to logos-colorways.py: that one needs a colour vector to start from,
and this makes one when the owner publishes no vector at all. Banner Bank ships a
base64 PNG inside an SVG wrapper; The Toro Company ships PNG only. Both still need
to become vectors.

HOW
---
Per colour, not per pixel. The artwork is quantised to the handful of colours
actually in it, each colour is traced as its own bitmap with `potrace`, and the
layers are stacked cumulatively — every layer carries the union of itself and all
the colours above it — so adjacent colours meet with no hairline seam between them.
Alpha gates every mask, so a mark on transparency stays on transparency.

--kill-white removes an opaque white background before tracing, feathering the
anti-aliased edge it leaves behind, so no white halo survives. Use it when the
source has a baked-in white field rather than real transparency. Without it, white
is treated as artwork, which is correct for a mark that genuinely contains white.

Requires: potrace, numpy, pillow.
"""

import argparse
import os
import re
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

UPSCALE_TO = 2000        # trace above native resolution so curves stay smooth
WHITE_CUT = 246          # at or above this luminance counts as background
FEATHER_ALPHA = 110      # drop edge pixels left translucent by the flood fill


def load(path, kill_white):
    """(native, upscaled) RGBA arrays, with any white field removed from both.

    The palette has to be read off the native pixels. Upscaling first means
    resampling invents thousands of intermediate shades, and a quantiser handed
    those returns their average — which is how Banner Bank's #0260af navy and
    #ee3742 red came back as a muddy #6290c0 and #994265.
    """
    im = Image.open(path).convert('RGBA')
    a = np.array(im)
    if kill_white:
        rgb, al = a[:, :, :3].astype(float), a[:, :, 3]
        lum = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
        a[(al >= 8) & (lum >= WHITE_CUT)] = (0, 0, 0, 0)
        # The fill leaves a rim of half-white pixels; they read as a halo.
        a[(a[:, :, 3] > 0) & (a[:, :, 3] < FEATHER_ALPHA)] = (0, 0, 0, 0)
        im = Image.fromarray(a)
    native = np.array(im)
    w, h = im.size
    s = UPSCALE_TO / max(w, h)
    big = (np.array(im.resize((round(w * s), round(h * s)), Image.LANCZOS))
           if s > 1 else native)
    return native, big


def palette(a, n, min_sep=64):
    """The n true colours of the artwork, most used first.

    Frequency of exact values among fully-opaque pixels, then a minimum-separation
    sweep so the winners are distinct hues rather than n samples of one gradient.
    Antialiased pixels are individually rare, so counting exact values ignores them
    where averaging would be dragged around by them.
    """
    solid = a[:, :, 3] >= 250
    if solid.sum() < 16:                      # thin or soft artwork: relax
        solid = a[:, :, 3] >= 128
    if not solid.any():
        sys.exit('source has no opaque pixels')
    px = a[:, :, :3][solid].reshape(-1, 3).astype(int)
    vals, counts = np.unique(px, axis=0, return_counts=True)
    picked = []
    for i in np.argsort(-counts):
        c = vals[i]
        if all(((c - np.array(p)) ** 2).sum() >= min_sep ** 2 for p in picked):
            picked.append(tuple(int(x) for x in c))
        if len(picked) == n:
            break
    return picked


def trace(mask, fill):
    h, w = mask.shape
    img = Image.fromarray(np.where(mask, 0, 255).astype('uint8'), 'L').convert('1')
    with tempfile.TemporaryDirectory() as td:
        pbm, svg = os.path.join(td, 'm.pbm'), os.path.join(td, 'm.svg')
        img.save(pbm)
        r = subprocess.run(['potrace', '-s', '-o', svg, '--flat', '--turdsize', '2',
                            '--alphamax', '1.0', '--opttolerance', '0.2', pbm],
                           capture_output=True)
        if r.returncode != 0:
            sys.exit('potrace: ' + r.stderr.decode()[:200])
        text = open(svg, encoding='utf-8').read()
    m = re.search(r'(<g[^>]*>.*?</g>)', text, re.S)
    if not m:
        return None
    g = re.sub(r'fill\s*=\s*["\']#?0{3,6}["\']', f'fill="{fill}"', m.group(1))
    if 'fill=' not in g.split('>', 1)[0]:
        g = g.replace('<g', f'<g fill="{fill}"', 1)
    return g


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('source')
    ap.add_argument('out')
    ap.add_argument('--colors', type=int, default=4)
    ap.add_argument('--kill-white', action='store_true',
                    help='treat an opaque white field as background, not artwork')
    ap.add_argument('--min-sep', type=int, default=64,
                    help='how far apart palette colours must be (RGB distance)')
    a = ap.parse_args()

    native, arr = load(a.source, a.kill_white)
    h, w = arr.shape[:2]
    op = arr[:, :, 3] >= 128
    cols = palette(native, a.colors, a.min_sep)
    print(f'{w}x{h}, {op.sum()} opaque px, palette: '
          + ' '.join('#%02x%02x%02x' % c for c in cols))

    rgb = arr[:, :, :3].astype(int)
    # Assign every opaque pixel to its nearest palette entry.
    d = np.stack([((rgb - np.array(c)) ** 2).sum(axis=2) for c in cols], axis=0)
    nearest = d.argmin(axis=0)

    # Darkest last so fine dark detail (lettering, outlines) draws on top.
    lum = [0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] for c in cols]
    order = sorted(range(len(cols)), key=lambda i: -lum[i])

    layers = []
    for pos, ci in enumerate(order):
        # Cumulative: this colour plus everything drawn after it, so edges butt.
        members = order[pos:]
        mask = op & np.isin(nearest, members)
        if mask.sum() < 0.001 * op.sum():
            continue
        g = trace(mask, '#%02x%02x%02x' % cols[ci])
        if g:
            layers.append(g)
            print(f'  layer #{"%02x%02x%02x" % cols[ci]}  {mask.sum()} px')

    if not layers:
        sys.exit('nothing traced')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">\n'
           + '\n'.join(layers) + '\n</svg>\n')
    open(a.out, 'w', encoding='utf-8').write(svg)
    print(f'wrote {a.out} ({len(svg)} bytes, {len(layers)} layers)')


if __name__ == '__main__':
    main()
