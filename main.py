import warnings
import yfinance as yf
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator

# Suppress minor warnings for cleaner output
warnings.filterwarnings("ignore")

app = FastAPI(
    title="Python_SDE_Engine",
    description="Motor cuantitativo Data-Driven de Evaluación de Riesgos Climáticos mediante modelos Jump-Diffusion (SDEs).",
    version="1.0.0"
)

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": "Jump-Diffusion-Euler-Maruyama",
        "version": "1.0.0"
    }

class RiskSimulationRequest(BaseModel):
    ticker: str = Field(
        ...,
        min_length=1,
        max_length=10,
        description="Stock ticker symbol (e.g. AAPL, XOM, TSLA)"
    )
    sector: str = Field(
        ...,
        min_length=1,
        description="Company sector from AlphaVantage OVERVIEW"
    )

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, v: str) -> str:
        cleaned = v.strip().upper()
        if not cleaned.replace("-", "").replace(".", "").isalpha():
            raise ValueError(
                f"Ticker must contain only letters, got: {cleaned}"
            )
        return cleaned

    @field_validator("sector")
    @classmethod
    def normalize_sector(cls, v: str) -> str:
        return v.strip()

def get_climate_beta(sector: str) -> float:
    """
    Inyección del Risk factor Sectorial ('Climate Beta').
    Asigna una penalización proporcional a la exposición de transición climática.
    """
    sector_upper = sector.upper()
    brown_sectors = ["ENERGY", "BASIC MATERIALS", "UTILITIES", "MANUFACTURING"]
    green_sectors = ["TECHNOLOGY", "HEALTHCARE", "LIFE SCIENCES", "COMMUNICATION SERVICES"]
    
    if any(s in sector_upper for s in brown_sectors):
        return 1.5  # Heavy penalty for highly polluting sectors (Brown Assets)
    elif any(s in sector_upper for s in green_sectors):
        return 0.8  # Mitigated penalty for non-polluting sectors (Green/Neutral Assets)
    else:
        return 1.0  # Transition or standard sectors

@app.post("/simulate_climate_risk")
async def simulate_climate_risk(request: RiskSimulationRequest):
    """
    Endpoint principal para calibrar el modelo histórico y simular riesgos futuros bajo estrés climático.
    Metodología (CEMRACS standard jump-diffusion Monte Carlo simulation):
    1. Historical Calibration (5 years).
    2. Detection of historical fat tails and jump intensity (Poisson lamda).
    3. Climate Beta mapping.
    4. Euler-Maruyama standard integration con intensidades proyectadas.
    5. Conditional Value at Risk (CVaR).
    """
    ticker = request.ticker
    sector = request.sector
    
    try:
        # Step 1: Data Ingestion (Last 5 Years)
        # ---------------------------------------------------------------------
        data = yf.download(
            ticker, period="5y", interval="1d",
            progress=False, auto_adjust=True
        )
        if data.empty:
            raise ValueError(f"No historical data found for ticker: {ticker}")
        adj_close = data['Close'].squeeze().dropna()
        if adj_close.empty:
            raise ValueError(f"Price series is empty for ticker: {ticker}")
            
        log_returns = np.log(adj_close / adj_close.shift(1)).dropna()
        
        # Step 2: Historical Calibration & Jump Detection
        # ---------------------------------------------------------------------
        mean_ret = log_returns.mean()
        std_ret = log_returns.std()
        
        # Outlier Detection (|R| > 3 sigma)
        jump_threshold = 3 * std_ret
        is_jump = np.abs(log_returns - mean_ret) > jump_threshold
        
        jumps = log_returns[is_jump]
        non_jumps = log_returns[~is_jump]
        
        # Non-jump parameters (annualized)
        mu_hist = non_jumps.mean() * 252
        sigma_hist = non_jumps.std() * np.sqrt(252)
        
        num_years = len(log_returns) / 252
        lambda_hist = len(jumps) / num_years if num_years > 0 else 0
        
        # We focus on the severity of negative tail risk
        negative_jumps = jumps[jumps < 0]
        mu_J_hist = negative_jumps.mean() if len(negative_jumps) > 0 else 0.0
        sigma_J_hist = negative_jumps.std() if len(negative_jumps) > 1 else (np.abs(mu_J_hist) * 0.5 if mu_J_hist != 0 else 0.05)
        
        if np.isnan(sigma_J_hist):
             sigma_J_hist = 0.05
             
        # Step 3: Climate Transition Risk Injection
        # ---------------------------------------------------------------------
        climate_beta = get_climate_beta(sector)
        
        # Project future risk
        lambda_future = lambda_hist * climate_beta
        mu_J_future = mu_J_hist * climate_beta  # Amplifying negative magnitude
        
        # Fallback if no historical jumps were detected (forces baseline evaluation)
        if lambda_future == 0.0:
            lambda_future = 0.5 * climate_beta
            mu_J_future = -0.05 * climate_beta
            
        # Step 4: SDE Monte Carlo Simulation (Euler-Maruyama)
        # ---------------------------------------------------------------------
        # d(ln S) = (mu - 0.5*sigma^2) dt + sigma dW + J dN
        N_paths = 10000
        steps = 252
        dt = 1.0 / 252.0
        
        # Starting asset price is normalized to 1.0
        S = np.ones((N_paths, steps + 1))
        
        Z = np.random.standard_normal((N_paths, steps))
        # Poisson prob approximation: Prob(dN=1) = lambda * dt
        prob_jump = min(lambda_future * dt, 1.0)
        dN = np.random.binomial(1, prob_jump, size=(N_paths, steps))
        J = np.random.normal(mu_J_future, sigma_J_hist, size=(N_paths, steps))
        
        drift = (mu_hist - 0.5 * sigma_hist**2) * dt
        diffusion = sigma_hist * np.sqrt(dt)
        
        # Vectorized path generation
        for t in range(steps):
            S[:, t+1] = S[:, t] * np.exp(drift + diffusion * Z[:, t] + J[:, t] * dN[:, t])
            
        final_returns_pct = (S[:, -1] - 1.0) * 100
        
        # Step 5: Risk Metric Calculation (CVaR 95%)
        # ---------------------------------------------------------------------
        alpha = 5.0 # Bottom 5% worst outcomes
        var_95 = np.percentile(final_returns_pct, alpha)
        # Conditional Value at Risk (Expected Shortfall)
        cvar_95 = final_returns_pct[final_returns_pct <= var_95].mean()
        
        cvar_95_display = abs(cvar_95) if cvar_95 < 0 else 0.0
        expected_drop_pct = (np.exp(mu_J_future) - 1) * 100
        prob_shock_annual = (1 - np.exp(-lambda_future)) * 100
        
        return {
            "ticker": ticker,
            "historical_volatility": round(sigma_hist, 4),
            "projected_jump_prob": round(prob_shock_annual, 2),
            "projected_expected_drop": round(expected_drop_pct, 2),
            "cvar_95": round(cvar_95_display, 2)
        }
        
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Simulation failed: {type(e).__name__}: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
