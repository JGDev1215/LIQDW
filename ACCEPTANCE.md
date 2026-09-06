# Acceptance record — 2026-09-06

Status: **PASS for the requested descriptive HTML study**, with the historical
and universe limits below. No claim of a trading edge or absolute oldest data.

## Project gate

- [x] Supports separate, traceable descriptive research under PROJECT_GOAL.md.
- [x] Current user request explicitly authorizes HTML backtest research and
  consideration of S&P and old-company shares. This is not an operational
  weekly/daily delivery plan, and does not change the Grok report contract.
- [x] Operational source hierarchy and original research evidence unchanged.
- [x] Original market database queried read-only; no database copy or mutation.
- [x] Facts, calculated patterns, assumptions and unavailable evidence labeled.
- [x] Data cutoff, source/session clocks and fixed/mutable boundaries disclosed.
- [x] No invented historical OHLC, executions, stop orders or corporate ages.
- [x] Each source series and adjustment variant is independent; no source splice.
- [x] Global ranking, historical availability and economic-return limits visible.

## Numeric and implementation checks

- [x] Seven synthetic checks: strict/equal breach; two-sided exclusion; FVG
  orientation/midpoint and future-only revisit; gap censoring; displacement and
  sweep-sequence availability; future-data invariance; next-open/non-overlap;
  temporal-split purge; zero-volume weeks. Some checks cover multiple cases.
- [x] Independent scalar implementation reproduces all **79,666 event rows**.
- [x] **235,399** forward-return fields independently reproduced.
- [x] **3,888** period/horizon/direction summary counts, means and medians checked.
- [x] All **480** FVG follow-up summary rows independently checked for complete
  denominators, threshold hits, range touches and conditional median waits.
- [x] **50** sampled external weekly bars reconstructed directly from raw JSON.
- [x] **Five** local weekly bars independently rebuilt by separate read-only
  SQLite queries, including exact minute counts and all four OHLC fields.
- [x] **6,852** mechanical position records checked for timing, arithmetic,
  cost deductions and non-overlap.
- [x] Raw-source hashes verified. Initial unfiltered results retained separately.
- [x] All 18 benchmark primary excess-return intervals contain zero.
- [x] Desktop/mobile browser checks: no JavaScript errors, five filter cases,
  charts populated, CSV download/pagination verified, no page overflow at 390px.
- [x] HTML makes **zero external network requests**; dependencies/data embedded.
- [x] Desktop, FVG/example and mobile screenshots visually inspected.

## Explicit limits, not passed claims

- A verified worldwide oldest-five stock ranking is **not established**.
  The five documented old operating lineages and two listing-history checks
  are transparently named, with their corporate-identity caveats.
- The oldest obtainable screened record is **not a universal numerical limit**.
  Older licensed/archival history may exist; it was not purchased or fabricated.
- S&P pre-1962 observed intraday OHLC is unavailable from this source.
  Open-dependent calculations are disabled before the week of 26 April 1982.
- Exact holiday completeness and original-tick reconciliation for every external
  daily observation are **not certified**. All observed gaps remain explicit.
- Futures contract-roll returns, stock rights/recapitalization economics,
  realistic historical execution costs and short-borrow eligibility are
  **not modeled**. The mechanical check is a signed price-return illustration.
- Stop-order locations, intraday path, institutional intent and the complete
  discretionary ICT model cannot be established from weekly OHLC.
- Statistical intervals are exploratory and pointwise, with no multiplicity
  correction. The chronological later period is a robustness check, not a
  separately registered untouched holdout. Survivor bias remains.

Verification evidence: `results/verification.json`,
`results/local_aggregation_verification.json`,
`results/browser_verification.json` and `results/run_checksums.json`.
