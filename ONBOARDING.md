# Working on this site

A short orientation for a new maintainer. The [README](README.md) is the full reference —
this is the part you need before you touch anything.

---

## Right now: who's doing what

**Kassie**

1. **Templates and decks** — `templates.html`. It has three sections already: the
   SharePoint-linked file table (`#templates`), kits (`#kits`) and mockups (`#mockups`).
   This is the page that's thinnest on real content, and it's the one people will look for
   first when they need to start a deck.
2. **Certification and partner marks** — the badges we've earned and the partners we work
   with. New work; see the folder recommendation below.

**Adam**

3. **Cover design images** — the cover treatments, working from the references I pasted.

Start with the two items above before reading the rest of this document. The detail below
is there for when you hit it, not to be read front to back.

### Where the certification and partner marks should go

**Put them in a new `assets/badges/` folder, with two subfolders:**

```
assets/badges/
  certifications/     ISO, SOC 2, and any earned credential
  partners/           Microsoft Solutions Partner designations, and the rest
```

**Not `assets/logos/`**, even though they're logo-shaped, and the reason is concrete:
`build-bundles.sh` zips that folder recursively, so anything you drop in a subfolder there
silently ends up inside `rba-logos.zip` behind the "Download all logos" button. That would
ship third-party marks as part of RBA's own logo download — wrong on branding, and a
licensing problem, since partner and certification marks carry their own usage rules and
usually may not be redistributed.

**Not `assets/images/`** either. That folder is the stock-photo shortlist and is driven by
`library.json` plus `images-add.py`, which expects a stock-service URL. A partner logo has
none. Don't run the image tools on these.

**Don't add `badges` to the `COLLECTIONS` table** in `tools/build-bundles.sh`. No bundle,
no "download all" button — same reasoning the script already gives for skipping images.
People should take individual marks, in the form the partner specifies.

**To show them**, add a `#badges` section to `index.html` directly after the Logos section
and a sidebar link under Foundations. Two things to get right:

- On the other four pages that sidebar link must be written `index.html#badges`, not
  `#badges`. See rule 4 below — a bare hash fails silently.
- Keep a source note per mark: where it came from and what its usage rules are. These are
  the assets most likely to be used incorrectly, and the guidance needs to sit with them.

An SVG is worth asking for where the partner offers one, but take whatever the partner's
brand kit provides — these are the one category where their rules beat ours.

---

## What it is

Connect, RBA's design system: brand foundations plus a downloadable asset library.
Five HTML pages, one stylesheet, one script. **No build step, no dependencies, no package
manager, no npm install.** If you can edit a file and refresh a browser, you can work on it.

- **Live site** — https://ahickey-rba.github.io/rba-design-system/index.html
- **Repo** — `ahickey-rba/rba-design-system` (canonical; this is the one that publishes)
- **Mirror** — `adamdhickey-collab/rba-design-system`, a private backup copy. Don't work there.

| Page | What's on it |
|---|---|
| `index.html` | Home, plus Colors, Typography, Logos, Voice |
| `components.html` | Buttons, links, cards, stat blocks, layout tokens |
| `icons.html` | 1,490 icons in 80 packs — search, filter, download, copy SVG |
| `images.html` | Brand image shortlist — 100 candidates in nine families |
| `templates.html` | Templates and decks, linked to SharePoint |

## Run it

Most things work by opening `index.html` straight off disk. Only "Copy SVG" on the icon
page needs a real server, so when in doubt:

```bash
python3 -m http.server 3477
```

Then visit `http://localhost:3477`.

## The five things that will bite you

Everything else is ordinary HTML and CSS. These are the ones worth memorising.

**1. Some files are generated. Editing them by hand is work that disappears.**

| Don't hand-edit | It's owned by |
|---|---|
| `assets/icons/**` | `tools/icons-sync.py` — hand-added files get deleted on the next sync |
| the manifest block at the bottom of `images.html` | `tools/images-sync.py` |
| the manifest block in `icons.html` | `tools/icons-sync.py` |

For images, the source of truth is `assets/images/library.json` — edit that, then run the
sync. For icons, the source is the pack folder plus the `PACKS` table in the sync script.

**2. Rebuild the zip bundles after adding or removing any asset.**

GitHub Pages can't zip a folder on request, so the "Download all" bundles in `downloads/`
are pre-built and committed. This is the one real failure mode of the repo: a bundle can
silently lag the folder it represents, and the button then hands people a stale set.

```bash
./tools/build-bundles.sh
```

There's no automated guard. Running it is just a step you don't skip.

**3. Colour and type values are imported, not authored here.**

The source of truth is `colors_and_type.css` in the RBA Design System project on
claude.ai/design. If a value looks wrong, fix it *there* and re-import. Editing it here
makes the two drift and neither one is authoritative any more.

Three rules that already come out of that source and are easy to break by accident:

- **RBA Red is logo-only.** Never a button, heading, link, border or chart series.
- **Aqua `#14BADB` is decorative only** — it fails AA as text. Use `--accent #0D8FA9`.
- **Libre Caslon is the hero title only.** Every other heading is Montserrat 800.

**4. On the library pages, cross-page links need the filename.**

The first four sidebar links point at sections that only exist on the home page. On
`index.html` they're written `#colors`; on every other page they must be
`index.html#colors`. A bare `#colors` on `icons.html` stays clickable, changes the URL,
and goes nowhere — no error, just a dead link.

**5. Leave these two lines in `app.js` alone.**

```js
const RBA_VERSION   = 'dev';
const RBA_PUBLISHED = 'not yet published';
```

The deploy workflow rewrites them, and it greps for them first and **fails the build** if
either has changed shape. Version is `1.<commit count>`, so it increments itself — there's
no number to bump.

## Common jobs

**Add or swap a brand image.** Paste the URL of the stock page; the script reads the
title, contributor and preview off it and does the rest.

```bash
./tools/images-add.py <url>
```

Then `./tools/images-sync.py`. Ranks renumber themselves. Removing an image means deleting
the entry and the file — nothing is archived.

**Add an icon pack.** Drop the pack into `icon-packs-source/` at the repo root, add it to
the `PACKS` table in `tools/icons-sync.py`, then:

```bash
./tools/icons-sync.py
```

Note `icon-packs-source/` is gitignored and **not backed up here** — keep the original
download. Icon names come from the hand-edited `labels` map, which the sync preserves.

**Change a token.** Every token is in one `:root` block at the top of `styles.css`, with
the dark theme as a short re-point below it rather than a second palette. But see rule 3
first — most token changes belong in the canonical source, not here.

**Check nothing has drifted.** Both sync scripts take `--check`: they report staleness and
change nothing.

```bash
./tools/icons-sync.py --check && ./tools/images-sync.py --check
```

## Deploying

Push to `main`. The Action stamps the version and date and publishes to Pages. That's it.

Pages deploys **from the Action, not from the branch** — if the Pages source ever gets
switched back to "deploy from a branch", the site serves an unstamped file that claims to
be a dev build.

## Two licensing cautions

- **The images are watermarked comps, not licensed.** `images.html` is a shortlist of
  candidates to buy. Nothing on it may go in anything client-facing until it's purchased.
- **The icons are purchased stock packs**, offered here as individual downloads. Most
  stock licences allow use but not redistribution, which is arguably what the icon page
  does. The repo is public by choice; this is a known, stated risk rather than a settled
  question. See [`assets/icons/README.md`](assets/icons/README.md).

## Where to read more

The [README](README.md) covers the reasoning behind most of the above, including why icons
are painted with a CSS mask instead of `<img>`, why the icon grid loads lazily, and how
icon search ranking works. Each asset folder also has its own README with exact filenames
and manifest shapes: [logos](assets/logos/README.md) · [icons](assets/icons/README.md) ·
[images](assets/images/README.md) · [templates](assets/templates/README.md)

The code comments are worth reading before changing anything non-obvious — most of them
explain what was tried and why it was removed, which is usually the thing you were about
to try.
