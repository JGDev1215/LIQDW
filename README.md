# LIQDW — Liquidity Chart Workspace

Interactive offline chart for studying liquidity sweeps and fair value gaps on frozen weekly and daily OHLC data.

Open [`chart_workspace/weekly_liquidity_chart.html`](chart_workspace/weekly_liquidity_chart.html) in a browser. The chart includes guided examples, replay controls, OHLC candlesticks, FVG and sweep overlays, daily mode, higher-timeframe weekly liquidity proxies, provenance limits, and weekly-only descriptive backtest evidence.

## Rebuild and verify

```bash
cd chart_workspace
python3 build_chart.py
node test_chart.cjs
```

The build is read-only with respect to the source data. It embeds the frozen inputs into a standalone HTML artifact. See [`PROTOCOL.md`](PROTOCOL.md), [`chart_workspace/README.md`](chart_workspace/README.md), and [`chart_workspace/ACCEPTANCE.md`](chart_workspace/ACCEPTANCE.md) for definitions, scope, data limits, and validation.

This is a descriptive research and learning tool. It does not provide trading advice, execution instructions, or proof of a directional edge.
