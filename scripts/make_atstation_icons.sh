#!/usr/bin/env bash
#
# Generate "_atstation" product icons by compositing a black SpaceStation badge
# onto the bottom-left of each launchable product's source icon.
#
# Usage:
#   ./scripts/make_atstation_icons.sh            # regenerate the default set
#   ./scripts/make_atstation_icons.sh <stem>...  # regenerate just the named stems
#                                                  e.g. spacecrew electronics4
#
# Tunables: BADGE_SIZE, BADGE_COLOR_OP, BADGE_GRAVITY (see below).
# Requires: ImageMagick (`convert`).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PRODUCTS_DIR="$REPO_ROOT/public/assets/products"
BADGE_SRC="$REPO_ROOT/public/assets/ui/SpaceStation.png"

# --- tunables ---------------------------------------------------------------
BADGE_SIZE="${BADGE_SIZE:-36x36}"           # ~55% of a 64x64 source icon
BADGE_GRAVITY="${BADGE_GRAVITY:-southwest}" # bottom-left placement
# Force badge RGB to black while preserving alpha. Override to "" to keep
# the badge's native color (e.g. a gray SpaceStation icon).
BADGE_COLOR_OP="${BADGE_COLOR_OP:--channel RGB -evaluate set 0 +channel}"

# Default launchable stems. These mirror `LAUNCHABLE_PRODUCT_IDS` in
# data/reformat.ts, stripped to the icon stem (lowercased, no `Product_` /
# `Product_Virtual_` prefix). Keep in sync if that list changes.
DEFAULT_STEMS=(
  stationpartsbasic   # Product_SpaceStationParts1
  stationparts        # Product_SpaceStationParts2
  crewsupplies        # Product_CrewSupplies
  electronics4        # Product_Electronics4
  asteroidboosterparts # Product_AsteroidBoosterParts
  spaceprobeparts     # Product_SpaceProbeParts
  spacecrew           # Product_Virtual_SpaceCrew
)
# ----------------------------------------------------------------------------

if ! command -v convert >/dev/null 2>&1; then
  echo "error: ImageMagick \`convert\` not found in PATH" >&2
  exit 1
fi

if [[ ! -f "$BADGE_SRC" ]]; then
  echo "error: badge source not found at $BADGE_SRC" >&2
  exit 1
fi

stems=("$@")
if [[ ${#stems[@]} -eq 0 ]]; then
  stems=("${DEFAULT_STEMS[@]}")
fi

# Pre-recolor the badge into a temp file so we don't repeat the op per stem.
tmp_badge="$(mktemp --suffix=.png)"
trap 'rm -f "$tmp_badge"' EXIT
# shellcheck disable=SC2086  # BADGE_COLOR_OP is intentionally word-split
convert "$BADGE_SRC" $BADGE_COLOR_OP -resize "$BADGE_SIZE" "$tmp_badge"

for stem in "${stems[@]}"; do
  src="$PRODUCTS_DIR/$stem.png"
  out="$PRODUCTS_DIR/${stem}_atstation.png"
  if [[ ! -f "$src" ]]; then
    echo "skip: source icon not found: $src" >&2
    continue
  fi
  convert "$src" "$tmp_badge" -gravity "$BADGE_GRAVITY" -composite "$out"
  echo "wrote $out"
done
