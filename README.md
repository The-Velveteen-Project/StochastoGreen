# 🌍 StochastoGreen: Climate Transition Risk Orchestrator

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=flat&logo=langchain)](https://langchain.com/)

> **StochastoGreen** is an advanced Multi-Agent AI system designed to assess **climate transition risks** for financial portfolios. By bridging the gap between rigorous mathematical modeling (Stochastic Differential Equations) and fundamental analysis, it evaluates corporate exposure to regulatory shocks and physical climate risks.

---

## 🚀 Key Features

*   **📈 Stochastic Simulation (SDE):** A quantitative FastAPI engine that implements a *Jump-Diffusion (Poisson)* model to calculate the Climate Value at Risk (CVaR) via Euler-Maruyama Monte Carlo simulations.
*   **🤖 Multi-Agent Reasoning:** Orchestrated using **LangChain** and **Google Gemini** (2.5 Flash), featuring:
    *   *Fundamental Analyst:* Evaluates traditional corporate health (P/E Ratio, EBITDA, Margins).
    *   *Technical Analyst:* Translates stochastic probabilities and expected drops into a financial narrative.
    *   *Executive Portfolio Manager:* Merges both reports to issue a final investment verdict (COMPRAR, MANTENER, or VENDER/RECHAZAR).
*   **📊 Real-time Market Intelligence:** Automated data ingestion from **AlphaVantage** (fundamentals) and **yfinance** (historical price action).
*   **🌍 Sectoral Climate Beta:** Proprietary penalty system that dynamically scales projected risk based on the asset's industry (e.g., heavily penalizing "Brown Assets" like Energy/Materials).

---

## 📁 Project Structure

```bash
├── 📄 main.py               # Quantitative SDE Engine (FastAPI)
├── 📄 orchestrator.py       # LangChain Multi-Agent Orchestrator
├── 📄 requirements.txt      # Python dependencies
├── 📄 StochastoGreen.json   # System topology and configuration models
└── 📄 .env.example          # Environment variables template
```

### ⚙️ Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/cmorregof/StochastoGreen.git
   cd StochastoGreen
   ```

2. **Environment Configuration:**
   Copy the example environment file and fill in your API keys:
   ```bash
   cp .env.example .env
   ```
   > 🔑 **Note:** You will need API keys for **AlphaVantage** and **Google Gemini** (`GOOGLE_API_KEY`).

3. **Install Dependencies:**
   Ensure you have Python 3.9+ installed, then run:
   ```bash
   pip install -r requirements.txt
   ```

### 🚀 Launching the System

You need to run two separate processes simultaneously:

1. **Start the Quantitative Backend (SDE Engine):**
   This launches the FastAPI microservice that generates the Monte Carlo simulations.
   ```bash
   python main.py
   # Or using Uvicorn directly: uvicorn main:app --host 0.0.0.0 --port 8000
   ```

2. **Run the Multi-Agent Orchestrator:**
   In a separate terminal, execute the AI orchestration script to begin risk assessment.
   ```bash
   python orchestrator.py
   ```
   *Follow the CLI prompts to input the target company ticker (e.g., AAPL, XOM, TSLA).*

---

## 🧪 Technical Background
The quantitative engine assesses downside tail risk through a specialized **Jump-Diffusion** process. Unlike standard geometric Brownian motion, this model injects a Poisson-driven jump component to simulate sudden, severe climate or regulatory shocks:

$$d(\ln S_t) = (\mu - \frac{1}{2}\sigma^2)dt + \sigma dW_t + J_t dN_t$$

Where:
*   **$W_t$** represents normal market volatility (Wiener process).
*   **$N_t$** is a Poisson process reflecting the probability of a climate event ($\lambda$).
*   **$J_t$** dictates the magnitude of the shock, scaled by the sector's *Climate Beta*.

These simulated paths (10,000 scenarios) allow the engine to calculate the **95% Climate Value at Risk (CVaR)**, forming the basis for the Quantitative Analyst's assessment.

---

## 🎓 About
*Developed as a sophisticated architectural model combining quantitative finance with state-of-the-art Agentic AI for ESG and Sustainable Finance applications.*
