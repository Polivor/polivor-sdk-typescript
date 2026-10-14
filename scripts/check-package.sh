#!/usr/bin/env bash
# Packs the SDK, installs the tarball into an empty project and type-checks a consumer file, so a package that ships without its types fails here and not for users.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
SDK_DIR="$PWD"
CONSUMER_DIR="$(mktemp -d)"
trap 'rm -rf "$CONSUMER_DIR"' EXIT
TARBALL="$(npm pack --pack-destination "$CONSUMER_DIR" --silent)"
cp test-types/consumer.mts "$CONSUMER_DIR/"
cd "$CONSUMER_DIR"
npm init -y >/dev/null
npm install --silent --no-audit --no-fund --ignore-scripts "./$TARBALL" "typescript@$(node -p "require('$SDK_DIR/package.json').devDependencies.typescript")" "@types/node@$(node -p "require('$SDK_DIR/package.json').devDependencies['@types/node']")"
npx tsc --noEmit --module nodenext --moduleResolution nodenext --target es2022 --strict --skipLibCheck consumer.mts
echo "package check: ok"
