"""What the French gazette recorded about a company, and when."""

import json
import sys
import urllib.request

# The gazette writes French typography: "20 000 €" carries U+202F, a narrow
# no-break space. Printing it to a console that is not UTF-8 - a Windows one, by
# default - raises before the API is ever at fault.
sys.stdout.reconfigure(encoding="utf-8")

BASE = "https://auregistre.fr/api"

# Say who you are. The API asks for no key and no account, but a request that
# carries no User-Agent at all is turned away at the edge before it reaches it,
# which arrives as a 403 that has nothing to do with your call. urllib sends no
# usable one by default; every other HTTP client for Python already does.
AGENT = "auregistre-example/1.0 (+https://github.com/auregistre/api)"


def get(path):
    ask = urllib.request.Request(f"{BASE}{path}", headers={"user-agent": AGENT})
    with urllib.request.urlopen(ask) as answer:
        return json.load(answer)


# The share capital of Doctolib, every value the gazette recorded.
company = get("/company/794598813/timeline")
print(company["legal_name"])
for thread in company["timeline"]:
    if thread["field"] != "share_capital":
        continue
    for step in thread["history"]:
        print(step["date"], step["value"], "->", step.get("source", ""))
        amount = step.get("amount")
        if amount:
            assert amount["currency"] == "EUR"

# Where it stands under insolvency law, or None. Do NOT recompute this from
# company["proceedings"] by taking the worst one: a closure cancels a
# liquidation, and a set-aside cancels the judgment it sets aside.
print(company["insolvency"])

# A watch over companies you already track: identifiers, never criteria.
# Twenty at most, and each one spends a unit of the rate limit.
watch = get("/changes?siren=794598813,552032534&since=2026-06-01")
for tracked in watch["companies"]:
    # complete=False means the list is a BEGINNING, not that nothing happened.
    print(tracked["legal_name"], len(tracked["changes"]), tracked["complete"])

# Insolvency openings, twelve months against the twelve before.
barometer = get("/insolvencies")
print(barometer["window"]["openings"], barometer["change_percent"])

# Reusing this data requires citing the source and the day it was read.
print(company["attribution"][0]["name"], company["attribution"][0]["retrieved"])
