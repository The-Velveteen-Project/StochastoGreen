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

# Conversation states
COLLECTING, CONFIRM, ANALYZING = range(3)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    context.user_data["portfolio"] = []
    await update.message.reply_text(
        "STOCHASTO GREEN — Climate Portfolio Risk\n\n"
        "Voy a ayudarte a construir tu portafolio y evaluar "
        "el riesgo climático de cada activo.\n\n"
        "Envíame tickers uno por uno (ej: AAPL, MSFT, XOM).\n"
        "Escribe /analizar cuando termines.\n"
        "Escribe /limpiar para empezar de nuevo."
    )
    return COLLECTING

async def add_ticker(update: Update, context: ContextTypes.DEFAULT_TYPE):
    ticker = update.message.text.strip().upper()
    
    if not ticker.replace("-", "").replace(".", "").isalpha():
        await update.message.reply_text(
            f"'{ticker}' no parece un ticker válido. "
            "Intenta con AAPL, MSFT, XOM, etc."
        )
        return COLLECTING
    
    portfolio = context.user_data.get("portfolio", [])
    
    if ticker in portfolio:
        await update.message.reply_text(f"{ticker} ya está en tu portafolio.")
        return COLLECTING
    
    if len(portfolio) >= 5:
        await update.message.reply_text(
            "Máximo 5 activos por análisis en el plan actual.\n"
            "Escribe /analizar para evaluar los que tienes."
        )
        return COLLECTING
    
    portfolio.append(ticker)
    context.user_data["portfolio"] = portfolio
    
    await update.message.reply_text(
        f"✓ {ticker} agregado.\n"
        f"Portafolio actual: {' · '.join(portfolio)}\n\n"
        "Agrega otro ticker o escribe /analizar para evaluar."
    )
    return COLLECTING

async def analyze_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    portfolio = context.user_data.get("portfolio", [])
    
    if not portfolio:
        await update.message.reply_text(
            "Tu portafolio está vacío. "
            "Envíame al menos un ticker primero."
        )
        return COLLECTING
    
    await update.message.reply_text(
        f"Analizando {len(portfolio)} activo(s): {' · '.join(portfolio)}\n\n"
        "Esto puede tomar 30–90 segundos por activo.\n"
        "El motor Jump-Diffusion está corriendo 10,000 escenarios..."
    )
    
    results = []
    for ticker in portfolio:
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
                        "verdict": data.get("executive_verdict", "Sin veredicto"),
                    })
                else:
                    results.append({
                        "ticker": ticker,
                        "error": f"Error {response.status_code}"
                    })
        except Exception as e:
            results.append({"ticker": ticker, "error": str(e)})
    
    # Build report
    report = "REPORTE DE RIESGO CLIMÁTICO\n"
    report += "=" * 32 + "\n\n"
    
    for r in results:
        if "error" in r:
            report += f"{r['ticker']}: Error — {r['error']}\n\n"
            continue
        
        cvar = r["cvar"]
        if cvar > 20:
            nivel = "ALTO — VENDER/RECHAZAR"
        elif cvar > 10:
            nivel = "MEDIO — MANTENER"
        else:
            nivel = "BAJO — COMPRAR"
        
        report += f"TICKER: {r['ticker']}\n"
        report += f"CVaR 95%: {cvar:.1f}%\n"
        report += f"Prob. Shock: {r['jump_prob']:.1f}% anual\n"
        report += f"Nivel: {nivel}\n"
        report += f"IA: {r['verdict'][:200]}...\n"
        report += "-" * 28 + "\n\n"
    
    report += "Análisis generado por StochastoGreen\n"
    report += "The Velveteen Project"
    
    await update.message.reply_text(report)
    
    # Reset portfolio
    context.user_data["portfolio"] = []
    await update.message.reply_text(
        "Portafolio reiniciado. "
        "Envía un ticker para empezar un nuevo análisis."
    )
    return COLLECTING

async def clear_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["portfolio"] = []
    await update.message.reply_text(
        "Portafolio limpiado. Envíame tickers para empezar de nuevo."
    )
    return COLLECTING

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "COMANDOS DISPONIBLES:\n\n"
        "/start — Iniciar nueva sesión\n"
        "/analizar — Evaluar portafolio actual\n"
        "/limpiar — Limpiar portafolio\n"
        "/help — Esta ayuda\n\n"
        "Envía cualquier ticker (AAPL, XOM, TSLA) para agregarlo."
    )
    return COLLECTING

def main():
    if not TOKEN:
        raise ValueError("TELEGRAM_BOT_TOKEN no configurado en variables de entorno")
    
    app = Application.builder().token(TOKEN).build()
    
    conv = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            COLLECTING: [
                CommandHandler("analizar", analyze_command),
                CommandHandler("limpiar", clear_command),
                CommandHandler("help", help_command),
                MessageHandler(filters.TEXT & ~filters.COMMAND, add_ticker),
            ],
        },
        fallbacks=[CommandHandler("start", start)],
    )
    
    app.add_handler(conv)
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    
    log.info("StochastoGreen bot iniciado")
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
