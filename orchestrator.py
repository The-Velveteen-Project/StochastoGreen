import asyncio
import os
import httpx
import logging
from dotenv import load_dotenv
from supabase import create_client, Client

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate

load_dotenv()

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("stochasto_orchestrator")

ALPHAVANTAGE_API = os.getenv("ALPHAVANTAGE_API_KEY", "demo")
SDE_ENGINE_URL = os.getenv(
    "SDE_ENGINE_URL", "http://localhost:8000/simulate_climate_risk"
)

# Supabase Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-project-url.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "your-service-role-key")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(
    title="StochastoGreen Orchestrator",
    description="Multi-agent climate transition risk analysis",
    version="1.0.0",
)

class AnalysisRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=10)
    
    @field_validator("ticker")
    @classmethod
    def normalize(cls, v: str) -> str:
        return v.strip().upper()

class AnalysisResponse(BaseModel):
    ticker: str
    fundamental_report: str
    technical_report: str
    executive_verdict: str
    cvar_95: float
    projected_jump_prob: float

@app.get("/health")
async def health():
    return {"status": "ok", "service": "orchestrator", "version": "1.0.0"}

async def fetch_alphavantage(symbol: str) -> dict:
    """Trigger y Data Ingestion: Obtiene datos fundamentales desde AlphaVantage."""
    url = f"https://www.alphavantage.co/query?function=OVERVIEW&symbol={symbol}&apikey={ALPHAVANTAGE_API}"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=15.0)
            response.raise_for_status()
            data = response.json()
            log.info(f"AlphaVantage response keys for {symbol}: {list(data.keys()) if data else 'empty response'}")

            if isinstance(data, dict) and ("Note" in data or "Information" in data):
                log.warning(f"AlphaVantage rate limit/info response for {symbol}: {data}")
                return {}

            if not data or "Symbol" not in data:
                log.warning(f"AlphaVantage returned empty/invalid payload for {symbol}. Using fundamental fallback.")
                return {}

            return data
    except Exception as e:
        log.warning(f"AlphaVantage request failed for {symbol}: {e}. Using fundamental fallback.")
        return {}

async def run_fundamental_analyst(llm, company_data: dict) -> str:
    """Rama A: Evaluación Fundamental Cruda de Salud Corporativa."""
    has_fundamentals = bool(company_data and company_data.get("Symbol"))
    prompt_prefix = (
        "Eres un analista financiero experto. Tu objetivo es resumir la salud financiera de la empresa, "
        "analiza estos fundamentales y dame tu veredicto de salud financiera en 2 líneas:\n"
    )
    if not has_fundamentals:
        prompt_prefix += (
            "No hay datos fundamentales disponibles para este ticker. "
            "Basa tu análisis solo en el perfil sectorial y riesgo climático.\n"
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
    chain = prompt | llm

    # Manejo de keys por fallback
    kwargs = {
        "Symbol": company_data.get("Symbol", "N/A"),
        "Sector": company_data.get("Sector", "N/A"),
        "Industry": company_data.get("Industry", "N/A"),
        "PERatio": company_data.get("PERatio", "N/A"),
        "ProfitMargin": company_data.get("ProfitMargin", "N/A"),
        "EBITDA": company_data.get("EBITDA", "N/A")
    }

    result = await chain.ainvoke(kwargs)
    return result.content

async def call_python_sde_engine(symbol: str, sector: str) -> dict:
    """Agente Intermediario Cuantitativo: Llama al microservicio microservicio matemático de SDEs (FastAPI)."""
    url = SDE_ENGINE_URL
    payload = {"ticker": symbol, "sector": sector}
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=40.0)
            response.raise_for_status()
            return response.json()
    except Exception as e:
        print(f"\n[!] Advertencia: El motor de SDE local falló ({e}). Asegúrate de haber ejecutado uvicorn main:app. Se usarán datos de contingencia.")
        # Fallback de emergencia si el endpoint no responde
        return {
            "ticker": symbol,
            "historical_volatility": 0.25,
            "projected_jump_prob": 12.5,
            "projected_expected_drop": -18.2,
            "cvar_95": 22.4
        }

async def run_technical_analyst(llm, symbol: str, sector: str) -> tuple[str, dict]:
    """Rama B: Analista Cuantitativo que interpreta el riesgo matemático del SDE."""
    # Obtener inferencia estocástica desde el microservicio paralelo
    sde_data = await call_python_sde_engine(symbol, sector)

    prompt = PromptTemplate.from_template(
        "Eres un Analista Cuantitativo Senior especializado en Finanzas Verdes (Green Finance) y Riesgo de Transición Climática.\n"
        "Acabas de recibir los resultados de nuestro motor matemático (un modelo estocástico de Jump-Diffusion que simula shocks regulatorios y físicos) "
        "para la empresa {Symbol} que opera en el sector {Sector}.\n\n"
        "Resultados de la Simulación Estocástica (10,000 escenarios):\n"
        "- Probabilidad de Shock Climático/Regulatorio (Poisson λ): {jump_prob}% anual.\n"
        "- Impacto Estimado en caso de Shock (Caída del precio): {expected_drop}%\n"
        "- Climate Value at Risk (CVaR al 95%): El portafolio podría perder un {cvar_95}% de su valor en el peor escenario climático.\n\n"
        "Tu tarea:\n"
        "Redacta un reporte analítico, técnico y crudo de máximo 2 párrafos dirigido al Portfolio Manager (Agente 3).\n"
        "Interpreta qué significan estos números matemáticos para una empresa del sector {Sector}.\n"
        "Explica si el riesgo predominante es físico (desastres) o de transición (impuestos al carbono/leyes ambientales).\n"
        "Concluye tajantemente clasificando el activo como: [Activo Verde], [Activo Sucio / Brown Asset] o [Activo en Transición].\n"
        "Nota: No des consejos de compra, solo traduce el riesgo estocástico a una narrativa financiera."
    )
    chain = prompt | llm
    result = await chain.ainvoke({
        "Symbol": symbol,
        "Sector": sector,
        "jump_prob": sde_data.get("projected_jump_prob", "N/A"),
        "expected_drop": sde_data.get("projected_expected_drop", "N/A"),
        "cvar_95": sde_data.get("cvar_95", "N/A")
    })
    return result.content, sde_data

async def run_executive_agent(llm, symbol: str, fundamental_report: str, technical_report: str) -> str:
    """Nodo Orquestador de Merge: Consolida el input y emite veredicto Ejecutivo."""
    prompt = PromptTemplate.from_template(
        "Eres el Gestor de Portafolios Principal de un fondo de cobertura cuantitativo especializado en ESG y Finanzas Verdes. "
        "Tienes que tomar la decisión final de inversión sobre la empresa {Symbol}.\n"
        "Tienes sobre tu mesa dos reportes independientes:\n\n"
        "1. Reporte Cuantitativo de Riesgo Climático:\n"
        "{technical_report}\n\n"
        "2. Reporte Fundamental:\n"
        "{fundamental_report}\n\n"
        "Tu tarea:\n"
        "Redacta un veredicto ejecutivo final (máximo 150 palabras) diciendo si debemos [COMPRAR], [MANTENER] o [VENDER/RECHAZAR] el activo. "
        "Debes justificar tu decisión equilibrando la salud financiera tradicional con la exposición matemática al riesgo de transición climática "
        "(los saltos estocásticos de Poisson y el CVaR). Tu tono debe ser el de un matemático financiero: frío, calculador y basado en el riesgo."
    )
    chain = prompt | llm
    result = await chain.ainvoke({
        "Symbol": symbol,
        "technical_report": technical_report,
        "fundamental_report": fundamental_report
    })
    return result.content

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze(request: AnalysisRequest) -> AnalysisResponse:
    ticker = request.ticker
    log.info(f"Starting analysis for {ticker}")

    company_data = await fetch_alphavantage(ticker)
    has_fundamental_data = bool(company_data and company_data.get("Symbol"))
    sector = company_data.get("Sector", "Unknown") if company_data else "Unknown"
    company_data_for_prompt = {
        "Symbol": ticker,
        "Sector": sector,
        "Industry": company_data.get("Industry", "N/A") if company_data else "N/A",
        "PERatio": company_data.get("PERatio", "N/A") if company_data else "N/A",
        "ProfitMargin": company_data.get("ProfitMargin", "N/A") if company_data else "N/A",
        "EBITDA": company_data.get("EBITDA", "N/A") if company_data else "N/A",
    }

    llm_analyst = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash", temperature=0.2
    )
    llm_executive = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash", temperature=0.5
    )

    # Paralelismo real con create_task
    fundamental_task = asyncio.create_task(
        run_fundamental_analyst(llm_analyst, company_data_for_prompt)
    )
    technical_task = asyncio.create_task(
        run_technical_analyst(llm_analyst, ticker, sector)
    )

    fundamental_result, technical_result = await asyncio.gather(
        fundamental_task, technical_task, return_exceptions=True
    )
    if isinstance(technical_result, Exception):
        raise HTTPException(
            status_code=500,
            detail=f"Technical analysis failed: {str(technical_result)}"
        )
    if isinstance(fundamental_result, Exception):
        log.warning(f"Fundamental agent failed for {ticker}: {fundamental_result}")
        has_fundamental_data = False
        fundamental_report = (
            "No hay datos fundamentales disponibles para este ticker. "
            "Basa tu análisis solo en el perfil sectorial y riesgo climático."
        )
    else:
        fundamental_report = fundamental_result

    technical_report, sde_data = technical_result

    executive_verdict = await run_executive_agent(
        llm_executive, ticker, fundamental_report, technical_report
    )
    if not has_fundamental_data:
        executive_verdict = (
            "Análisis cuantitativo únicamente — sin datos fundamentales.\n\n"
            f"{executive_verdict}"
        )

    log.info(f"Analysis complete for {ticker}")

    response = AnalysisResponse(
        ticker=ticker,
        fundamental_report=fundamental_report,
        technical_report=technical_report,
        executive_verdict=executive_verdict,
        cvar_95=sde_data.get("cvar_95", 0.0),
        projected_jump_prob=sde_data.get("projected_jump_prob", 0.0),
    )

    # Persist to Supabase
    try:
        data_to_save = {
            "ticker": response.ticker,
            "cvar_95": response.cvar_95,
            "jump_prob": response.projected_jump_prob,
            "verdict": response.executive_verdict,
            "fundamental_report": response.fundamental_report,
            "technical_report": response.technical_report
        }
        supabase.table("risk_analyses").insert(data_to_save).execute()
        log.info(f"Saved analysis for {ticker} to Supabase")
    except Exception as e:
        log.error(f"Failed to save to Supabase: {e}")

    return response

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
