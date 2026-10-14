#!/usr/bin/env bash
# usage: describe-api-change.sh <previous spec> <current spec> <output markdown>   (needs OASDIFF_IMAGE, docker and jq)
# Writes the body of the spec-update pull request: whether the API change is breaking, what changed, and which version bump that suggests.
set -euo pipefail
PREVIOUS_SPEC="${1:?previous spec}"
CURRENT_SPEC="${2:?current spec}"
OUTPUT_FILE="${3:?output file}"
: "${OASDIFF_IMAGE:?OASDIFF_IMAGE must name a pinned oasdiff image}"
ERROR_LEVEL=3

COMPARE_DIR="$(mktemp -d)"
trap 'rm -rf "$COMPARE_DIR"' EXIT
cp "$PREVIOUS_SPEC" "$COMPARE_DIR/previous.yaml"
cp "$CURRENT_SPEC" "$COMPARE_DIR/current.yaml"

run_oasdiff() { docker run --rm --volume "$COMPARE_DIR:/specs:ro" "$OASDIFF_IMAGE" "$@" /specs/previous.yaml /specs/current.yaml; }

BREAKING_JSON="$(run_oasdiff breaking --format json)"
CHANGELOG_JSON="$(run_oasdiff changelog --format json)"
BREAKING_COUNT="$(jq "[.[] | select(.level >= $ERROR_LEVEL)] | length" <<<"$BREAKING_JSON")"
CHANGE_COUNT="$(jq 'length' <<<"$CHANGELOG_JSON")"

{
  echo "The published API description changed. This pull request regenerates the client from it."
  echo
  echo "## Version"
  if [[ "$BREAKING_COUNT" -gt 0 ]]; then
    echo "**$BREAKING_COUNT breaking change(s) found.** Bump the minor version while the package is below 1.0, and the major version after that. Review the list below before merging."
  elif [[ "$CHANGE_COUNT" -gt 0 ]]; then
    echo "No breaking changes found. Additions and documentation changes need only a patch version bump (a minor bump if you want to announce new operations)."
  else
    echo "The API itself did not change (only text that does not affect the client). No new version is needed."
  fi
  echo
  echo "## Breaking changes"
  echo
  if [[ "$BREAKING_COUNT" -gt 0 ]]; then
    echo '```'
    run_oasdiff breaking
    echo '```'
  else
    echo "None."
  fi
  echo
  echo "## All changes"
  echo
  if [[ "$CHANGE_COUNT" -gt 0 ]]; then
    echo '```'
    run_oasdiff changelog
    echo '```'
  else
    echo "None."
  fi
} > "$OUTPUT_FILE"
