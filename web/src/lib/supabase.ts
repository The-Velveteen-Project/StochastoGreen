import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Tipos de la base de datos
export type Profile = {
  id: string
  display_name: string | null
  telegram_chat_id: number | null
  telegram_linked_at: string | null
  created_at: string
}

export type Portfolio = {
  id: string
  user_id: string
  name: string
  created_at: string
}

export type PortfolioAsset = {
  id: string
  portfolio_id: string
  ticker: string
  added_at: string
}

export type RiskAnalysis = {
  id: string
  created_at: string
  ticker: string
  cvar_95: number | null
  jump_prob: number | null
  verdict: string | null
  fundamental_report: string | null
  technical_report: string | null
  user_id: string | null
}

export type TelegramLinkCode = {
  code: string
  user_id: string
  expires_at: string
  used: boolean
}
