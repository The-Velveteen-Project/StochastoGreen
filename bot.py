import os
import asyncio
import httpx
import logging
from dotenv import load_dotenv
from telegram import Update, ReplyKeyboardMarkup, ReplyKeyboardRemove
from telegram.ext import (
    Application, CommandHandler, MessageHandler,
    ConversationHandler, filters, ContextTypes
)

load_dotenv()
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("stochasto_bot")

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
ORCHESTRATOR_URL = os.getenv(
    "ORCHESTRATOR_URL",
    "https://orchestator-production.up.railway.app/analyze"
)

# Estados de la conversación
ASK_HORIZON, ASK_SECTORS, ASK_RISK, ASK_CONFIRM, ANALYZING = range(5)

SECTOR_SUGGESTIONS = {
    ("corto", "baja"):   ["MSFT", "JNJ", "PG"],
    ("corto", "media"):  ["AAPL", "NEE", "ENPH"],
    ("corto", "alta"):   ["TSLA", "PLUG", "FSLR"],
    ("mediano", "baja"): ["MSFT", "NEE", "AMT"],
    ("mediano", "media"):["AAPL", "ENPH", "XOM"],
    ("mediano", "alta"): ["TSLA", "RIVN", "PLUG"],
    ("largo", "baja"):   ["JNJ", "NEE", "PG"],
    ("largo", "media"):  ["MSFT", "AAPL", "ENPH"],
    ("largo", "alta"):   ["TSLA", "FSLR", "PLUG"],
}

def get_suggestions(horizon: str, risk: str) -> list[str]:
    key = (horizon, risk)
    return SECTOR_SUGGESTIONS.get(key, ["AAPL", "MSFT", "NEE"])

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    await update.message.reply_text(
        "STOCHASTO GREEN\n"
        "Climate Risk Terminal · by The Velveteen Project\n\n"
        "Soy tu asesor de portafolio ESG. Voy a hacerte "
        "3 preguntas para construir un portafolio adaptado "
        "a tu perfil y evaluar su riesgo climático.\n\n"
        "¿Cuál es tu horizonte de inversión?",
        reply_markup=ReplyKeyboardMarkup(
            [["Corto plazo (< 1 año)"],
             ["Mediano plazo (1–3 años)"],
             ["Largo plazo (> 3 años)"]],
            one_time_keyboard=True,
            resize_keyboard=True
        )
    )
    return ASK_HORIZON

async def ask_horizon(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.lower()
    if "corto" in text:
        context.user_data["horizon"] = "corto"
        horizon_label = "corto plazo"
    elif "largo" in text:
        context.user_data["horizon"] = "largo"
        horizon_label = "largo plazo"
    else:
        context.user_data["horizon"] = "mediano"
        horizon_label = "mediano plazo"

    await update.message.reply_text(
        f"Horizonte: {horizon_label} ✓\n\n"
        "¿Qué sectores te interesan para invertir?",
        reply_markup=ReplyKeyboardMarkup(
            [["Tecnología y Salud"],
             ["Energía limpia y Utilities"],
             ["Mixto (todos los sectores)"]],
            one_time_keyboard=True,
            resize_keyboard=True
        )
    )
    return ASK_SECTORS

async def ask_sectors(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["sectors"] = update.message.text

    await update.message.reply_text(
        "¿Cuál es tu tolerancia al riesgo climático?\n\n"
        "El riesgo climático incluye regulaciones ambientales, "
        "impuestos al carbono y eventos físicos extremos.",
        reply_markup=ReplyKeyboardMarkup(
            [["Baja — prefiero activos verdes estables"],
             ["Media — acepto algo de exposición"],
             ["Alta — busco retorno aunque haya riesgo"]],
            one_time_keyboard=True,
            resize_keyboard=True
        )
    )
    return ASK_RISK

async def ask_risk(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.lower()
    if "baja" in text:
        context.user_data["risk"] = "baja"
    elif "alta" in text:
        context.user_data["risk"] = "alta"
    else:
        context.user_data["risk"] = "media"

    horizon = context.user_data["horizon"]
    risk = context.user_data["risk"]
    suggestions = get_suggestions(horizon, risk)
    context.user_data["portfolio"] = suggestions

    await update.message.reply_text(
        f"Perfil construido:\n"
        f"· Horizonte: {horizon} plazo\n"
        f"· Sectores: {context.user_data['sectors']}\n"
        f"· Tolerancia al riesgo: {risk}\n\n"
        f"Basado en tu perfil, te sugiero analizar:\n"
        f"{' · '.join(suggestions)}\n\n"
        "¿Procedemos con este portafolio o quieres "
        "cambiarlo antes de analizar?",
        reply_markup=ReplyKeyboardMarkup(
            [["Analizar este portafolio"],
             ["Quiero cambiar los tickers"],
             ["Agregar un ticker adicional"]],
            one_time_keyboard=True,
            resize_keyboard=True
        )
    )
    return ASK_CONFIRM

async def ask_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.lower()

    if "cambiar" in text:
        context.user_data["portfolio"] = []
        await update.message.reply_text(
            "Envíame los tickers que quieres analizar "
            "separados por comas.\nEjemplo: AAPL, NEE, MSFT",
            reply_markup=ReplyKeyboardRemove()
        )
        return ASK_CONFIRM

    if "agregar" in text:
        await update.message.reply_text(
            "Envíame el ticker adicional:",
            reply_markup=ReplyKeyboardRemove()
        )
        return ASK_CONFIRM

    if "," in text:
        tickers = [t.strip().upper() for t in text.split(",") if t.strip()]
        context.user_data["portfolio"] = tickers[:5]
        await update.message.reply_text(
            f"Portafolio actualizado: {' · '.join(context.user_data['portfolio'])}\n\n"
            "¿Procedemos?",
            reply_markup=ReplyKeyboardMarkup(
                [["Analizar este portafolio"]],
                one_time_keyboard=True,
                resize_keyboard=True
            )
        )
        return ASK_CONFIRM

    if text[0].isalpha() and len(text.split()) == 1 and len(text) <= 10:
        ticker = text.upper()
        portfolio = context.user_data.get("portfolio", [])
        if ticker not in portfolio and len(portfolio) < 5:
            portfolio.append(ticker)
            context.user_data["portfolio"] = portfolio
            await update.message.reply_text(
                f"{ticker} agregado.\n"
                f"Portafolio: {' · '.join(portfolio)}\n\n"
                "¿Procedemos?",
                reply_markup=ReplyKeyboardMarkup(
                    [["Analizar este portafolio"]],
                    one_time_keyboard=True,
                    resize_keyboard=True
                )
            )
            return ASK_CONFIRM

    return await run_analysis(update, context)

async def run_analysis(update: Update, context: ContextTypes.DEFAULT_TYPE):
    portfolio = context.user_data.get("portfolio", [])

    if not portfolio:
        await update.message.reply_text(
            "No hay activos para analizar. Escribe /start para comenzar.",
            reply_markup=ReplyKeyboardRemove()
        )
        return ASK_CONFIRM

    await update.message.reply_text(
        f"Iniciando análisis de {len(portfolio)} activo(s)...\n\n"
        "El motor Jump-Diffusion está simulando 10,000 escenarios "
        "por activo. Esto toma entre 30 y 90 segundos por ticker.",
        reply_markup=ReplyKeyboardRemove()
    )

    results = []
    for ticker in portfolio:
        await update.message.reply_text(f"Analizando {ticker}...")
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    ORCHESTRATOR_URL,
                    json={"ticker": ticker}
                )
                if response.status_code == 200:
                    data = response.json()
                    results.append({
                        "ticker": ticker,
                        "cvar": data.get("cvar_95", 0),
                        "jump_prob": data.get("projected_jump_prob", 0),
                        "verdict": data.get("executive_verdict", ""),
                    })
                else:
                    results.append({
                        "ticker": ticker,
                        "error": f"Error {response.status_code}"
                    })
        except Exception as e:
            results.append({"ticker": ticker, "error": str(e)})

    report = "REPORTE FINAL DE RIESGO CLIMÁTICO\n"
    report += "=" * 34 + "\n\n"

    for r in results:
        if "error" in r:
            report += f"{r['ticker']}: No disponible — {r['error']}\n\n"
            continue

        cvar = r["cvar"]
        if cvar > 20:
            nivel = "ALTO"
            accion = "VENDER / RECHAZAR"
        elif cvar > 10:
            nivel = "MEDIO"
            accion = "MANTENER"
        else:
            nivel = "BAJO"
            accion = "COMPRAR"

        report += f"TICKER: {r['ticker']}\n"
        report += f"CVaR 95%: {cvar:.1f}%  |  Riesgo: {nivel}\n"
        report += f"Prob. Shock Climático: {r['jump_prob']:.1f}% anual\n"
        report += f"Veredicto: {accion}\n"
        verdict_short = r['verdict'][:300] if r['verdict'] else "Sin veredicto"
        report += f"\n{verdict_short}\n"
        report += "-" * 30 + "\n\n"

    report += "StochastoGreen · The Velveteen Project\n"
    report += "Engineering Computational Sovereignty"

    await update.message.reply_text(report)

    await update.message.reply_text(
        "Análisis completado.\n\n"
        "Escribe /start para evaluar un nuevo portafolio\n"
        "o /help para ver todos los comandos."
    )
    return ASK_HORIZON

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "STOCHASTO GREEN — Comandos\n\n"
        "/start — Construir nuevo portafolio\n"
        "/help — Esta ayuda\n\n"
        "El bot te guía con 3 preguntas para construir "
        "tu portafolio ESG y evalúa el riesgo climático "
        "de cada activo con un modelo Jump-Diffusion."
    )

def main():
    if not TOKEN:
        raise ValueError(
            "TELEGRAM_BOT_TOKEN no configurado en variables de entorno"
        )

    app = Application.builder().token(TOKEN).build()

    conv = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            ASK_HORIZON:  [MessageHandler(
                filters.TEXT & ~filters.COMMAND, ask_horizon)],
            ASK_SECTORS:  [MessageHandler(
                filters.TEXT & ~filters.COMMAND, ask_sectors)],
            ASK_RISK:     [MessageHandler(
                filters.TEXT & ~filters.COMMAND, ask_risk)],
            ASK_CONFIRM:  [MessageHandler(
                filters.TEXT & ~filters.COMMAND, ask_confirm)],
        },
        fallbacks=[CommandHandler("start", start)],
    )

    app.add_handler(conv)
    app.add_handler(CommandHandler("help", help_command))

    log.info("StochastoGreen bot iniciado")
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
