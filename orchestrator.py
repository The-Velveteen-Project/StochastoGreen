import asyncio
import os
import httpx
import logging
from contextlib import asynccontextmanager
from typing import Literal
from dotenv import load_dotenv
from supabase import create_client, Client

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate

load_dotenv()

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("stochasto_orchestrator")

ALPHAVANTAGE_API: str = os.getenv("ALPHAVANTAGE_API_KEY", "demo")
SDE_ENGINE_URL:   str = os.getenv(
    "SDE_ENGINE_URL", "http://localhost:8000/simulate_climate_risk"
)

# ---------------------------------------------------------------------------
# LLM Singletons — instantiated once at module load, reused across all requests.
# Instantiating per-request adds latency and wastes memory.
# ---------------------------------------------------------------------------
_LLM_ANALYST = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0.2,
    google_api_key=os.getenv("GOOGLE_API_KEY"),
)
_LLM_EXECUTIVE = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0.3,   # lower temp improves structured-output reliability
    google_api_key=os.getenv("GOOGLE_API_KEY"),
)

# ---------------------------------------------------------------------------
# Lazy Supabase — initialized on first use to prevent import-time crash
# when credentials are not yet configured (e.g. local dev without .env).
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Shared HTTP client — module-level singleton for connection pooling / TLS reuse.
# Managed via FastAPI lifespan so it is properly closed on shutdown.
# ---------------------------------------------------------------------------
_http_client: httpx.AsyncClient | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _http_client
    _http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(40.0, connect=10.0)
    )
    yield
    await _http_client.aclose()


_supabase_client: Client | None = None


def get_supabase() -> Client:
    global _supabase_client
    if _supabase_client is None:
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_KEY", "")
        if not url or not key or "your-project" in url:
            raise RuntimeError(
                "Supabase credentials not configured. "
                "Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env"
            )
        _supabase_client = create_client(url, key)
    return _supabase_client


app = FastAPI(
    title="StochastoGreen Orchestrator",
    description="Multi-agent climate transition risk analysis",
    version="2.0.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
def _safe_get(data: dict | None, field: str, default: str = "N/A") -> str:
    """Returns data[field] if data is a non-empty dict, else default."""
    return data.get(field, default) if data else default


class AnalysisRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=10)
    user_id: str | None = Field(
        None,
        description=(
            "Supabase user UUID — supplied by the bot after resolving the "
            "Telegram chat_id → profiles lookup. None for unauthenticated calls."
        ),
    )

    @field_validator("ticker")
    @classmethod
    def normalize(cls, v: str) -> str:
        cleaned = v.strip().upper()
        if not cleaned.replace("-", "").replace(".", "").isalpha():
            raise ValueError(f"Ticker must contain only letters, got: {cleaned}")
        return cleaned


class ExecutiveVerdict(BaseModel):
    """
    Structured output for the executive agent.
    Enforced via LangChain with_structured_output() → Pydantic schema is sent
    to the LLM as a JSON schema constraint, eliminating free-form hallucinations.
    """
    action: Literal["COMPRAR", "MANTENER", "VENDER"] = Field(
        ..., description="Decisión de inversión final."
    )
    justification: str = Field(
        ..., max_length=800,
        description="Justificación cuantitativa en máximo 150 palabras.",
    )
    confidence: float = Field(
        ..., ge=0.0, le=1.0,
        description="Nivel de confianza del analista en la decisión [0=incierto, 1=certero].",
    )


class AnalysisResponse(BaseModel):
    ticker:                 str
    climate_beta:           float
    fundamental_report:     str
    technical_report:       str
    verdict_action:         Literal["COMPRAR", "MANTENER", "VENDER"]
    verdict_justification:  str
    verdict_confidence:     float
    cvar_95:                float
    projected_jump_prob:    float
    is_fallback:            bool   # True if SDE engine returned contingency data


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok", "service": "orchestrator", "version": "2.0.0"}


# ---------------------------------------------------------------------------
# Data Ingestion
# ---------------------------------------------------------------------------
async def fetch_alphavantage(symbol: str) -> dict:
    """Obtiene datos fundamentales desde AlphaVantage OVERVIEW (best-effort)."""
    url = (
        f"https://www.alphavantage.co/query"
        f"?function=OVERVIEW&symbol={symbol}&apikey={ALPHAVANTAGE_API}"
    )
    try:
        response = await _http_client.get(url, timeout=15.0)
        response.raise_for_status()
        data = response.json()

        if isinstance(data, dict) and ("Note" in data or "Information" in data):
            log.warning(f"[{symbol}] AlphaVantage rate limit hit — using sector fallback.")
            return {}

        if not data or "Symbol" not in data:
            log.warning(f"[{symbol}] AlphaVantage returned invalid payload — using sector fallback.")
            return {}

        log.info(f"[{symbol}] AlphaVantage OK — sector: {data.get('Sector', 'N/A')}")
        return data

    except Exception as e:
        log.warning(f"[{symbol}] AlphaVantage request failed: {e} — using sector fallback.")
        return {}


# ---------------------------------------------------------------------------
# Agent A — Fundamental Analyst (LLM, optional)
# ---------------------------------------------------------------------------
async def run_fundamental_analyst(company_data: dict) -> str:
    """
    Agente A: Evaluación de salud financiera corporativa.
    Si no hay datos fundamentales, el análisis se basa solo en sector y riesgo climático.
    """
    has_fundamentals = bool(company_data and company_data.get("Symbol"))
    prompt_prefix = (
        "Eres un analista financiero experto. Analiza estos fundamentales "
        "y emite tu veredicto de salud financiera en 2 líneas:\n"
    )
    if not has_fundamentals:
        prompt_prefix += (
            "AVISO: No hay datos fundamentales disponibles para este ticker. "
            "Basa tu análisis únicamente en el perfil sectorial y riesgo climático.\n"
        )

    prompt = PromptTemplate.from_template(
        prompt_prefix
        + "- Símbolo: {Symbol}\n"
        + "- Sector: {Sector}\n"
        + "- Industria: {Industry}\n"
        + "- PE Ratio: {PERatio}\n"
        + "- Margen de Beneficio: {ProfitMargin}\n"
        + "- EBITDA: {EBITDA}"
    )
    chain = prompt | _LLM_ANALYST
    result = await chain.ainvoke({
        "Symbol":       company_data.get("Symbol", "N/A"),
        "Sector":       company_data.get("Sector", "N/A"),
        "Industry":     company_data.get("Industry", "N/A"),
        "PERatio":      company_data.get("PERatio", "N/A"),
        "ProfitMargin": company_data.get("ProfitMargin", "N/A"),
        "EBITDA":       company_data.get("EBITDA", "N/A"),
    })
    return result.content


# ---------------------------------------------------------------------------
# SDE Engine bridge — FAILS EXPLICITLY, never returns fake data
# ---------------------------------------------------------------------------
async def call_python_sde_engine(symbol: str, sector: str) -> dict:
    """
    Llama al microservicio matemático (main.py FastAPI).

    DESIGN DECISION: This function raises HTTPException on failure instead of
    returning hardcoded contingency values. Fake simulation data passed through
    to an LLM-generated investment verdict is a silent, undetectable error that
    is worse than a visible failure. The system fails loudly or not at all.
    """
    payload = {"ticker": symbol, "sector": sector}
    try:
        response = await _http_client.post(SDE_ENGINE_URL, json=payload, timeout=40.0)
        response.raise_for_status()
        return response.json()

    except httpx.HTTPStatusError as e:
        detail = e.response.text if e.response else str(e)
        raise HTTPException(
            status_code=502,
            detail=f"SDE Engine returned HTTP error for {symbol}: {detail}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=(
                f"SDE Engine unreachable for {symbol}: {type(e).__name__}: {e}. "
                f"Ensure 'uvicorn main:app --port 8000' is running."
            ),
        )


# ---------------------------------------------------------------------------
# Agent B — Technical / Quantitative Analyst
# ---------------------------------------------------------------------------
async def run_technical_analyst(symbol: str, sector: str) -> tuple[str, dict]:
    """
    Agente B: Interpreta los resultados del SDE engine en narrativa financiera.
    El LLM narra — no calcula. Los números vienen del motor matemático Python.
    Retorna (reporte_texto, sde_data_dict).
    """
    sde_data = await call_python_sde_engine(symbol, sector)

    prompt = PromptTemplate.from_template(
        "Eres un Analista Cuantitativo Senior especializado en Green Finance "
        "y Riesgo de Transición Climática.\n"
        "Acabas de recibir los resultados del motor Merton Jump-Diffusion "
        "(10.000 escenarios Monte Carlo, NGFS Phase 4) "
        "para la empresa {Symbol} en el sector {Sector}.\n\n"
        "Resultados de la Simulación Estocástica:\n"
        "- Climate Beta (NGFS Phase 4): {climate_beta}\n"
        "- Intensidad de saltos histórica (λ/año): {lambda_hist} "
        "→ proyectada bajo estrés climático: {lambda_proj}\n"
        "- Probabilidad de Shock Climático anual (Poisson): {jump_prob}%\n"
        "- Impacto estimado por shock (caída esperada en precio): {expected_drop}%\n"
        "- Climate CVaR al 95%: pérdida esperada de {cvar_95}% en el peor escenario\n\n"
        "Tu tarea (máximo 2 párrafos, dirigido al Portfolio Manager):\n"
        "1. Interpreta qué significan estos números para una empresa del sector {Sector}.\n"
        "2. Clasifica el activo como [Activo Verde], [Brown Asset] o [Activo en Transición].\n"
        "Nota: Solo narras el riesgo estocástico. No emitas recomendación de compra/venta."
    )
    chain = prompt | _LLM_ANALYST
    result = await chain.ainvoke({
        "Symbol":        symbol,
        "Sector":        sector,
        "climate_beta":  sde_data.get("climate_beta", "N/A"),
        "lambda_hist":   sde_data.get("lambda_historical", "N/A"),
        "lambda_proj":   sde_data.get("lambda_projected", "N/A"),
        "jump_prob":     sde_data.get("projected_jump_prob", "N/A"),
        "expected_drop": sde_data.get("projected_expected_drop", "N/A"),
        "cvar_95":       sde_data.get("cvar_95", "N/A"),
    })
    return result.content, sde_data


# ---------------------------------------------------------------------------
# Agent C — Executive / Portfolio Manager (Pydantic-validated structured output)
# ---------------------------------------------------------------------------
async def run_executive_agent(
    symbol: str,
    fundamental_report: str,
    technical_report: str,
) -> ExecutiveVerdict:
    """
    Agente C: Veredicto ejecutivo estructurado y validado por Pydantic.

    Usa with_structured_output(ExecutiveVerdict) que envía el JSON schema de
    ExecutiveVerdict al LLM como constraint de formato. Si el LLM alucina texto
    libre o un action inválido, LangChain lanza ValidationError — nunca llega
    al usuario una respuesta no estructurada.
    """
    prompt = PromptTemplate.from_template(
        "Eres el Gestor de Portafolios Principal de un fondo ESG cuantitativo. "
        "Toma la decisión final sobre {Symbol} equilibrando la salud financiera "
        "tradicional con la exposición matemática al riesgo de transición climática "
        "(Climate Beta NGFS, intensidad de saltos Poisson λ, CVaR 95%).\n\n"
        "Reporte Cuantitativo de Riesgo Climático:\n{technical_report}\n\n"
        "Reporte Fundamental:\n{fundamental_report}\n\n"
        "Emite un veredicto estructurado con:\n"
        "- action: COMPRAR | MANTENER | VENDER\n"
        "- justification: máximo 150 palabras, tono frío y calculador\n"
        "- confidence: float [0, 1]"
    )
    structured_llm = _LLM_EXECUTIVE.with_structured_output(ExecutiveVerdict)
    chain = prompt | structured_llm

    verdict: ExecutiveVerdict = await chain.ainvoke({
        "Symbol":             symbol,
        "technical_report":   technical_report,
        "fundamental_report": fundamental_report,
    })
    return verdict


# ---------------------------------------------------------------------------
# Main Endpoint
# ---------------------------------------------------------------------------
@app.post("/analyze", response_model=AnalysisResponse)
async def analyze(request: AnalysisRequest) -> AnalysisResponse:
    ticker = request.ticker
    log.info(f"[{ticker}] Analysis started")

    # Step 1 — Data ingestion (sequential: sector is required before SDE call)
    company_data = await fetch_alphavantage(ticker)
    sector = company_data.get("Sector", "Unknown") if company_data else "Unknown"

    if sector == "Unknown":
        log.warning(
            f"[{ticker}] Sector not resolved from AlphaVantage — "
            "climate_beta will default to 1.0 (neutral). "
            "Transition risk may be underestimated for brown-sector assets."
        )

    company_data_for_prompt = {
        "Symbol":       ticker,
        "Sector":       sector,
        "Industry":     _safe_get(company_data, "Industry"),
        "PERatio":      _safe_get(company_data, "PERatio"),
        "ProfitMargin": _safe_get(company_data, "ProfitMargin"),
        "EBITDA":       _safe_get(company_data, "EBITDA"),
    }

    # Step 2 — Agents A and B in true parallel (asyncio.gather)
    fundamental_task = asyncio.create_task(run_fundamental_analyst(company_data_for_prompt))
    technical_task   = asyncio.create_task(run_technical_analyst(ticker, sector))

    fundamental_result, technical_result = await asyncio.gather(
        fundamental_task, technical_task, return_exceptions=True
    )

    # Agent B (SDE + technical narrative) is CRITICAL — fail loudly if it breaks
    if isinstance(technical_result, Exception):
        raise HTTPException(
            status_code=500,
            detail=f"[{ticker}] Technical analysis failed: {technical_result}",
        )

    technical_report, sde_data = technical_result

    # Agent A (fundamentals) is OPTIONAL — degrade gracefully if unavailable
    if isinstance(fundamental_result, Exception):
        log.warning(f"[{ticker}] Fundamental agent failed: {fundamental_result}")
        fundamental_report = (
            "Análisis fundamental no disponible para este ticker. "
            "Decisión basada exclusivamente en riesgo cuantitativo climático."
        )
    else:
        fundamental_report = fundamental_result

    # Step 3 — Executive synthesis: structured, Pydantic-validated verdict
    verdict: ExecutiveVerdict = await run_executive_agent(
        ticker, fundamental_report, technical_report
    )
    log.info(
        f"[{ticker}] Verdict: {verdict.action} "
        f"(confidence={verdict.confidence:.2f})"
    )

    # Step 4 — Build validated response
    response = AnalysisResponse(
        ticker=ticker,
        climate_beta=float(sde_data.get("climate_beta", 1.0)),
        fundamental_report=fundamental_report,
        technical_report=technical_report,
        verdict_action=verdict.action,
        verdict_justification=verdict.justification,
        verdict_confidence=verdict.confidence,
        cvar_95=float(sde_data.get("cvar_95", 0.0)),
        projected_jump_prob=float(sde_data.get("projected_jump_prob", 0.0)),
        is_fallback=bool(sde_data.get("is_fallback", False)),
    )

    # Step 5 — Persist to Supabase (non-blocking: log error, never crash response)
    try:
        db = get_supabase()
        db.table("risk_analyses").insert({
            "ticker":                response.ticker,
            "user_id":               request.user_id,        # None if Telegram not linked
            "climate_beta":          response.climate_beta,
            "cvar_95":               response.cvar_95,
            "jump_prob":             response.projected_jump_prob,
            "verdict_action":        response.verdict_action,
            "verdict_confidence":    response.verdict_confidence,
            "verdict_justification": response.verdict_justification,
            "fundamental_report":    response.fundamental_report,
            "technical_report":      response.technical_report,
            "simulation_paths":      sde_data.get("simulation_paths"),
            "is_fallback":           response.is_fallback,
        }).execute()
        log.info(f"[{ticker}] Saved to Supabase")
    except Exception as e:
        log.error(f"[{ticker}] Supabase persistence failed (non-critical): {e}")

    return response


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
