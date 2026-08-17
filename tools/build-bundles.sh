#!/usr/bin/env bash
#
# Rebuild the zip bundles behind every "Download all" button.
#
# GitHub Pages serves static files and cannot zip a folder on request, so the
# bundles are pre-built and committed. That makes staleness the one real failure
# mode of this site: a bundle can silently lag the folder it represents. This
# script being the only way bundles are made is the guard — it prints the file
# count and size of everything it writes, so a bundle that came out smaller than
# you expected is visible at the point of building it.
#
# Run it from anywhere; it locates the repo itself.
#
#   ./tools/build-bundles.sh
#
# Then COMMIT the zips. A rebuild that isn't committed
# is the same as no rebuild at all.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

command -v zip >/dev/null || { echo "error: 'zip' is not installed." >&2; exit 1; }

mkdir -p downloads

# collection : bundle name : include glob
#
# The icons are split by format on purpose. Together they are 9.4 MB, but the SVGs
# alone are 1.3 MB and are what almost everyone actually wants — one combined
# bundle would make the common case download seven times what it needs. Splitting
# also keeps the 8 MB PNG zip out of git history on any revision that only touched
# vectors.
#
# A fourth field is an extra exclude glob, for a collection that has files inside it
# which are not part of the download. The logo library is the only one so far: `_*/*`
# skips its two underscore folders — the source rasters it was traced from, and the
# handful of harvested files that turned out not to be logos.
COLLECTIONS=(
  "logos:rba-logos:*"
  "icons:rba-icons-svg:*.svg"
  "icons:rba-icons-png:*.png"
  "logo-library:rba-logo-library-svg:*.svg:_*/*"
  "logo-library:rba-logo-library-png:*.png:_*/*"
  # No images entry: assets/images/ holds the shortlist workbook and, once
  # anything is licensed, files under shortlist/. Neither is a "download the
  # whole set" collection, and a zip of unlicensed comps would be worse than
  # none. Add one back when there is a licensed set worth shipping together.
  "templates:rba-templates:*"
)

for entry in "${COLLECTIONS[@]}"; do
  IFS=':' read -r name bundle glob skip <<< "$entry"
  src="assets/$name"
  out="downloads/$bundle.zip"

  if [ ! -d "$src" ]; then
    echo "skip  $out — $src does not exist"
    continue
  fi

  # Check for content first. zip exits non-zero with "Nothing to do!" on an empty
  # folder, and letting that noise through would train everyone to ignore this
  # script's output — which is where the staleness warnings live.
  if [ -z "$(find "$src" -type f -name "$glob" ! -name 'README.md' ! -name '.*' \
              ${skip:+! -path "$src/$skip"} -print -quit)" ]; then
    echo "empty $out — $src has no $glob files yet, no bundle written"
    continue
  fi

  # -x excludes the folder's own instructions and macOS cruft: a README telling
  # you how to add assets is noise inside a bundle of the assets themselves.
  rm -f "$out"
  ( cd "$src" && zip -q -r "$ROOT/$out" . -i "$glob" \
      -x "README.md" -x "*/README.md" -x ".*" -x "__MACOSX/*" ${skip:+-x "$skip"} )

  # The favicons are logo derivatives, so they ride along in the logo bundle rather
  # than becoming a fifth download button for three small PNGs. Nested under
  # favicons/ inside the zip so it's obvious what they are.
  if [ "$src" = "assets/logos" ] && [ -d assets/favicons ]; then
    ( cd assets && zip -q -r "$ROOT/$out" favicons -x "*/README.md" -x ".*" -x "__MACOSX/*" )
  fi

  if [ -f "$out" ]; then
    count=$(unzip -Z1 "$out" 2>/dev/null | grep -cv '/$' || true)
    printf 'built %-32s %s file(s), %s\n' "$out" "$count" "$(du -h "$out" | cut -f1 | tr -d ' ')"
  fi
done

# This used to stamp a build date into a constant in app.js, which the pages printed
# next to each "download all" button. The pages no longer show it, so the stamp was
# rewriting a value nothing read — and a build step whose output is invisible is one
# that quietly rots. The sizes and file counts printed above are the live signal now.
# See the note where the constant used to be in app.js if it is ever reinstated.

echo
echo "Done. Commit the files under downloads/."
