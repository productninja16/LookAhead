import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { useApp } from './AppContext'
import { LogoMark, Spinner } from './ui'

const NAV = [
  { to: '/home', label: 'Home', icon: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { to: '/ask', label: 'Ask', icon: 'M4 5h16v11H9l-5 4z' },
  { to: '/bills', label: 'Bills', icon: 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6' },
  { to: '/decisions', label: 'Decisions', icon: 'M5 12l4 4 10-10' },
  { to: '/you', label: 'You', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6' },
]

function Icon({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

function LlmToggle() {
  const { state, llmEnabled, setLlmEnabled } = useApp()
  if (!state) return null
  if (!state.llm.available) {
    return (
      <span
        className="rounded-full bg-mint px-3 py-1.5 text-xs font-medium text-forest"
        title="No API key is configured on this server, so answers use the built-in deterministic engine."
      >
        Offline engine
      </span>
    )
  }
  return (
    <button
      role="switch"
      aria-checked={llmEnabled}
      onClick={() => setLlmEnabled(!llmEnabled)}
      title="Turn the AI off to see the app run on its deterministic engine alone"
      className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-3 text-xs font-medium"
    >
      <span className={`relative h-4 w-7 rounded-full transition-colors ${llmEnabled ? 'bg-teal' : 'bg-line'}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${llmEnabled ? 'left-3.5' : 'left-0.5'}`} />
      </span>
      {llmEnabled ? `AI on · ${state.llm.calls_left} left` : 'AI off'}
    </button>
  )
}

export default function Shell() {
  const { state, loading } = useApp()
  if (loading) return <Spinner />
  if (!state) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen pb-24 md:pb-10">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2">
          <NavLink to="/home" className="flex items-center gap-2 font-display text-lg font-bold text-forest">
            <LogoMark size={26} /> LookAhead
          </NavLink>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-mint text-forest' : 'text-muted hover:text-ink'}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <LlmToggle />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
        <p className="mt-10 text-center text-xs text-muted">
          LookAhead is a decision-support demo, not financial, investment, or tax advice.
        </p>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Main"
      >
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${isActive ? 'text-forest' : 'text-muted'}`
            }
          >
            <Icon d={n.icon} />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
