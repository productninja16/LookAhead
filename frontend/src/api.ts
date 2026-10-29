import type {
  AppState,
  AvatarKey,
  ChatResponse,
  Decision,
  Demo,
  OnboardingPayload,
  ToolProposal,
  VerdictKind,
} from './types'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.")
  }
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail)
  }
  return res.json() as Promise<T>
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

export const api = {
  demos: () => request<Demo[]>('/api/demos'),
  loadDemo: (key: string) => post<AppState>(`/api/demo/${key}`),
  onboard: (payload: OnboardingPayload) => post<AppState>('/api/onboarding', payload),
  state: () => request<AppState>('/api/state'),
  reset: () => request<{ ok: boolean }>('/api/session', { method: 'DELETE' }),
  chat: (message: string, llm_enabled: boolean) => post<ChatResponse>('/api/chat', { message, llm_enabled }),
  confirmTool: (proposal: ToolProposal, confirm: boolean) =>
    post<AppState>('/api/tools/confirm', { proposal, confirm }),
  markPaid: (id: string) => post<AppState>(`/api/obligations/${id}/paid`),
  decisions: () => request<Decision[]>('/api/decisions'),
  saveDecision: (item: string, amount: number, verdict: VerdictKind) =>
    post<{ id: number }>('/api/decisions', { item, amount, verdict }),
  updateDecision: (id: number, status: Decision['status'], regret: Decision['regret']) =>
    request<{ ok: boolean }>(`/api/decisions/${id}`, { method: 'PATCH', body: JSON.stringify({ status, regret }) }),
  setAvatar: (avatar: AvatarKey) => request<AppState>('/api/profile/avatar', { method: 'PATCH', body: JSON.stringify({ avatar }) }),
  forget: (index: number) => request<AppState>(`/api/memory/${index}`, { method: 'DELETE' }),
}
