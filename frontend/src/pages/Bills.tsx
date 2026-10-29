import { useState } from 'react'
import { api, ApiError } from '../api'
import { useApp } from '../AppContext'
import { daysLabel, money, monthLabel, shortDate } from '../format'
import { Btn, Card, ErrorNote, Eyebrow } from '../ui'
import type { UpcomingBill } from '../types'

export default function Bills() {
  const { state, setState } = useApp()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!state) return null

  const { upcoming, blind_spot: spot, snapshot } = state
  const nextByObligation = new Map<string, string>()
  for (const b of upcoming) if (!nextByObligation.has(b.obligation_id)) nextByObligation.set(b.obligation_id, b.due)

  const byMonth = new Map<string, UpcomingBill[]>()
  for (const b of upcoming) {
    const key = monthLabel(b.due)
    byMonth.set(key, [...(byMonth.get(key) ?? []), b])
  }
  const maxMonth = Math.max(...[...byMonth.values()].map((l) => l.reduce((s, b) => s + b.amount, 0)), 1)

  async function pay(id: string) {
    setBusy(id)
    setError(null)
    try {
      setState(await api.markPaid(id))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not mark that as paid.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5 rise">
      <div>
        <Eyebrow>6-month projection</Eyebrow>
        <h1 className="mt-1 font-display text-3xl font-bold text-forest">What’s coming</h1>
        <p className="mt-1 text-sm text-muted">
          {money(snapshot.due_before_payday)} is due before your next payday. Mark a bill paid and your safe-to-spend recalculates.
        </p>
      </div>

      {spot && (
        <Card className="border-caution/30 bg-caution-bg">
          <p className="text-xs font-semibold uppercase tracking-wider text-caution">Biggest upcoming blind spot</p>
          <p className="mt-1 text-lg font-semibold">
            {spot.name}: {money(spot.amount)} {daysLabel(spot.days_away)} ({shortDate(spot.due)})
          </p>
          <p className="text-sm text-caution/90">
            Irregular bills are the ones that break a budget. Every purchase verdict accounts for this one.
          </p>
        </Card>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="space-y-4">
        {[...byMonth.entries()].map(([month, bills]) => {
          const total = bills.reduce((s, b) => s + b.amount, 0)
          return (
            <Card key={month}>
              <div className="flex items-baseline justify-between">
                <h2 className="font-semibold">{month}</h2>
                <span className="text-sm text-muted">{money(total)}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
                <div className="h-full rounded-full bg-teal" style={{ width: `${(total / maxMonth) * 100}%` }} />
              </div>
              <ul className="mt-2 divide-y divide-line">
                {bills.map((b) => {
                  const isNext = nextByObligation.get(b.obligation_id) === b.due
                  return (
                    <li key={`${b.obligation_id}-${b.due}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div>
                        <p className="font-medium">{b.name}</p>
                        <p className="text-xs text-muted">{shortDate(b.due)} · {daysLabel(b.days_away)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{money(b.amount)}</span>
                        {isNext && b.days_away <= 14 && (
                          <Btn variant="ghost" className="min-h-9 px-3 text-xs" disabled={busy !== null} onClick={() => void pay(b.obligation_id)}>
                            {busy === b.obligation_id ? '…' : 'Mark paid'}
                          </Btn>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
