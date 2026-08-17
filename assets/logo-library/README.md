# Logo library

Partner, platform, client and community marks harvested from
**www.rbaconsulting.com** (crawled 2026-08-17, all 105 pages in the page and project
sitemaps), identity-checked, vectorized, trimmed, and built out into three colorways.
Rendered by [`../../logo-library.html`](../../logo-library.html); regenerate that
page's manifest with `tools/logos-sync.py`.

This is *not* `../logos/`. That folder holds RBA's own four logo colorways and has a
`currentColor` / `--mark-fill` contract the site depends on.

`MANIFEST.csv` is the index: one row per logo, with all six filenames, its `origin`,
what it came from, and the URL it was fetched from.

## What you get

**79 logos × 6 files each**, all on transparency:

| File | What it is |
|---|---|
| `name.svg` / `name.png` | Full color — vector, and 512px on the long edge |
| `name-black.svg` / `name-black.png` | One-color black |
| `name-white.svg` / `name-white.png` | One-color white |

Black and white are traced from the same silhouette and differ only in fill, so a
row of logos stays consistent whichever way a section flips.

| Folder | Logos | What's in it |
|---|---|---|
| `platforms/` | 32 | Technology marks |
| `community/` | 21 | Nonprofits from the RBA Cares logo wall |
| `clients/` | 16 | Client marks from case studies and logo strips |
| `partnerships/` | 8 | The eight named partner tiers on `/our-partnerships/` |
| `certifications/` | 2 | See the caveat below |

Four folders start with an underscore. That prefix is what keeps them out of the
gallery *and* out of the download bundles, while still keeping the files:

| Folder | What's in it |
|---|---|
| `_rba-brand/` | RBA's own marks and service icons, as published on the site |
| `_retired/` | Legacy and alt cuts pulled from the gallery, plus traces a published vector displaced |
| `_raster-originals/` | All 98 source rasters, mirroring the category paths |
| `_not-logos/` | Harvested, but not actually a logo mark |

**RBA's own marks are deliberately not in the gallery.** The page says at the top
that they live under Logos, and listing them on the same screen would contradict
that. They are still on disk under `_rba-brand/` — including
`_rba-brand/rba-logo-full-color-rgb.svg`, which is the real RBA logo live on every
page of the production site. `../logos/README.md` says everything in that folder is a
placeholder awaiting real artwork; this is probably it, though it is the web lockup
rather than the master and needs the `currentColor` / `--mark-fill` treatment before
it can drive the four colorways.

## Where the vectors come from

Of the 79 shown: **8 are the owner's own published vector**, **11 arrived as SVG on
RBA's site**, and **60 were traced** from raster. The `origin` column says which.

Tracing is per-color, not per-pixel. Each logo is quantized to the handful of colors
actually in it, each color is traced as its own bitmap with `potrace`, and the layers
are stacked cumulatively so adjacent colors meet with no seam. Alpha gates every
mask, so white-on-transparent marks stay white and transparent instead of being
flattened onto a background.

Fidelity was checked by rendering every SVG back to bitmap and diffing against its
source over a mid-grey composite — median difference **0.44/255**. Every viewBox is
trimmed tight to the artwork, so no file carries transparent padding.

### The eight replaced with published vectors

Angular, .NET, GitHub, JavaScript, Node.js, OpenAI, Snowflake and WordPress use the
artwork their owners publish, taken from Wikimedia Commons (public domain except
Node.js, which is MIT). Each displaced trace is in `_retired/`.

**Angular is a rebrand, not just a better file.** RBA's site still uses the pre-2023
red shield; the published vector is the current pink-to-purple wordmark. If a page
has to match the existing site, the old mark is in `_retired/`.

### What could not be replaced, and why

Not on Wikimedia Commons at all, so still traced: **Sitecore, Optimizely,
BigCommerce, dbt, Cursor, Microsoft Fabric, Semrush, Power Platform, Microsoft
Copilot.** Their vendors publish brand kits behind a request form or a JS-driven
page; worth pulling by hand, and Sitecore, Optimizely and BigCommerce matter most
since they are named partners.

Deliberately kept as traces: **Azure, Figma, Power BI, Python, React.** Published
vectors exist, but every one is the glyph *alone* — swapping them would drop the
wordmark RBA's lockups use, which is a downgrade.

## What was retired, and what that cost

Legacy and alt cuts are out of the gallery and parked in `_retired/`. Three of them
were the *only* mark for their product, so the library no longer has any:

- **Dynamics 365**, **Office 365** and **SharePoint** — all three existed only as
  2019-era artwork with no current sibling. Office 365 is Microsoft 365 now; the
  other two have been redrawn since. If a deck needs them, source the current mark.

Three "alt" files turned out to be the *real* color artwork, with the plain name
holding a reversed white cut. Those were promoted rather than deleted, so nothing was
lost: **BCU** and **Edina Realty** now resolve to their color logos, and
**Microsoft 365** to the lockup with the wordmark rather than the bare glyph.

## Backgrounds

Every PNG is transparent. Eight logos were traced from source PNGs with an opaque
white background baked in — the four partnership tiles, `microsoft-copilot`,
`sitecore-legacy-2` and both WordPress alts — and were re-traced with the background
flood-filled away at the source raster and its anti-aliased edge feathered, so no
white halo is left. Of those, only the four partnership tiles are still in the
gallery; the rest were retired.

Some marks are white-on-transparent (Cargill, Best Buy, Toro, Post Consumer Brands
and a few more) because RBA's site only ever carried the reversed cut. Their "color"
file is therefore white and looks empty on a light background. The site measures this
and gives those tiles a dark stage.

## How the one-color variants were made

Not by recoloring fills — that would have turned a baked-in white background into a
solid rectangle. Instead the mark is rendered and ink is taken as *opaque and not
near-white*, then traced as a single flat layer.

Treating white as knockout rather than ink is what a one-color logo should do anyway,
and it is what keeps the hole in the Sitecore ring, the W in the WordPress badge and
the `.NET` lettering on its tile. Where knocking white out would consume the whole
mark, the mark is kept whole and inverts.

**One casualty.** `platforms/javascript-black.svg` collapses to a filled square:
black glyphs on a yellow tile leave no silhouette once color is gone. The white cut
has the same problem. Redraw by hand if you need it; every other one reads correctly.

## Naming

`partnerships/` filenames carry the tier the site claims, separated by a double dash:
`sitecore--gold-partner.svg`, `umbraco--platinum-partner.svg`. Those come from the
`<h*>` above each logo on `/our-partnerships/`, so they are what RBA publicly asserts
today. Worth re-checking before they go on a page.

`-black` and `-white` are always the generated colorways, never part of a source
name. There are no `-alt` or `-legacy` names left in the gallery.

## Two caveats

**Certifications barely exist as artwork.** The site carries exactly one real badge —
`umbraco-platinum-partner-badge.svg` — plus the Glassdoor mark. Everything else RBA
claims (Sitecore MVP, Umbraco Certified Master, Star Tribune Top Workplace 2026,
MN365) appears only baked into announcement cards, at small size. Those cards are in
`_raster-originals/certifications/_announcement-graphics/`. Redraw from the issuer's
brand kit rather than tracing them.

**Alt text on the source site is unreliable.** It is copy-pasted between logos — the
AWS logo carries `alt="Umbraco Gold Partner Logo"`, and the whole RBA Cares wall is
shifted by one. Every file here was identified by eye instead, which caught four wrong
guesses (`Cgil` is Cargill, not Caleres; `BB` is Best Buy, not Banner Bank; `BGCLogo`
is Black Girls Code; `SciSci` is Science From Scientists). Don't trust the attribute.

## Licensing

These are other people's trademarks. Use them to say who RBA works with, follow the
owner's brand guidelines on clear space and minimum size, don't recolor beyond the
sanctioned black and white, and don't imply a partnership that doesn't exist. The
Commons files are public-domain or MIT *as files*; that has no bearing on the
trademark.

## Known gap

`clients/dji.png` — referenced by `/tech-connect-contest/` but 404s at the source.
Broken on RBA's side, not a fetch failure.
