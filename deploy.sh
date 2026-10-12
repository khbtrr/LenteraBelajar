#!/usr/bin/env bash
set -euo pipefail

: "${RELEASE_SOURCE_DIR:?Select the reviewed source revision with installed release tools}"
: "${RELEASE_ARTIFACT_DIR:?Select the tested standalone artifact}"
: "${APP_CURRENT_DIR:?Select the application current symlink}"
: "${RELEASE_DATABASE_URL:?Select the reviewed database explicitly}"
: "${MAINTENANCE_CONFIRMED:?Confirm maintenance and completed active exams}"
: "${BACKUP_VERIFIED:?Confirm a restorable DB and uploads backup}"
: "${DATA_REVIEW_CONFIRMED:?Confirm legacy reconciliation and schema review}"

test "$MAINTENANCE_CONFIRMED" = yes
test "$BACKUP_VERIFIED" = yes
test "$DATA_REVIEW_CONFIRMED" = yes
test -f "$RELEASE_ARTIFACT_DIR/server.js"
test -f "$RELEASE_ARTIFACT_DIR/.release-manifest.json"

cd "$RELEASE_SOURCE_DIR"
npm run release:preflight -- --before-migrate
node node_modules/prisma/build/index.js migrate deploy --config prisma.config.release.ts
npm run release:gate

ln -sfn "$RELEASE_ARTIFACT_DIR" "$APP_CURRENT_DIR"
cd "$APP_CURRENT_DIR"
pm2 delete lenterabelajar lenterabelajar-cbt-worker || true
pm2 start ecosystem.config.js --update-env
curl --fail --silent http://127.0.0.1:3000/id/login >/dev/null
echo 'Candidate started. Complete role/file/CBT/grade smoke tests before ending maintenance.'
