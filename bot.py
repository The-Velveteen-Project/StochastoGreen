import os
import asyncio
import json
import httpx
import logging
from datetime import datetime, timezone
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import (
    Application, CommandHandler,
    MessageHandler, filters, ContextTypes
)
from telegram.error import Conflict
from telegram.constants import ParseMode
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
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

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

# ─── SUPABASE ──────────────────────────────────────────────────────────────────

async def save_analysis_to_supabase(chat_id: int, ticker: str, result: dict):
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{SUPABASE_URL}/rest/v1/profiles",
                headers=headers,
                params={"telegram_chat_id": f"eq.{chat_id}", "select": "id"}
            )
            if r.status_code != 200 or not r.json():
                return
            user_id = r.json()[0]["id"]
            await client.post(
                f"{SUPABASE_URL}/rest/v1/risk_analyses",
                headers=headers,
                json={
                    "ticker": ticker,
                    "cvar_95": result.get("cvar"),
                    "jump_prob": result.get("jump_prob"),
                    "verdict": result.get("verdict"),
                    "user_id": user_id,
                }
            )
    except Exception as e:
        log.warning(f"Supabase save failed for {ticker}: {e}")


async def link_telegram_account(chat_id: int, code: str) -> bool:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return False
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{SUPABASE_URL}/rest/v1/telegram_link_codes",
                headers=headers,
                params={
                    "code": f"eq.{code.upper()}",
                    "used": "eq.false",
                    "select": "user_id,expires_at"
                }
            )
            if r.status_code != 200 or not r.json():
                return False
            row = r.json()[0]
            expires_at = datetime.fromisoformat(
                row["expires_at"].replace("Z", "+00:00")
            )
            if expires_at < datetime.now(timezone.utc):
                return False
            user_id = row["user_id"]
            await client.patch(
                f"{SUPABASE_URL}/rest/v1/profiles",
                headers={**headers, "Prefer": "return=minimal"},
                params={"id": f"eq.{user_id}"},
                json={
                    "telegram_chat_id": chat_id,
                    "telegram_linked_at": datetime.now(timezone.utc).isoformat()
                }
            )
            await client.patch(
                f"{SUPABASE_URL}/rest/v1/telegram_link_codes",
                headers={**headers, "Prefer": "return=minimal"},
                params={"code": f"eq.{code.upper()}"},
                json={"used": True}
            )
            return True
    except Exception as e:
        log.error(f"Link error: {e}")
        return False

# ─── REPORT ────────────────────────────────────────────────────────────────────

def escape_md(text: str) -> str:
    """Escapa caracteres especiales para MarkdownV2."""
    for ch in r"_*[]()~`>#+-=|{}.!":
        text = text.replace(ch, f"\\{ch}")
    return text

def build_report(results: list) -> str:
    lines = ["📊 *REPORTE DE RIESGO CLIMÁTICO*", ""]
    for r in results:
        ticker = r["ticker"]
        if "error" in r:
            lines.append(f"⚠️ *{ticker}*: datos no disponibles ahora")
            lines.append(f"   _\\({escape_md(str(r['error'])[:60])}\\)_")
            lines.append("")
            continue
        cvar = r["cvar"]
        jump_prob = r["jump_prob"]
        if cvar > 20:
            emoji, nivel, accion = "🔴", "ALTO", "🚫 VENDER / RECHAZAR"
        elif cvar > 10:
            emoji, nivel, accion = "🟡", "MEDIO", "⏸️ MANTENER"
        else:
            emoji, nivel, accion = "🟢", "BAJO", "✅ COMPRAR"
        lines.append(f"{emoji} *{ticker}*")
        lines.append(f"  📉 CVaR 95%: `{cvar:.1f}%` — Riesgo {nivel}")
        lines.append(f"  ⚡ Prob\\. Shock: `{jump_prob:.1f}%` anual")
        lines.append(f"  {accion}")
        lines.append("")
    lines.append("━━━━━━━━━━━━━━━━━━━━━━")
    lines.append("_StochastoGreen · The Velveteen Project_")
    return "\n".join(lines)

# ─── HANDLERS ──────────────────────────────────────────────────────────────────

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    context.user_data["history"] = []
    context.user_data["analyzing"] = False
    await update.message.reply_text(
        "👋 Hola\\. Soy *StochastoGreen*, tu asesor de portafolio ESG\\.\n\n"
        "Evalúo el riesgo de transición climática de activos financieros "
        "con modelos Jump\\-Diffusion y 10,000 escenarios Monte Carlo\\.\n\n"
        "¿Tienes algún activo en mente o empezamos desde cero?",
        parse_mode=ParseMode.MARKDOWN_V2
    )


async def link_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    if not args:
        await update.message.reply_text(
            "🔗 *Vincular tu cuenta del dashboard:*\n\n"
            "1\\. Ve a stochasto\\-green\\.vercel\\.app\n"
            "2\\. Haz clic en *Vincular Telegram*\n"
            "3\\. Copia el código de 6 dígitos\n"
            "4\\. Envíalo aquí: `/link TU_CODIGO`",
            parse_mode=ParseMode.MARKDOWN_V2
        )
        return
    code = args[0].strip()
    chat_id = update.message.from_user.id
    await update.message.reply_text("🔄 Verificando código\\.\\.\\.", parse_mode=ParseMode.MARKDOWN_V2)
    success = await link_telegram_account(chat_id, code)
    if success:
        await update.message.reply_text(
            "✅ *¡Cuenta vinculada\\!*\n\n"
            "Tus análisis se guardarán en el dashboard automáticamente\\.",
            parse_mode=ParseMode.MARKDOWN_V2
        )
    else:
        await update.message.reply_text(
            "❌ Código inválido, expirado o ya utilizado\\.\n"
            "Genera uno nuevo desde el dashboard\\.",
            parse_mode=ParseMode.MARKDOWN_V2
        )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🌿 *StochastoGreen — Ayuda*\n\n"
        "/start — Nueva conversación\n"
        "/link CODIGO — Vincular con dashboard web\n"
        "/help — Esta ayuda\n\n"
        "Háblame normal y te guío al mejor portafolio para tu perfil\\.",
        parse_mode=ParseMode.MARKDOWN_V2
    )


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if context.user_data.get("analyzing"):
        await update.message.reply_text(
            "⏳ Estoy procesando tu portafolio\\. Un momento\\.\\.\\.",
            parse_mode=ParseMode.MARKDOWN_V2
        )
        return

    user_text = update.message.text
    history = context.user_data.get("history", [])
    history.append({"role": "user", "parts": [user_text]})

    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=SYSTEM_PROMPT
        )
        chat = model.start_chat(history=history[:-1])
        response = await asyncio.to_thread(chat.send_message, user_text)
        reply = response.text.strip()
    except Exception as e:
        log.error(f"Gemini error: {e}")
        await update.message.reply_text(
            "⚠️ Problema técnico\\. Intenta en unos segundos\\.",
            parse_mode=ParseMode.MARKDOWN_V2
        )
        return

    if reply.startswith("ANALYZE:"):
        try:
            json_str = reply.replace("ANALYZE:", "").strip()
            data = json.loads(json_str)
            tickers = data.get("tickers", [])

            if not tickers:
                await update.message.reply_text(
                    "No identifiqué los tickers\\. ¿Los confirmas?",
                    parse_mode=ParseMode.MARKDOWN_V2
                )
                return

            context.user_data["analyzing"] = True
            history.append({"role": "model", "parts": [reply]})
            context.user_data["history"] = history

            tickers_fmt = " · ".join(tickers)
            await update.message.reply_text(
                f"⚙️ Analizando: *{escape_md(tickers_fmt)}*\n\n"
                "Simulando 10,000 escenarios por activo\\. "
                "30–90 segundos por ticker\\.\\.\\.",
                parse_mode=ParseMode.MARKDOWN_V2
            )

            results = []
            chat_id = update.message.from_user.id

            for ticker in tickers:
                await update.message.reply_text(
                    f"🔄 Procesando `{ticker}`\\.\\.\\.",
                    parse_mode=ParseMode.MARKDOWN_V2
                )
                try:
                    async with httpx.AsyncClient(timeout=120.0) as client:
                        res = await client.post(
                            ORCHESTRATOR_URL,
                            json={"ticker": ticker}
                        )
                        if res.status_code == 200:
                            d = res.json()
                            result = {
                                "ticker": ticker,
                                "cvar": d.get("cvar_95", 0),
                                "jump_prob": d.get("projected_jump_prob", 0),
                                "verdict": d.get("executive_verdict", ""),
                            }
                            results.append(result)
                            await save_analysis_to_supabase(chat_id, ticker, result)
                        else:
                            detail = ""
                            try:
                                detail = res.json().get("detail", "")
                            except Exception:
                                pass
                            log.warning(f"Orchestrator {res.status_code} for {ticker}: {detail}")
                            results.append({"ticker": ticker, "error": f"HTTP {res.status_code}"})
                except httpx.TimeoutException:
                    log.warning(f"Timeout: {ticker}")
                    results.append({"ticker": ticker, "error": "timeout — reintenta más tarde"})
                except Exception as e:
                    log.error(f"Error {ticker}: {e}")
                    results.append({"ticker": ticker, "error": str(e)[:80]})

                # Pausa entre tickers para no saturar AlphaVantage
                if ticker != tickers[-1]:
                    await asyncio.sleep(3)

            await update.message.reply_text(
                build_report(results),
                parse_mode=ParseMode.MARKDOWN_V2
            )

            # Síntesis Gemini
            successful = [r for r in results if "error" not in r]
            if successful:
                summary_prompt = (
                    f"Resultados del análisis ESG: {json.dumps(successful, ensure_ascii=False)}. "
                    f"Da tu veredicto final en 3-4 líneas. Directo, cálido, sin markdown."
                )
                try:
                    summary_chat = model.start_chat(history=[])
                    sr = await asyncio.to_thread(summary_chat.send_message, summary_prompt)
                    await update.message.reply_text(
                        f"🧠 *Veredicto del asesor:*\n\n{escape_md(sr.text.strip())}",
                        parse_mode=ParseMode.MARKDOWN_V2
                    )
                except Exception as e:
                    log.warning(f"Summary failed: {e}")

            context.user_data["analyzing"] = False
            context.user_data["history"] = []
            await update.message.reply_text(
                "¿Quieres analizar otro portafolio\\? Escribe /start\\.",
                parse_mode=ParseMode.MARKDOWN_V2
            )
            return

        except json.JSONDecodeError:
            log.error(f"JSON parse error: {reply}")

    history.append({"role": "model", "parts": [reply]})
    context.user_data["history"] = history
    await update.message.reply_text(reply)

# ─── MAIN ──────────────────────────────────────────────────────────────────────

async def post_init(application: Application) -> None:
    await application.bot.delete_webhook(drop_pending_updates=True)
    log.info("Webhook eliminado. Esperando 2s...")
    await asyncio.sleep(2)
    log.info("Iniciando polling...")


def main():
    if not TOKEN:
        raise ValueError("TELEGRAM_BOT_TOKEN no configurado")

    app = Application.builder().token(TOKEN).post_init(post_init).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("link", link_command))
    app.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message)
    )

    log.info("StochastoGreen bot iniciado")
    max_retries = 5
    for attempt in range(max_retries):
        try:
            app.run_polling(drop_pending_updates=True, allowed_updates=Update.ALL_TYPES)
            break
        except Conflict:
            if attempt < max_retries - 1:
                log.warning(f"Conflicto 409. Reintento {attempt + 2}/{max_retries} en 5s...")
                import time
                time.sleep(5)
            else:
                log.error("Máximo reintentos. Abortando.")
                raise


if __name__ == "__main__":
    main()
