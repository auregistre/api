#!/usr/bin/env bash
# auregistre - What changed in a French company, and when.
# No key, no account. Run any line on its own.
set -euo pipefail

# Every recorded change for Doctolib, with the announcement behind each one.
curl -s 'https://auregistre.fr/api/company/794598813/timeline' | jq '.timeline[] | {field, changes}'

# The same answer says where the company stands under insolvency law, ready-made.
# Do not recompute it from .proceedings by taking the worst judgment: a closure
# cancels a liquidation, and a set-aside cancels the judgment it sets aside.
curl -s 'https://auregistre.fr/api/company/981809627/timeline' | jq '{insolvency, proceedings: .proceedings[0]}'

# The accounts it filed, fiscal year by fiscal year. .perimeter says whether a
# line is the company alone (legal_entity) or its group (group): never add them.
curl -s 'https://auregistre.fr/api/company/794598813/financials' | jq '.statements[] | {fiscal_year, perimeter, revenue, net_income}'

# A watch over companies you already track. Twenty at most, thirty days by default.
curl -s 'https://auregistre.fr/api/changes?siren=794598813,552032534&since=2026-06-01' | jq '.companies[] | {legal_name, seen: (.changes | length), complete}'

# Insolvency openings, twelve months against the twelve before. Add
# /department/{code} or /trade/{slug} for one slice of the country.
curl -s 'https://auregistre.fr/api/insolvencies' | jq '{window, reference, change_percent}'

# Conditional: hand back the validator and get a 304 with no body.
etag=$(curl -sI 'https://auregistre.fr/api/company/794598813/timeline' | tr -d '\r' | awk '/^[Ee][Tt]ag:/{print $2}')
curl -s -o /dev/null -w '%{http_code}\n' -H "if-none-match: $etag" 'https://auregistre.fr/api/company/794598813/timeline'

# A refusal is a problem document, not a page. 000000000 is the filler the
# gazette prints when an announcement carries no company number: hundreds of
# unrelated announcements share it, so it is refused rather than invented.
curl -s 'https://auregistre.fr/api/company/000000000/timeline' | jq '{type, title, status}'
