# Analysis audit log

Protocol v1 was written after coverage inspection and before event outcomes.
After the first complete run, an outlier/volume audit found 43 carried-price
zero-volume weeks for MPS, including its 2017 suspension. The issuer's annual
report confirms trading resumed on 25 October 2017. Orell Füssli also has many
zero-volume records. This is a source-data problem, not a parameter choice.

Quality correction: omit daily equity records whose reported volume is zero
or absent from observed OHLC aggregation. Entire inactive weeks stay invalid
in the weekly calendar; all feature/forward windows crossing them are excluded.
Apply the same rule to every stock and both adjustment variants. No price
return outlier is clipped. Preserve the initial results in
`audit_initial_unfiltered/`; these are superseded and not report results.

Other findings: S&P pre-1962 OHLC fields repeat the close; from 1962 through
April 1982, about 94% of opens equal the preceding close. HLC research is
allowed from 1962, but open-dependent patterns and next-open checks are
disabled until the week beginning 26 April 1982. Historical opening prices
have not been independently certified after that boundary either.

Maximum-history checks: direct Yahoo requests used explicit start/end times
because `range=max` did not return daily granularity as requested. Swedish
Stora Enso shares begin in January 2000 in Yahoo too, so do not extend the
Helsinki listing used here. Stooq .com and .pl CSV endpoints returned browser
verification pages, not usable CSV. No attempted bypass. Yale's long-history
NYSE collection includes periodic prices and interpolation, which do not
establish weekly observed OHLC. Earliest obtainable usable data is not proof
of a universal historical limit.

Official suspension evidence:
https://www.gruppomps.it/static/upload/ann/annual_report_gmps_2017_draft.pdf

Final export audit: a midpoint of 5.0599999425 had been exported with too few
significant digits, making an equality-sensitive first-touch calculation
disagree with the in-memory calculation. Weekly OHLC and all result exports
now retain 17 significant digits, with round-trip CSV parsing. The full study
was regenerated and independently rechecked after that correction. This is
numerical precision, not a tuned definition or a price-return outlier removal.
The bootstrap seed is documented precisely as base 20260906 plus the timeline
length; this clarification does not change the implemented resampling rule.
