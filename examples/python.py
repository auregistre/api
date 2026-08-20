"""The share capital of a French company, every value the gazette recorded."""

import urllib.request, json

SIREN = "794598813"  # Doctolib

with urllib.request.urlopen(f"https://auregistre.fr/api/company/{SIREN}/timeline") as answer:
    company = json.load(answer)

print(company["legal_name"])
for thread in company["timeline"]:
    if thread["field"] != "share_capital":
        continue
    for step in thread["history"]:
        amount = step.get("amount")
        print(step["date"], step["value"], "->", step.get("source", ""))
        if amount:
            assert amount["currency"] == "EUR"

# Reusing this data requires citing the source and the day it was read.
print(company["attribution"][0]["name"], company["attribution"][0]["retrieved"])
