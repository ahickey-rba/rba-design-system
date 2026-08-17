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

**108 logos × 6 files each**, all on transparency bar a few (see
[Backgrounds](#backgrounds)):

| File | What it is |
|---|---|
| `name.svg` / `name.png` | Full color — vector, and 512px on the long edge |
| `name-black.svg` / `name-black.png` | One-color black |
| `name-white.svg` / `name-white.png` | One-color white |

Black and white are traced from the same silhouette and differ only in fill, so a
row of logos stays consistent whichever way a section flips.

| Folder | Logos | What's in it |
|---|---|---|
| `platforms/` | 34 | Technology marks |
| `clients/` | 30 | Client marks from case studies, logo strips and the capability deck |
| `community/` | 21 | Nonprofits from the RBA Cares logo wall |
| `certifications/` | 15 | Credential badges, issuer marks and partner tier badges |
| `partnerships/` | 8 | The eight named partner tiers on `/our-partnerships/` |

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

Of the 108 shown: **49 are the owner's own published vector**, **10 arrived as SVG on
RBA's site**, and **49 were traced** from raster. The `origin` column says which.

Tracing is per-color, not per-pixel. Each logo is quantized to the handful of colors
actually in it, each color is traced as its own bitmap with `potrace`, and the layers
are stacked cumulatively so adjacent colors meet with no seam. Alpha gates every
mask, so white-on-transparent marks stay white and transparent instead of being
flattened onto a background.

Fidelity was checked by rendering every SVG back to bitmap and diffing against its
source over a mid-grey composite — median difference **0.44/255**. Every viewBox is
trimmed tight to the artwork, so no file carries transparent padding.

### The 49 that are the owner's own vector

Two rounds got them here. The first took eight from Wikimedia Commons: Angular,
.NET, GitHub, JavaScript, Node.js, OpenAI, Snowflake and WordPress.

The second round went after the traces whose letterforms `potrace` had visibly
softened, and found 17 more — ten on Commons (**Azure, Cursor, Moz, Python,
Semrush, Best Buy, Cargill, Fastenal, AWS, Glassdoor**, every one filed under the
brand's own name as the author) and seven straight off the owner's site
(**BigCommerce, Coveo, Post Consumer Brands, Caleres, Nutrition Incentive Hub
(GSCN), Black Girls Code**, plus BigCommerce again for the partner tile). Each
displaced trace is in `_retired/`.

**Check that a vendor's "SVG" is actually a vector.** `banner-bank-logo.svg` on
Banner Bank's own site is a base64 PNG in an SVG wrapper — 267×75, with a white
background baked in. It counts as a raster here, not a published vector.

Two of those are a different lockup, not just a cleaner file, and a page that has to
match the existing site should pull the old cut from `_retired/`:

- **Angular** — RBA's site still uses the pre-2023 red shield; the vector is the
  current pink-to-purple wordmark.
- **Azure** — the current official lockup is a flat blue A and the word *Azure*.
  The trace it replaced was the older gradient A reading *Microsoft Azure*.

### What could not be replaced, and why

Published nowhere reachable, so still traced: **Optimizely, dbt, Microsoft Fabric,
Power Platform, Microsoft Copilot.** Their vendors gate brand kits behind a request
form or a JS-driven page. Optimizely matters most, since it is a named partner.

**Sitecore was on this list until the capability deck was checked.** Both the
Sitecore mark and its Gold Partner badge were sitting inside `Logo library.pptx` as
embedded vectors. Before concluding a vendor publishes nothing, look in the decks.

Deliberately kept as traces: **Figma, Power BI, React.** Published vectors exist,
but each is the glyph *alone* — swapping them would drop the wordmark RBA's lockups
use, which is a downgrade.

Three more were checked and deliberately left alone, because the owner's own web
asset is a *thinner* mark than the trace already here — a reminder that "official
file" and "better file" are not the same test:

- **OutFront Minnesota** — their header SVG drops both the arrow glyph and the
  brand purple.
- **Second Harvest Heartland** — their header SVG drops the tagline.
- **BCRF** — their header SVG drops the *BCRF* acronym, carrying only the
  spelled-out name. Their full lockup exists as a 1274px PNG, but on an opaque
  dusty-pink field (`#deb4b4`) that would have to come off first, for a modest gain
  over the 800px raster this was traced from. Worth revisiting.

### The two retraces

Where the owner publishes no usable vector, the trace stays — but off the owner's
own artwork instead of whatever RBA's site happened to carry. Both source rasters
are kept under `_raster-originals/clients/`.

- **Toro.** No reachable SVG at all: the investor site is PNG-only and the consumer
  site's media handler returns a 91×60 thumbnail. The badge is now traced from
  Toro's own 2104px corporate lockup, cropped out of it, rather than a 154px web
  PNG — which is where its letterforms came back.
- **Banner Bank.** Traced from the 267×75 raster inside their wrapped "SVG", with
  the baked white field flood-filled away and its edge feathered. Low resolution,
  but it is their own color artwork rather than the white-only cut RBA carried.
  Worth replacing if a real vector ever surfaces.

`../../tools/logos-trace.py` is what did both, and is the tool to reach for next
time. It reads the palette off the *native* pixels before upscaling: quantising the
upscaled image averages the resampled shades, which is how Banner Bank's `#0260af`
navy and `#ee3742` red first came back as a muddy `#6290c0` and `#994265`.

### The capability deck, which beat the web

20 of these logos came from `Logo library.pptx`, an RBA capability deck — and it was a
better source than the open web for three separate reasons worth remembering:

1. **Decks carry embedded vectors.** PowerPoint keeps whatever was pasted in, so the
   deck held true SVGs of Sitecore, its Gold Partner badge, Essentia Health and
   Surescripts. Sitecore had been written off here as unobtainable.
2. **Decks name things the web does not.** Most of its rasters are 29×9 to 150px and
   useless as artwork, but they *identified* marks nobody would have thought to look
   for — Target, Optum, UnitedHealthcare, Boston Scientific, C.H. Robinson, Andersen,
   Ford, Thomson Reuters, Patterson, Siteimprove, Salesforce and the certifications.
   Each was then fetched properly from its owner.
3. **Internal decks hold the tier badges** vendors bury behind partner-portal logins.

The deck's other contents were deliberately skipped: 12 cyan role icons (not brand
marks — RBA's own service icons already live in `_rba-brand/`), and a long tail of
healthcare logos whose owners publish nothing usable (CareWire, LHI, Triplefin,
Wilderness Health, Medica, Aurora Health Care) plus marks not yet chased down
(Medtronic, Intel, Allina Health, Perrigo, RSM, Ameriprise, CHS, Mortenson, Braun
Intertec, NAVIS, Upper Lakes Foods, Riverside, University of Minnesota, University
of Georgia).

**WEX and Mutual of Omaha were the reversed-only pair, and both are now in colour.**
Mutual of Omaha was easy: `mutual-brand-white.svg` has a `mutual-brand-blue.svg`
sibling at the same path, in their navy `#003a70`. Guess the sibling before you
reach for a tracer.

WEX needed a judgement call. They publish a vector *only* in white, and colour *only*
as a 100×29 raster — too small to trace. So `wex.svg` is their own white vector with
their own red (`#c8102e`, sampled from that raster) substituted for the white. That is
a recolour, which this README otherwise warns against, and it is defensible only
because the two silhouettes were measured against each other first and agree to an
IoU of **0.969** — the red cut and the white cut are the same artwork. No letterform
is invented. The grey wedge inside the X is grey only in the reversed cut; WEX's own
colour artwork has zero grey pixels in that region, so in the colour file it is red.
If WEX ever ships a real colour vector, take it.

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

**Eight marks used to be white-on-transparent** — Banner Bank, Best Buy, Caleres,
Cargill, Fastenal, Nutrition Incentive Hub (GSCN), Post Consumer Brands and Toro —
because RBA's site only ever carried the reversed cut of them, so their "color" file
was white and looked empty on a light tile. All eight now carry real brand color,
sourced as described above, and **no logo in the gallery needs a dark stage any
more**: `logos-sync.py` measures it and now reports zero. The dark-tile code path is
still there, and still correct, for whatever gets added next.

Two marks are an opaque colored plate rather than transparency, and that is correct
for both: `clients/caleres.svg` on midnight `#24356e` and
`clients/post-consumer-brands.svg` on red `#db1c2b`. Each is reversed *out of* its
plate in the owner's own artwork — the plate is the logo. Cutting the wordmark out
and recoloring it would invent a mark neither company publishes.

## How the one-color variants were made

Not by recoloring fills — that would have turned a baked-in white background into a
solid rectangle. Instead the mark is rendered and ink is taken as *opaque and not
near-white*, then traced as a single flat layer.

Treating white as knockout rather than ink is what a one-color logo should do anyway,
and it is what keeps the hole in the Sitecore ring, the W in the WordPress badge and
the `.NET` lettering on its tile. Where knocking white out would consume the whole
mark, the mark is kept whole and inverts.

### Knockout artwork: `--knockout`

The rule above has a blind spot, and JavaScript was it. Black `JS` on a yellow tile:
yellow is not near-white, so "ink is everything not near-white" called the whole tile
ink and both one-color cuts came out as **a featureless black or white square**. It
shipped that way until someone looked at the tile.

`tools/logos-colorways.py --knockout` inverts the relationship for that shape — the
mid-tone field becomes the ink and the glyph is punched out of it, giving a black
square with `JS` showing through. `MANIFEST.csv` records the flag on the JavaScript
row, because rebuilding it without the flag silently reintroduces the block.

**It is a flag and not automatic on purpose.** It *was* automatic first, gated on
"the light region is the majority, contrasts strongly, and encloses the dark region".
That correctly caught JavaScript and correctly ignored CISSP and OutFront Minnesota —
their lettering sits *beside* a device rather than inside it, so the enclosure test
failed. But it also fired on `umbraco-platinum-partner-badge`, whose light card
genuinely does enclose its U and wordmark, and knocking them out left a near-blank
tile reading only PLATINUM.

No geometric test separates "glyph reversed out of a plate" from "logo composed on a
card" — that is a question about meaning, not pixels. So:

    ./tools/logos-colorways.py --report

names the candidates and changes nothing. Look at each one before rebuilding. Today
it flags exactly two: JavaScript, which needs the flag, and the Umbraco Platinum
badge, which must not have it.

## Adding or replacing a logo

`../../tools/logos-colorways.py` is this step, written down — the original six-file
set was built by an ad-hoc script that did not survive, which is how the library
ended up with colorways nobody could reproduce. Give it one color vector and it
emits all six files, trimmed and named to the contract:

    ./tools/logos-colorways.py clients/acme path/to/acme.svg
    ./tools/logos-colorways.py --from-json replacements.json --base .

Then run `./tools/logos-sync.py` to rewrite the manifest the page renders from, and
add a row to `MANIFEST.csv` recording where the artwork came from. It needs
`rsvg-convert`, `potrace`, `numpy` and `pillow`; `logos-sync.py` needs `numpy` too,
and silently mis-measures the dark flag without it.

## Naming

`partnerships/` filenames carry the tier the site claims, separated by a double dash:
`sitecore--gold-partner.svg`, `umbraco--platinum-partner.svg`. Those come from the
`<h*>` above each logo on `/our-partnerships/`, so they are what RBA publicly asserts
today. Worth re-checking before they go on a page.

`-black` and `-white` are always the generated colorways, never part of a source
name. There are no `-alt` or `-legacy` names left in the gallery.

## Two caveats

**Certifications: 2 entries became 15, and Credly is why.** Credly is where the
issuers host their own badge artwork, publicly, at up to 680px — not behind the
per-person login the badges appear on. `images.credly.com/size/680x680/images/<uuid>/`
is the pattern; the uuid is on the issuer's public badge page, e.g.
`credly.com/org/isc2/badge/certified-information-systems-security-professional-cissp`.
That got the real **PMP, PMI-ACP, CISSP** and **AWS Certified Solutions Architect**
badges. Microsoft is easier still and publishes true SVGs at
`learn.microsoft.com/en-us/media/learn/certification/badges/` — hence
**Microsoft Certified — Expert** and **— Associate**.

Three things to know before using them:

1. **They are traced, and gradients flatten.** Credly serves PNG only, so the five
   non-Microsoft badges are traces. PMP's and PMI-ACP's radial gradient becomes one
   flat colour and AWS's blue gradient is approximated in six steps. CISSP is flat
   artwork to begin with, so its trace is near-exact. Fine at tile size; don't
   blow one up to a full slide.
2. **CSM is the weakest file in the whole library.** Scrum Alliance uses BadgeCert,
   not Credly, and publishes no standalone badge — the only artwork anywhere is a
   3×5 sheet of all their badges at 800×874, so the CSM crop is 153px and its
   "Scrum Alliance" sub-line is soft. Still 3× the deck's 57px version.
3. **A Microsoft badge names the tier, not the certification.** The shield for Azure
   Solutions Architect Expert *is* `microsoft-certified-expert`; the certification
   name lives in Credly metadata, not the artwork. Set it yourself alongside.

The issuer marks are kept alongside the badges on purpose — **ISC2, Scrum Alliance,
Prosci, Google Analytics** — because a partner wall usually wants the company's logo,
not a credential seal. Pick by what the slide is claiming: the badge for "our people
hold this", the issuer mark for "we work in this ecosystem".

Still missing entirely: **Sitecore MVP, Star Tribune Top Workplace 2026, MN365.**
Those appear only baked into announcement cards, at small size, in
`_raster-originals/certifications/_announcement-graphics/`. Redraw from the issuer's
brand kit rather than tracing them. **Prosci's Change Practitioner seal** is also
only an issuer mark so far — Prosci does not use Credly.

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
