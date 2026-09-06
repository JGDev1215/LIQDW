# Acceptance — chart-first presentation

Completed 6 September 2026 for the user's request to prioritise concepts on
the price chart with minimal reading.

- [x] A built offline HTML file is the primary deliverable.
- [x] A 1D/1W timeframe selector is available. Daily mode uses saved daily
      Yahoo bars and calculates the same concepts over completed sessions.
      Unsupported local-minute and adjusted-only series are disabled in 1D.
- [x] Weekly prices occupy the main screen; FVGs, CE, range levels and sweeps
      appear directly on price. Default overlays are bounded to limit clutter.
- [x] Selected-zone state, exact prices, custom-reference distances and
      observed toward/away movement are accessible without opening the backtest.
- [x] Replay only displays confirmed patterns and candles at or before its
      selected close. Future lifecycle events do not affect the displayed state.
- [x] Calculated levels, user measurements, unknown data states and observed
      threshold reaches are distinguishable. No executable fills or forecasts
      are inferred from weekly ranges.
- [x] HLC-only weeks have no synthetic open; invalid weeks remain missing.
- [x] Source series, observation date and sample range are visible. Detailed
      provenance, source limitations and full-sample evidence are secondary.
- [x] Original analytical exports and market-data storage are preserved.
- [x] Six guided examples use real frozen events, begin at their confirmation
      closes and reveal later bars only after user action. They cover both sweep
      directions, both FVG directions, partial mitigation, a counterexample and
      a second instrument. Selection is explicitly for visual clarity.
- [x] Daily mode is visibly labelled in the header, range controls, replay,
      footer and provenance drawer. Its backtest drawer warns that saved
      performance evidence is weekly-only.
- [x] The chart is a descriptive research companion requested by the user,
      not a new operational Weekly Map or Daily Delivery Plan. Operational
      bias/model-state/session-clock templates are not imposed on this UI.

## Final focused checks

`verification.json` records the passing browser run:

- 32 SHA-256 comparisons confirm frozen weekly, daily raw, event and study inputs unchanged.
- 100 replay views across all 20 series checked; 231 displayed zone states
  independently compared with observed prefixes and 2,038 sweep markers checked.
- Fixtures verify confirmation timing, edge/CE/far progression, equality at
  thresholds and gap censoring. These are test fixtures, not displayed market data.
- Exact between-tick NQ midpoint retained; early S&P 500 HLC presentation checked.
- Range-window membership, event navigation, fixed measurement reference,
  chart-coordinate clicks, zoom, focus and replay transport checked.
- Optional evidence/guide/source drawers checked.
- All six lessons checked against their saved detector events. Their initial
  charts contain no later candles or later-formed zones; reveal, reset,
  previous/next and exit controls were checked.
- Independent daily detector reference matched sweeps, raw FVGs, displacement
  FVGs and sweep-to-FVG events across 11 daily series (108,711 bars). Daily
  future-candle/zone isolation, S&P HLC handling and local-series availability
  were checked.
- Desktop 1440×960 fits without page overflow. Mobile 390×844 has no horizontal
  overflow and retains a usable chart.
- Zero browser JavaScript errors and zero external network requests.

Desktop, selection, sweep, early-HLC and mobile screenshots were generated.
Desktop, selected-zone, mobile and early-HLC renderings were visually inspected.
During UI QA, a mobile select-width overflow and clipped chart labels were
corrected. A click test was corrected to use the actual browser pointer
coordinate rather than a pre-event fractional coordinate. The final run passes.

This validation covers presentation and replay correctness. It does not
revalidate the original market snapshots or turn descriptive study results
into a demonstrated trading edge; that evidence remains in the original audit.
