import { useState } from 'react'
import { money } from '../format'
import type { AvatarKey, VerdictMessage } from '../types'
import { Btn, VerdictPill, verdictStyle } from '../ui'
import ComputationPanel from './ComputationPanel'

type Section = 'direct' | 'tradeoffs' | 'risk' | 'next'

/** Identity-first personalisation: the avatar decides which section leads, not just the tone. */
const ORDER: Record<AvatarKey, Section[]> = {
  strategist: ['direct', 'tradeoffs', 'risk', 'next'],
  adventurer: ['direct', 'risk', 'next', 'tradeoffs'],
  builder: ['direct', 'tradeoffs', 'next', 'risk'],
}

interface Props {
  msg: VerdictMessage
  avatar: AvatarKey
  saved: boolean
  onSave: () => void
  onFollowUp: (q: string) => void
  showChips: boolean
}

export default function VerdictCard({ msg, avatar, saved, onSave, onFollowUp, showChips }: Props) {
  const [open, setOpen] = useState(false)
  const s = verdictStyle(msg.verdict)

  const blocks: Record<Section, React.ReactNode> = {
    direct: <p key="d" className="text-base leading-relaxed">{msg.directAnswer}</p>,
    tradeoffs:
      msg.tradeoffs.length > 0 ? (
        <div key="t">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Trade-offs</p>
          <ul className="mt-1 space-y-1 text-sm">
            {msg.tradeoffs.map((t) => (
              <li key={t} className="flex gap-2"><span className="text-teal">•</span>{t}</li>
            ))}
          </ul>
        </div>
      ) : null,
    risk: msg.risksOrCaution ? (
      <div key="r" className={`rounded-xl px-3 py-2 text-sm ${s.bg} ${s.fg}`}>
        <span className="font-semibold">Watch out: </span>{msg.risksOrCaution}
      </div>
    ) : null,
    next: msg.nextStep ? (
      <p key="n" className="text-sm"><span className="font-semibold">Next step: </span>{msg.nextStep}</p>
    ) : null,
  }

  return (
    <article className="rise rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(15,42,43,0.04)]" aria-label="Verdict">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h3 className="font-display text-xl font-bold text-forest">{msg.headline}</h3>
          <p className="text-xs text-muted">
            {msg.facts.item} · {money(msg.facts.amount)}
            {msg.facts.days_of_budget ? ` · ${msg.facts.days_of_budget} days of budget` : ''}
          </p>
        </div>
        <VerdictPill verdict={msg.verdict} />
      </div>

      <div className="space-y-3 px-4 py-4">{ORDER[avatar].map((k) => blocks[k])}</div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
        <Btn variant="subtle" onClick={onSave} disabled={saved} className="min-h-10 text-xs">
          {saved ? 'Saved to Decisions ✓' : 'Save this decision'}
        </Btn>
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="min-h-10 rounded-lg px-2 text-xs font-semibold text-teal hover:underline"
        >
          {open ? 'Hide' : 'How this was computed'}
        </button>
        <span className="ml-auto text-[11px] text-muted">
          {msg.source === 'llm' ? 'Explained by AI · numbers by code' : 'Deterministic engine'}
        </span>
      </div>

      {open && <ComputationPanel msg={msg} />}

      {showChips && msg.followUps.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
          {msg.followUps.map((f) => (
            <button
              key={f}
              onClick={() => onFollowUp(f)}
              className="min-h-9 rounded-full border border-line px-3 text-xs text-muted hover:border-teal hover:text-forest"
            >
              {f}
            </button>
          ))}
        </div>
      )}
    </article>
  )
}
