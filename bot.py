import os
import asyncio
import json
import httpx
import logging
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import (
    Application, CommandHandler,
    MessageHandler, filters, ContextTypes
)
from telegram.error import Conflict
import google.generativeai as genai

load_dotenv()
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("stochasto_bot")

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
ORCHESTRATOR_URL = os.getenv(
    "ORCHESTRATOR_URL",
    "https://orchestator-production.up.railway.app/analyze"
)
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

genai.configure(api_key=GOOGLE_API_KEY)

SYSTEM_PROMPT = """
Eres StochastoGreen, un asesor de portafolio ESG especializado
en riesgo de transición climática. Fuiste creado por
The Velveteen Project.

Tu personalidad: analítico, directo, cálido. Hablas como
un asesor financiero experto, no como un bot. Usas lenguaje
natural, no formularios. Haces UNA pregunta a la vez.

Tu objetivo: entender el perfil del usuario (horizonte de
inversión, tolerancia al riesgo, sectores de interés,
capital disponible si lo menciona) y cuando tengas suficiente
información, proponer entre 2 y 5 tickers para analizar.

Cuando tengas los tickers listos para analizar, responde
EXACTAMENTE con este formato JSON y nada más:

ANALYZE:{"tickers":["TICKER1","TICKER2","TICKER3"]}

Reglas:
- Nunca menciones que eres un bot o que sigues un flujo
- Si el usuario pregunta algo fuera del tema de inversión,
  redirige amablemente hacia el portafolio
- Solo propón tickers reales que cotizan en NYSE o NASDAQ
- Máximo 5 tickers por análisis
- Cuando el usuario confirme que quiere analizar,
  emite el ANALYZE JSON inmediatamente
- Responde siempre en el idioma del usuario
"""

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    context.user_data["history"] = []
    context.user_data["analyzing"] = False

    await update.message.reply_text(
        "Hola. Soy StochastoGreen, tu asesor de portafolio ESG.\n\n"
        "Cuéntame — ¿qué te trae por aquí? ¿Tienes algún "
        "activo en mente o empezamos desde cero?"
    )

async def handle_message(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):
    if context.user_data.get("analyzing"):
        await update.message.reply_text(
            "Espera, estoy analizando tu portafolio..."
        )
        return

    user_text = update.message.text
    history = context.user_data.get("history", [])

    history.append({
        "role": "user",
        "parts": [user_text]
    })

    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=SYSTEM_PROMPT
        )
        chat = model.start_chat(history=history[:-1])
        response = await asyncio.to_thread(
            chat.send_message, user_text
        )
        reply = response.text.strip()

    except Exception as e:
        log.error(f"Gemini error: {e}")
        await update.message.reply_text(
            "Tuve un problema técnico. Intenta de nuevo."
        )
        return

    if reply.startswith("ANALYZE:"):
        try:
            json_str = reply.replace("ANALYZE:", "").strip()
            data = json.loads(json_str)
            tickers = data.get("tickers", [])

            if not tickers:
                await update.message.reply_text(
                    "No pude identificar los tickers. "
                    "¿Puedes confirmarlos?"
                )
                return

            context.user_data["analyzing"] = True
            history.append({
                "role": "model",
                "parts": [reply]
            })
            context.user_data["history"] = history

            await update.message.reply_text(
                f"Perfecto. Analizando: "
                f"{' · '.join(tickers)}\n\n"
                "El motor Jump-Diffusion está simulando "
                "10,000 escenarios por activo. "
                "Esto toma 30–90 segundos por ticker..."
            )

            results = []
            for ticker in tickers:
                await update.message.reply_text(
                    f"Procesando {ticker}..."
                )
                try:
                    async with httpx.AsyncClient(
                        timeout=120.0
                    ) as client:
                        res = await client.post(
                            ORCHESTRATOR_URL,
                            json={"ticker": ticker}
                        )
                        if res.status_code == 200:
                            d = res.json()
                            results.append({
                                "ticker": ticker,
                                "cvar": d.get("cvar_95", 0),
                                "jump_prob": d.get(
                                    "projected_jump_prob", 0
                                ),
                                "verdict": d.get(
                                    "executive_verdict", ""
                                ),
                            })
                        else:
                            results.append({
                                "ticker": ticker,
                                "error": f"Error {res.status_code}"
                            })
                except Exception as e:
                    results.append({
                        "ticker": ticker,
                        "error": str(e)
                    })

            report = build_report(results)
            await update.message.reply_text(report)

            summary_prompt = (
                f"El análisis de riesgo climático dio estos "
                f"resultados: {json.dumps(results, ensure_ascii=False)}. "
                f"En 3–4 líneas, da tu veredicto final como "
                f"asesor ESG. Sé directo y útil."
            )
            try:
                summary_response = await asyncio.to_thread(
                    chat.send_message, summary_prompt
                )
                await update.message.reply_text(
                    summary_response.text.strip()
                )
            except Exception:
                pass

            context.user_data["analyzing"] = False
            context.user_data["history"] = []

            await update.message.reply_text(
                "¿Quieres analizar otro portafolio? "
                "Escribe /start para comenzar de nuevo."
            )
            return

        except json.JSONDecodeError:
            log.error(f"JSON parse error: {reply}")

    history.append({
        "role": "model",
        "parts": [reply]
    })
    context.user_data["history"] = history

    await update.message.reply_text(reply)

def build_report(results: list) -> str:
    report = "REPORTE DE RIESGO CLIMÁTICO\n"
    report += "=" * 32 + "\n\n"

    for r in results:
        if "error" in r:
            report += (
                f"{r['ticker']}: No disponible\n\n"
            )
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
        report += (
            f"CVaR 95%: {cvar:.1f}%  |  "
            f"Riesgo: {nivel}\n"
        )
        report += (
            f"Prob. Shock: "
            f"{r['jump_prob']:.1f}% anual\n"
        )
        report += f"Señal: {accion}\n"
        report += "-" * 28 + "\n\n"

    report += "StochastoGreen · The Velveteen Project"
    return report

async def help_command(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):
    await update.message.reply_text(
        "Soy StochastoGreen, tu asesor ESG.\n\n"
        "/start — Nueva conversación\n"
        "/help — Esta ayuda\n\n"
        "Solo háblame normal — te guío hacia "
        "el mejor portafolio para tu perfil."
    )

async def post_init(application: Application) -> None:
    await application.bot.delete_webhook(drop_pending_updates=True)
    log.info("Webhook residual eliminado. Esperando 2s para sincronización con Railway...")
    # Delay to allow previous instance to shut down
    await asyncio.sleep(2)
    log.info("Iniciando polling...")

def main():
    if not TOKEN:
        raise ValueError(
            "TELEGRAM_BOT_TOKEN no configurado"
        )

    app = Application.builder().token(TOKEN).post_init(post_init).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(
        MessageHandler(
            filters.TEXT & ~filters.COMMAND,
            handle_message
        )
    )

    log.info("StochastoGreen agent iniciado")
    
    max_retries = 5
    for attempt in range(max_retries):
        try:
            app.run_polling(drop_pending_updates=True, allowed_updates=Update.ALL_TYPES)
            break
        except Conflict:
            if attempt < max_retries - 1:
                log.warning(f"Conflicto 409 detectado. Reintento {attempt + 2}/{max_retries} en 5s...")
                import time
                time.sleep(5)
            else:
                log.error("Máximo de reintentos alcanzado. Abortando.")
                raise

if __name__ == "__main__":
    main()
