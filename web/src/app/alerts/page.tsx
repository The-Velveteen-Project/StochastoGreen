'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient, type VerdictAction } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TerminalShell } from '@/components/layout/TerminalShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n/LanguageContext'

type AlertRow = {
  id:             string
  ticker:         string
  cvar_95:        number | null
  verdict_action: VerdictAction | null
  climate_beta:   number | null
  created_at:     string
  severity:       'CRÍTICA' | 'MEDIA' | 'BAJA'
}

function severity(cvar: number | null, action: VerdictAction | null): AlertRow['severity'] {
  if ((cvar != null && cvar > 20) || action === 'VENDER') return 'CRÍTICA'
  if ((cvar != null && cvar > 10) || action === 'MANTENER') return 'MEDIA'
  return 'BAJA'
}

const SEVERITY_PANEL: Record<AlertRow['severity'], string> = {
  'CRÍTICA': 'border-danger/30 bg-danger/5',
  'MEDIA': 'border-primary/30 bg-primary/5',
  'BAJA': 'border-success/20 bg-success/5',
}

const SEVERITY_PILL: Record<AlertRow['severity'], string> = {
  'CRÍTICA': 'bg-danger/10 text-danger border-danger/40',
  'MEDIA': 'bg-primary/10 text-primary border-primary/40',
  'BAJA': 'bg-success/10 text-success border-success/30',
}

const VERDICT_BADGES: Record<VerdictAction, string> = {
  COMPRAR: 'bg-success/10 text-success border-success/30',
  MANTENER: 'bg-primary/10 text-primary border-primary/30',
  VENDER: 'bg-danger/10 text-danger border-danger/30',
}

export default function AlertsPage() {
  const supabase = createClient()
  const router   = useRouter()
  const { dictionary, locale } = useLanguage()
  const { alerts: alertText, common } = dictionary
  const [telegramLinked, setTelegramLinked] = useState<boolean | null>(null)
  const [linkCode,       setLinkCode]       = useState<string | null>(null)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [userId,         setUserId]         = useState<string | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [alerts,         setAlerts]         = useState<AlertRow[]>([])
  const [copied,         setCopied]         = useState(false)

  const checkTelegramStatus = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const [{ data: profile }, { data: analyses }] = await Promise.all([
      supabase.from('profiles')
        .select('telegram_chat_id, telegram_linked_at')
        .eq('id', user.id)
        .single(),
      supabase.from('risk_analyses')
        .select('id, ticker, cvar_95, verdict_action, climate_beta, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    setTelegramLinked(!!profile?.telegram_chat_id)

    const rows: AlertRow[] = (analyses ?? [])
      .map(r => ({
        ...r,
        verdict_action: r.verdict_action as VerdictAction | null,
        severity: severity(r.cvar_95, r.verdict_action as VerdictAction | null),
      }))
      .filter(r => r.severity !== 'BAJA')
      .sort((a, b) => ({ 'CRÍTICA': 0, 'MEDIA': 1, 'BAJA': 2 }[a.severity] - { 'CRÍTICA': 0, 'MEDIA': 1, 'BAJA': 2 }[b.severity]))

    setAlerts(rows)
    setLoading(false)
  }, [router, supabase])

  useEffect(() => {
    const frame = setTimeout(() => {
      void checkTelegramStatus()
    }, 0)

    return () => clearTimeout(frame)
  }, [checkTelegramStatus])

  async function generateLinkCode() {
    if (!userId) return
    setGeneratingCode(true)

    // Código criptográficamente seguro — 6 chars alfanuméricos sin ambigüedad
    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const bytes = crypto.getRandomValues(new Uint8Array(6))
    const code  = Array.from(bytes).map(b => CHARS[b % CHARS.length]).join('')

    const { error } = await supabase.from('telegram_link_codes').insert({ code, user_id: userId })

    if (!error) {
      setLinkCode(code)
    }
    setGeneratingCode(false)
  }

  if (loading) {
    return (
      <TerminalShell>
        <div className="font-mono text-[0.75rem] text-obsidian-on-var">{alertText.loading}</div>
      </TerminalShell>
    )
  }

  return (
    <TerminalShell>
      <div className="mb-8">
        <div className="font-mono text-[0.58rem] tracking-[0.18em] text-primary uppercase mb-2">{alertText.eyebrow}</div>
        <h1 className="font-display text-xl font-bold text-obsidian-on">{alertText.title}</h1>
      </div>

      <div
        className={cn(
          'panel p-6 mb-6',
          telegramLinked ? 'border-success/25 bg-success/5' : 'border-primary/30 bg-primary/5'
        )}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className={cn(
              'w-2.5 h-2.5 rounded-full',
              telegramLinked ? 'bg-success animate-pulse' : 'bg-primary'
            )}
          />
          <div className="min-w-0">
            <div className="font-display text-[0.95rem] font-bold text-obsidian-on">{alertText.telegram.title}</div>
            <div className={cn('font-mono text-[0.58rem] tracking-[0.18em] uppercase', telegramLinked ? 'text-success' : 'text-primary')}>
              {telegramLinked ? alertText.telegram.linked : alertText.telegram.unlinked}
            </div>
          </div>
        </div>

        {telegramLinked ? (
          <p className="text-obsidian-on-var text-[0.85rem] leading-relaxed">
            {alertText.telegram.linkedDescription}
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-obsidian-on-var text-[0.85rem] leading-relaxed">
              {alertText.telegram.unlinkedDescription}
            </p>

            {!linkCode ? (
              <button
                type="button"
                onClick={generateLinkCode}
                disabled={generatingCode}
                className="bg-primary text-obsidian-bg font-display text-[0.72rem] font-bold tracking-[0.18em] uppercase px-5 py-3 hover:bg-primary-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {generatingCode ? alertText.telegram.generating : alertText.telegram.generate}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="font-mono text-[0.6rem] tracking-widest text-obsidian-outline uppercase">
                  {alertText.telegram.codeLabel} ({common.linkCodeValid})
                </div>

                <div className="bg-obsidian-mid border border-obsidian-outline-var px-4 py-3 inline-flex items-center gap-3">
                  <div className="font-mono text-[1.1rem] font-bold tracking-[0.35em] text-primary">{linkCode}</div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(linkCode)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 1500)
                    }}
                    className="px-2.5 py-1 border border-obsidian-outline-var text-obsidian-on-var hover:text-obsidian-on hover:bg-obsidian-high transition-colors font-mono text-[0.6rem] tracking-widest uppercase"
                  >
                    {copied ? common.copied : common.copy}
                  </button>
                </div>

                <div className="text-obsidian-on-var text-[0.85rem]">
                  {alertText.telegram.openBotLead}:{' '}
                  <a
                    href="https://t.me/velveteen_stochasto_green_bot"
                    target="_blank"
                    rel="noreferrer"
                    className="text-secondary hover:text-obsidian-on transition-colors font-mono"
                  >
                    @velveteen_stochasto_green_bot
                  </a>{' '}
                  {alertText.telegram.openBotAction}: <span className="font-mono text-primary">{`/link ${linkCode}`}</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setLinkCode(null)
                    checkTelegramStatus()
                  }}
                  className="px-4 py-2 border border-obsidian-outline-var text-obsidian-on-var hover:text-obsidian-on hover:bg-obsidian-mid transition-colors font-mono text-[0.65rem] tracking-widest uppercase"
                >
                  {common.verify}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="font-mono text-[0.58rem] tracking-[0.18em] text-primary uppercase mb-4">
        {alertText.activeRule}
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          eyebrow={alertText.empty.eyebrow}
          title={alertText.empty.title}
          description={alertText.empty.description}
          action={
            <Link
              href="/history"
              className="px-4 py-2 border border-primary/40 text-primary hover:bg-primary/10 transition-colors font-mono text-[0.65rem] tracking-widest uppercase"
            >
              {alertText.empty.action}
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => {
            const badge = a.verdict_action ? VERDICT_BADGES[a.verdict_action] : null
            const cvarClass = a.severity === 'CRÍTICA' ? 'text-danger' : a.severity === 'MEDIA' ? 'text-primary' : 'text-success'

            return (
              <div
                key={a.id}
                className={cn('panel p-4 grid grid-cols-[auto_1fr_auto_auto] items-center gap-4', SEVERITY_PANEL[a.severity])}
              >
                <div className={cn('font-mono text-[0.58rem] font-bold px-2 py-0.5 tracking-widest uppercase border whitespace-nowrap', SEVERITY_PILL[a.severity])}>
                  {a.severity === 'CRÍTICA'
                    ? common.severity.critical
                    : a.severity === 'MEDIA'
                      ? common.severity.medium
                      : common.severity.low}
                </div>

                <div className="min-w-0">
                  <div className="font-mono text-[0.75rem] font-bold tracking-widest text-secondary">{a.ticker}</div>
                  <div className="mt-1 font-mono text-[0.58rem] tracking-widest text-obsidian-outline uppercase">
                    {new Date(a.created_at).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}
                    {a.climate_beta != null ? <span className="ml-3">{`${alertText.card.beta}=${a.climate_beta.toFixed(1)}`}</span> : null}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono text-[0.58rem] tracking-widest text-obsidian-outline uppercase">{alertText.card.cvar}</div>
                  <div className={cn('font-mono text-[0.85rem] font-bold', cvarClass)}>
                    {a.cvar_95 != null ? `${a.cvar_95.toFixed(1)}%` : '—'}
                  </div>
                </div>

                <div className="justify-self-end">
                  {a.verdict_action ? (
                    <span className={cn('font-mono text-[0.58rem] font-bold px-2 py-0.5 tracking-widest border uppercase', badge!)}>
                      {common.verdicts[a.verdict_action]}
                    </span>
                  ) : (
                    <span className="font-mono text-[0.72rem] text-obsidian-outline">—</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </TerminalShell>
  )
}
