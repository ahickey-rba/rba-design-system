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

A mid-tone plate carrying a name — the PMP and PMI-ACP badges — is neither ink nor
white, and filling it loses the only part of the badge that says which badge it is.
`--plate-above` knocks out mid-tones the flood cannot reach from outside the mark,
so a sealed name plate opens up while a gradient running off the edge stays whole.

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


def otsu(values):
    """Luminance threshold that best splits values into two clusters."""
    import numpy as np
    hist, edges = np.histogram(values, bins=64, range=(0, 255))
    total = hist.sum()
    if total == 0:
        return 128.0
    centres = (edges[:-1] + edges[1:]) / 2
    cw, cm = np.cumsum(hist), np.cumsum(hist * centres)
    best, thr = -1.0, 128.0
    for i in range(1, 64):
        w0 = cw[i] / total
        if w0 <= 0 or w0 >= 1:
            continue
        m0 = cm[i] / cw[i]
        m1 = (cm[-1] - cm[i]) / (total - cw[i])
        var = w0 * (1 - w0) * (m0 - m1) ** 2
        if var > best:
            best, thr = var, float(centres[i])
    return thr


def reach_from_border(free):
    """Which cells of `free` a flood starting at the image border can get to.

    The one primitive behind both enclosure questions this file asks: what is sealed
    inside the mark, and what has a path out to the edge. A BFS rather than a scipy
    label call, to keep the dependency list at numpy and pillow.
    """
    import numpy as np
    from collections import deque

    h, w = free.shape
    seen = np.zeros_like(free, dtype=bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if free[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if free[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and free[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    return seen


def shrink_all(mask, step):
    """Downscale `mask` by `step`, keeping a cell True only if every pixel in it is.

    Subsampling with mask[::step, ::step] is wrong for a region the flood must not
    escape: it can drop a one-pixel ink barrier and let the fill leak into a sealed
    plate. Requiring the whole block keeps every barrier, so the flood errs towards
    calling things sealed-off rather than reachable.
    """
    import numpy as np
    if step < 2:
        return mask
    h, w = mask.shape
    ph, pw = -h % step, -w % step
    if ph or pw:
        mask = np.pad(mask, ((0, ph), (0, pw)), constant_values=False)
    H, W = mask.shape
    return mask.reshape(H // step, step, W // step, step).all(axis=(1, 3))


def enclosed_fraction(inner, outer):
    """What fraction of `inner` is sealed inside `outer` rather than open to the edge.

    Flood-fills the not-`outer` region inward from the image border; anything in
    `inner` the flood cannot reach is enclosed. This is what separates a knockout
    from a plain two-tone mark: JavaScript's black JS is completely ringed by its
    yellow tile, while CISSP's black lettering sits beside its teal bracket with a
    clear path out to the edge. Majority-of-area alone cannot tell those apart.
    """
    h, w = outer.shape
    step = max(1, max(h, w) // 320)          # downscale: enclosure is a coarse property
    o = outer[::step, ::step]
    i = inner[::step, ::step]
    if not i.any():
        return 0.0
    seen = reach_from_border(~o)
    return float((i & ~seen).sum()) / float(i.sum())


def dilate(mask, radius):
    """Grow a boolean mask by radius pixels (PIL MaxFilter, no scipy needed)."""
    import numpy as np
    from PIL import Image, ImageFilter
    if radius < 1:
        return mask
    size = radius * 2 + 1
    im = Image.fromarray(np.where(mask, 255, 0).astype('uint8'), 'L')
    # MaxFilter caps at size 5 per pass in some builds; iterate for larger radii.
    while size > 5:
        im = im.filter(ImageFilter.MaxFilter(5))
        size -= 4
    if size > 1:
        im = im.filter(ImageFilter.MaxFilter(size))
    return np.array(im) > 127


def knock_out_plates(png, mask, plate_above):
    """Knock the sealed mid-tone plates out of an already-computed ink mask.

    The PMI badges are the case this exists for. Each is a dark disc carrying a
    light rounded plate with the certification name on it — PMP, PMI-ACP — and the
    name is the one part of the badge that identifies it. The flat rule calls
    everything below NEAR_WHITE ink, so the plate fills solid and takes the name
    down with it: both badges came out as featureless black discs.

    A plain luminance cut cannot fix that. PMI-ACP's disc is a brown-to-tan gradient
    whose bottom is #be9577 — the exact tone of the plate it carries — so any
    threshold low enough to knock the plate out also erases the bottom of the disc
    and the word PRACTITIONER with it.

    What separates them is not tone but position. The plate is sealed inside the
    ink; the gradient runs off the edge of the disc into open space. So a mid-tone
    is treated as a plate only where the flood cannot reach it from outside the
    mark, and the tone threshold just says which mid-tones are candidates. Glyphs
    sitting on the plate are darker than it, so they stay ink and read as the plate's
    own lettering — which is the whole point.
    """
    import numpy as np
    from PIL import Image
    a = np.array(Image.open(png).convert('RGBA'))
    rgb = a[:, :, :3].astype(float)
    lum = (0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2])

    mid = mask & (lum >= plate_above)
    if not mid.any():
        raise SystemExit(f'--plate-above {plate_above:g} matches no ink — '
                         f'check the value against the artwork')

    # Free = anything that is not solid ink, so the flood runs through the
    # background and through candidate plates but stops at darker ink.
    free = ~mask | mid
    h, w = free.shape
    step = max(1, max(h, w) // 800)
    seen = reach_from_border(shrink_all(free, step))
    if step > 1:
        seen = np.array(Image.fromarray((seen * 255).astype('uint8'), 'L')
                        .resize((w, h), Image.NEAREST)) > 127
    return mask & ~(mid & ~seen)


def gap_mask(png, gap_colour, gap_px):
    """Ink with a hairline knockout gap where gap_colour overlaps everything else.

    Banner Bank is the case this exists for. Its navy wordmark sits *on top of* a red
    swoosh, and in one colour both become the same ink, so the leading B is swallowed
    and the mark reads "ANNER BANK". Luminance cannot separate them either — the navy
    is 82 and the red is 95, near enough to land in the same cluster.

    So the caller names the colour of the element that sits on top. That element is
    dilated and subtracted from the rest, leaving the thin knockout outline a designer
    would draw by hand for a one-colour cut, and the wordmark stays legible.
    """
    import numpy as np
    from PIL import Image
    a = np.array(Image.open(png).convert('RGBA'))
    rgb, alpha = a[:, :, :3].astype(int), a[:, :, 3]
    opaque = alpha >= 128
    lum = (0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2])
    ink = opaque & (lum < NEAR_WHITE)

    target = np.array([int(gap_colour[i:i + 2], 16) for i in (1, 3, 5)])
    dist = np.sqrt(((rgb - target) ** 2).sum(axis=2))
    top = ink & (dist <= 60)
    if top.sum() < 0.005 * max(1, ink.sum()):
        raise SystemExit(f'--gap-colour {gap_colour} matches almost nothing '
                         f'({top.sum()} px) — check the colour against the artwork')
    rest = ink & ~top
    return (rest & ~dilate(top, gap_px)) | top


def ink_mask(png, knockout=False):
    """(mask, mode) — True where the one-colour cut should put ink.

    'flat' — the default. Ink is opaque and not near-white, so white reads as
    knockout, which is what keeps the hole in the Sitecore ring and the reversed
    lettering in the Toro badge.

    'inverted' — the artwork is white and nothing else (the reversed cuts this
    library inherited). There is nothing to knock out, so the whole silhouette
    becomes the ink and the mark inverts.

    'knockout' — only when asked for. A dark glyph inside a *mid-tone* field:
    JavaScript is the case, black JS on a yellow tile. Yellow is not near-white, so
    the flat rule calls the whole tile ink and the black cut comes out a featureless
    square. Here the field becomes the ink and the glyph is punched out of it.

    WHY THIS IS A FLAG AND NOT AUTOMATIC
    ------------------------------------
    It was automatic first, gated on "the light region is the majority, contrasts
    strongly, and encloses the dark region". That correctly caught JavaScript and
    correctly left CISSP and OutFront Minnesota alone — their lettering sits beside
    a device rather than inside it, so the enclosure test failed. But it also fired
    on `umbraco-platinum-partner-badge`, whose light card genuinely does enclose its
    U and wordmark, and knocking those out left a near-blank tile with only the word
    PLATINUM.

    No purely geometric test separates "glyph reversed out of a plate" from "logo
    composed on a card" — that is a question about meaning. So the caller decides,
    and `--report` prints which logos look like candidates.
    """
    import numpy as np
    from PIL import Image
    a = np.array(Image.open(png).convert('RGBA'))
    rgb, alpha = a[:, :, :3].astype(float), a[:, :, 3]
    opaque = alpha >= 128
    lum = (0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2])
    total = max(1, opaque.sum())

    if knockout:
        thr = otsu(lum[opaque])
        light = opaque & (lum >= thr)
        if light.any():
            return light, 'knockout'
        return opaque, 'inverted'

    mask = opaque & (lum < NEAR_WHITE)
    if mask.sum() < 0.02 * total:
        return opaque, 'inverted'
    return mask, 'flat'


def knockout_candidate(png):
    """Whether this artwork looks like a glyph reversed out of a mid-tone field.

    Advisory only — see ink_mask. Returns (bool, why).
    """
    import numpy as np
    from PIL import Image
    a = np.array(Image.open(png).convert('RGBA'))
    rgb, alpha = a[:, :, :3].astype(float), a[:, :, 3]
    opaque = alpha >= 128
    lum = (0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2])
    total = max(1, opaque.sum())
    if (opaque & (lum < NEAR_WHITE)).sum() <= 0.97 * total:
        return False, 'white already knocks something out'
    thr = otsu(lum[opaque])
    dark, light = opaque & (lum < thr), opaque & (lum >= thr)
    if not (dark.any() and light.any()):
        return False, 'single tone'
    fd, fl = dark.sum() / total, light.sum() / total
    gap = lum[light].mean() - lum[dark].mean()
    if fl < 0.55:
        return False, f'dark is the majority ({fd:.0%}) — the dark IS the mark'
    if fd < 0.04:
        return False, f'dark is negligible ({fd:.1%})'
    if gap < 70:
        return False, f'weak contrast (gap {gap:.0f})'
    enc = enclosed_fraction(dark, light)
    if enc < 0.80:
        return False, f'dark not enclosed by the field ({enc:.0%})'
    return True, (f'light field {fl:.0%}, enclosed dark {fd:.0%} at {enc:.0%} — '
                  f'would fill the field and punch the glyph out')


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


def build(slug, src, dry=False, knockout=False, gap_colour=None, gap_px=6,
          plate_above=None):
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
        if gap_colour:
            mask, mode = gap_mask(big, gap_colour, gap_px), 'gap'
        else:
            mask, mode = ink_mask(big, knockout=knockout)
        if plate_above is not None:
            mask, mode = knock_out_plates(big, mask, plate_above), mode + '+plate'
        if not knockout:
            cand, why = knockout_candidate(big)
            if cand:
                print(f'  NOTE {slug}: looks like a knockout — {why}.\n'
                      f'       Rebuild with --knockout if the glyph should punch '
                      f'through the field.')

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
                  f'(trimmed={cropped}, mode={mode})')
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
    ap.add_argument('--from-json', help='{slug: {src: path, knockout: bool}} batch file')
    ap.add_argument('--base', default='.', help='resolve JSON src paths against this')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--knockout', action='store_true',
                    help='fill the mid-tone field and punch the glyph out of it, '
                         'for artwork like JavaScript (black JS on a yellow tile) '
                         'whose one-colour cut would otherwise be a solid block')
    ap.add_argument('--gap-colour', '--gap-color', dest='gap_colour',
                    help='hex fill of the element that sits ON TOP of the others '
                         '(e.g. #0260af for Banner Bank\'s wordmark). The one-colour '
                         'cuts get a hairline knockout gap around it, so an overlap '
                         'stays legible once the colours are gone')
    ap.add_argument('--plate-above', dest='plate_above', type=float,
                    help='luminance (0-255) at or above which a mid-tone SEALED '
                         'inside the ink is a plate carrying a glyph, and is knocked '
                         'out rather than filled (e.g. 100 for the PMP badge, whose '
                         'name plate would otherwise vanish into a solid disc). '
                         'Mid-tones open to the outside are left alone, so a '
                         'gradient running off the edge of the mark survives')
    ap.add_argument('--gap-px', dest='gap_px', type=int, default=6,
                    help='width of that gap, in pixels of the 2400px trace render')
    ap.add_argument('--report', action='store_true',
                    help='say which of the shipped logos look like --knockout '
                         'candidates, and change nothing')
    a = ap.parse_args()

    if a.report:
        return report()

    jobs = []
    if a.from_json:
        spec = json.load(open(a.from_json))
        for slug, s in spec.items():
            if slug.startswith('_'):
                continue
            jobs.append((slug, os.path.join(a.base, s['src']),
                         bool(s.get('knockout', a.knockout)),
                         s.get('gap_colour', a.gap_colour),
                         int(s.get('gap_px', a.gap_px)),
                         s.get('plate_above', a.plate_above)))
    elif a.slug and a.source:
        jobs.append((a.slug, a.source, a.knockout, a.gap_colour, a.gap_px,
                     a.plate_above))
    else:
        ap.error('give a slug and source, or --from-json, or --report')

    total = 0
    for slug, src, knock, gapc, gappx, plate in jobs:
        if not os.path.exists(src):
            print(f'{slug:<48} ! missing source {src}')
            continue
        try:
            made = build(slug, src, dry=a.dry_run, knockout=knock,
                         gap_colour=gapc, gap_px=gappx, plate_above=plate)
        except Exception as e:
            print(f'{slug:<48} ! {type(e).__name__}: {e}')
            continue
        total += len(made)
        print(f'{slug:<48} {len(made)} file(s)'
              + ('  [knockout]' if knock else '')
              + (f'  [gap {gapc}]' if gapc else '')
              + (f'  [plate {plate:g}]' if plate is not None else ''))
    print(f'\n{total} files written')


def report():
    """Name the shipped logos whose one-colour cuts may want --knockout.

    Advisory by design: the geometry cannot tell a glyph reversed out of a plate
    from a logo composed on a card, and getting that wrong blanks the tile.
    """
    import csv
    manifest = os.path.join(LIB, 'MANIFEST.csv')
    if not os.path.exists(manifest):
        sys.exit('no MANIFEST.csv — run tools/logos-sync.py first')
    rows = [r for r in csv.DictReader(open(manifest))
            if not r['category'].startswith('_') and r['color_png']]
    hits = []
    for r in rows:
        svg = os.path.join(LIB, r['category'], r['logo'] + '.svg')
        if not os.path.exists(svg):
            continue
        with tempfile.TemporaryDirectory() as td:
            png = os.path.join(td, 'p.png')
            try:
                render(svg, png, height=1200)
            except Exception:
                continue
            cand, why = knockout_candidate(png)
        if cand:
            hits.append((f"{r['category']}/{r['logo']}", why))
    print(f'checked {len(rows)} logos\n')
    if not hits:
        print('no knockout candidates')
        return
    for slug, why in hits:
        print(f'{slug}\n    {why}')
    print('\nReview each by eye before rebuilding: a mark composed ON a light card '
          '\nlooks identical to this test but must NOT be knocked out.')


if __name__ == '__main__':
    main()
