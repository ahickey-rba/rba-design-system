#!/usr/bin/env python3
"""Add an image to the shortlist by pasting the URL of its page.

    ./tools/images-add.py <url> [<url> ...]
    ./tools/images-add.py --cat "Data, AI & security" <url> <url>
    ./tools/images-add.py --replace adobe-456373844.webp <url>

Paste the address bar. That is the whole interface. For each URL this works out
which service it is, reads the title, contributor and preview image off the page,
downloads the preview into assets/images/shortlist/, writes the entry into
library.json and regenerates the page.

    ./tools/images-add.py https://elements.envato.com/item-9Z4YMDX
    ./tools/images-add.py https://unsplash.com/photos/some-slug-64YrPKiguAE
    ./tools/images-add.py https://www.pexels.com/photo/two-people-1181244/

WHY IT WORKS ON SITES NOBODY WROTE CODE FOR
-------------------------------------------
Every stock site publishes Open Graph tags so its pages preview nicely when shared
on social media: og:title, og:image, usually an author. That metadata is the same
metadata this library needs, it is on every item page, and it is served to anyone
without a session. So the importer is generic — it reads the tags, not the site.
A service it has never seen still works; it just falls back to the domain name for
the label and asks you to fill in the licence line once.

ADOBE STOCK, WITHOUT AN API KEY
-------------------------------
Adobe returns 403 to any scripted request for an item PAGE — every user agent,
every header combination, and the oembed endpoint too. Its image CDN, however,
has no check of any kind: a plain GET with no user agent and no referer returns
the watermarked comp.

So paste the IMAGE address instead of the page address. On the Adobe Stock page,
right-click the preview and choose "Copy image address":

    ./tools/images-add.py --cat Technology --title "Two engineers at a whiteboard" \
      "https://as2.ftcdn.net/jpg/19/04/00/09/1000_F_1904000970_WvhiNxc....webp"

The id is in that filename, so the entry and its link back to Adobe are rebuilt
from it. Only the title has to be supplied, because the CDN serves an image and
not a page to read one off.

REPLACING RATHER THAN ADDING
----------------------------
    ./tools/images-add.py --replace adobe-456373844.webp <url-of-something-better>

Takes the old entry's place in the running order, inherits its category, and
deletes the old file. That is the operation you actually do when improving a
library — "this one, but better" — and doing it by hand means editing two files
and remembering to keep the position.
"""

import argparse
import html
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(ROOT, 'assets', 'images', 'library.json')
SHOTS = os.path.join(ROOT, 'assets', 'images', 'shortlist')
SYNC = os.path.join(ROOT, 'tools', 'images-sync.py')

UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/124.0 Safari/537.36')

# host fragment -> (source key, display name, tier, licence line)
# Only used to give a known service a proper label and licence. Anything not here
# still imports; it just gets a name derived from the domain and a TODO licence.
KNOWN = {
    'elements.envato.com': ('envato', 'Envato Elements', 'subscription',
                            'Covered by the RBA subscription — licensed on download, usable in production.'),
    'unsplash.com':        ('unsplash', 'Unsplash', 'free',
                            'Unsplash Licence — free for commercial use, no attribution required.'),
    'pexels.com':          ('pexels', 'Pexels', 'free',
                            'Pexels Licence — free for commercial use, no attribution required.'),
    'pixabay.com':         ('pixabay', 'Pixabay', 'free',
                            'Pixabay Content Licence — free for commercial use.'),
    'stocksy.com':         ('stocksy', 'Stocksy United', 'paid',
                            'Not licensed. Royalty-free or rights-managed, priced per image.'),
    'istockphoto.com':     ('istock', 'iStock', 'paid',
                            'Not licensed. Credit or subscription required before use.'),
    'gettyimages.com':     ('getty', 'Getty Images', 'paid',
                            'Not licensed. Rights-managed; clear the intended use before buying.'),
    'shutterstock.com':    ('shutterstock', 'Shutterstock', 'paid',
                            'Not licensed. Subscription or credits required before use.'),
    'freepik.com':         ('freepik', 'Freepik', 'subscription',
                            'Covered by a Freepik subscription — check the plan before shipping.'),
    'stock.adobe.com':     ('adobe', 'Adobe Stock', 'paid',
                            'Watermarked comp. Evaluation only until licensed.'),
}

BLOCKED = {'stock.adobe.com': (
    'Adobe Stock returns 403 to scripted requests for the PAGE — but not for the '
    'image itself.\n'
    '  Open the image on Adobe Stock, right-click the preview, "Copy image '
    'address", and paste THAT here instead. It looks like\n'
    '  https://as2.ftcdn.net/jpg/.../1000_F_<id>_<hash>.webp\n'
    '  Add --title "..." to save filling it in afterwards.')}

# Adobe's watermarked comp, served straight off their CDN as
# 1000_F_<id>_<hash>.webp. The hash cannot be derived from the id, which is why
# the id alone is not enough — but the CDN itself has no UA, referer or session
# check, so once you have the URL the download is a plain GET. That is the whole
# trick: Adobe defends the HTML page and leaves the image open.
FTCDN = re.compile(r'/\d+_F_(\d+)_[A-Za-z0-9]+\.(?:webp|jpe?g|png)', re.I)

# The one URL shape that resolves on Adobe Stock when all you have is an id.
ADOBE_PAGE = 'https://stock.adobe.com/images/x/%s'

# iStock needs no special case: unlike Adobe, its item pages answer a scripted
# request, so the ordinary og: route handles them. Paste the item URL, not the
# image URL — an iStock item link carries TWO numbers (…-gm<id>-<asset>) and only
# the first is in the CDN path, so a link rebuilt from the image address 404s.


def get(url, binary=False):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    return data if binary else data.decode('utf-8', 'replace')


def meta(doc, prop):
    for pat in (r'<meta[^>]+(?:property|name)=["\']%s["\'][^>]+content=["\']([^"\']+)',
                r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']%s["\']'):
        m = re.search(pat % re.escape(prop), doc, re.I)
        if m:
            return html.unescape(m.group(1))
    return None


def identify(url):
    host = urllib.parse.urlparse(url).netloc.lower().lstrip('www.')
    for frag, info in KNOWN.items():
        if host.endswith(frag) or frag.endswith(host):
            return info
    # Unknown service: derive a usable key from the domain and let the sync's
    # validation prompt for the licence line rather than inventing one.
    key = re.sub(r'[^a-z0-9]', '', host.split('.')[0]) or 'stock'
    return (key, host, 'paid', 'TODO licence terms for %s' % host)


def item_id(url, source):
    """A stable id from the URL. Every one of these sites puts it in the path."""
    path = urllib.parse.urlparse(url).path.rstrip('/')
    last = path.split('/')[-1]
    if source == 'envato':                      # item-9Z4YMDX or slug-words-9Z4YMDX
        m = re.search(r'([A-Z0-9]{6,10})$', last)
        return m.group(1) if m else last
    if source == 'unsplash':                    # long-slug-<id>
        m = re.search(r'([A-Za-z0-9_-]{11})$', last)
        return m.group(1) if m else last
    if source == 'pexels':                      # words-<digits>
        m = re.search(r'(\d+)$', last)
        return m.group(1) if m else last
    m = re.search(r'(\d{5,})', last)            # most others end in a numeric id
    return m.group(1) if m else re.sub(r'[^A-Za-z0-9_-]', '-', last)[:40]


def contributor(doc):
    for pat in (r'"author"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"',
                r'"author"\s*:\s*"([^"]+)"',
                r'/user/([A-Za-z0-9_-]+)',
                r'/@([A-Za-z0-9_-]+)'):
        for hit in re.findall(pat, doc):
            if hit.lower() not in ('envato', 'unsplash', 'pexels', 'pixabay'):
                return hit
    return ''


def title_from_slug(url):
    """Most of these sites put a human-readable slug in the path. Not as good as
    og:title, but a great deal better than 'TODO title'."""
    last = urllib.parse.urlparse(url).path.rstrip('/').split('/')[-1]
    last = re.sub(r'-[A-Za-z0-9_-]{6,}$', '', last)     # trailing id
    last = re.sub(r'-\d+$', '', last)
    words = [w for w in last.split('-') if w and not w.isdigit()]
    return ' '.join(words).capitalize() if words else ''


def scrape(url, title_override=None):
    # A direct Adobe comp URL. No page fetch at all: the id is in the filename and
    # the canonical page can be rebuilt from it, so this route sidesteps the 403
    # entirely and needs no API key.
    m = FTCDN.search(url)
    if m and 'ftcdn' in url:
        ident = m.group(1)
        meta_ = KNOWN['stock.adobe.com']
        return {'source': meta_[0], 'sourceName': meta_[1], 'tier': meta_[2],
                'licence': meta_[3], 'id': ident,
                # /images/<slug>/<id>, NOT /images/<id> — Adobe answers the second
                # form with "Sorry, that page doesn't exist". The slug is not checked
                # against anything, so a literal "x" stands in for the one we cannot
                # read off a CDN filename. This route built the short form for a long
                # time and every link it wrote was dead; images-sync.py --check now
                # fails on the short form so it cannot come back quietly.
                'url': ADOBE_PAGE % ident,
                'title': title_override or 'TODO title', 'by': '', 'preview': url}

    source, name, tier, licence = identify(url)
    host = urllib.parse.urlparse(url).netloc.lower().lstrip('www.')
    if host in BLOCKED:
        raise RuntimeError(BLOCKED[host])

    ident = item_id(url, source)
    try:
        doc = get(url)
    except urllib.error.HTTPError as exc:
        # Several sites answer a plain scripted GET with 401/403 even though the
        # page is public in a browser — Unsplash and Pexels both do. Where the
        # service exposes a direct download that is NOT gated, use it and take the
        # metadata from the URL instead of the page. Worse metadata, real image.
        if source == 'unsplash':
            return {'source': source, 'sourceName': name, 'tier': tier,
                    'licence': licence, 'id': ident, 'url': url,
                    'title': title_from_slug(url) or 'TODO title', 'by': '',
                    'preview': 'https://unsplash.com/photos/%s/download?w=1400' % ident}
        raise RuntimeError(
            '%s returned %s to a scripted request. The page is public in a browser '
            'but not to this script. Save the preview by hand into '
            'assets/images/shortlist/ as %s-%s.webp, then run '
            './tools/images-sync.py --adopt.' % (name, exc.code, source, ident))

    img = meta(doc, 'og:image')
    if not img:
        raise RuntimeError('no og:image on that page — is it an item page rather '
                           'than a search result?')
    title = meta(doc, 'og:title') or ''
    title = re.split(r'\s+Stock Photo|\s+·\s+Free Stock Photo|\s+-\s+Envato|\s+\|\s+', title)[0].strip()
    return {'source': source, 'sourceName': name, 'tier': tier, 'licence': licence,
            'id': ident, 'url': url, 'title': title or title_from_slug(url) or 'TODO title',
            'by': contributor(doc), 'preview': img}


def stage(info):
    raw = get(info['preview'], binary=True)
    base = '%s-%s' % (info['source'], info['id'])
    try:
        from PIL import Image
        import io
        im = Image.open(io.BytesIO(raw)).convert('RGB')
        out = os.path.join(SHOTS, base + '.webp')
        im.save(out, 'WEBP', quality=82, method=6)
        return os.path.basename(out), '%d x %d' % im.size
    except ImportError:
        out = os.path.join(SHOTS, base + '.jpg')
        with open(out, 'wb') as fh:
            fh.write(raw)
        return os.path.basename(out), 'unknown'


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('urls', nargs='+', help='item page URLs, pasted from the address bar')
    ap.add_argument('--cat', help='category for the new entries')
    ap.add_argument('--replace', metavar='FILE',
                    help='take this entry\'s place and delete its file')
    ap.add_argument('--title', help='set the title (the CDN route cannot read one)')
    # There was a --status here, defaulting to "undecided", and it outlived the
    # decision system it belonged to by long enough to be the last thing writing
    # that field. Nothing reads "status" — not images-sync.py, not app.js — so
    # every import was quietly putting a dead key back into the source of truth.
    ap.add_argument('--no-sync', action='store_true', help='skip regenerating the page')
    args = ap.parse_args()

    if args.replace and len(args.urls) != 1:
        return ap.error('--replace takes exactly one URL')

    os.makedirs(SHOTS, exist_ok=True)
    with open(LIB, encoding='utf-8') as fh:
        lib = json.load(fh)

    at, cat = len(lib['items']), args.cat
    if args.replace:
        hits = [n for n, it in enumerate(lib['items']) if it.get('file') == args.replace]
        if not hits:
            return ap.error('no entry has file "%s"' % args.replace)
        at = hits[0]
        cat = cat or lib['items'][at]['cat']
        old = os.path.join(SHOTS, args.replace)
        if os.path.exists(old):
            os.remove(old)
        print('replacing %s (%s)' % (args.replace, lib['items'][at]['title'][:44]))
        lib['items'].pop(at)

    if not cat:
        cat = lib['categories'][0]
        print('no --cat given, filing under "%s"' % cat)
    if cat not in lib['categories']:
        return ap.error('"%s" is not a category. Known: %s'
                        % (cat, ', '.join(lib['categories'])))

    added = 0
    for url in args.urls:
        try:
            info = scrape(url, args.title)
            fname, dim = stage(info)
        except Exception as exc:                          # noqa: BLE001
            print('failed %s\n  %s' % (url, exc), file=sys.stderr)
            continue

        if info['source'] not in lib['sources']:
            lib['sources'][info['source']] = {
                'name': info['sourceName'], 'tier': info['tier'],
                'licence': info['licence'],
                'note': 'Added automatically by images-add.py. Check the licence line.'}
            print('registered new source "%s" (%s)' % (info['source'], info['sourceName']))

        lib['items'].insert(at, {
            'source': info['source'], 'id': info['id'], 'file': fname, 'cat': cat,
            'title': info['title'],
            # Left EMPTY when unknown rather than falling back to the service
            # name. Filling it with "Adobe Stock" made --review count the
            # service as a photographer and report a concentration that was
            # really just five images with no credit recorded.
            'by': info['by'], 'dim': dim,
            'why': 'TODO why this one', 'use': 'TODO where it is for', 'crop': '',
            'url': info['url']})
        at += 1
        added += 1
        print('added %-30s %-11s %s' % (fname, dim, info['title'][:44]))

    if not added:
        return 1

    with open(LIB, 'w', encoding='utf-8') as fh:
        json.dump(lib, fh, indent=2, ensure_ascii=False)
        fh.write('\n')
    print('\n%d added to "%s". Fill in the TODO fields in library.json.' % (added, cat))

    if not args.no_sync:
        return subprocess.call([sys.executable, SYNC])
    return 0


if __name__ == '__main__':
    sys.exit(main())
