# E-Commerce Scraper

A Node.js CLI that crawls `https://webscraper.io/test-sites/e-commerce/static`, expands HDD sizes, and writes one JSON object to `out.json`.

## Requirements

- Node.js 22 or newer
- pnpm

## Setup and usage

```sh
pnpm install
pnpm start
```

Default: beautified JSON in `out.json`. `--stdout` prints it instead (needed for a pipe):

```sh
pnpm start --stdout
```

- `--stdout`: print JSON instead of writing `out.json`
- `--unique-total`: `total` = distinct prices, not every row
- `--verbose`: request diagnostics on stderr
- `--help`: usage

Bad args → exit `2`. Fetch/parse/catalog errors → exit `1`, no partial JSON.

## Output

```json
{
  "results": [
    {
      "name": "Dell Latitude 5580 128 GB",
      "description": "Dell Latitude 5580, 15.6\" FHD",
      "price": 1178.19
    }
  ],
  "total": 1178.19
}
```

Sorted by URL, then HDD size. Same name/price can repeat if the description differs. `colors` only when there is more than one option. HDD prices and `total` — Trade-offs.

## Architecture

```text
CLI (arguments, orchestration, output)
  └─ scraper (HTTP, catalog discovery, HTML parsers)
       └─ domain (money, variants, aggregation)

lib (logging, bounded concurrency, shared error helpers)
```



## Development

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
```



## Trade-offs and Future Improvements



### Trade-offs

The task had the following ambiguities:

- It wants one row per HDD size, but does not say how to price them. HTML is always the 128 GB figure. Extra dollars live in `app.js`, which you cannot scrape without a browser.
- It says `total` is unique prices, then the example sums `results`.
- It wants `colors` only when there are multiple options. Live phones use `select[aria-label="color"]`, not HDD swatches. Omit the key unless there are 2+ enabled options; do not split colors into extra rows.



#### HDD prices


| What                                                    | Implemented | Pros                                                             | Cons                                                                               |
| ------------------------------------------------------- | ----------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Copy `app.js` add-ons (`+0` / `+$20` / `+$40` / `+$60`) | ✓           | Matches the UI - correct prices for each HDD option; No browser. | Stale if `app.js` changes. `+$60` unused (1024 disabled). Unknown size gets `+$0`. |
| Copy the same HTML price onto every HDD option          | ✗           | Matches GET. Tiny code.                                          | 256 / 512 look cheaper than in the browser.                                        |
| Click each size in a browser                            | ✗           | Always matches the UI.                                           | Playwright: slow, flaky, too much for 1–2 hours and a CLI.                         |
| Fetch `?hdd=`                                           | ✗           | Looks like an API.                                               | Same HTML. No change.                                                              |
| Hardcode each product                                   | ✗           | Exact today.                                                     | Breaks when the catalog changes.                                                   |




#### `total`


| What                                       | Implemented | Pros                                                                                                | Cons                                                                                                                           |
| ------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Sum every product row                      | ✓           | Sum of every emitted row, including HDD options - correct total based on correct HDD option prices. | Not the word "unique" in the task.                                                                                             |
| Sum each distinct price (`--unique-total`) | ✓           | Follows the task wording. Opt-in flag.                                                              | Same `$899.99` twice counts once. `total` no longer equals the list. Unique-total after HDD add-ons is not unique HTML prices. |
| Sum listing prices only, skip HDD split    | ✗           | Smaller number.                                                                                     | Throws away HDD rows.                                                                                                          |
| Dedupe by name, then sum                   | ✗           | Looks tidy.                                                                                         | Drops real products (`Dell Latitude 5480` is 8 URLs).                                                                          |




#### Colors


| What                                                                                           | Implemented | Pros                                                  | Cons                                                           |
| ---------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| Field on the product; omit unless 2+ enabled options; parse `select` (and swatches if present) | ✓           | Matches the task. Matches live phones. No extra rows. | Task example looks like swatch buttons; `gold` vs live `Gold`. |
| One JSON row per color                                                                         | ✗           | Same pattern as HDD.                                  | Task never asked. Mixes two product axes.                      |
| Skip `colors`                                                                                  | ✗           | Simpler parser.                                       | Fails the Samsung example on phones.                           |




#### Additional


| What                                               | Implemented | Pros                                                     | Cons                                   |
| -------------------------------------------------- | ----------- | -------------------------------------------------------- | -------------------------------------- |
| No browser, cache, DB, Docker, CI, or partial JSON | ✓           | Fits 1–2 hours. Cheerio is enough for a CLI.             | Not a long-lived crawler.              |
| `out.json` by default                              | ✓           | pnpm extra stdout breaks a pipe. `--stdout` is explicit. | The task asked for stdout, not a file. |
| Pretty JSON always                                 | ✓           | Easy to read.                                            | Noisy on a pipe.                       |
| Names are not IDs; dedupe by URL only              | ✓           | Keeps same-name products.                                | You will see repeated titles.          |




### Future improvements


| What                                               | Why                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `--limit <n>`                                      | Cap products after discovery; today the full catalog always runs                     |
| `--concurrency <n>`                                | Override the fixed pool of 8 detail fetches                                          |
| Stop crawl once `--limit` is hit                   | Only useful after `--limit` exists                                                   |
| `--out <path>`                                     | `out.json` is hardcoded                                                              |
| Live smoke test on shape/`total`, not catalog size | Catch a redesign without freezing counts                                             |
| Cap `Retry-After`                                  | A `3600` header currently parks the process for an hour                              |
| Parallel listing fetches                           | Category/pagination crawl is still sequential                                        |
| HTTP cache on disk                                 | Repeat local runs should not hit the site ~173 times                                 |
| Fixture refresh                                    | Checked-in HTML drifts from the live site                                            |
| CI and a container                                 | Reproducible install/test/run outside a laptop                                       |
| `--allow-partial`                                  | Fail-loud is the default; some operators want a short `results` plus a non-zero exit |
| Cancel in-flight requests on failure               | The pool already stops starting work; up to 7 fetches still complete                 |


## Bottom Line

The interesting part was the ambiguities in the task - unique vs row-sum `total`, HTML price vs HDD UI, colours that aren't swatches. Defaults keep the full catalog; flags keep the other readings. Thanks for the task.