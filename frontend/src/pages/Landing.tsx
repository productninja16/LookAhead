import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import { useApp } from '../AppContext'
import { resetChat } from '../chatLog'
import type { Demo } from '../types'
import { Btn, Card, ErrorNote, Eyebrow, LogoMark } from '../ui'

const AVATAR_LABEL = { strategist: 'Strategist', adventurer: 'Adventurer', builder: 'Builder' }

export default function Landing() {
  const nav = useNavigate()
  const { state, setState } = useApp()
  const [demos, setDemos] = useState<Demo[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.demos().then(setDemos).catch((e: ApiError) => setError(e.message))
  }, [])

  async function startDemo(key: string) {
    setBusy(key)
    setError(null)
    try {
      setState(await api.loadDemo(key))
      resetChat()
      nav('/home')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-2 font-display text-xl font-bold text-forest">
          <LogoMark /> LookAhead
        </div>
        {state && (
          <Btn variant="ghost" onClick={() => nav('/home')}>
            Continue as {state.profile.name}
          </Btn>
        )}
      </header>

      <section className="grid items-center gap-10 py-10 md:grid-cols-[1.2fr_1fr] md:py-16">
        <div>
          <Eyebrow>The decision companion for your money</Eyebrow>
          <h1 className="mt-3 font-display text-4xl font-bold leading-[1.1] text-forest sm:text-5xl">
            “Can I afford this?” deserves a real answer.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Your bank app shows a balance. LookAhead shows what a purchase actually costs: in days of budget,
            in delayed goals, and against the bill that’s about to hit.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Btn onClick={() => nav('/onboarding')} className="px-6">
              Set up my own numbers
            </Btn>
            <a href="#demos" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-forest underline-offset-4 hover:underline">
              Or try a demo persona ↓
            </a>
          </div>
        </div>

        <Card className="bg-forest text-white">
          <p className="text-xs uppercase tracking-widest text-mint-deep">Example verdict · Maya’s demo numbers</p>
          <p className="mt-3 font-display text-2xl leading-snug">
            “You can technically afford the $549 headphones. But it’s 4.5 days of your $123/day budget, and
            your $168 renters insurance renewal is about two months out.”
          </p>
          <ul className="mt-5 space-y-2 text-sm text-white/80">
            <li>• Numbers come from deterministic code, never the model</li>
            <li>• Every dollar figure is checked before you see it</li>
            <li>• Works offline when the AI is off</li>
          </ul>
        </Card>
      </section>

      <section id="demos" className="scroll-mt-6">
        <h2 className="font-display text-2xl font-bold text-forest">Try it in one click</h2>
        <p className="mt-1 text-muted">Pick a persona with a pre-filled paycheck, bills and goals. No sign-up.</p>
        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {demos.map((d) => (
            <Card key={d.key} className="flex flex-col">
              <p className="text-xs font-semibold uppercase tracking-wider text-teal">{AVATAR_LABEL[d.avatar]}</p>
              <h3 className="mt-1 text-lg font-semibold">{d.title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted">{d.blurb}</p>
              <Btn className="mt-4" disabled={busy !== null} onClick={() => startDemo(d.key)}>
                {busy === d.key ? 'Loading…' : `Explore as ${d.title.split(',')[0]}`}
              </Btn>
            </Card>
          ))}
        </div>
      </section>

      <p className="mt-12 text-center text-xs text-muted">
        A portfolio project for the US market. Decision support only, not financial advice.
      </p>
    </div>
  )
}
