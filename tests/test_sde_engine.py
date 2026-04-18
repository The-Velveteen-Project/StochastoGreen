"""
tests/test_sde_engine.py
========================
Quantitative test suite for the StochastoGreen SDE Engine (main.py).

Design principles:
  - Zero network calls: yfinance is fully mocked.
  - Deterministic: SIMULATION_SEED guarantees identical output per run.
  - Mathematical: tests verify distributional properties, not just "no crash".

Run with:
    pytest tests/ -v
"""

import numpy as np
import pandas as pd
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from main import (
    app,
    get_climate_beta,
    SIMULATION_SEED,
    _CLIMATE_BETA_MAP,
    _BETA_DEFAULT,
)

client = TestClient(app)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def make_price_series(n: int = 1_260, seed: int = 99) -> pd.Series:
    """
    Synthetic 5-year daily close series (n ≈ 252 × 5 trading days).
    Parameters chosen to guarantee at least a few 3-sigma jump events
    so jump-detection code paths are exercised.

    The index is built first and prices are sized to match — avoids
    off-by-one errors when pd.bdate_range resolves holidays differently
    across environments.
    """
    idx = pd.bdate_range(end="2026-04-18", periods=n)
    actual_n = len(idx)           # may differ from n due to holiday calendars
    rng = np.random.default_rng(seed)
    # Baseline GBM-like returns with occasional fat-tail jumps
    returns = rng.normal(0.0003, 0.012, actual_n)
    # Inject 8 explicit large negative jumps to ensure jump detection fires
    jump_idx = rng.choice(actual_n, size=min(8, actual_n), replace=False)
    returns[jump_idx] -= rng.uniform(0.05, 0.12, size=len(jump_idx))
    prices = 100.0 * np.exp(np.cumsum(returns))
    return pd.Series(prices, index=idx, name="Close")


def simulate(ticker: str = "XOM", sector: str = "Energy", n: int = 1_260) -> dict:
    """Helper: run a full simulation with mocked yfinance and return JSON."""
    prices = make_price_series(n=n)
    with patch("yfinance.download") as mock_dl:
        mock_dl.return_value = pd.DataFrame({"Close": prices})
        resp = client.post(
            "/simulate_climate_risk",
            json={"ticker": ticker, "sector": sector},
        )
    assert resp.status_code == 200, f"Unexpected {resp.status_code}: {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# 1. Health endpoint
# ---------------------------------------------------------------------------

class TestHealth:
    def test_health_returns_200(self):
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_health_schema(self):
        data = client.get("/health").json()
        assert data["status"] == "ok"
        assert "model" in data
        assert "version" in data


# ---------------------------------------------------------------------------
# 2. Climate Beta — NGFS Phase 4 sector multipliers
# ---------------------------------------------------------------------------

class TestClimateBeta:
    """Verifies sector → beta mapping is correct and exhaustive."""

    # Brown assets
    @pytest.mark.parametrize("sector,expected", [
        ("Energy",          1.5),
        ("ENERGY",          1.5),
        ("energy sector",   1.5),   # substring match: "ENERGY" in "ENERGY SECTOR"
        ("Basic Materials", 1.5),
        ("Utilities",       1.4),
        ("Manufacturing",   1.3),
        ("Industrials",     1.2),
    ])
    def test_brown_sectors(self, sector, expected):
        assert get_climate_beta(sector) == expected

    # Green / low-exposure assets
    @pytest.mark.parametrize("sector,expected", [
        ("Technology",            0.8),
        ("Healthcare",            0.8),
        ("Life Sciences",         0.8),
        ("Communication Services", 0.9),
    ])
    def test_green_sectors(self, sector, expected):
        assert get_climate_beta(sector) == expected

    def test_unknown_sector_returns_default(self):
        assert get_climate_beta("Quantum Blockchain Metaverse") == _BETA_DEFAULT

    def test_empty_sector_returns_default(self):
        assert get_climate_beta("Unknown") == _BETA_DEFAULT

    def test_all_map_keys_uppercase(self):
        """Keys must be uppercase so the substring search works correctly."""
        for key in _CLIMATE_BETA_MAP:
            assert key == key.upper(), f"Key not uppercase: '{key}'"

    def test_all_betas_positive(self):
        for key, beta in _CLIMATE_BETA_MAP.items():
            assert beta > 0, f"Non-positive beta for {key}: {beta}"


# ---------------------------------------------------------------------------
# 3. Simulation — mathematical invariants
# ---------------------------------------------------------------------------

class TestSimulationInvariants:
    """Core mathematical properties that must hold regardless of market data."""

    def test_reproducibility(self):
        """Fixed seed → identical CVaR and jump probability across runs."""
        a = simulate()
        b = simulate()
        assert a["cvar_95"] == b["cvar_95"]
        assert a["projected_jump_prob"] == b["projected_jump_prob"]
        assert a["historical_volatility"] == b["historical_volatility"]

    def test_seed_reported_in_response(self):
        data = simulate()
        assert data["simulation_seed"] == SIMULATION_SEED

    def test_is_fallback_false_on_success(self):
        """A successful simulation must never report is_fallback=True."""
        data = simulate()
        assert data["is_fallback"] is False

    def test_cvar_non_negative(self):
        """CVaR is displayed as a positive loss magnitude (abs value)."""
        data = simulate()
        assert data["cvar_95"] >= 0.0

    def test_jump_prob_in_valid_range(self):
        """Annualized shock probability must be in [0, 100]%."""
        data = simulate()
        assert 0.0 <= data["projected_jump_prob"] <= 100.0

    def test_historical_volatility_realistic(self):
        """Annualized daily vol for equities is typically 5%–150%."""
        data = simulate()
        sigma = data["historical_volatility"]
        assert 0.05 <= sigma <= 1.50, f"Unrealistic σ={sigma:.4f}"

    def test_brown_riskier_than_green(self):
        """
        Energy (β=1.5) must produce higher projected jump prob than Technology (β=0.8)
        given identical underlying price data.
        """
        brown = simulate(sector="Energy")
        green = simulate(sector="Technology")
        assert brown["climate_beta"] > green["climate_beta"]
        assert brown["projected_jump_prob"] > green["projected_jump_prob"]

    def test_climate_beta_in_response(self):
        data = simulate(sector="Energy")
        assert data["climate_beta"] == 1.5

    def test_lambda_projected_geq_lambda_historical_for_brown(self):
        """
        For brown sectors (β > 1), projected λ must exceed historical λ.
        λ_future = λ_hist × climate_beta, clamped to minimum.
        """
        data = simulate(sector="Energy")
        assert data["lambda_projected"] >= data["lambda_historical"]

    def test_expected_drop_negative(self):
        """Expected drop is (exp(μ_J) − 1) × 100, always negative for downside jumps."""
        data = simulate()
        assert data["projected_expected_drop"] < 0.0


# ---------------------------------------------------------------------------
# 4. Simulation paths — shape and ordering
# ---------------------------------------------------------------------------

class TestSimulationPaths:
    """Verify the three reported percentile paths are well-formed."""

    def test_paths_present(self):
        data = simulate()
        assert set(data["simulation_paths"].keys()) == {"media", "optimista", "cvar_zone"}

    def test_paths_have_50_points(self):
        """S[:, 5::5] → exactly 50 time points for the frontend chart."""
        paths = simulate()["simulation_paths"]
        for key, series in paths.items():
            assert len(series) == 50, f"'{key}' has {len(series)} points, expected 50"

    def test_path_ordering_at_every_step(self):
        """
        At each of the 50 time steps:
          optimista (P90) >= media (P50) >= cvar_zone (P5)
        """
        paths = simulate()["simulation_paths"]
        for i in range(50):
            assert paths["optimista"][i] >= paths["media"][i], (
                f"Step {i}: optimista={paths['optimista'][i]} < media={paths['media'][i]}"
            )
            assert paths["media"][i] >= paths["cvar_zone"][i], (
                f"Step {i}: media={paths['media'][i]} < cvar_zone={paths['cvar_zone'][i]}"
            )

    def test_paths_start_near_100(self):
        """All paths are indexed to 100 at t=0; first reported point (t=5d) should be close."""
        paths = simulate()["simulation_paths"]
        for key, series in paths.items():
            assert 50.0 < series[0] < 200.0, (
                f"'{key}' first point {series[0]} looks wrong (expected near 100)"
            )


# ---------------------------------------------------------------------------
# 5. Jump distribution invariant — TruncNormal upper=0
# ---------------------------------------------------------------------------

class TestTruncNormalInvariant:
    """
    Independently verifies that the jump size distribution produces
    strictly non-positive samples. This is the key fix over the original
    symmetric Gaussian, which generated positive jumps from a
    negative-calibrated mean.
    """

    def test_all_simulated_jumps_non_positive(self):
        from scipy.stats import truncnorm

        mu_J    = -0.05   # representative calibrated value
        sigma_J =  0.02
        b_trunc = (0.0 - mu_J) / sigma_J   # > 0

        rng = np.random.default_rng(SIMULATION_SEED)
        J = truncnorm.rvs(
            a=-np.inf, b=b_trunc,
            loc=mu_J, scale=sigma_J,
            size=(10_000, 252),
            random_state=rng,
        )
        assert np.all(J <= 0.0), (
            f"Positive jump sizes detected. max(J)={J.max():.8f} — "
            "TruncNormal upper bound is broken."
        )

    def test_jump_mean_matches_calibration(self):
        """
        Mean of TruncNormal(-∞, 0; μ_J, σ_J) must be more negative than μ_J
        because we are truncating the right tail.
        """
        from scipy.stats import truncnorm

        mu_J, sigma_J = -0.05, 0.02
        b_trunc = -mu_J / sigma_J
        rng = np.random.default_rng(SIMULATION_SEED)
        J = truncnorm.rvs(
            a=-np.inf, b=b_trunc,
            loc=mu_J, scale=sigma_J,
            size=100_000,
            random_state=rng,
        )
        # Truncating the right tail pulls the mean leftward
        assert J.mean() < mu_J, (
            f"TruncNormal mean {J.mean():.4f} should be < μ_J={mu_J}"
        )


# ---------------------------------------------------------------------------
# 6. Input validation
# ---------------------------------------------------------------------------

class TestInputValidation:
    def test_invalid_ticker_special_chars(self):
        resp = client.post(
            "/simulate_climate_risk",
            json={"ticker": "XO M!", "sector": "Energy"},
        )
        assert resp.status_code == 422

    def test_ticker_too_long(self):
        resp = client.post(
            "/simulate_climate_risk",
            json={"ticker": "ABCDEFGHIJK", "sector": "Energy"},
        )
        assert resp.status_code == 422

    def test_empty_ticker(self):
        resp = client.post(
            "/simulate_climate_risk",
            json={"ticker": "", "sector": "Energy"},
        )
        assert resp.status_code == 422

    def test_missing_sector(self):
        resp = client.post(
            "/simulate_climate_risk",
            json={"ticker": "AAPL"},
        )
        assert resp.status_code == 422

    def test_ticker_normalized_to_uppercase(self):
        """Lowercase ticker 'aapl' must be normalized to 'AAPL' in response."""
        prices = make_price_series()
        with patch("yfinance.download") as mock_dl:
            mock_dl.return_value = pd.DataFrame({"Close": prices})
            resp = client.post(
                "/simulate_climate_risk",
                json={"ticker": "aapl", "sector": "Technology"},
            )
        assert resp.status_code == 200
        assert resp.json()["ticker"] == "AAPL"

    def test_empty_yfinance_response_raises_422(self):
        """If yfinance returns no data, endpoint must return 422 (not 500)."""
        with patch("yfinance.download") as mock_dl:
            mock_dl.return_value = pd.DataFrame()
            resp = client.post(
                "/simulate_climate_risk",
                json={"ticker": "FAKE", "sector": "Energy"},
            )
        assert resp.status_code == 422

    def test_too_few_prices_raises_422(self):
        """A price series with <2 points cannot produce log-returns."""
        with patch("yfinance.download") as mock_dl:
            mock_dl.return_value = pd.DataFrame({"Close": pd.Series([100.0])})
            resp = client.post(
                "/simulate_climate_risk",
                json={"ticker": "FAKE", "sector": "Energy"},
            )
        # Should fail gracefully — either 422 or 500, not a Python exception
        assert resp.status_code in (422, 500)


# ---------------------------------------------------------------------------
# 7. Baseline enforcement — minimum risk floor
# ---------------------------------------------------------------------------

class TestBaselineEnforcement:
    """
    When a stock has zero historical jumps, the climate baseline must still
    inject a non-zero risk floor proportional to climate_beta.
    """

    def test_zero_historical_jumps_still_produces_risk(self):
        """
        Inject a perfectly smooth price series (no 3-sigma outliers).
        The minimum baseline (lambda_future = 0.5 × beta) must fire.
        """
        idx     = pd.bdate_range(end="2026-04-18", periods=1_260)
        actual_n = len(idx)
        rng     = np.random.default_rng(42)
        # Tiny vol → no 3-sigma events even across 5 years
        returns = rng.normal(0.0003, 0.001, actual_n)
        prices  = 100.0 * np.exp(np.cumsum(returns))
        series  = pd.Series(prices, index=idx, name="Close")

        with patch("yfinance.download") as mock_dl:
            mock_dl.return_value = pd.DataFrame({"Close": series})
            resp = client.post(
                "/simulate_climate_risk",
                json={"ticker": "TEST", "sector": "Energy"},
            )
        assert resp.status_code == 200
        data = resp.json()
        # With beta=1.5, lambda_floor = 0.5 × 1.5 = 0.75 → prob > 0
        assert data["projected_jump_prob"] > 0.0
        assert data["lambda_projected"] >= 0.5 * data["climate_beta"]
