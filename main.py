import warnings
import os
import yfinance as yf
import numpy as np
import pandas as pd
from scipy.stats import truncnorm
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator

warnings.filterwarnings("ignore")

# ---------------------------------------------------------------------------
# Global reproducibility seed — set once, used by both numpy and scipy RNGs.
# Guarantees identical simulation results across runs for auditability.
# ---------------------------------------------------------------------------
SIMULATION_SEED: int = 42

app = FastAPI(
    title="Python_SDE_Engine",
    description=(
        "Motor cuantitativo de Evaluación de Riesgos Climáticos "
        "mediante Merton Jump-Diffusion (Euler-Maruyama, Monte Carlo)."
    ),
    version="2.0.0",
)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": "Merton-Jump-Diffusion-Euler-Maruyama",
        "version": "2.0.0",
    }


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------
class RiskSimulationRequest(BaseModel):
    ticker: str = Field(
        ..., min_length=1, max_length=10,
        description="Stock ticker symbol (e.g. AAPL, XOM, TSLA)",
    )
    sector: str = Field(
        ..., min_length=1,
        description="Company sector from AlphaVantage OVERVIEW",
    )

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, v: str) -> str:
        cleaned = v.strip().upper()
        if not cleaned.replace("-", "").replace(".", "").isalpha():
            raise ValueError(f"Ticker must contain only letters, got: {cleaned}")
        return cleaned

    @field_validator("sector")
    @classmethod
    def normalize_sector(cls, v: str) -> str:
        return v.strip()


# ---------------------------------------------------------------------------
# Climate Beta — NGFS Phase 4 (2023) sector transition-risk multiplier.
#
# Values anchored to:
#   - NGFS Climate Scenarios for Central Banks and Supervisors, Phase 4 (2023),
#     Table 3.1: Sectoral Transition Risk Exposure (Disorderly scenario).
#   - MSCI Climate Beta methodology (carbon-intensity weighted factor loading).
#
# Interpretation: scales Poisson jump intensity (λ) and jump severity (μ_J)
# to project future risk under a disorderly low-carbon transition pathway.
# ---------------------------------------------------------------------------
_CLIMATE_BETA_MAP: dict[str, float] = {
    # Brown Assets — high regulatory exposure, significant stranded-asset risk
    "ENERGY":                   1.5,
    "BASIC MATERIALS":          1.5,
    "UTILITIES":                1.4,
    "MANUFACTURING":            1.3,
    # Green / Low-exposure sectors — mitigated transition risk
    "TECHNOLOGY":               0.8,
    "HEALTHCARE":               0.8,
    "LIFE SCIENCES":            0.8,
    "COMMUNICATION SERVICES":   0.9,
    # Transition / moderate-exposure sectors
    "FINANCIALS":               1.1,
    "CONSUMER STAPLES":         1.0,
    "REAL ESTATE":              1.1,
    "INDUSTRIALS":              1.2,
}
_BETA_DEFAULT: float = 1.0   # neutral — unknown or unlisted sector


def get_climate_beta(sector: str) -> float:
    """
    Returns the NGFS Phase 4 transition-risk multiplier for a given sector.
    Falls back to 1.0 (neutral) for unlisted sectors.
    """
    sector_upper = sector.upper()
    for key, beta in _CLIMATE_BETA_MAP.items():
        if key in sector_upper:
            return beta
    return _BETA_DEFAULT


# ---------------------------------------------------------------------------
# Main simulation endpoint
# ---------------------------------------------------------------------------
@app.post("/simulate_climate_risk")
async def simulate_climate_risk(request: RiskSimulationRequest):
    """
    Calibrates the Merton (1976) Jump-Diffusion model on 5 years of historical
    data, injects a climate transition stress via NGFS Phase 4 sector betas,
    and runs a fully vectorized Euler-Maruyama Monte Carlo simulation.

    SDE:  d(ln S) = (μ - ½σ²)dt + σ dW + J dN
      where:
        dW ~ N(0, dt)                         [Brownian diffusion]
        dN ~ Bernoulli(λ·dt)                  [Poisson jump arrivals]
        J  ~ TruncNormal(-∞, 0; μ_J, σ_J)    [downside-only jump sizes]

    Steps:
      1. Data ingestion         — yfinance, 5y daily close prices.
      2. Historical calibration — 3-sigma filter separates diffusion from jumps.
      3. Climate Beta injection — NGFS Phase 4 multiplier on (λ, μ_J).
      4. Vectorized simulation  — np.cumsum replaces Python loop (O(1) passes).
      5. Risk metrics           — CVaR 95% (Expected Shortfall).
    """
    ticker = request.ticker
    sector = request.sector

    try:
        # ------------------------------------------------------------------
        # Step 1 — Data Ingestion
        # ------------------------------------------------------------------
        data = yf.download(
            ticker, period="5y", interval="1d",
            progress=False, auto_adjust=True,
        )
        if data.empty:
            raise ValueError(f"No historical data found for ticker: {ticker}")

        adj_close = data["Close"].squeeze().dropna()
        if adj_close.empty:
            raise ValueError(f"Price series is empty for ticker: {ticker}")

        log_returns: pd.Series = np.log(adj_close / adj_close.shift(1)).dropna()

        # ------------------------------------------------------------------
        # Step 2 — Historical Calibration & Jump Detection (Merton 3-sigma)
        # ------------------------------------------------------------------
        mean_ret = float(log_returns.mean())
        std_ret  = float(log_returns.std())

        is_jump   = np.abs(log_returns - mean_ret) > 3.0 * std_ret
        jumps     = log_returns[is_jump]
        non_jumps = log_returns[~is_jump]

        # Diffusion parameters — annualized from daily non-jump returns
        mu_hist:    float = float(non_jumps.mean()) * 252
        sigma_hist: float = float(non_jumps.std())  * np.sqrt(252)

        num_years:     float = len(log_returns) / 252.0
        lambda_hist:   float = len(jumps) / num_years if num_years > 0 else 0.0

        # Jump severity — calibrated on the NEGATIVE tail only (downside focus).
        # Jump sizes will be drawn from a left-truncated Normal (upper bound = 0)
        # so that calibration and simulation are internally consistent.
        negative_jumps = jumps[jumps < 0]
        if len(negative_jumps) > 1:
            mu_J_hist:    float = float(negative_jumps.mean())
            sigma_J_hist: float = float(negative_jumps.std())
        elif len(negative_jumps) == 1:
            mu_J_hist    = float(negative_jumps.iloc[0])
            sigma_J_hist = abs(mu_J_hist) * 0.5
        else:
            # Conservative baseline when no historical negative jumps detected
            mu_J_hist:    float = -0.03
            sigma_J_hist: float =  0.05

        if np.isnan(sigma_J_hist) or sigma_J_hist <= 0.0:
            sigma_J_hist = 0.05

        # ------------------------------------------------------------------
        # Step 3 — Climate Transition Risk Injection (NGFS Phase 4)
        # ------------------------------------------------------------------
        climate_beta:  float = get_climate_beta(sector)
        lambda_future: float = lambda_hist * climate_beta
        mu_J_future:   float = mu_J_hist   * climate_beta  # amplifies downside

        # Enforce minimum baseline (all firms face residual transition risk)
        lambda_future = max(lambda_future, 0.5  * climate_beta)
        mu_J_future   = min(mu_J_future,  -0.01 * climate_beta)

        # ------------------------------------------------------------------
        # Step 4 — Vectorized SDE Monte Carlo (Euler-Maruyama, no Python loops)
        # ------------------------------------------------------------------
        N_paths: int   = 10_000
        steps:   int   = 252
        dt:      float = 1.0 / 252.0

        rng = np.random.default_rng(SIMULATION_SEED)   # modern, reproducible RNG

        # Brownian increments: shape (N_paths, steps)
        Z = rng.standard_normal((N_paths, steps))

        # Poisson jump arrivals: P(dN=1) = λ·dt  [first-order approximation, valid for λ·dt << 1]
        prob_jump = min(lambda_future * dt, 1.0)
        dN = rng.binomial(1, prob_jump, size=(N_paths, steps))

        # Jump sizes: TruncNormal(-∞, 0) — all samples are strictly negative.
        # scipy.stats.truncnorm parameterisation:
        #   a = (lower - loc) / scale,  b = (upper - loc) / scale
        #   here: lower = -inf,  upper = 0  →  a = -inf,  b = -mu_J_future / sigma_J_hist
        # random_state=rng unifies all three draws (Z, dN, J) into one reproducible stream.
        b_trunc = (0.0 - mu_J_future) / sigma_J_hist   # > 0 since mu_J_future < 0
        J = truncnorm.rvs(
            a=-np.inf, b=b_trunc,
            loc=mu_J_future, scale=sigma_J_hist,
            size=(N_paths, steps),
            random_state=rng,
        )

        drift     = (mu_hist - 0.5 * sigma_hist ** 2) * dt
        diffusion = sigma_hist * np.sqrt(dt)

        # Log-increments — fully vectorized, no Python for-loop
        log_increments = drift + diffusion * Z + J * dN   # (N_paths, steps)

        # Cumulative sum converts log-increments to log-prices: S_t = exp(Σ dlogS).
        # np.concatenate avoids allocating a full ones-matrix only to overwrite 252/253 cols.
        log_prices = np.cumsum(log_increments, axis=1)                    # (N_paths, steps)
        S = np.concatenate([np.ones((N_paths, 1)), np.exp(log_prices)], axis=1)  # (N_paths, steps+1)

        final_returns_pct: np.ndarray = (S[:, -1] - 1.0) * 100.0

        # ------------------------------------------------------------------
        # Step 5 — Risk Metrics: CVaR 95% (Expected Shortfall)
        # ------------------------------------------------------------------
        alpha   = 5.0   # bottom 5% worst outcomes → 95% confidence level
        var_95  = float(np.percentile(final_returns_pct, alpha))
        cvar_95 = float(final_returns_pct[final_returns_pct <= var_95].mean())

        cvar_95_display   = abs(cvar_95) if cvar_95 < 0.0 else 0.0
        expected_drop_pct = (np.exp(mu_J_future) - 1.0) * 100.0
        prob_shock_annual = (1.0 - np.exp(-lambda_future)) * 100.0

        # ------------------------------------------------------------------
        # Step 6 — Simulation Paths: 3 representative percentiles, 50 points
        # S[:, 5::5] → indices 5, 10, ..., 250 → exactly 50 time points
        # S[:, 0] = 1.0 by construction → no division needed, multiply by 100
        # ------------------------------------------------------------------
        S_sampled = S[:, 5::5] * 100.0
        simulation_paths = {
            "media":     [round(float(v), 2) for v in np.percentile(S_sampled, 50, axis=0)],
            "optimista": [round(float(v), 2) for v in np.percentile(S_sampled, 90, axis=0)],
            "cvar_zone": [round(float(v), 2) for v in np.percentile(S_sampled,  5, axis=0)],
        }

        return {
            "ticker":                  ticker,
            "climate_beta":            climate_beta,
            "historical_volatility":   round(sigma_hist, 4),
            "lambda_historical":       round(lambda_hist, 4),
            "lambda_projected":        round(lambda_future, 4),
            "projected_jump_prob":     round(prob_shock_annual, 2),
            "projected_expected_drop": round(expected_drop_pct, 2),
            "cvar_95":                 round(cvar_95_display, 2),
            "simulation_paths":        simulation_paths,
            "simulation_seed":         SIMULATION_SEED,
            "is_fallback":             False,
        }

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Simulation failed: {type(e).__name__}: {str(e)}",
        )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
