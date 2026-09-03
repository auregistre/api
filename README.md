# auregistre

**What changed in a French company, and when.**

A company-data service usually publishes a **state**: the name, the address and
the share capital as of today. This API publishes the **history**: every value
the French official gazette (BODACC) has recorded for a company, the date it
was published, and a link to the announcement that published it.

Four things follow from that one idea: the **timeline** of a company and the
insolvency judgments against it, its **filed accounts** fiscal year by fiscal
year, a **watch** over companies you already track, and the **count** of
insolvency openings over time.

Nothing is inferred, scored or estimated.

No API key, no account, no quota to apply for. Every figure here was published
by a public source; whoever republishes it should say so, and every answer
carries the sentence to do it with.

- **The API**: `https://auregistre.fr`
- **Human documentation**: https://auregistre.fr/api
- **The contract**: [`openapi.json`](openapi.json), also served live at `https://auregistre.fr/api/openapi.json`
- **The site**: https://auregistre.fr

## Install

```sh
npm install auregistre
```

```js
import { timeline, financials, changes, insolvencies, ApiError } from 'auregistre';

const doctolib = await timeline('794 598 813');
const accounts = await financials('794 598 813');
```

Zero dependencies, ESM, Node 18 or newer. The client is a thin layer: it builds
the addresses, reads refusals as problem documents, and follows pages. Nothing
stops you from calling the API with `curl`.

## Endpoints

| Address | Answers |
| --- | --- |
| `GET /api/company/{siren}/timeline` | Every recorded change for one company, and its insolvency judgments |
| `GET /api/company/{siren}/financials` | The accounts it filed, fiscal year by fiscal year: revenue, margins, net income, thirteen INPI ratios |
| `GET /api/changes?siren={a,b,c}&since={date}` | What the gazette published on companies you already track |
| `GET /api/insolvencies` | Insolvency openings in France, twelve months against the twelve before |
| `GET /api/insolvencies/department/{code}` | The same barometer, for one department |
| `GET /api/insolvencies/trade/{slug}` | The same barometer, for one trade |
| `GET /api/openapi.json` | The contract, generated from the constants the code serves |
| `GET /api` | The human documentation, with one anchor per refusal code |

There is deliberately **no search endpoint**, and there will not be one: article
A.123-69 of the French commercial code forbids four search criteria, all
judicial, and the only shape that cannot expose them is the one that exposes no
criterion at all. `/api/changes` is not an exception - it takes identifiers you
already hold, never criteria, and a caller who does not know a SIREN learns none
from it. To resolve a NAME into a SIREN, the state's own API does it better:
`recherche-entreprises.api.gouv.fr`.

The two barometer scopes are the **closed lists the website already publishes as
pages**, never a filter composed from what you send: an unknown department or
trade is a 404, and the refusal carries the list you can choose from.

## The conventions, which are the same across the fleet

This API answers by the same convention as its two siblings
([auregistre](https://github.com/auregistre/api),
[titelia](https://github.com/titelia/api),
[quivad](https://github.com/quivad/api)). What holds for one holds for the three.

- **No version in the address, and none in the body.** The promise that replaces
  it is written in `x-stability` of the contract: a field may be **added**, none
  is removed or renamed under a caller, and an address does not move.
- **Refusals are RFC 9457 problem documents**, served as
  `application/problem+json`. `type` is a documentation anchor that opens in a
  browser; `title`, `status` and `detail` say the rest. An error is never an
  HTML page - a program that calls `.json()` on one gets a parse error and goes
  looking for the fault in the wrong place.
- **Long collections are cut by `limit` and `offset`**, never silently. The
  `page` block carries `total`, `more`, and the absolute address of the next
  and previous pages; the same two links travel in the `Link` header. An
  unreadable parameter falls back to the default rather than refusing, and an
  offset past the end is an empty list, not an error.
- **Every address in an answer is absolute.** A response stored on somebody's
  disk has to say which host it came from.
- **`source` and `served_by` answer two different questions**: who PRODUCED
  the figures, and who ANSWERED. Confusing them is how a republished figure gets
  credited to the wrong party.
- **Every answer carries a weak `ETag`** and honours `If-None-Match`: hand it
  back and get a `304` with no body.
- **Discovery links on every answer** (RFC 8631): `service-desc` points at the
  contract, `service-doc` at the human documentation. One answer in hand is
  enough to find the whole specification.
- **Rate limited by address**, on `/api` only, and a cached answer does not
  count. A `429` carries `retry-after` and says how long to wait in the body.

## What the data does not say

Three limits are worth more than the rest of this page, because each one lets a
reader draw a wrong conclusion in silence.

- **The earliest value is not the original value.** The gazette has been
  digitised since 2008. For an older company, `first_known` is the oldest value
  on record, not the value it was founded with.
- **The register publishes THAT something changed, not by how much.** A capital
  increase appears as a new figure on a date; who came in, and on what terms, is
  not published.
- **Announcements that merely cite a SIREN are excluded.** On large franchised
  networks these are around 40% of what a naive search on the identifier
  returns, and they describe a different company.

Four more belong to the addresses that came after the timeline.

- **Company-only and consolidated accounts never add up.** Every entry of the
  financials carries a `perimeter`: `legal_entity` is the one company under
  this SIREN, `group` the consolidated accounts of its group. A holding files a
  revenue of zero beside a group revenue in the billions, and a figure quoted
  without its perimeter is a figure quoted wrong. Filings kept confidential are
  not listed, so a missing fiscal year is not a fiscal year at zero.
- **`insolvency` is served ready-made, and must not be recomputed.** Taking the
  most severe entry of `proceedings` would mark as liquidated a company a court
  put back on its feet: a closure cancels a liquidation, a set-aside cancels the
  judgment it sets aside, and two judgments can share a date.
- **The watch filters on the PUBLICATION date, not on the date of the act.** The
  two differ by sixteen days at the median, and filtering on the act would miss
  precisely what a watch exists to catch. `complete: false` means the list is a
  BEGINNING; an empty list with `complete: true` means nothing happened, which
  is a different fact.
- **The three natures of insolvency do not add up to the total.** A judgment
  naming two procedures answers two filters, which overshoots by well under one
  percent. Closures are not counted at all, and the current month is always
  excluded because a month still running reads as a collapse.

## Examples

Runnable, in [`examples/`](examples): [`curl.sh`](examples/curl.sh),
[`node.mjs`](examples/node.mjs), [`python.py`](examples/python.py).

## Licence

The client code in this repository is MIT (see [LICENSE](LICENSE)).

**The data is not covered by that licence**: Licence Ouverte 2.0 (Etalab), BODACC. Cite the source
when you republish it - every answer carries the sentence to do it with.

## Reporting something wrong

A wrong line is worth an issue: <https://github.com/auregistre/api/issues>.
Name the address you called and what you expected; the answer carries
`served_by`, which is what says the figure came from here rather than from the
register itself.
