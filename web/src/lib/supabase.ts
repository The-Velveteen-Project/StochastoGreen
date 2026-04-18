import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ─── Domain types ─────────────────────────────────────────────────────────────

export type VerdictAction = 'COMPRAR' | 'MANTENER' | 'VENDER'

export type SimulationPaths = {
  media:     number[]   // P50 — median path
  optimista: number[]   // P90 — optimistic path
  cvar_zone: number[]   // P5  — CVaR zone (worst 5%)
}

export type Profile = {
  id:                  string
  display_name:        string | null
  telegram_chat_id:    number | null
  telegram_linked_at:  string | null
  created_at:          string
}

export type Portfolio = {
  id:         string
  user_id:    string
  name:       string
  created_at: string
}

export type PortfolioAsset = {
  id:           string
  portfolio_id: string
  ticker:       string
  added_at:     string
}

/**
 * Mirrors the schema written by orchestrator.py → /analyze endpoint.
 * All verdict fields are structured (not a free-form string) and validated
 * by Pydantic's ExecutiveVerdict before being persisted.
 */
export type RiskAnalysis = {
  id:          string
  created_at:  string
  ticker:      string
  user_id:     string | null

  // ── SDE Engine output ──────────────────────────────────────────────────
  cvar_95:          number | null   // CVaR 95% — expected shortfall (positive %)
  jump_prob:        number | null   // Annualised Poisson shock probability (%)
  climate_beta:     number | null   // NGFS Phase 4 sector multiplier
  is_fallback:      boolean | null  // true if SDE engine was unavailable

  // ── Structured LLM verdict (via with_structured_output) ───────────────
  verdict_action:        VerdictAction | null  // COMPRAR | MANTENER | VENDER
  verdict_justification: string | null         // ≤150 words, quantitative rationale
  verdict_confidence:    number | null         // [0, 1] analyst confidence score

  // ── LLM narrative reports ─────────────────────────────────────────────
  fundamental_report: string | null
  technical_report:   string | null

  // ── Monte Carlo paths (50 time points, indexed to 100) ───────────────
  simulation_paths: SimulationPaths | null
}

export type TelegramLinkCode = {
  code:       string
  user_id:    string
  expires_at: string
  used:       boolean
}

export const supabase = createClient()
