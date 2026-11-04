#!/usr/bin/env sh
set -e
OUT="${1:?usage: run.sh <out-dir>}"
SCENE_OUT="$OUT" npx jest -c scripts/scene-compare/jest.config.js
node scripts/scene-compare/proto.mjs "$OUT"
node scripts/scene-compare/compare.mjs "$OUT"
