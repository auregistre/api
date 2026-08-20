#!/usr/bin/env bash
# auregistre - What changed in a French company, and when.
# No key, no account. Run any line on its own.
set -euo pipefail

# Every recorded change for Doctolib, with the announcement behind each one.
curl -s 'https://auregistre.fr/api/company/794598813/timeline' | jq '.timeline[] | {field, changes}'

# Conditional: hand back the validator and get a 304 with no body.
etag=$(curl -sI 'https://auregistre.fr/api/company/794598813/timeline' | tr -d '\r' | awk '/^[Ee][Tt]ag:/{print $2}')
curl -s -o /dev/null -w '%{http_code}\n' -H "if-none-match: $etag" 'https://auregistre.fr/api/company/794598813/timeline'

# A refusal is a problem document, not a page. 000000000 is the filler the
# gazette prints when an announcement carries no company number: hundreds of
# unrelated announcements share it, so it is refused rather than invented.
curl -s 'https://auregistre.fr/api/company/000000000/timeline' | jq '{type, title, status}'
