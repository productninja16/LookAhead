import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import { useApp } from '../AppContext'
import { resetChat } from '../chatLog'
import { addDaysISO, money } from '../format'
import type { AvatarKey, BillFrequency, OnboardingBill, OnboardingGoal, PayFrequency } from '../types'
import { Btn, Card, ErrorNote, Eyebrow, LogoMark } from '../ui'

const AVATARS: { key: AvatarKey; label: string; identity: string; sounds: string }[] = [
  { key: 'strategist', label: 'The Strategist', identity: 'Money is a tool. I want to use it precisely.', sounds: '“The numbers suggest…”' },
  { key: 'adventurer', label: 'The Adventurer', identity: 'Life comes first. I’ll figure the money part out.', sounds: '“Main thing to watch out for…”' },
  { key: 'builder', label: 'The Builder', identity: 'I’m working toward something. I want to see my progress.', sounds: '“This moves you closer to…”' },
]

const BILL_PRESETS: { label: string; bill: Omit<OnboardingBill, 'next_due'>; dueIn: number }[] = [
  { label: 'Rent', bill: { name: 'Rent', amount: 1500, frequency: 'monthly', essential: true, category: 'rent' }, dueIn: 5 },
  { label: 'Car payment', bill: { name: 'Car payment', amount: 400, frequency: 'monthly', essential: true, category: 'debt' }, dueIn: 12 },
  { label: 'Student loan', bill: { name: 'Student loan', amount: 300, frequency: 'monthly', essential: true, category: 'debt' }, dueIn: 15 },
  { label: 'Phone', bill: { name: 'Phone plan', amount: 60, frequency: 'monthly', essential: true, category: 'utilities' }, dueIn: 9 },
  { label: 'Car insurance', bill: { name: 'Car insurance', amount: 1100, frequency: 'semiannual', essential: true, category: 'insurance' }, dueIn: 45 },
  { label: 'Streaming', bill: { name: 'Streaming', amount: 25, frequency: 'monthly', essential: false, category: 'subscription' }, dueIn: 7 },
  { label: 'Credit card min', bill: { name: 'Credit card minimum', amount: 100, frequency: 'monthly', essential: true, category: 'debt' }, dueIn: 10 },
  { label: 'Affirm / Klarna', bill: { name: 'Buy-now-pay-later plan', amount: 120, frequency: 'monthly', essential: false, category: 'bnpl' }, dueIn: 14 },
]

const GOAL_PRESETS: OnboardingGoal[] = [
  { name: 'Emergency fund', target: 10000, saved: 0, monthly_contribution: 400 },
  { name: 'Down payment', target: 40000, saved: 0, monthly_contribution: 800 },
  { name: 'Trip', target: 3000, saved: 0, monthly_contribution: 150 },
]

const STEPS = ['You', 'Income', 'Balances', 'Bills', 'Goals']

const field = 'min-h-11 w-full rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-teal'

function Num({ label, value, onChange, prefix = '$', id }: { label: string; value: number; onChange: (n: number) => void; prefix?: string; id: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          value={Number.isFinite(value) && value !== 0 ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className={`${field} ${prefix ? 'pl-7' : ''}`}
        />
      </div>
    </div>
  )
}

export default function Onboarding() {
  const nav = useNavigate()
  const { setState } = useApp()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState<AvatarKey>('strategist')
  const [freq, setFreq] = useState<PayFrequency>('biweekly')
  const [pay, setPay] = useState(0)
  const [payday, setPayday] = useState(addDaysISO(7))
  const [checking, setChecking] = useState(0)
  const [savings, setSavings] = useState(0)
  const [bills, setBills] = useState<OnboardingBill[]>([])
  const [goals, setGoals] = useState<OnboardingGoal[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = [
    name.trim().length > 0,
    pay > 0 && payday.length === 10,
    true,
    bills.every((b) => b.amount > 0 && b.name.trim() && b.next_due),
    goals.every((g) => g.target > 0 && g.name.trim()),
  ][step]

  function addBill(p: (typeof BILL_PRESETS)[number]) {
    setBills([...bills, { ...p.bill, next_due: addDaysISO(p.dueIn) }])
  }
  const patchBill = (i: number, patch: Partial<OnboardingBill>) => setBills(bills.map((b, j) => (j === i ? { ...b, ...patch } : b)))
  const patchGoal = (i: number, patch: Partial<OnboardingGoal>) => setGoals(goals.map((g, j) => (j === i ? { ...g, ...patch } : g)))

  async function finish() {
    setBusy(true)
    setError(null)
    try {
      const s = await api.onboard({
        name: name.trim(),
        avatar,
        pay_frequency: freq,
        net_pay: pay,
        next_payday: payday,
        checking_balance: checking,
        savings_balance: savings,
        obligations: bills,
        goals,
      })
      setState(s)
      resetChat()
      nav('/home')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center gap-2 font-display text-lg font-bold text-forest">
        <LogoMark size={26} /> LookAhead
      </div>

      <ol className="mt-6 flex gap-1.5" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1" aria-current={i === step ? 'step' : undefined}>
            <div className={`h-1.5 rounded-full ${i <= step ? 'bg-teal' : 'bg-line'}`} />
            <p className={`mt-1 text-[11px] ${i === step ? 'font-semibold text-forest' : 'text-muted'}`}>{s}</p>
          </li>
        ))}
      </ol>

      <div className="mt-6 rise" key={step}>
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <Eyebrow>Step 1 of 5</Eyebrow>
              <h1 className="mt-1 font-display text-3xl font-bold text-forest">How do you relate to your money?</h1>
              <p className="mt-1 text-muted">No quiz on financial knowledge. Pick the one that sounds like you.</p>
            </div>
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium">What should I call you?</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={field} autoComplete="given-name" />
            </div>
            <div className="space-y-3" role="radiogroup" aria-label="Avatar">
              {AVATARS.map((a) => (
                <button
                  key={a.key}
                  role="radio"
                  aria-checked={avatar === a.key}
                  onClick={() => setAvatar(a.key)}
                  className={`w-full rounded-2xl border p-4 text-left transition-colors ${avatar === a.key ? 'border-teal bg-mint' : 'border-line bg-white hover:border-teal/50'}`}
                >
                  <p className="font-semibold">{a.label}</p>
                  <p className="mt-0.5">“{a.identity}”</p>
                  <p className="mt-1 text-sm text-muted">Sounds like: {a.sounds}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <Eyebrow>Step 2 of 5</Eyebrow>
              <h1 className="mt-1 font-display text-3xl font-bold text-forest">Your paycheck</h1>
              <p className="mt-1 text-muted">Use take-home pay (after taxes and deductions), the amount that lands in your account.</p>
            </div>
            <div>
              <label htmlFor="freq" className="mb-1 block text-sm font-medium">How often are you paid?</label>
              <select id="freq" value={freq} onChange={(e) => setFreq(e.target.value as PayFrequency)} className={field}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every two weeks</option>
                <option value="semimonthly">Twice a month (1st & 15th)</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <Num id="pay" label="Take-home per paycheck" value={pay} onChange={setPay} />
            <div>
              <label htmlFor="payday" className="mb-1 block text-sm font-medium">Next payday</label>
              <input id="payday" type="date" value={payday} min={addDaysISO(0)} onChange={(e) => setPayday(e.target.value)} className={field} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <Eyebrow>Step 3 of 5</Eyebrow>
              <h1 className="mt-1 font-display text-3xl font-bold text-forest">What you have today</h1>
              <p className="mt-1 text-muted">Rough numbers are fine. You can update them in chat anytime.</p>
            </div>
            <Num id="checking" label="Checking balance" value={checking} onChange={setChecking} />
            <Num id="savings" label="Savings (emergency fund, HYSA)" value={savings} onChange={setSavings} />
            <Card className="bg-mint/50">
              <p className="text-sm text-muted">You’ll start with</p>
              <p className="font-display text-3xl font-bold text-forest">{money(checking + savings)}</p>
              <p className="text-xs text-muted">across checking and savings</p>
            </Card>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <Eyebrow>Step 4 of 5</Eyebrow>
              <h1 className="mt-1 font-display text-3xl font-bold text-forest">Your recurring bills</h1>
              <p className="mt-1 text-muted">Tap to add, then adjust the amount and due date. Include annual or semiannual ones. They’re the ones people forget.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {BILL_PRESETS.map((p) => (
                <button key={p.label} onClick={() => addBill(p)} className="min-h-9 rounded-full border border-line bg-white px-3 text-xs font-medium hover:border-teal hover:text-forest">
                  + {p.label}
                </button>
              ))}
              <button
                onClick={() => setBills([...bills, { name: '', amount: 0, frequency: 'monthly', next_due: addDaysISO(10), essential: true, category: 'other' }])}
                className="min-h-9 rounded-full border border-dashed border-line px-3 text-xs text-muted hover:border-teal"
              >
                + Other
              </button>
            </div>
            {bills.length === 0 && <p className="text-sm text-muted">No bills yet. You can skip this, but verdicts are sharper with them.</p>}
            {bills.map((b, i) => (
              <Card key={i} className="space-y-3 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`bn${i}`} className="mb-1 block text-xs font-medium text-muted">Name</label>
                    <input id={`bn${i}`} value={b.name} onChange={(e) => patchBill(i, { name: e.target.value })} maxLength={60} className={field} />
                  </div>
                  <Num id={`ba${i}`} label="Amount" value={b.amount} onChange={(n) => patchBill(i, { amount: n })} />
                  <div>
                    <label htmlFor={`bf${i}`} className="mb-1 block text-xs font-medium text-muted">How often</label>
                    <select id={`bf${i}`} value={b.frequency} onChange={(e) => patchBill(i, { frequency: e.target.value as BillFrequency })} className={field}>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="semiannual">Every 6 months</option>
                      <option value="annual">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`bd${i}`} className="mb-1 block text-xs font-medium text-muted">Next due</label>
                    <input id={`bd${i}`} type="date" value={b.next_due} onChange={(e) => patchBill(i, { next_due: e.target.value })} className={field} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={b.essential} onChange={(e) => patchBill(i, { essential: e.target.checked })} className="h-4 w-4" />
                    Essential (counts toward your safety buffer)
                  </label>
                  <button onClick={() => setBills(bills.filter((_, j) => j !== i))} className="min-h-9 px-2 text-sm text-stop" aria-label={`Remove ${b.name || 'bill'}`}>Remove</button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div>
              <Eyebrow>Step 5 of 5</Eyebrow>
              <h1 className="mt-1 font-display text-3xl font-bold text-forest">What are you working toward?</h1>
              <p className="mt-1 text-muted">Goals let me tell you how a purchase delays them. Optional.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {GOAL_PRESETS.map((g) => (
                <button key={g.name} onClick={() => setGoals([...goals, { ...g }])} className="min-h-9 rounded-full border border-line bg-white px-3 text-xs font-medium hover:border-teal hover:text-forest">
                  + {g.name}
                </button>
              ))}
            </div>
            {goals.map((g, i) => (
              <Card key={i} className="space-y-3 p-4">
                <div>
                  <label htmlFor={`gn${i}`} className="mb-1 block text-xs font-medium text-muted">Goal</label>
                  <input id={`gn${i}`} value={g.name} onChange={(e) => patchGoal(i, { name: e.target.value })} maxLength={60} className={field} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Num id={`gt${i}`} label="Target" value={g.target} onChange={(n) => patchGoal(i, { target: n })} />
                  <Num id={`gs${i}`} label="Saved so far" value={g.saved} onChange={(n) => patchGoal(i, { saved: n })} />
                  <Num id={`gm${i}`} label="Per month" value={g.monthly_contribution} onChange={(n) => patchGoal(i, { monthly_contribution: n })} />
                </div>
                <button onClick={() => setGoals(goals.filter((_, j) => j !== i))} className="min-h-9 text-sm text-stop" aria-label={`Remove ${g.name || 'goal'}`}>Remove</button>
              </Card>
            ))}
          </div>
        )}
      </div>

      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}

      <div className="mt-8 flex justify-between gap-3">
        <Btn variant="ghost" onClick={() => (step === 0 ? nav('/') : setStep(step - 1))}>Back</Btn>
        {step < STEPS.length - 1 ? (
          <Btn disabled={!valid} onClick={() => setStep(step + 1)} className="px-6">Continue</Btn>
        ) : (
          <Btn disabled={!valid || busy} onClick={() => void finish()} className="px-6">
            {busy ? 'Setting up…' : 'Show me where I stand'}
          </Btn>
        )}
      </div>
    </div>
  )
}
