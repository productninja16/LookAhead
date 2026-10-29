import { money } from '../format'
import type { VerdictMessage } from '../types'

/** The "show your work" panel: exposes the 5 context layers, the engine numbers, and the grounding check. */
export default function ComputationPanel({ msg }: { msg: VerdictMessage }) {
  const f = msg.facts
  const g = msg.grounding
  const rows: [string, string][] = [
    ['Safe-to-spend', money(f.safe_to_spend)],
    ['Purchase', money(f.amount)],
    ['Left after', money(f.safe_after)],
    ['Daily budget', money(f.daily_budget)],
    ['Share of safe-to-spend', f.pct_of_safe === null ? 'n/a' : `${f.pct_of_safe}%`],
    ['Days to payday', String(f.days_to_payday)],
  ]

  return (
    <div className="space-y-4 border-t border-line bg-mint/40 px-4 py-4 text-sm" data-testid="computation-panel">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-teal">Engine numbers (computed in code)</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2 sm:block">
              <dt className="text-muted">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted">
          Verdict label “{f.verdict}” is set by rules: not-now if the price exceeds safe-to-spend; caution if it is
          over 40% of it, leaves less than an upcoming irregular bill, or your buffer is thin.
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-teal">Context the explanation saw</p>
        <ol className="mt-2 space-y-1.5">
          {msg.context_layers.map((l) => (
            <li key={l.layer} className="rounded-lg bg-white px-3 py-2">
              <span className="font-semibold">L{l.layer} · {l.name}: </span>
              <span className="whitespace-pre-line text-muted">{l.content}</span>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-teal">Grounding check</p>
        {g.cited.length === 0 ? (
          <p className="mt-1 text-muted">No dollar figures cited in the explanation.</p>
        ) : g.ungrounded.length === 0 ? (
          <p className="mt-1 text-yes">
            ✓ All {g.cited.length} dollar figures cited ({g.cited.map(money).join(', ')}) trace back to your profile or the engine.
          </p>
        ) : (
          <p className="mt-1 text-stop">Untraceable figures: {g.ungrounded.map(money).join(', ')}.</p>
        )}
        {msg.llm_rejected && (
          <p className="mt-1 text-caution">
            The AI’s draft cited a figure we couldn’t verify, so it was discarded and the deterministic explanation was
            used instead.
          </p>
        )}
      </div>
    </div>
  )
}
