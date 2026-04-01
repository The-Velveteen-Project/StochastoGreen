import asyncio
import os
import httpx
from dotenv import load_dotenv

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate

# Cargar las variables de entorno
load_dotenv()

# Nos aseguramos de tener ALPHAVANTAGE_API_KEY y GOOGLE_API_KEY en el environment (.env)
ALPHAVANTAGE_API = os.getenv("ALPHAVANTAGE_API_KEY", "demo")

async def fetch_alphavantage(symbol: str) -> dict:
    """Trigger y Data Ingestion: Obtiene datos fundamentales desde AlphaVantage."""
    url = f"https://www.alphavantage.co/query?function=OVERVIEW&symbol={symbol}&apikey={ALPHAVANTAGE_API}"
    async with httpx.AsyncClient() as client:
        response = await client.get(url, timeout=15.0)
        data = response.json()
        if not data or "Symbol" not in data:
            raise ValueError(f"No se encontraron datos para {symbol} en AlphaVantage. Verifica el Ticker o el API Key.")
        return data

async def run_fundamental_analyst(llm, company_data: dict) -> str:
    """Rama A: Evaluación Fundamental Cruda de Salud Corporativa."""
    prompt = PromptTemplate.from_template(
        "Eres un analista financiero experto. Tu objetivo es resumir la salud financiera de la empresa, "
        "analiza estos fundamentales y dame tu veredicto de salud financiera en 2 líneas:\n"
        "- Símbolo: {Symbol}\n"
        "- Sector: {Sector}\n"
        "- Industria: {Industry}\n"
        "- PE Ratio: {PERatio}\n"
        "- Margen de Beneficio: {ProfitMargin}\n"
        "- EBITDA: {EBITDA}"
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
    url = "http://localhost:8000/simulate_climate_risk"
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

async def run_technical_analyst(llm, company_data: dict) -> str:
    """Rama B: Analista Cuantitativo que interpreta el riesgo matemático del SDE."""
    symbol = company_data.get("Symbol", "Unknown")
    sector = company_data.get("Sector", "Unknown")

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
    return result.content

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

async def main():
    """Ejecución de la Red Causal StochastoGreen Multi-Agente"""
    # Mapeamos los LLMs tal como fue explícito en la topología JSON.
    # Usaremos modelos soportados si "1.5-flash" reemplaza a "2.5-flash-lite".
    try:
        llm_fundamental = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.2)
        llm_technical = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.2)
        llm_executive = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.5)
    except Exception as e:
        print(f"Error al inicializar LangChain Google GenAI: {e}\nPor favor asegura haber exportado GOOGLE_API_KEY.")
        return

    print(r'''
    ========================================================
     [ STOCHASTOGREEN : CLIMATE TRANSITION RISK ORCHESTRATOR ]
    ========================================================
    ''')
    target_ticker = input(">>> Ingresa el Ticker de la empresa a evaluar (Ej: AAPL, XOM, TSLA): ").strip().upper()
    if not target_ticker:
        target_ticker = "AAPL"

    print(f"\n[1/4] Iniciando Data Ingestion para {target_ticker} (AlphaVantage)...")
    try:
        company_data = await fetch_alphavantage(target_ticker)
        print(f"      [+] Sector detectado: {company_data.get('Sector', 'Desconocido')} | Industria: {company_data.get('Industry', 'Desconocida')}")
    except Exception as e:
        print(f"Error en Fetch data: {e}")
        return

    print("\n[2/4] Desplegando ramas de evaluación en PARALELO...")
    print("      -> Lanzando Agente Fundamental (Salud Tradicional)")
    print("      -> Lanzando Agente Cuantitativo Tecnico (Evaluación Stochástica y Llamada SDE)")

    # Orquestación Concurrente Asíncrona (Aumenta la velocidad drasticamente)
    fundamental_task = run_fundamental_analyst(llm_fundamental, company_data)
    await asyncio.sleep(2)
    technical_task = run_technical_analyst(llm_technical, company_data)

    fundamental_report, technical_report = await asyncio.gather(fundamental_task, technical_task)

    print("\n--- [REPORTE FUNDAMENTAL] ---")
    print(fundamental_report)
    print("\n--- [REPORTE TÉCNICO / RIESGO ESTOCÁSTICO] ---")
    print(technical_report)

    print("\n[3/4] Merge: Agente Orquestador procesando veredicto Ejecutivo...")
    executive_verdict = await run_executive_agent(llm_executive, target_ticker, fundamental_report, technical_report)

    print("\n================== [VEREDICTO FINAL] ==================")
    print(executive_verdict)
    print("=========================================================")

if __name__ == "__main__":
    asyncio.run(main())
