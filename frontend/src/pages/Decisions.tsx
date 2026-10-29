import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../api'
import { money } from '../format'
import type { Decision } from '../types'
import { Btn, Card, ErrorNote, Eyebrow, Spinner, VerdictPill } from '../ui'

export default function Decisions() {
  const [items, setItems] = useState<Decision[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () =>
    api
      .decisions()
      .then(setItems)
      .catch((e: ApiError) => setError(e.message))

  useEffect(() => {
    void load()
  }, [])

  async function set(d: Decision, status: Decision['status'], regret: Decision['regret'] = null) {
    try {
      await api.updateDecision(d.id, status, regret)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update that decision.')
    }
  }

  if (!items && !error) return <Spinner />
  const due = (items ?? []).filter((d) => d.followup_due)

  return (
    <div className="space-y-5 rise">
      <div>
        <Eyebrow>Decision log</Eyebrow>
        <h1 className="mt-1 font-display text-3xl font-bold text-forest">Decisions you’re weighing</h1>
        <p className="mt-1 text-sm text-muted">
          Save a verdict from chat. After a week I’ll ask how it turned out. That’s how you see whether waiting paid off.
        </p>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}

      {due.map((d) => (
        <Card key={d.id} className="border-teal/40 bg-mint/50">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal">Follow-up · {d.age_days} days later</p>
          <p className="mt-1 text-lg font-semibold">You were weighing {d.item} ({money(d.amount)}). Still holding?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn onClick={() => void set(d, 'skipped')}>Skipped it</Btn>
            <Btn variant="ghost" onClick={() => void set(d, 'bought')}>Bought it</Btn>
            <Btn variant="ghost" onClick={() => void set(d, 'waiting')}>Still thinking</Btn>
          </div>
        </Card>
      ))}

      {items && items.length === 0 && (
        <Card>
          <p className="text-sm text-muted">
            Nothing saved yet. Ask about a purchase in <Link to="/ask" className="font-semibold text-teal">Ask</Link> and tap “Save this decision”.
          </p>
        </Card>
      )}

      <ul className="space-y-3">
        {(items ?? []).map((d) => (
          <li key={d.id}>
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{d.item} <span className="font-normal text-muted">· {money(d.amount)}</span></p>
                <p className="text-xs text-muted">
                  {d.age_days === 0 ? 'Today' : `${d.age_days} days ago`} ·{' '}
                  {d.status === 'waiting' ? 'Still deciding' : d.status === 'bought' ? 'Bought it' : 'Skipped it'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <VerdictPill verdict={d.verdict} />
                {d.status !== 'waiting' && !d.regret && (
                  <>
                    <Btn variant="subtle" className="min-h-9 px-3 text-xs" onClick={() => void set(d, d.status, 'good_call')}>Good call</Btn>
                    <Btn variant="ghost" className="min-h-9 px-3 text-xs" onClick={() => void set(d, d.status, 'regret')}>Regret</Btn>
                  </>
                )}
                {d.regret && <span className="text-xs font-medium text-muted">{d.regret === 'good_call' ? 'Good call ✓' : 'Regret'}</span>}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
