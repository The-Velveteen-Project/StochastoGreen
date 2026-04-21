'use client'

import React from 'react'

export function EmptyState({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="border border-obsidian-outline-var bg-obsidian-low p-10 text-center">
      {eyebrow ? (
        <div className="font-mono text-[0.58rem] tracking-[0.18em] text-obsidian-outline uppercase mb-3">
          {eyebrow}
        </div>
      ) : null}
      <div className="font-display text-[0.95rem] font-bold text-obsidian-on">{title}</div>
      {description ? <div className="mt-2 text-obsidian-on-var text-[0.85rem]">{description}</div> : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  )
}

