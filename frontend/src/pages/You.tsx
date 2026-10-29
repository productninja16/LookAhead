import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import { useApp } from '../AppContext'
import { resetChat } from '../chatLog'
import { money, shortDate } from '../format'
import type { AvatarKey } from '../types'
import { Btn, Card, ErrorNote, Eyebrow } from '../ui'

const AVATARS: { key: AvatarKey; label: string; identity: string }[] = [
  { key: 'strategist', label: 'The Strategist', identity: 'Money is a tool. I want to use it precisely.' },
  { key: 'adventurer', label: 'The Adventurer', identity: 'Life comes first. I’ll figure the money part out.' },
  { key: 'builder', label: 'The Builder', identity: 'I’m working toward something. I want to see my progress.' },
]

const FREQ = { weekly: 'weekly', biweekly: 'every 2 weeks', semimonthly: 'twice a month', monthly: 'monthly' }

export default function You() {
  const { state, setState } = useApp()
  const nav = useNavigate()
  const [error, setError] = useState<string | null>(null)
  if (!state) return null
  const { profile, snapshot: snap, memory } = state

  async function switchAvatar(a: AvatarKey) {
    try {
      setState(await api.setAvatar(a))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not change avatar.')
    }
  }

  async function forget(i: number) {
    try {
      setState(await api.forget(i))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not remove that.')
    }
  }

  async function startOver() {
    await api.reset().catch(() => undefined)
    setState(null)
    resetChat()
    nav('/')
  }

  return (
    <div className="space-y-5 rise">
      <div>
        <Eyebrow>Your profile</Eyebrow>
        <h1 className="mt-1 font-display text-3xl font-bold text-forest">{profile.name}</h1>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}

      <Card>
        <h2 className="font-semibold">How you relate to money</h2>
        <p className="text-sm text-muted">Changes which part of each verdict leads, and how urgently cautions are framed.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Avatar">
          {AVATARS.map((a) => (
            <button
              key={a.key}
              role="radio"
              aria-checked={profile.avatar === a.key}
              onClick={() => void switchAvatar(a.key)}
              className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                profile.avatar === a.key ? 'border-teal bg-mint' : 'border-line hover:border-teal/50'
              }`}
            >
              <p className="font-semibold">{a.label}</p>
              <p className="mt-1 text-muted">“{a.identity}”</p>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Money snapshot</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {[
              ['Take-home pay', `${money(profile.net_pay)} ${FREQ[profile.pay_frequency]}`],
              ['Next payday', shortDate(profile.next_payday)],
              ['Checking', money(profile.checking_balance)],
              ['Savings', money(profile.savings_balance)],
              ['Monthly income', money(snap.monthly_income)],
              ['Essential bills / month', money(snap.monthly_essentials)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
            ))}
          </dl>
        </Card>

        <Card>
          <h2 className="font-semibold">Goals</h2>
          {snap.goals.length === 0 && <p className="mt-2 text-sm text-muted">No goals set.</p>}
          <ul className="mt-3 space-y-4">
            {snap.goals.map((g) => (
              <li key={g.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{g.name}</span>
                  <span className="text-muted">{money(g.saved)} / {money(g.target)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-teal" style={{ width: `${Math.min(100, (g.saved / g.target) * 100)}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted">
                  {g.status === 'Reached'
                    ? 'Reached 🎉'
                    : g.months_to_go
                      ? `${g.status} · about ${Math.ceil(g.months_to_go)} months at ${money(g.monthly_contribution)}/mo`
                      : g.status}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold">What I’ve learned about you</h2>
        <p className="text-sm text-muted">Tell me a habit in chat (“I tend to impulse-buy after stressful weeks”) and I’ll use it. Entries older than 90 days stop being used until you refresh them.</p>
        {memory.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {memory.map((m) => (
              <li key={m.index} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <p className={m.stale ? 'text-muted line-through' : ''}>{m.text}</p>
                  <p className="text-xs text-muted">{m.section} · {m.created}{m.stale ? ' · stale, not used' : ''}</p>
                </div>
                <Btn variant="ghost" className="min-h-9 px-3 text-xs" onClick={() => void forget(m.index)}>Forget</Btn>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex justify-end">
        <Btn variant="danger" onClick={() => void startOver()}>Delete my data & start over</Btn>
      </div>
    </div>
  )
}
