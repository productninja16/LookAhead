import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import { useApp } from '../AppContext'
import { getLog, newId, setLog, type LogEntry } from '../chatLog'
import ToolConfirmationCard from '../components/ToolConfirmationCard'
import VerdictCard from '../components/VerdictCard'
import type { ChatResponse } from '../types'
import { ErrorNote } from '../ui'

const REASON: Record<string, string> = {
  disabled: 'AI is switched off, so this used the deterministic engine.',
  no_api_key: 'No API key on this server, so this used the deterministic engine.',
  session_cap: 'You’ve used the demo’s AI allowance, so this used the deterministic engine.',
  daily_cap: 'The demo’s daily AI budget is used up, so this used the deterministic engine.',
}

const STARTERS = [
  'Can I afford a $549 pair of headphones?',
  'Should I buy a $1,200 laptop on Affirm or pay upfront?',
  'I got a bonus of $1,000 this month.',
  'What bills are coming up?',
]

export default function Chat() {
  const { state, setState, llmEnabled, refresh } = useApp()
  const location = useLocation()
  const nav = useNavigate()
  const [entries, setEntries] = useState<LogEntry[]>(getLog)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const sentInitial = useRef(false)

  function update(next: LogEntry[]) {
    setLog(next)
    setEntries(next)
  }

  async function send(text: string) {
    const clean = text.trim()
    if (!clean || sending) return
    setError(null)
    setSending(true)
    let next: LogEntry[] = [...getLog(), { id: newId(), role: 'user', text: clean }]
    update(next)
    try {
      const res: ChatResponse = await api.chat(clean, llmEnabled)
      const bots: LogEntry[] = res.messages.map((msg) => ({ id: newId(), role: 'bot', msg }))
      const note = llmEnabled && res.llm.reason ? REASON[res.llm.reason] : null
      next = [...next, ...bots, ...(note ? [{ id: newId(), role: 'note' as const, text: note }] : [])]
      update(next)
      void refresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
  }

  // Auto-send a prompt handed over from Home (once).
  useEffect(() => {
    const prompt = (location.state as { prompt?: string } | null)?.prompt
    if (prompt && !sentInitial.current) {
      sentInitial.current = true
      nav('.', { replace: true, state: null })
      void send(prompt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [entries.length, sending])

  async function resolveTool(entryId: number, confirm: boolean) {
    const entry = entries.find((e) => e.id === entryId)
    if (!entry || entry.role !== 'bot' || entry.msg.type !== 'tool_confirmation') return
    setSending(true)
    try {
      const s = await api.confirmTool(entry.msg.proposal, confirm)
      setState(s)
      update(getLog().map((e) => (e.id === entryId && e.role === 'bot' ? { ...e, resolved: confirm ? 'confirmed' : 'declined' } : e)))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not apply that change.')
    } finally {
      setSending(false)
    }
  }

  async function saveDecision(entryId: number) {
    const entry = entries.find((e) => e.id === entryId)
    if (!entry || entry.role !== 'bot' || entry.msg.type !== 'verdict') return
    try {
      const f = entry.msg.facts
      await api.saveDecision(f.item, f.amount, entry.msg.verdict)
      update(getLog().map((x) => (x.id === entryId && x.role === 'bot' ? { ...x, resolved: 'saved' as const } : x)))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save the decision.')
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = input
    setInput('')
    void send(t)
  }

  if (!state) return null
  const lastBotId = [...entries].reverse().find((e) => e.role === 'bot')?.id

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <h1 className="font-display text-2xl font-bold text-forest">Ask LookAhead</h1>
      <p className="text-sm text-muted">
        Include the price. I’ll check it against your paycheck, bills, and goals as {state.persona.label}.
      </p>

      <div className="mt-4 space-y-3" aria-live="polite">
        {entries.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line p-4">
            <p className="text-sm font-medium">Try one of these</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  className="min-h-9 rounded-full border border-line bg-white px-3 text-left text-xs text-muted hover:border-teal hover:text-forest"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {entries.map((e) => {
          if (e.role === 'user')
            return (
              <div key={e.id} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-forest px-4 py-2.5 text-sm text-white">{e.text}</p>
              </div>
            )
          if (e.role === 'note') return <p key={e.id} className="text-center text-xs text-muted">{e.text}</p>
          const m = e.msg
          if (m.type === 'verdict')
            return (
              <VerdictCard
                key={e.id}
                msg={m}
                avatar={state.persona.key}
                saved={e.resolved === 'saved'}
                onSave={() => void saveDecision(e.id)}
                onFollowUp={(q) => void send(q)}
                showChips={e.id === lastBotId && !sending}
              />
            )
          if (m.type === 'tool_confirmation')
            return (
              <ToolConfirmationCard
                key={e.id}
                msg={m}
                resolved={e.resolved === 'saved' ? undefined : e.resolved}
                busy={sending}
                onConfirm={() => void resolveTool(e.id, true)}
                onDecline={() => void resolveTool(e.id, false)}
              />
            )
          return (
            <div key={e.id} className="rise max-w-[90%] rounded-2xl rounded-bl-md border border-line bg-white px-4 py-3 text-sm">
              <p className="whitespace-pre-line">{m.text}</p>
              {e.id === lastBotId && m.followUps.length > 0 && !sending && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.followUps.map((f) => (
                    <button
                      key={f}
                      onClick={() => void send(f)}
                      className="min-h-9 rounded-full border border-line px-3 text-xs text-muted hover:border-teal hover:text-forest"
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {sending && (
          <p className="text-sm text-muted" role="status">
            Running your numbers…
          </p>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={submit}
        className="sticky bottom-16 mt-4 flex gap-2 bg-canvas/95 py-2 backdrop-blur md:bottom-2"
      >
        <label htmlFor="msg" className="sr-only">Message</label>
        <input
          id="msg"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Can I afford a $300 jacket?"
          maxLength={500}
          autoComplete="off"
          className="min-h-12 flex-1 rounded-xl border border-line bg-white px-4 text-base outline-none focus:border-teal"
        />
        <button
          disabled={sending || !input.trim()}
          className="min-h-12 rounded-xl bg-forest px-5 text-sm font-semibold text-white hover:bg-forest-soft disabled:bg-forest/40"
        >
          Send
        </button>
      </form>
    </div>
  )
}
