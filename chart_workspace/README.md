# Weekly liquidity — chart workspace

Open **weekly_liquidity_chart.html**. It is the built, self-contained chart;
the template files are development inputs and are not meant to be opened.

## Use

- Pick an instrument. NQ, Nasdaq-100, S&P 500, the five old-origin stock
  candidates, and the original sensitivity series remain separate.
- Use the timeframe selector beside the instrument for **1W** or **1D**.
  Daily mode embeds the frozen Yahoo daily snapshots for the ten base Yahoo
  instruments and SP500_MODERN. It applies the same sweep/FVG geometry over
  completed trading sessions. The two local NQ series and adjusted sensitivity
  series are intentionally disabled in 1D because no frozen daily export exists.
- Daily bars render as OHLC candlesticks when a verified open is available.
  HLC-only history uses a wick and close mark without an invented candle body.
- The HTF Liquidity Proxy card identifies the selected completed weekly range
  in 1W and the prior continuous completed weekly range in 1D. Its BSL/SSL
  labels are price-level proxies, not evidence of resting orders.
- Structure layers add PWH/PWL, PMH/PML, confirmed five-bar swing highs/lows,
  and relative equal highs/lows within 0.10 × prior ATR14. Swing pivots appear
  only after two right-side bars complete. These are learning overlays and are
  not included in the frozen performance backtest.
- Click a coloured FVG zone, a nearby level, or an amber sweep triangle.
- Read the selected level's state and price distance in the side panel.
- Use **Reference**, then click a price, for a custom measurement. This does
  not simulate a trade or create an order.
- Rewind with the date, slider, drag gesture or event navigation. Step forward
  to reveal subsequent completed weeks. Scroll or use +/− to zoom.
- Guide, Backtest, and Source & data limits open secondary panels.
- **Examples** opens six guided chart replays. Each begins at the event's
  confirmation close. Read the short checklist, then reveal the later weeks or
  use the weekly step controls. Previous/next moves through the lesson set.

The lesson set covers a sell-side sweep, a buy-side-sweep counterexample,
bullish and bearish sweep-to-displacement-FVG sequences, partial FVG mitigation,
and the same sequence on the S&P 500. The examples were selected to make the
detector geometry legible, not to maximise or imply performance.

The chart embeds 37,233 weekly rows and 43,313 frozen sweep/FVG event rows
across 20 series. Leading ineligible history is removed from the visual data;
interior unavailable weeks remain explicit gaps. The original study and
market-data storage were not edited. The backtest drawer displays saved
full-sample statistics and links to the original comprehensive report.

Daily mode embeds 108,711 daily rows across 11 compatible series. Its event
overlays are calculated in the browser from those saved bars; the saved return
and fill statistics remain explicitly weekly-only.

The HTML works without a server or internet connection. Copying just this
file preserves the chart, embedded data, guide and summary statistics.
The optional link to the original report requires the parent folder layout.

## Visual rules

Four nearest active FVGs by default; selecting another known zone can add one.
Filled-zone history is optional. CE is the exact arithmetic midpoint. Zones
become visible at their confirmation close. Revisit tracking starts the next
week and stops being known at a missing week. A weekly threshold may be
reached or passed; execution is never inferred from it.

Range lines include the replay week and are the next week's references.
Sweep detection uses the preceding lookback window. Early S&P 500 weeks
without reliable opens use HLC bars rather than invented candle bodies.
In 1D, “week” becomes trading session throughout the detector and replay.
Toward/away compares consecutive observed closes to the same selected level;
it does not forecast direction. Large axis prices can use an M suffix, while
selection details retain numeric prices.

The five oldest-origin candidates are not a certified global ranking of
continuously traded securities. All data limits and the original study's
lack of demonstrated core directional edge remain explicit in the drawers.

## Rebuild and verify

Run `python3 build_chart.py` from this directory (standard library only).
It reads the frozen parent CSV/JSON exports and embeds the existing Chart.js
library, stylesheet and application code into the HTML.

`test_chart.cjs` uses the bundled Playwright runtime and installed Google
Chrome for an isolated headless browser test. The final result is recorded
in `verification.json`; `input_manifest.json` records 32 input SHA-256 hashes.
The retained `verification_failed.json` file is historical diagnostic output from an earlier failed UI test; use `verification.json` for the current passing run.
See `ACCEPTANCE.md` and `PLAN.md` for scope and checks.
