# Connect Design System

RBA Consulting's design system — brand foundations and a downloadable asset library. Static HTML,
CSS and JavaScript — no build step, no dependencies, no package manager.

**Start here: [the live site](https://ahickey-rba.github.io/rba-design-system/).** This
README is about maintaining the repo; the site is the thing itself.

> **Logos, the palette and the icons are real. Photography is not — it hasn't been bought
> yet.** The logo files, favicons and every colour and type value are imported from the
> brand's own source, and the icon library holds 1,490 real icons, all named. The templates
> link to SharePoint rather than being copied here.
>
> `images.html` is a **shortlist of candidates to license**, not a gallery. Every image
> on it is a **watermarked comp** — not licensed, and not usable in anything that ships.
> The shortlist takes images from any service: sources are declared in
> `assets/images/library.json`, which is the hand-edited source of truth, and
> `./tools/images-sync.py` builds the page from it. Adding, swapping and deleting are
> each one step, and ranks renumber themselves. See
> [`assets/images/README.md`](assets/images/README.md) — it carries the review of the
> original fifty, guidance on which services suit this brand, and a flag that comps are
> an internal-review licence on a publicly reachable site.
>
> The icons are **purchased stock packs** and carry no licence file. Most stock licences
> allow use but not redistribution as standalone downloads, which is what the icon page
> does. The repo is public by choice; that redistribution question is a stated risk, not
> a solved one — see [`assets/icons/README.md`](assets/icons/README.md).

## Pages

| Page | Contents |
|---|---|
| `index.html` | Home with task-based entry points, plus Colors, Typography, Logos, Voice |
| `components.html` | Component specimens — buttons, links, cards, stat blocks, layout tokens |
| `icons.html` | Icon library — 1,490 icons in 80 packs; search, filter, SVG/PNG download, copy SVG |
| `images.html` | Brand image shortlist — candidates to license, grouped in visual families; filter, search, link out |
| `templates.html` | Templates & decks — a table of SharePoint-linked files, plus "What good looks like" reference layouts |

The logo, favicons and all token values were imported from the RBA Design System project on
claude.ai/design via `DesignSync`. The PowerPoint master is **not** copied into this repo:
SharePoint holds the version that actually gets updated, and a duplicate here would go
stale without anyone noticing, so `templates.html` links to it instead.

The theme toggle and ⌘K search palette are identical across all five pages. The rail
groups its eight links under three static labels — Foundations / Library / Build — the
same categories the search palette reports. The labels are plain headings, not
collapsible: an earlier version persisted collapse state to localStorage, which was ~90
lines of CSS and JS to navigate eight destinations, and the labels alone deliver the
grouping without any of it.

**The rail is NOT identical across pages, in two deliberate ways.** Each page marks its
own link with `sidebar-link--active` and `aria-current="page"`. And the first four links
point at sections that only exist on the home page, so they are written `#colors` on
`index.html` — a same-page scroll, which is what the scroll-spy binds to — and
`index.html#colors` everywhere else. Writing a bare `#colors` on the library pages is the
one mistake to avoid here: the link stays clickable, changes the URL, and goes nowhere,
because there is no such section on that page to scroll to.

## Running it

Open `index.html` directly for most things. Two features need a served origin:

- **Copy SVG** on the icon page fetches the file, which a `file://` page can't do. The
  buttons remove themselves rather than failing on click.
- Nothing else. Downloads, search, filtering and theming all work off disk.

To serve it:

```bash
python3 -m http.server 3477
```

## Adding an asset

Two steps, and no build:

1. Drop the file into the right folder under `assets/`.
2. Add a row to that page's manifest (images) or a `<tr>` (templates).

**Icons are the exception** — there are 1,490 of them, so `assets/icons/` is generated
and hand-added files there get deleted on the next sync. Drop the pack into `icon-packs-source/` at
the repo root, add it to the `PACKS` table in `tools/icons-sync.py`, and run:

```bash
./tools/icons-sync.py
```

`icon-packs-source/` is gitignored: only about 11 MB of its 124 MB is servable, the rest being
Illustrator and EPS sources. **It is not backed up here** — keep the original download.

Each folder has its own README with the exact filenames, formats and manifest shape:
[logos](assets/logos/README.md) · [icons](assets/icons/README.md) ·
[images](assets/images/README.md) · [templates](assets/templates/README.md)

Then rebuild the download bundles and commit them:

```bash
./tools/build-bundles.sh
```

## The zip bundles are pre-built

GitHub Pages can't zip a folder on request, and doing it in the browser would mean
shipping a zip library for a page that is otherwise dependency-free. So the bundles under
`downloads/` are built by `tools/build-bundles.sh` and committed.

**This makes staleness the one real failure mode of this repo.** A bundle can silently lag
the folder it represents. If you add an asset and don't run the script, the button hands
people the old set.

The guard is procedural, not visible: the script is the only way bundles are made, it
prints the file count and size of everything it writes, and rebuilding is a step in
"adding an asset" below. The pages used to print the build date beside each "Download all"
button; that was removed because it crowded the buttons with a date that only means
something to someone who already knows when the assets last changed.

The script writes no bundle for an empty collection, which is why `templates.html`
currently shows no bundle button at all rather than a link that would 404.

**The icons ship as two bundles, split by format.** Together they are 9.4 MB, but the
SVGs alone are 1.3 MB and are what almost everyone wants — one combined zip would make
the common case download seven times what it needs. Splitting also keeps the 8.2 MB PNG
zip out of git history on any revision that only touched vectors. Bundles are matched by
glob in the `COLLECTIONS` table at the top of the script, so a third split is one line.

## Version and published date

Both are stamped at deploy time by `.github/workflows/deploy.yml`, so what the page shows
is always what was actually deployed:

- **Version** is `1.<number of commits on main>` — it increments on its own, no file to
  bump and nothing to forget.
- **Published** is the deploy date.

The workflow rewrites two constants in `app.js` on the way to the Pages artifact and
commits nothing back, so `main` stays clean and there is no push loop. It `grep`s for both
lines first and fails the build if either has changed shape — better a red run than a page
quietly claiming the wrong version. If you edit those two lines, keep them on one line in
exactly the form the workflow expects.

A working copy that has never been deployed shows **"Dev build · not published"** rather
than a stale number.

Note this means Pages deploys **from the Action, not from the branch**. Changing the Pages
source back to "deploy from a branch" would serve the unstamped file.

## How it's put together

- **`styles.css`** — one stylesheet. Every token is in a single `:root` block at the top,
  with the dark theme as a short re-point below it rather than a second palette.
- **`app.js`** — one script, plain IIFEs, no dependencies. Hash-scrolling, scroll-spy,
  theme toggle, off-canvas drawer with focus trap, ⌘K search, the manifest-driven asset
  grids, clipboard copy, and SVG serialisation for downloads.
- **Manifests are inlined** as `<script type="application/json">` rather than fetched, so
  the pages work opened straight off disk.

Two decisions worth knowing before you change things:

**Icons are painted with a CSS mask, not `<img>`.** An `<img>` renders the file's own
colors and can't inherit `currentColor`, so one monochrome file could never follow the
theme — dark mode would need a second copy of all 1,490. Masking paints the file's alpha
with the tile's color instead. The near-black stroke inside each file is therefore ignored
on this site, but is what you get if you download one.

**The icon grid loads its masks lazily.** 1,490 tiles each declaring a mask URL is 1,490
requests on open, so an `IntersectionObserver` sets the URL only as a tile nears the
viewport — about 40 requests instead. Filtering toggles `hidden` on existing tiles rather
than re-rendering, because rebuilding 13,000 nodes per keystroke is not free. Both are
load-bearing at this size; neither matters for the image gallery, which is why that grid
still uses the simpler shared renderer.

**The icon manifest stores packs, not icons.** Every file is `<slug>-NN.svg` with a
matching `.png`, so a slug plus a count reconstructs all 1,490 paths — 13 KB inlined
instead of ~200 KB. It is generated; the only part meant to be hand-edited is the `labels`
map that names the icons, and `tools/icons-sync.py` preserves those across a re-sync.

**Icon search ranks in three tiers, and the tiers are the point.** With 1,490 named icons
a plain substring test ranks badly — "owl" is inside "b*owl*" and "kn*owl*edge". So a term
matching the START of a word in the name wins, a term matching the name anywhere comes
next, and a match that only came through the pack's keywords comes last. Queries are also
split into terms that must all match in any order, and both sides are hyphen-flattened, so
"pie chart" reaches `pie-chart-dollar` and "office chair" puts `office-chair` above
`reading-in-armchair`. A filter pass over the whole set costs about 1 ms.

**Color swatch labels sit below the color, never on it.** RBA's Action blue (`#3178BF`)
can't carry a label at 4.5:1 against either black or white — its best case is 3.91:1. Text
on the color would mean either shipping a swatch that fails AA or inflating the label to
reach the large-text threshold. The label sits on the card instead, so every swatch is
legible by construction whatever gets added to the palette.

## Palette provenance — resolved

**Source of truth: `colors_and_type.css` in the RBA Design System project on
claude.ai/design.** It states "All values match the canonical brand guidelines, Feb 2026"
and cites `BRAND_TOKENS.md` / `SKILL.md`. Every colour, type and radius value in this repo
is imported from it. Where the two disagree, that file wins — correct it there and
re-import rather than editing values here, or they drift and neither is authoritative.

An earlier version of this site was seeded from `RBA Redesign/brand.html`, which turned out
to be an incomplete subset. Reconciling against the canonical source changed real things:

- **RBA Red is logo-only.** Never a button, heading, link, chart series or border. This
  site had been using it for caution notices; those are now accent teal. There is no red
  anywhere in the interface — only in the mark itself.
- **Aqua `#14BADB` is decorative only** — it fails AA as text. `--accent #0D8FA9` is the
  teal that can carry type.
- **Eight colours were missing entirely**, including `--primary-hover`, `--secondary`,
  `--accent`, `--navy-dark`, `--bg-dark` and the 8-value data-visualization set.
- **There are two gradients, both vertical**, not one at 135°.
- **The type scale was wrong.** Official is hero 100px Libre Caslon / h1 48 / h2 40 / h3 36
  / h4 32 / h5 24 / h6 20 / body-lg 20 / body 16 / body-sm 14. (The hero has since been
  brought down to 72px by decision, Aug 2026 — the one value where this site leads the
  canonical source rather than following it.)
- **The hero is the serif.** The canonical file defines the hero as Libre Caslon and
  comments that it is the only place the serif is used. An earlier pass had switched it to
  Montserrat on the reasoning that a reference page isn't an editorial moment; the
  published system overrules that.

The type specimen documents the official scale exactly. The site's own furniture is set
smaller on purpose — the official scale is a marketing scale — and that divergence is
noted in `styles.css` where it happens.

## Typefaces

Montserrat and Libre Caslon Text, both from Google Fonts, loaded via a `<link>`. There are
no font files in this repo and no `@font-face` rules, so nothing here needs a licence
check before it ships.

The canonical project bundles the brand-approved TTFs and loads them with `@font-face`.
Same families, open-licensed either way. If a font *download* is ever wanted here, see
[`assets/templates/README.md`](assets/templates/README.md).

Libre Caslon appears in two places on this site: the hero title on each page — the one
use the published system names for the serif — and the type specimen, where it is the
subject rather than the voice. Every other heading, section titles included, is
Montserrat 800 per the system's own rule. Section titles were briefly set in the serif
to match the hero; that put the Typography section's "hero display only" rule directly
beneath a heading that broke it, so the furniture now obeys the rule it publishes.

## Moving to the RBA hub

Choices made to keep that port cheap: no build step and no dependencies; all paths
relative; one stylesheet with every token in a single `:root` block; manifests inlined
rather than fetched; and all four pages sharing an identical sidebar, so the hub's own
chrome can replace it with one find-and-replace.
