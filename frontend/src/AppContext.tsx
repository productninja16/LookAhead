import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError } from './api'
import type { AppState } from './types'

interface Ctx {
  state: AppState | null
  /** true until the first /api/state response (success or 404) has come back */
  loading: boolean
  setState: (s: AppState | null) => void
  refresh: () => Promise<void>
  llmEnabled: boolean
  setLlmEnabled: (on: boolean) => void
}

const AppCtx = createContext<Ctx | null>(null)
const LLM_KEY = 'lookahead.llm'

function readPref(): boolean {
  try {
    return localStorage.getItem(LLM_KEY) !== 'off'
  } catch {
    return true
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null)
  const [loading, setLoading] = useState(true)
  const [llmEnabled, setLlm] = useState<boolean>(readPref)

  const refresh = useCallback(async () => {
    try {
      setState(await api.state())
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setState(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const setLlmEnabled = useCallback((on: boolean) => {
    setLlm(on)
    try {
      localStorage.setItem(LLM_KEY, on ? 'on' : 'off')
    } catch {
      /* storage blocked: preference lasts for this page view only */
    }
  }, [])

  const value = useMemo(
    () => ({ state, loading, setState, refresh, llmEnabled, setLlmEnabled }),
    [state, loading, refresh, llmEnabled, setLlmEnabled],
  )
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp(): Ctx {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
