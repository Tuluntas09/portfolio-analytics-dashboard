# Disclaimer

**Quant Portfolio Analytics Dashboard** is a personal portfolio analytics and risk-monitoring tool built for analytical and educational purposes.

## What this tool does

- Displays historical return, risk, and volatility metrics for a user-defined portfolio
- Runs scenario analyses including Monte Carlo simulation and stress tests
- Compares hypothetical allocation scenarios based on model-based optimization
- Shows data quality and source transparency for all displayed figures

## What this tool does not do

- Provide investment advice of any kind
- Generate buy, sell, or hold recommendations
- Produce target prices or return forecasts
- Constitute financial planning, wealth management, or brokerage services
- Guarantee the accuracy or completeness of any displayed metric or scenario

## Model limitations

Financial metrics displayed in this tool are computed from historical price data using standard quantitative methods. They include simplifications:

- Beta is approximated, not derived from a full regression
- The optimizer uses a heuristic weight-tilt model, not mean-variance optimization
- Monte Carlo simulation assumes log-normal return distributions and does not model fat tails, regime changes, or correlation breakdowns
- Stress scenario impacts are estimated from asset-class exposure, not from granular position data
- All outputs are hypothetical and backward-looking

## Data sources

Market data is sourced from Finnhub (primary) and Yahoo Finance (fallback). When neither is available, the tool uses a deterministic synthetic price model for illustration only.

Past performance shown in this tool does not predict future results.

---

*This project is not affiliated with any financial institution, regulator, or investment service.*
