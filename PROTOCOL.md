# Weekly liquidity and fair-value-gap research — protocol v1

Written 2026-09-06 after inspecting input coverage and before calculating event outcomes.
User-authorized descriptive HTML research; separate from operational ICT delivery notes.
No change to the project's operational source hierarchy or market-data storage.

## Questions and data

1. Does rejection after breaching a previously known weekly extreme precede a
   different four-week directional price change from the same-era baseline?
2. How frequently are weekly three-candle FVGs revisited at their near edge,
   50% consequent encroachment (CE), and far edge within 1/4/13/52 weeks?
3. What follows a rejection sweep and then a directional displacement FVG
   confirmed in one of the next three weeks?

NQ local 1-minute continuation is queried read-only and independently aggregated.
External NQ=F, Nasdaq-100 cash (^NDX), and S&P cash (^GSPC) remain separate series.
Use maximum obtainable daily history through the completed week 2026-09-04.
All downloads are retained and hashed. Never splice the series.
Pre-1962 S&P copied-close OHLC is excluded from pattern tests. Earlier close-only
observations remain an archive/data-coverage fact. Audit early S&P opens; present
1962+ HLC event statistics and a separate 1982-04-26+ open-dependent sensitivity.
The historical maximum is the oldest usable record obtained, not a claim that
no older licensed/archive data exists. No purchase or fabricated extension.

The stock extension is a survivor-selected case study. Distinguish corporate
founding, predecessor history, exchange listing, and accessible OHLC history.
A global top-five ranking requires documentary evidence; do not invent one.
Freeze the chosen cases before their event outcomes are calculated.

Pre-outcome data decisions: the five operating-origin cases are Stora Enso,
Monte dei Paschi, Orell Füssli, Matsui Construction and Sumitomo Metal Mining.
BNY and Con Edison add listing-history checks. This is a documented candidate
screen, not a certified exhaustive world ranking. Yomeishu is excluded because
JPX confirms its June 2026 delisting. Other downloaded candidates are retained
as search evidence but excluded before outcome calculation. Local NQ requires
at least 6,000 observed minutes per week, an explicitly conservative coverage
screen which excludes some holiday weeks. The fixed-only variant stops at
2026-08-07, before the mixed-source week of 2026-08-14. Full local snapshot is
a separate sensitivity. Historical source boundary: 2026-08-11 22:49 UTC.

## Weekly clock and quality

External daily bars: exchange-local calendar dates, Monday–Friday weekly bucket,
dated Friday. NQ Yahoo daily timestamps are vendor session-date labels rather
than CME session open instants. Local NQ: convert UTC to America/New_York;
Sunday 18:00 through Friday 17:00 ET, with Sunday assigned to the following
week. Exclude records outside that session envelope and report them.
Use first open, max high, min low, final close; retain count and actual boundaries.
Keep a complete weekly calendar with invalid/missing weeks as gaps. Never
forward-fill and never allow a feature or outcome to jump over a missing week.
Reject nonfinite/nonpositive or logically inconsistent OHLC, allowing only
floating-point tolerance of 1e-6 relative for vendor rounding. Exclude a week
with any invalid non-null daily OHLC. Null daily records are reported, without
pretending to know whether they were missing sessions or holidays.
First partial week dropped; holiday-shortened weeks retained. No assertion that
daily/session coverage is certified complete without an exchange holiday audit.
Stock input quote OHLC is used as supplied (Yahoo split-adjusted convention);
dividend-adjusted OHLC sensitivity multiplies ALL four fields by adjclose/close.
Do not mix adjusted close with unadjusted high/low/open.

## Operational definitions, known only at weekly close t

Liquidity means ability to transact without excessive price impact in market
microstructure. OHLC does not observe depth or resting stops. In this study
BSL/SSL refer only to candidate stop-location proxies above/below historical
extremes. No claim of actual stop execution, intent, or manipulation.

For k in {1,4,13,52}, U_t=max(H[t-k:t]), D_t=min(L[t-k:t]); exclude current bar.
Strict BSL breach: H_t > U_t; SSL breach: L_t < D_t.
BSL rejection: breach and C_t < U_t; SSL rejection: breach and C_t > D_t.
Equality is not a breach/rejection. Weeks breaching BOTH sides are counted as
two-sided and excluded from directional rejection samples: their order is unknown.
Primary k=1 (prior-week high/low); other k are sensitivity cases, not optimization.
Direction +1 after SSL rejection, -1 after BSL rejection.
Breakout comparator: single-side breach with close strictly outside that boundary.
No inferred fractal swings or retrospectively selected equal-high clusters.

Bullish FVG at t: L_t > H_(t-2), zone [H_(t-2),L_t]. Bearish FVG:
H_t < L_(t-2), zone [H_t,L_(t-2)]. CE=(lower+upper)/2. Strict positive width;
no arbitrary minimum tick shared across unlike assets. This is outer-candle
non-overlap, NOT proof that no trading happened there in the middle candle.
Displacement subset: middle candle body in FVG direction and
abs(C_(t-1)-O_(t-1)) >= 0.5 * ATR14_(t-2), where ATR14 is a simple mean of
weekly true ranges using only completed past bars. Require middle candle's
range to span both zone edges; label the other raw FVGs as non-bridging gaps.
Raw FVG and displacement FVG are both reported; no parameter fitting.

Combined event: a displacement FVG at t and same-direction k=1 rejection in
t-3,t-2,t-1. Use latest qualifying rejection, only one event at t per direction.
This simplified weekly sequence is NOT the full ICT intraday entry model;
it imposes no discretionary MSS/OB/premium-discount interpretation.

## Outcomes and controls

Primary event-study outcome: s*(C_(t+4)/C_t-1), a post-signal close-reference
price move, NOT an executable fill. Also h=1,13. Count ties as zero, not wins.
Show sample count, mean, median, positive share, and same-direction same-era
unconditional eligible-week mean. Era = ten-year calendar bucket. Excess per
event = its outcome minus its instrument/direction/decade baseline. Baseline
contains all eligible weeks, including events; it is a reference, not a causal
control. Trend/volatility matching is not claimed.
Only complete contiguous future h-week windows enter each denominator.
Confidence intervals: 1,000 circular moving-block bootstrap replicates of the
weekly timeline, block length 26 weeks, base seed 20260906 plus timeline length;
recompute the
same-era baseline within each replicate. 95% intervals are pointwise,
exploratory, not corrected for the many assets/rules/horizons examined.
Never call a confidence interval excluding zero a proven tradable edge.
Chronological 70%/30% split per series; exclude forward windows crossing the
split boundary from early-period summaries. Later sample is a temporal
robustness check, not an independently registered untouched holdout.

FVG revisit: start at t+1, never count formation candle. Threshold-reach for
bullish FVG uses subsequent low <= edge/CE/far edge; bearish uses high >=.
A price opening through a threshold counts as reached/passed and is separately
flagged, NOT an observed fill at that level. Show range-containing touches too.
Use full 1/4/13/52-week follow-up denominators and censored counts; a censored
event is not an unfilled failure. Median wait is conditional on reached events.
No assertion that fill probability alone establishes predictive value.

Secondary mechanical check: primary rejection and combined signals only,
enter next week's open; exit close of the fourth following week; one position
at a time per instrument/rule, no stops/targets, no same-bar order assumptions.
Report signed price returns with 0/10/25 bp round-trip cost scenarios, win rate,
profit factor and sample counts. 10 bp is an illustrative uniform cost, not a
validated historical spread/fee/borrow/roll model. NQ results are price-index
proxies, not dollar futures P&L; S&P/NDX are non-investable cash indices.
No leverage, sizing advice, equity CAGR, or performance optimization.

## Required verification and delivery

Synthetic tests: strict/equal breach, two-sided exclusion, off-by-one prior
window, FVG orientation/CE/formation exclusion, displacement availability,
combined timing, gap censoring, next-open and non-overlap behavior, future-data
invariance. Independently recalculate selected real event rows and weekly bars.
Self-contained HTML with no remote runtime dependencies; asset/rule filters,
coverage audit, definitions/diagrams, result tables/charts, visible limitations,
source citations and event/weekly-data CSV exports. Retain analysis scripts,
raw hashes, results and acceptance checklist alongside it. No source DB writes.
