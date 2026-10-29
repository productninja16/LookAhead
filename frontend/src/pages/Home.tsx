import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../AppContext'
import { daysLabel, money, shortDate } from '../format'
import { Card, Eyebrow } from '../ui'
import type { Snapshot } from '../types'

const BUFFER_STYLE = {
  Thin: { pill: 'bg-stop-bg text-stop', bar: 'bg-stop' },
  Building: { pill: 'bg-caution-bg text-caution', bar: 'bg-caution' },
  Healthy: { pill: 'bg-yes-bg text-yes', bar: 'bg-yes' },
} as const

function BufferCard({ snap }: { snap: Snapshot }) {
  const s = BUFFER_STYLE[snap.buffer_status]
  const pct = Math.min(100, (snap.buffer_months / 3) * 100)
  return (
    <Card>
      <div className="flex items-start justify-between">
        <Eyebrow>Safety buffer</Eyebrow>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.pill}`}>{snap.buffer_status}</span>
      </div>
      <p className="mt-3 font-display text-3xl font-bold">
        {snap.buffer_months.toFixed(1)} <span className="text-base font-medium text-muted">months</span>
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-line" role="img" aria-label={`${pct.toFixed(0)}% of the 3-month target`}>
        <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">Savings vs. essential bills. 3 months is the target.</p>
    </Card>
  )
}

export default function Home() {
  const { state } = useApp()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  if (!state) return null
  const { snapshot: snap, profile, blind_spot: spot, upcoming } = state

  const next = upcoming.filter((b) => b.days_away <= 21).slice(0, 4)
  const chips = ['Can I afford a $549 purchase?', 'What bills are coming up?', 'What if I wait until payday?']

  function ask(e: FormEvent) {
    e.preventDefault()
    if (q.trim()) nav('/ask', { state: { prompt: q.trim() } })
  }

  return (
    <div className="space-y-5 rise">
      <div>
        <Eyebrow>{state.persona.label}</Eyebrow>
        <h1 className="mt-1 font-display text-3xl font-bold text-forest">Hi {profile.name}, here’s where you stand</h1>
      </div>

      <Card className="bg-forest text-white">
        <p className="text-sm text-white/70">Safe to spend until payday ({shortDate(profile.next_payday)})</p>
        <p className="mt-1 font-display text-5xl font-bold tracking-tight sm:text-6xl">{money(snap.safe_to_spend)}</p>
        <div className="mt-5 grid grid-cols-3 gap-4 border-t border-white/15 pt-4 text-sm">
          <div>
            <p className="text-white/60">Daily budget</p>
            <p className="text-lg font-semibold">{money(snap.daily_budget)}</p>
          </div>
          <div>
            <p className="text-white/60">Days to payday</p>
            <p className="text-lg font-semibold">{snap.days_to_payday}</p>
          </div>
          <div>
            <p className="text-white/60">Bills before then</p>
            <p className="text-lg font-semibold">{money(snap.due_before_payday)}</p>
          </div>
        </div>
      </Card>

      <form onSubmit={ask} className="space-y-2">
        <label htmlFor="ask" className="sr-only">Ask about a purchase</label>
        <div className="flex gap-2">
          <input
            id="ask"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Can I afford a $549 pair of headphones?"
            maxLength={500}
            className="min-h-12 flex-1 rounded-xl border border-line bg-white px-4 text-base outline-none focus:border-teal"
          />
          <button className="min-h-12 rounded-xl bg-forest px-5 text-sm font-semibold text-white hover:bg-forest-soft">Check</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => nav('/ask', { state: { prompt: c } })}
              className="min-h-9 rounded-full border border-line bg-white px-3 text-xs text-muted hover:border-teal hover:text-forest"
            >
              {c}
            </button>
          ))}
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-3">
        <BufferCard snap={snap} />

        <Card>
          <Eyebrow>Biggest blind spot</Eyebrow>
          {spot ? (
            <>
              <p className="mt-3 font-display text-3xl font-bold">{money(spot.amount)}</p>
              <p className="mt-1 text-sm">
                {spot.name} <span className="text-muted">{daysLabel(spot.days_away)} · {shortDate(spot.due)}</span>
              </p>
              <p className="mt-2 text-xs text-muted">The irregular bill that quietly breaks a budget.</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">No large irregular bills in the next 6 months.</p>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <Eyebrow>Goals</Eyebrow>
            <Link to="/you" className="text-xs font-medium text-teal">See all</Link>
          </div>
          {snap.goals.length === 0 && <p className="mt-3 text-sm text-muted">No goals yet.</p>}
          <ul className="mt-3 space-y-3">
            {snap.goals.slice(0, 2).map((g) => (
              <li key={g.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{g.name}</span>
                  <span className="text-muted">{g.status}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-teal" style={{ width: `${Math.min(100, (g.saved / g.target) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <Eyebrow>Next up (21 days)</Eyebrow>
          <Link to="/bills" className="text-xs font-medium text-teal">All bills</Link>
        </div>
        {next.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing due in the next three weeks.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {next.map((b) => (
              <li key={`${b.obligation_id}-${b.due}`} className="flex items-center justify-between py-2.5 text-sm">
                <span>{b.name}</span>
                <span className="text-muted">
                  {shortDate(b.due)} · <span className="font-medium text-ink">{money(b.amount)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
