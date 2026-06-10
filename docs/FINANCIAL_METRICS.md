# Financial Metrics Reference

**Project:** Quant Portfolio Analytics Dashboard  
**Date:** 2026-06-10  
**Status:** Current through Phase 10b — data-derived beta and empirical CVaR are live; true Sortino (downside deviation) is still an open target (see Phase 4c+ section below)

This document is a reference for every quantitative metric computed in `src/data.js`.  
It records the current formula, whether the output is data-derived or approximated,  
which user assumptions feed into it, known limitations, and what test coverage exists.

---

## Overview Table

| Metric | Formula | Data / Approx | User assumptions | Known limitations | Test coverage |
|---|---|---|---|---|---|
| Annualized Return | CAGR: `(V_T/V_0)^(252/n) - 1` | Data-derived | Date range (`days`) | No dividend adjustment; uses arithmetic weights not log returns | smoke-check, metrics-check |
| Annualized Volatility | `sqrt(E[r²]) * sqrt(252)` | Data-derived | None | Second-moment approx (not mean-centered); bias negligible for near-zero daily mean | metrics-check |
| Sharpe Ratio | `(annRet - rf) / annVol`, 0 if annVol=0 | Data-derived + user rf | `assumptions.rf` | RMS vol not std dev; guarded to 0 for zero-vol paths | smoke-check (rf), metrics-check (zero-vol) |
| Sortino Ratio | `(annRet - rf) / (annVol × 0.72)`, 0 if annVol=0 | Approximation | `assumptions.rf` | 0.72 proxies downside-std/total-std for normal distributions; not true downside deviation | metrics-check |
| Max Drawdown | `min(v/peak - 1)` running peak-trough | Data-derived | None | Daily granularity; intraday drawdowns not captured; bounded in (−1, 0] | metrics-check |
| VaR (95%, 1M) | `−1.65 × annVol / sqrt(252) × sqrt(21)` | Approximation (parametric) | None | Normality assumption; understates tail risk for fat-tailed returns; 21-day month | metrics-check |
| CVaR (95%, 1M) | Mean of worst 5% daily returns × sqrt(21) | Data-derived (empirical) | None | Requires ≥20 observations; returns 0 for short/flat paths; sqrt(21) scaling assumes i.i.d. | metrics-check (sign, ≤VaR, zero-vol guard) |
| Beta | `cov(portRets, benchRets) / var(benchRets)` | Data-derived | None | VTI used as benchmark; fallback 1.0 when n<20, bench variance≈0, or result non-finite | metrics-check (finiteness, fallback, not-synthetic) |
| Optimizer Sharpe (maxSharpe) | Weight tilt: per-asset Sharpe > 0.6 threshold | Heuristic | `assumptions.rf` | Not MVO; constants 0.6 / 0.45 are calibrated heuristics; not globally optimal | metrics-check (weight sum, floor) |
| Optimizer Risk (minRisk) | Weight tilt: annVol < 0.22 threshold | Heuristic | None | Same; 0.22 / 1.4 are calibrated heuristics | metrics-check (weight sum, floor) |
| Rolling Vol (30d) | `sqrt(sum((r − mean)² / 30)) × sqrt(252)` | Data-derived | None | 30-day window; mean-centered (std dev) — consistent with theory, unlike headline vol | metrics-check (length, finiteness) |
| Rolling Return (63d) | `geometric_63d_return × 252/63` | Data-derived | None | Arithmetic annualization vs CAGR used in headline annRet; minor inconsistency | metrics-check (length) |
| Rolling Sharpe (63d) | `(daily_mean × 252 − rf) / rolling_annVol` | Data-derived + user rf | `assumptions.rf` | Arithmetic return scaling; epsilon guard `v \|\| 1e-6` prevents division by zero | metrics-check (length, finiteness) |
| Risk Contribution | `weight × annVol × weighted_avg_corr`, normalized | Approximation | None | Missing `vol_j` term vs true Euler decomposition; simpler but not exact marginal contribution | None |
| HHI (Concentration) | `sum(weight²)` | Data-derived | None | Standard Herfindahl–Hirschman index; correct | None |
| Benchmark Reference | VTI path × BENCH_EQUITY_SCALAR + BENCH_DAILY_INCOME | Scenario approx (see Phase 3b) | None | Not an actual 60/40 index; BND not included; see ARCHITECTURE_AUDIT.md Risk 6 | smoke-check (benchCum finiteness) |

---

## Per-Metric Notes

### Annualized Return

```
annRet = (cum_terminal)^(252 / n) - 1
```

`cum_terminal` is the terminal value of a $1 investment. `n` is the number of daily returns.  
This is the compound annual growth rate (CAGR) formula, which assumes reinvestment of returns.

**Limitation:** Per-asset `annRet` is computed using cumulative return of the price path (first-to-last price),
then annualized. This does not incorporate dividends or corporate actions. It is a price-only return.

---

### Annualized Volatility

```
annVol = sqrt( sum(r_i²) / n ) * sqrt(252)
```

Uses the second moment of daily returns rather than the mean-centered standard deviation.  
For near-zero daily mean returns (typical equity daily returns ≈ 0.05%/day), the bias is:
`E[r²] = Var(r) + E[r]²`, making the error ≈ `(E[r])² / Var(r)` — typically < 0.1%.

**Note:** Rolling volatility (30-day window) uses the mean-centered formula `sqrt(sum((r - mean)²) / n)`,
which is the standard deviation. This is technically more correct but the difference is negligible.

---

### Sharpe Ratio

```
sharpe = (annRet - rf) / annVol    if annVol > 0, else 0
```

User can adjust `rf` via the sidebar "Risk-free rate" slider. The value propagates through
`buildPortfolio(opts.rf)` → `optimize(assets, mode, rf)`.

**Guard:** Returns 0 for zero-volatility portfolios (flat price paths). Without this guard,
a declining price path with zero variance would produce −Infinity.

---

### Sortino Ratio

```
sortino = (annRet - rf) / (annVol * 0.72)    if annVol > 0, else 0
```

The `0.72` constant approximates the ratio of downside standard deviation to total standard deviation
for a normally distributed return series. For a normal distribution, the theoretical value is
`1 / sqrt(2) ≈ 0.707`. The value `0.72` is a slightly higher empirical calibration.

**True Sortino** would compute the downside deviation directly as `sqrt(mean(min(r - T, 0)²))` where
`T` is the target return. This approximation is well-established in practice but introduces
error when returns are skewed or fat-tailed.

**Relationship with Sharpe:** When `annRet > rf`, `Sortino > Sharpe` (smaller denominator, positive numerator).
When `annRet < rf`, `Sortino < Sharpe` (smaller denominator, negative numerator — more negative).

---

### Max Drawdown

```
mdd = min over all t of: (cum[t] / peak_before_t) - 1
```

Tracks the running peak of the cumulative $1 curve and records the largest peak-to-trough ratio.
Result is in (−1, 0] (cannot exceed 100% loss on a non-leveraged portfolio).

**Limitation:** Daily granularity only. Intraday selloffs within a trading day are not captured.

---

### VaR (95%, 1-Month)

```
var95 = −1.65 * annVol / sqrt(252) * sqrt(21)
      = −1.65 * annVol * sqrt(21/252)
      = −1.65 * annVol * sqrt(1/12)
```

Parametric VaR at 95% confidence over a 21-trading-day (≈1 month) horizon.
Assumes portfolio returns follow a normal distribution with zero mean drift over the horizon.

**z-score:** 1.65 is the 95th percentile of a standard normal distribution (more precisely 1.6449).

**Scaling:** Square-root-of-time rule converts daily vol to monthly vol. Assumes i.i.d. returns.

**Limitation:** Normality assumption understates VaR for fat-tailed or skewed return distributions.
Real equity portfolios typically exhibit excess kurtosis (heavier tails than normal).

---

### CVaR (Conditional VaR / Expected Shortfall) — *Data-derived since Phase 4b*

```
sorted   = portRets sorted ascending
k        = floor(0.05 * n)            // worst 5% tail count
tailMean = mean(sorted[0..k])         // mean of the k worst daily returns
cvar95   = tailMean * sqrt(21)        // scaled to 1-month horizon
```

Empirical CVaR at the 95% confidence level over a 21-trading-day (≈1 month) horizon.
Selects the worst 5% of daily portfolio returns (the left tail), computes their mean,
then scales to monthly using the square-root-of-time rule.

**Sign convention:** `cvar95` is negative — it represents a loss.
For a positive-vol portfolio, `cvar95 ≤ var95 < 0` (CVaR is at least as conservative as VaR).

**Guard:** Returns 0 when `portRets.length < 20` (short history, flat paths).
Also returns 0 if the tail is empty (`k < 1`) or `tailMean` is not finite.

**Limitation:** The i.i.d. scaling assumption (sqrt(21)) is the same limitation as parametric VaR.
For very short histories the tail sample (5% of n) may contain only 1–2 observations.

---

### Beta — *Data-derived since Phase 4b*

```
bVar = sampleCov(benchRets, benchRets)       // benchmark variance (n-1 denominator)
beta = sampleCov(portRets, benchRets) / bVar
```

`sampleCov(xs, ys) = sum((x_i - x̄)(y_i - ȳ)) / (n - 1)`

Uses the VTI benchmark daily returns already computed in `buildPortfolio` via `benchPath`.
The benchmark series is aligned day-by-day with portfolio returns — both are derived from
the same `minPathLength` window.

**Fallback to 1.0** when:
- Fewer than 20 observations (`n < 20`)
- Benchmark variance is near zero (`bVar < 1e-12` — flat benchmark price)
- Computed beta is not finite

**Limitation:** VTI is used as the benchmark regardless of portfolio composition.
For portfolios that do not correlate with US equities (e.g., all-bond), the beta
value against VTI has limited interpretive meaning.

---

### Optimizer (maxSharpe / minRisk)

The optimizer is a **heuristic weight-tilt**, not mean-variance optimization (MVO).

**maxSharpe mode:**
```
score_i = (annRet_i - rf) / annVol_i
new_weight_i = max(0.02, current_weight_i * (1 + (score_i - 0.6) * 0.45))
```
Assets with per-asset Sharpe > 0.6 get upweighted; below 0.6 get downweighted.  
`0.6` = heuristic threshold; `0.45` = tilt multiplier.

**minRisk mode:**
```
new_weight_i = max(0.02, current_weight_i * (1 + (0.22 - annVol_i) * 1.4))
```
Assets with annVol < 0.22 (22%) get upweighted.  
`0.22` = heuristic vol ceiling; `1.4` = tilt multiplier.

**Both modes:** Weights are re-normalized to sum to 1.0 after tilting. Minimum per-asset weight is 0.02 (2%).

**Optimizer output vol** is computed via the full portfolio covariance matrix using pairwise correlations.
This is the only place in the codebase where the full covariance structure is correctly propagated.

**Known limitation:** The tilt direction and magnitude depend on heuristic constants, not on a convex
optimization problem. True MVO would solve `max (w^T mu - λ * w^T Σ w)` subject to sum(w)=1, w≥0.

---

### Risk Contribution

```
rc_i_raw = weight_i * annVol_i * sum_j(weight_j * corr(i, j))
rc_i = max(0, rc_i_raw) / sum_j(max(0, rc_j_raw))
```

This approximates marginal risk contribution as `weight × vol × weighted-average-correlation`.

**True Euler decomposition** for a portfolio with covariance matrix Σ and volatility σ_p is:
`rc_i = weight_i * (Σ w)_i / σ_p` where `(Σ w)_i = sum_j(weight_j * vol_i * vol_j * corr(i,j))`.

The approximation omits the `vol_j` term in the cross products, simplifying `vol_i * vol_j * corr(i,j)`
to `vol_i * corr(i,j)`. For portfolios with similar per-asset volatilities the error is small.

---

## Validation and Test Coverage

### `scripts/smoke-check.mjs`

- Empty portfolio: all metrics finite, sharpe and sortino = 0
- Real history path: annRet and annVol finite
- rf propagation: lower rf → higher Sharpe for same portfolio
- NaN rf: falls back to 0.043
- benchCum: finite array output

### `scripts/metrics-check.mjs` *(Phase 4a: tests 1–11; Phase 4b: tests 12–15)*

Phase 4a (tests 1–11):
- All headline metrics finite for normal multi-asset portfolio
- Single-asset portfolio: all metrics finite, optimizer holds 100% weight
- Negative-return scenario: annRet < 0, mdd < 0, sharpe finite
- Max drawdown bounded in (−1, 0]
- VaR is negative for positive-vol portfolio
- Sortino > Sharpe when annRet > rf (mathematical identity for 0.72 approximation)
- Sortino < Sharpe when annRet < rf (same identity)
- Zero-vol guard: flat price path produces finite sharpe, sortino, beta, var95
- Optimizer: weights sum to 1.0, respect 0.02 floor
- Rolling metrics: correct array lengths, finite non-negative values
- benchCum starts at 1, terminal value finite

Phase 4b (tests 12–15):
- Beta is finite and not equal to the old Sharpe-based approximation
- Flat benchmark (zero benchmark variance) produces beta = 1.0 fallback
- CVaR is finite, negative, and ≤ var95 for a positive-vol portfolio
- Short-history (< 20 returns) and flat path produce cvar95 = 0

---

## Open Improvement Targets

| Item | Current | Target | Status |
|---|---|---|---|
| Sortino denominator | `annVol × 0.72` proxy | True downside deviation: `sqrt(mean(min(r-T,0)²))` | **Open** |
| Annualized vol | Second moment `E[r²]` | Mean-centered `E[(r-mean)²]` (bias negligible for typical equity daily returns) | Low priority |
| Rolling return | Arithmetic annualization | CAGR: `(1 + geometric_63d)^(252/63) - 1` | Low priority |
| Optimizer | Heuristic weight-tilt | True MVO via quadratic programming | Long-term |
