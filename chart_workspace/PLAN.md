# Chart-focused revision

User intent: show liquidity concepts on weekly price candles so spatial
relationships and subsequent movement are understandable with minimal reading.

## Screen hierarchy

1. Weekly or daily candles occupy the primary screen. Compact asset/date toolbar.
2. Nearest FVG zones and selected rolling high/low are drawn on price.
3. Small sweep markers show rejection; only a selected marker gets a label.
4. Right panel: above / current price / below, then selected-zone state and
   a price-distance measurement. No automatically recommended direction.
5. Bottom replay timeline with single-week steps, play/pause, event jumps and zoom.
6. Definitions, provenance and the existing backtest live in optional drawers.
7. Guided examples start at the real event's confirmation close. Users inspect
   the pattern first, then reveal later weeks or advance one candle at a time.

## Data and interaction rules

- Read only the frozen weekly CSV and event exports; preserve all research
  outputs and market storage. This revision changes the presentation.
- No candles or formed patterns after the replay cursor are visible.
- A zone becomes knowable at its formation close. Revisit checks begin next
  week. Fresh / edge reached / CE reached / far edge reached are distinct.
- An invalid week makes an older zone's subsequent untouched status unknown;
  do not claim a fresh zone across missing evidence.
- Draw at most four nearest active FVG zones by default. Filled zones are an
  optional historical layer. Selecting a zone preserves its exact bounds.
- Range references use k completed weeks through the replay close, for the
  following week. Sweep markers use the preceding k weeks, as in the study.
- A clicked historical sweep rewinds to its confirmation close. Forward
  movement is revealed only by advancing replay.
- Click a zone/level to measure from the replay close; optional custom
  reference is a user measurement, not a backtest fill. The distance connector
  does not forecast a future price path.
- Toward/away compares distance to the same fixed level at two consecutive
  known closes. Level crossings are labeled separately. No forward statistics
  on the primary chart. Full-sample evidence is explicitly labeled in a drawer.
- HLC-only source weeks render as HLC bars; no invented candle open. Invalid
  weeks render as missing data, not interpolated candles.
- Actual midpoint precision retained. A mathematical NQ midpoint between
  tradable ticks is displayed exactly; it is not an executable order price.
- Example selection is for visual legibility of the detector conditions, not
  subsequent profitability. Include a valid-sweep counterexample and a second
  market so the lessons do not imply guaranteed follow-through or NQ-only rules.
- Daily mode uses the frozen Yahoo daily snapshots for the ten base Yahoo
  instruments plus SP500_MODERN. The same geometry is calculated over completed
  trading sessions; it is descriptive and has no daily performance backtest.
  Local minute-derived NQ and adjusted sensitivity series remain weekly-only.

## Verification

Verify frozen-input hashes, chart/event alignment, no future overlays or
status leakage under replay, gap-aware zone state, nearest-zone cap, distance
arithmetic, event navigation, manual reference, keyboard/replay controls,
source switching, no external requests, and usable desktop/mobile layout.
Visually inspect screenshots. Open the built file, not an unfilled template.
