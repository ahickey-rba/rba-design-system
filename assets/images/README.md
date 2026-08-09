# Brand images

**A working library, not licensed yet.** Photography and abstracts in named visual
families — `library.json` holds the current list, and the count moves as candidates
are added and cut. The page exists so images can be searched, compared and decided
on — not downloaded from. Every image in it is a watermarked comp until somebody
buys it.

**The whole library is currently Adobe Stock.** That is a deliberate choice about how the
set hangs together, not a limit of the tooling: `images-add.py` imports from any
service that publishes Open Graph tags, and the table further down is still the
guide to which one to reach for. A mixed-source run was tried and reverted — the
Adobe frames held the register better as a set, and coherence beat the licensing
saving. If that trade changes, the swap is one command per image.

```
assets/images/
├── library.json                     ← SOURCE OF TRUTH. Hand-edit this.
├── shortlist/                       ← the image files, <source>-<id>.<ext>
└── RBA_Adobe_Stock_Shortlist.xlsx   ← the original review. No longer wired up.
```

## Adding, swapping and deleting

Everything goes through `library.json` and then one command:

```bash
./tools/images-sync.py
```

| | |
|---|---|
| **Swap** | Replace the file in `shortlist/`. Same source and id, nothing else changes. Different service, change `source`, `id`, `file` and `url`. |
| **Delete** | `--remove <file>` drops the entry and deletes the file. **Ranks are not stored**, so nothing renumbers — the images below simply move up. |
| **Add** | Drop `<source>-<id>.<ext>` into `shortlist/`, run `--adopt`, fill in the TODOs. |
| **Reorder** | Move the entry up or down its category in the array. Rank and priority follow. |
| **Want** | Add an entry with **no `file` key** — a candidate you have shortlisted but not downloaded. |
| **Treat** | File it under **Signature & campaign**. Treatment is a family, not a flag — see below. |

### Treated frames are a family, not a field

A `style` field was tried here — `documentary` / `treated` / `abstract` as a second
axis, with its own filter row above the grid — and taken out again. Two filter rows
that combine is a more precise model of the truth and a worse thing to stand in front
of: the honest question a person arrives with is *show me the campaign imagery*, not
*show me the intersection of a subject and a treatment*. One row of families answers
that in one click.

So a deliberately graded or overlaid frame goes in **Signature & campaign**. It costs the ability to say "treated
Industries shot", which nothing has needed yet; the day something does, that is the
day to reconsider, not before.

**Filing it correctly is still what makes treatment safe.** "Use images as supplied"
remains the rule everywhere else — a graded frame filed among documentary work will
one day sit beside an ungraded one in the same layout and read as a mistake. The full
treatment spec, with both duotones shown on a real frame, is on the images page under
*Treating an image*.

### Wanted entries

A **wanted** entry has no `file` key, and it is the only staging state the library
has. You found six things worth a look in one browsing session and will download
them later; before this the library could not express that, so those candidates
lived in somebody's notes and got lost. The card renders a dashed frame reading
*not downloaded yet* — visibly different from a named file that will not load,
which is a fault rather than a task.

That distinction is enforced rather than decorative. `file` is the one field an
entry may omit: leave it out and `--check` is happy, but name a file that is not
in `shortlist/` and it is an error, because the page would ship a card pointing at
nothing. `--prune` drops the second kind and deliberately leaves the first alone.

**There is no decision state.** An earlier version of this file documented a
`"status"` of `keep` / `cut` / `licensed`, a badge on each card and a filter above
the grid that turned the page into a queue. All of it was tried and taken out —
every part of it read as clutter on a page whose job is comparing photographs, and
nothing reads `"status"` today. Removing an image now means removing it.

### Removing an image

```bash
./tools/images-sync.py --remove adobe-1904000970.webp
./tools/images-sync.py --remove adobe-1904000970.webp adobe-1904000971.webp
```

Takes one or more filenames — an entry's `id` works too — and deletes both the
entry and the file outright, then revalidates and rewrites the manifest in the same
run. **Nothing is archived.**

A library only improves if things leave it, and the first things that should leave
are unlicensed comps already ruled out — they cannot be used, they are the bulk of
what this repo publishes, and once the decision is made they are dead weight on a
public URL.

There was a `--retire` that emptied the file but kept the entry as a record of the
rejection. It went with the rest of the decision machinery: if an image is out it
is out, and a library you have to filter to see properly is not simpler than one
with fewer things in it. The reasoning for a cut lives in the commit that made it,
which is where the rest of this repo's history lives too.

```bash
./tools/images-sync.py --check    # drift, orphans, dangling entries. Writes nothing.
./tools/images-sync.py --adopt    # stub entries for files nothing claims
./tools/images-sync.py --prune    # drop entries whose file is gone
./tools/images-sync.py --review   # curation health — see below
```

## Keeping it good, not just valid

`--check` answers *will this build*. `--review` answers *is this still a good
library*, which is the question that actually decays. Nothing it reports breaks the
page; all of it makes the page worse if left alone. Run it whenever you add a batch.

It flags three things, each of which was a real fault in the original fifty:

- **Contributor concentration** — one photographer supplying a fifth of the library
  across four categories, which is how a brand library ends up looking like one
  person's portfolio.
- **One idea shot several ways** — clusters of images in the same category, by the
  same contributor, whose titles describe the same picture. It found the four
  interchangeable analytics shots that were holding ranks 1–4 of Data, AI & security,
  and several clusters the hand review missed.
- **Aspect ratios the 3:2 frame will ruin** — portrait, near-square, or panoramic.

**A perceptual hash was tried for the duplicate check and thrown out.** It scored the
two most obviously interchangeable images in the library at hamming distance 30, and
scored one of them against an unrelated factory photograph at 29 — it could not
separate them at all, because the duplication is compositional rather than
pixel-level: different crop, different colour, different lighting, same idea. The
metadata catches what the pixels cannot, because those images shared a contributor,
a category and the words *data*, *analyst* and *dashboard*. Don't add it back.

Reports are grouped into clusters rather than pairs. Four interchangeable images
generate six pairwise warnings, which reads as six problems and hides the only one
that matters — that the top of a category is one idea photographed four times.

The sync refuses to write a manifest that references a missing file, so the page
can never ship a card pointing at nothing. Half-finished edits are caught by
`--check` rather than by someone spotting a blank card later.

## Using more than one service

Every entry names a `source`, and every source is declared once at the top of
`library.json` with a display name, a tier and a licence line. Those strings are
what the card prints, so a free image and an unlicensed comp are never confused
for one another on screen. **Add a source before you add an image from it** —
`--adopt` refuses files whose service is not declared, on purpose.

What actually suits this brand:

| Service | Tier | What it is good for | The catch |
|---|---|---|---|
| **Adobe Stock** | paid | **The whole current library**, and there is a credit balance against it. The deepest catalogue, and it resells Stocksy, Westend61, Blend Images and peopleimages. | Everything here is still an **unlicensed comp until the credit is spent**. Forty-two are 1 credit each; eight are Enhanced at 25 or 50. Its exclude-generative filter only removes what contributors declared, so it is not a screen. |
| **Envato Elements** | subscription | **The cheapest way to ship.** RBA already pays for it, and the subscription licenses on download — the only source in this table whose images can be used today. | Widely subscribed, so no exclusivity. Quality is uneven and the candid register this brand wants is thinner; the results need filtering. |
| **Stocksy United** | paid | The least stock-looking work available. Artist co-op, tight curation. | Priciest per image, smaller library. |
| **iStock** | paid | Getty's affordable tier, and Signature is exclusive to Getty/iStock — not resold through Adobe, which is the reason to reach for it rather than a price one. | Item pages answer scripted requests, but a link needs BOTH numbers (`…-gm<id>-<asset>`); the id alone 404s. |
| **Getty Images** | paid | The premium end of the same library. | Easy to overpay when iStock has the same look. |
| **Offset / Cavan** | paid | Exclusive to their agency, so nobody else's site has it. | Advertising-tier pricing. |
| **Unsplash / Pexels** | free | Internal decks, wireframes, placeholders, anything low-stakes. | Zero exclusivity, and **no screening for third-party logos** — see below. |

### Envato is the one that is actually licensed

Worth stating plainly, because it is the standing argument against the current
all-Adobe set: every image here is a comp for work nobody has
bought, and **none of them can be used in anything** until they are. Envato
images are covered by the subscription the moment they are downloaded.

A rebalance toward Envato was run and then reverted — the Adobe frames held the
photographic register better as a set, and one coherent world beat a cheaper
mixed one. That was a judgement about this library, not about the services: when
an Envato image genuinely matches, it is not merely cheaper, it is the only one
of the two that exists as an option. Re-running that trade is one command per
image, and the history is in git.

```bash
./tools/images-fetch-envato.py --cat "Data, AI & security" 9Z4YMDX NKPJ5GC
```

That reads each item page, pulls the title, contributor and preview, stages the
preview as `envato-<id>.webp`, and prints library entries to paste in. It works
where the Adobe equivalent does not because Envato publishes a complete signed
preview URL in its Open Graph tags, while Adobe returns `403` to scripted
requests — which is why the Adobe comps had to be saved by hand.

Two things to know about the staged previews. They are **watermarked**, and they
are a **1200×630 social crop**, not the real aspect ratio — the signature covers
the resize parameters, so a 3:2 version cannot be requested. Judge the subject
from the card and the composition from the item page. When you download the clean
full-size file, save it over the same filename and both problems disappear with
no library edit.

### Adobe Stock, without an API key

Adobe returns `403` to any request from `curl` or `urllib` for an item **page** —
every user agent, every header combination, and the oembed endpoint. That is a
TLS and JavaScript check rather than a header one, which is why swapping the
user agent never helped and never will. Its image **CDN** has no check at all: a
plain GET with no user agent and no referer returns the watermarked comp.

**A real browser is not blocked, and that is the part this file used to get
wrong.** Driving an actual browser session at `stock.adobe.com/images/x/<id>`
renders the whole page, signed out, and the four fields the CDN route cannot
supply are all sitting in it:

| | |
|---|---|
| `by <name>` | the contributor, for the `by` field and `--review`'s concentration check |
| `DIMENSIONS` | the real asset size — **not** the 1000px comp — which is the AI screen below |
| `LICENSE TYPE` | `Standard or Extended` is subscription-covered; `Enhanced` is per-image |
| the `1000_F_` `<img>` | the CDN preview address, without right-clicking anything |

So the API key is optional rather than required, and the manual copy step is a
convenience rather than the only way in. The tools themselves still use `urllib`
and so still hit the 403 — the constraint is real *for them*. What changed is
what a person, or an agent with a browser, has to type by hand.

Either way, paste the image address rather than the page address. Right-click the
preview on Adobe Stock and choose **Copy image address**, or read it off the DOM:

```bash
./tools/images-add.py --cat Technology --title "Two engineers at a whiteboard" \
  "https://as2.ftcdn.net/jpg/19/04/00/09/1000_F_1904000970_WvhiNxc....webp"
```

The Adobe id is inside that filename (`1000_F_<id>_<hash>`), so the entry and its
link back to Adobe are rebuilt from it. Only the title needs supplying, because
the CDN serves an image and not a page to read one off — and Adobe deliberately
puts its own logo in `og:image`, so even the page would not give you the picture.

This is how the original fifty comps were obtained; they just were not automated
at the time.

**Free is not automatically cheaper.** Five Unsplash candidates were reviewed for
the Engineering category and one was used. Of the rejects: one carried a Twitter
logo and a client's hashtag on the office signage, one was a geology CAD screen
rather than anything consulting-shaped, and two were portrait crops that will not
survive the 3:2 frame. That hit rate is the real cost of the free tiers — the
curation work that a paid library has already done for you.

### What rbaconsulting.com actually looks like

Worth matching, because the library and the website should not look like two
different companies. The photography on rbaconsulting.com is strikingly
consistent:

- **One person, mid-shot.** Not teams, not boardrooms.
- **Holding a device, looking down at it.** Absorbed in the work, not presenting
  to camera. Almost none of their images make eye contact.
- **A real environment behind, softly defocused** — a data wall, a warehouse
  aisle, an office floor. The place is legible but never competes.
- **Bright and naturally lit.** Nothing cinematically graded, no teal-and-orange.
- **Business casual.** Shirts, no suits, no hi-vis, no hard hats.

Measured against that, the biggest mismatch in this library is the Gorodenkoff
material: dark, cool-graded, often industrial PPE. It is 18% of the set and it is
the furthest thing here from how RBA presents itself.

**The sources of their images could not be identified.** Three routes were tried
and all are closed: the filenames are renamed on upload
(`IT-Leader.png`, `Operations-and-biz-leader.png`), the EXIF and IPTC are stripped
by their CDN's re-encoding, and reverse image search is not available here. If you
want a specific one added, run it through Google Images or TinEye yourself and
paste the Adobe Stock link — the CDN route above turns that into one command.

**Exclusivity is the thing worth paying for.** For a page that says "this is what
RBA looks like", the failure mode is not a mediocre photo, it is the same photo on
a competitor's site. That argues for premium collections on the hero images and
free stock only where nobody is forming an impression of the brand.

## Every thumbnail is a watermarked comp

Every card shows a picture, and **every one of those pictures is an Adobe Stock
comp with the watermark still across it.** That is the point: a comp exists to be
reviewed, and this page is the review. It is not an image library, and nothing in
`shortlist/` may be used in anything that ships.

The original fifty were saved by hand from Adobe Stock, because `curl` and
`urllib` get `403` from the asset pages. That is still true of the scripts, but
not of a browser — see *Adobe Stock, without an API key* above, which is the
cheaper route now. They are `.webp`, roughly 70 KB each, 3.5 MB for the set.

**Worth deciding deliberately:** the comp licence covers internal evaluation, and
this site is reachable publicly. If that matters, the fix is to keep `shortlist/`
out of the deployed build rather than to remove it here — the cards degrade to
labelled slots on their own when the files are absent.

## Replacing a comp with the real thing

Licensing an image does not require a code change. Overwrite the comp with the
clean file under exactly the same name:

```
assets/images/shortlist/adobe-1904000970.webp
```

The card picks it up on the next load and the watermark is simply gone. No
`library.json` edit, no re-sync.

Changing the **extension** does mean one edit, because `library.json` records the
real filename and the page requests that one URL — it no longer discovers its own
content by trying four extensions and taking whichever does not 404. Drop
`adobe-1904000970.jpg` in, update `file` on that entry, re-run the sync. `--check`
will tell you if you forget.

If a card ever needs re-staging from scratch, `tools/save-previews.html` lists every
candidate in shortlist order with its link, the exact filename to save as and a copy
button, and probes the folder as you go so it doubles as a progress tracker.
`tools/images-fetch-previews.py` does the same job in one unattended pass given an
Adobe Stock API key — worth it for the whole set, overkill for one image, where
reading the fields off the page in a browser is quicker than getting a key.

Frames are 3:2, which is what most of the set is shot at. **Portrait images will be
cropped hard** — check any tall candidate in the grid before committing to it.

## The 66 → 50 pass

Every image was looked at, not read off its title: the 66 were laid out as contact
sheets and judged as a set. **27 were cut and 11 added**, which is the whole
difference between 66 and 50. `--review` now reports nothing.

### What was wrong

**1. The abstracts were one cliché eight times.** Twelve of 66 were backgrounds and
eight of those were the same picture — glowing plexus nodes, particle waves, neon
fibre, a data tunnel. Not one was on RBA's palette, most had no quiet area to set
type in, and collectively they were the visual language of the AI hype cycle on a
page that argues for pragmatism. All eight went.

**2. Four categories described the picture, not the job.** *Collaboration*,
*Applied AI & data* and *Workspaces & devices* all had a legitimate claim on a
photograph of three people at a dashboard, so the filter could not be used to find
anything. The families are now named for the page an image goes on.

**3. Compositional clusters.** Four takes on "person with a tablet in an industrial
aisle", three on "pointing at a chart on a screen", four on "colleagues walking and
talking outdoors". Cut back to one or two of each.

**4. Register drift had crept back.** The dark, cool-graded frames the previous
review removed as Gorodenkoff had returned under other names — a server room, a
green-cast machine shop, dead black monitors. Same fault, different contributors.

**5. Faceless frames in a human-centered library.** Heads cropped out of the top of
the frame, hands-only desks, a laptop with a cactus. The rule was already written
down; six images broke it.

### Per family, after

| Family | Count | Note |
|---|---|---|
| **Client work & collaboration** | 11 | The strongest set and the flagship. Largely intact from before. |
| **Focused expertise** | 8 | Rebuilt toward one person, mid-shot, absorbed in the work — the composition rbaconsulting.com uses almost exclusively. |
| **Data & AI in practice** | 8 | Was the worst family, held together by dashboards. Now shows people using software, because "data" photographed literally is always a cliché. |
| **Industries in action** | 8 | Verticals rather than machinery: agriculture, education, financial services, healthcare, retail, manufacturing, food production. |
| **Culture & careers** | 8 | Gained the mentoring frame it never had. Street-scene cluster trimmed. |
| **Backgrounds & texture** | 7 | Rebuilt around real light on real material. One data texture survives; one is the limit. |

### Eight picks are Enhanced, and it is not the eight you would guess

**8 of 50**, read off `LICENSE TYPE` on each asset page rather than inferred from
the contributor:

| Image | Contributor | Large | Small |
|---|---|---|---|
| 179326180 | John Fedele/Blend Images | $499.99 | $249.99 |
| 1705494494 | Westend61 | $499.99 | $249.99 |
| 1725109912 | Westend61 | $499.99 | $249.99 |
| 370855681 | Westend61 | $249.99 | $119.99 |
| 2110070169 | Marko Geber | $249.99 | $119.99 |
| 2008985972 | Marko Geber | $249.99 | $119.99 |
| 1708678408 | Santi Nuñez/Stocksy | $249.99 | $119.99 |
| 2110075031 | Davor | $249.99 | $119.99 |

**US$2,749.92 for all eight at full size, US$1,349.92 at 1688 × 1125.**

### In credits, which is how this actually gets paid for

Credits are universal and a Standard asset is 1 credit, so the arithmetic is
short:

| | | |
|---|---|---|
| Standard | 42 × 1 | **42 credits** |
| Enhanced | 5 × 25 | **125 credits** |
| Enhanced | 3 × 50 | **150 credits** |
| | **whole library** | **317 credits** |

Against a balance around 100: the forty-two Standard frames are covered several
times over and are not worth deliberating, and about **two** of the Enhanced eight
fit alongside them. That is the only real decision in this document. Spend them
where the brand is most exposed — homepage, campaign hero — because the failure
mode there is not a mediocre photo, it is the same photo on a competitor's site.

Credit prices are readable only when signed in; the tier is readable while signed
out. Confirm the credit cost at checkout.

**The earlier count of eleven was wrong**, and wrong in a way worth recording: it
was assembled by matching agency names, on the assumption that a peopleimages or
Monkey Business byline meant a premium tier. It does not. Those, and Jacob Lund,
are all Standard — while Marko Geber and Davor, which no name-based list would
have flagged, are Enhanced. The tier is a field on the asset page and nothing
else is a substitute for reading it:

- `LICENSE TYPE: Enhanced` — two prices shown, per-image purchase, not covered.
- `LICENSE TYPE: Standard or Extended` — Standard comes from the subscription,
  Extended is $79.99.

### Adobe search is now AI-contaminated, and the filter does not save you

This is the operational finding worth keeping. Sourcing ran ~180 candidates through
contact sheets. On generic business terms — *dashboard*, *analytics*, *AI*,
*business team* — **the great majority of first-page results were AI-generated**,
with `filters[gentech]=0` applied. That filter only removes what the contributor
declared, and undeclared generative work is now the bulk of the corpus.

Four screens work, in this order. The first two cost nothing and run before you
have looked at anything; the last two need the picture in front of you.

- **Sort by downloads, not relevance.** Add `&order=nb_downloads` to the search
  URL. Relevance order on any business term returns ids in the 2.0–2.1 billion
  range, which is the 2024–25 cohort; the same query sorted by downloads comes
  back in the 121–384 million range, which is years before diffusion output
  reached this catalogue. It is the single most effective filter found so far, and
  markedly better than `filters[gentech]=0`, which only removes what a
  contributor declared. Downloads also select for images that have already
  survived other people's judgement.
  **It over-corrects on people, though.** For architecture and texture, where
  nothing dates, it is close to free. For anyone in shot it surfaces 2015–19
  stock whose wardrobe, grading and posing are visibly old, which trades an AI
  risk for a dated one. Both people-frames that survived this week's pass came
  from mid-range ids found on relevance and screened by eye. Use the sort to
  find the pre-AI band, not to pick within it.
- **The id is a date.** Adobe ids run roughly sequential by upload, so their
  magnitude alone dates an asset before you open it. Under ~500 million is
  pre-2023 and effectively pre-AI; 2 billion and up is the contaminated cohort.
  Free, and it works straight off a search-results grid.
- **Pixel dimensions.** Camera files are large and irregular: 8736 × 4896,
  7087 × 3911, 6955 × 4637. Diffusion output is small and tidy, and lands on
  2752 × 1536, 2688 × 1536, or multiples of 64. Under ~4500px wide, or a height of
  exactly 1024/1536/2048, is a reject until proven otherwise. **Three picks that
  survived visual review were dropped on this test alone**, after they had already
  been chosen — which is the argument for running it before you get attached.
- **Subject matter.** Spaces that are expensive to fake are still real: a substation,
  a crop field, a classroom, a hospital. Spaces that are cheap to fake — a generic
  bright office with a dashboard on the wall — are almost entirely synthetic now.

| Search space | Reviewed | Used | Rejected mostly for |
|---|---|---|---|
| Dashboards, analytics, "AI" | 48 | 0 | AI-generated: impossible screen graphics, plastic skin, blank screens being gestured at. |
| Industries (energy, agriculture, education, health) | 40 | 3 | Real photography, but hi-vis and hard hats — a register RBA's own site never uses. |
| Mentoring, onboarding, training | 34 | 1 | AI-generated, or backs of heads in a seminar room. |
| Developers, focused single-person work | 32 | 4 | Dark, teal-graded, or faceless. |
| Architecture, light, texture | 24 | 2 | Duplicated the glass facade already in the set. |

## Before anything is bought

Every row needs its **AI disclosure confirmed**. The review found no explicit
disclosure on any asset page, which is not the same as confirming there is none —
and the brief excludes AI-generated imagery, so this is the check that decides
whether a pick is valid at all.

Also per asset: the licence tier (several picks are Stocksy or other
premium-collection assets a standard subscription does not cover), the model
release against the intended use, and — for anything carrying the brand — whether
a standard-collection image is too widely licensed to be sensible.

## There is no bundle

`tools/build-bundles.sh` has no images entry. A zip of unlicensed comps would be
worse than no zip. Add one back when there is a licensed set worth shipping
together.

## What was here before

Six gradient SVG stand-ins wired into a generic photo gallery, both now removed —
the shortlist board replaced the gallery, and a placeholder that looks like a
finished asset is worse than an empty section.

The earlier hunt for real photography is worth not repeating. The canonical
design-system project has no photo library: its `uploads/` folder is screenshots
and documents, and its own slide templates render gradient placeholders labelled
"Photo background placeholder". The 32 photographs in OneDrive — `office/`,
`factory/`, `bio industrial/` — are all Getty stock, with `photoshop:Credit="Getty
Images"`, an `xmpRights:WebStatement` pointing at Getty's EULA and
`plus:DataMining` prohibited. This Adobe Stock shortlist is the answer to that
gap, which is why it needs licensing rather than importing.
