import { money } from '../format'
import type { ToolMessage } from '../types'
import { Btn } from '../ui'

interface Props {
  msg: ToolMessage
  resolved?: 'confirmed' | 'declined'
  busy: boolean
  onConfirm: () => void
  onDecline: () => void
}

export default function ToolConfirmationCard({ msg, resolved, busy, onConfirm, onDecline }: Props) {
  const { impact: i } = msg
  const delta = i.safe_to_spend_after - i.safe_to_spend_before
  return (
    <article className="rise rounded-2xl border border-line bg-white p-4" aria-label="Confirm change">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal">Confirm profile change</p>
      <p className="mt-1 text-base font-medium">{msg.proposal.summary}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-mint/50 p-3 text-sm">
        <div>
          <p className="text-muted">Safe-to-spend</p>
          <p className="font-semibold">
            {money(i.safe_to_spend_before)} → {money(i.safe_to_spend_after)}
          </p>
        </div>
        <div>
          <p className="text-muted">Daily budget</p>
          <p className="font-semibold">
            {money(i.daily_budget_before)} → {money(i.daily_budget_after)}
          </p>
        </div>
      </div>
      {delta !== 0 && !resolved && (
        <p className="mt-2 text-xs text-muted">
          That’s {delta > 0 ? '+' : '−'}
          {money(Math.abs(delta))} to what you can spend before payday.
        </p>
      )}
      {resolved ? (
        <p className={`mt-3 text-sm font-semibold ${resolved === 'confirmed' ? 'text-yes' : 'text-muted'}`}>
          {resolved === 'confirmed' ? '✓ Updated. Your dashboard is recalculated.' : 'Declined. Nothing was changed.'}
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
          <Btn onClick={onConfirm} disabled={busy}>Confirm</Btn>
          <Btn variant="ghost" onClick={onDecline} disabled={busy}>Not now</Btn>
        </div>
      )}
    </article>
  )
}
