#!/usr/bin/env python3
"""Fetch Adobe Stock preview URLs for every shortlisted asset.

    export ADOBE_STOCK_API_KEY=xxxxxxxx
    ./tools/images-fetch-previews.py
    ./tools/images-sync.py            # fold them into the page

Writes assets/images/previews.json — a plain {adobe-id: url} map that
images-sync.py merges into the manifest. Run the sync after this one.

WHY THIS EXISTS
---------------
Adobe Stock will not hand previews to an anonymous script: a plain request gets
403, from every user agent and header combination, because the check is at the
TLS and JavaScript layer rather than the header one. The Search API is designed
for exactly this and returns thumbnail URLs as selectable result columns, so an
API key is the sanctioned way through for anything automated.

IT IS NO LONGER THE ONLY WAY THROUGH
------------------------------------
This docstring used to claim that "a real headless browser gets served an empty
page". That is wrong, and it was wrong in the direction that costs you an API
key you may not need. Driving an actual browser at stock.adobe.com/images/x/<id>
renders the page fully, signed out, with the contributor, the real DIMENSIONS,
the LICENSE TYPE and the 1000_F_ CDN preview URL all present in the DOM. The
CDN itself has never had a check of any kind.

So this script is the right tool when you want ALL fifty previews in one
unattended pass, and overkill when you want one image — for that, read the
fields off the page and hand the CDN address to images-add.py.

GETTING A KEY
-------------
console.adobe.io → new project → add the Adobe Stock API → copy the Client ID.
That Client ID is the x-api-key. Search needs nothing else: the Authorization
bearer token is only required for the Licensing API, which this does not touch.

THE KEY IS A CREDENTIAL — IT NEVER LANDS IN THE REPO
----------------------------------------------------
Read from $ADOBE_STOCK_API_KEY, or from .adobe-stock-key at the repo root, which
is gitignored. It is never written into previews.json, the workbook, the manifest
or any output. Don't paste it into a file that is tracked, and don't put it in a
commit message.

WHAT COMES BACK IS STILL A WATERMARKED COMP
-------------------------------------------
These URLs point at Adobe's own CDN copies of unlicensed previews. They are fine
for a review board. They are not a licence, and the cards still say so. Once an
image is bought, drop the real file into assets/images/shortlist/<id>.jpg and it
takes precedence over the preview automatically.
"""

import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, 'images.html')
OUT = os.path.join(ROOT, 'assets', 'images', 'previews.json')
KEYFILE = os.path.join(ROOT, '.adobe-stock-key')
ENDPOINT = 'https://stock.adobe.io/Rest/Media/1/Search/Files'

# Biggest first: the cards render at ~325px wide on a 3-across desktop grid, so
# the 500 is the one that actually fits. comp_url is the fallback because it is
# larger than needed and more likely to be rate-shaped.
WANT = ['thumbnail_500_url', 'thumbnail_1000_url', 'thumbnail_240_url', 'comp_url']


def api_key():
    key = os.environ.get('ADOBE_STOCK_API_KEY', '').strip()
    if not key and os.path.exists(KEYFILE):
        key = open(KEYFILE, encoding='utf-8').read().strip()
    if not key:
        sys.exit(
            'error: no API key.\n'
            '       export ADOBE_STOCK_API_KEY=... , or put it in .adobe-stock-key\n'
            '       (gitignored). Get one at console.adobe.io: new project, add the\n'
            '       Adobe Stock API, copy the Client ID.')
    return key


def shortlist_ids():
    text = open(PAGE, encoding='utf-8').read()
    i = text.find('id="image-manifest">')
    j = text.find('</script>', i)
    if i < 0 or j < 0:
        sys.exit('error: could not read the manifest from images.html')
    data = json.loads(text[i + len('id="image-manifest">'):j])
    return [(it['id'], it['title']) for it in data.get('items', [])]


def fetch_one(media_id, key):
    params = [('search_parameters[media_id]', media_id), ('locale', 'en_US')]
    params += [('result_columns[]', c) for c in WANT + ['id']]
    url = ENDPOINT + '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        'x-api-key': key,
        # Not documented as required, but every Adobe example sends one and it is
        # what identifies this caller in their logs. Be a named client.
        'x-Product': 'RBA-Connect-Design-System/1.0',
        'Accept': 'application/json',
    })
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
        payload = json.load(r)
    files = payload.get('files') or []
    if not files:
        return None, 'no result'
    row = files[0]
    for col in WANT:
        if row.get(col):
            return row[col], col
    return None, 'result had no thumbnail column'


def main():
    key = api_key()
    items = shortlist_ids()
    if not items:
        sys.exit('error: the shortlist manifest is empty — run ./tools/images-sync.py first')

    existing = {}
    if os.path.exists(OUT):
        try:
            existing = json.load(open(OUT, encoding='utf-8'))
        except ValueError:
            existing = {}

    found, skipped, failed = dict(existing), 0, []
    for n, (aid, title) in enumerate(items, 1):
        if aid in existing:
            skipped += 1
            continue
        try:
            url, how = fetch_one(aid, key)
        except urllib.error.HTTPError as e:
            body = ''
            try:
                body = e.read().decode('utf-8', 'replace')[:160]
            except Exception:
                pass
            if e.code in (401, 403):
                sys.exit('error: Adobe rejected the key (HTTP %d). %s\n'
                         '       Check the Client ID, and that the Adobe Stock API is\n'
                         '       actually added to that project.' % (e.code, body))
            failed.append((aid, 'HTTP %d %s' % (e.code, body)))
            continue
        except Exception as e:
            failed.append((aid, str(e)))
            continue

        if url:
            found[aid] = url
            print('  %2d/%d  %-12s %-18s %s' % (n, len(items), aid, how, title[:44]))
        else:
            failed.append((aid, how))
        # Be a polite client. Fifty sequential calls is nothing, but hammering a
        # rate-limited endpoint to save nine seconds is how a key gets throttled.
        time.sleep(0.2)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(dict(sorted(found.items())), f, indent=2, ensure_ascii=False)
        f.write('\n')

    print('\n%d previews on file (%d new, %d already had one)'
          % (len(found), len(found) - len(existing), skipped))
    if failed:
        print('%d could not be fetched:' % len(failed))
        for aid, why in failed[:10]:
            print('  %-12s %s' % (aid, why))
    print('\nNext: ./tools/images-sync.py')


if __name__ == '__main__':
    main()
