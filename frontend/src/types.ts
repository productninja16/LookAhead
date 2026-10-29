export type VerdictKind = 'yes' | 'caution' | 'not_now'
export type AvatarKey = 'strategist' | 'adventurer' | 'builder'
export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'
export type BillFrequency = 'monthly' | 'quarterly' | 'semiannual' | 'annual'

export interface Obligation {
  id: string
  name: string
  amount: number
  frequency: BillFrequency
  next_due: string
  essential: boolean
  category: string
}

export interface MemoryEntry {
  index: number
  section: string
  text: string
  created: string
  stale: boolean
}

export interface Profile {
  name: string
  avatar: AvatarKey
  pay_frequency: PayFrequency
  net_pay: number
  next_payday: string
  checking_balance: number
  savings_balance: number
  obligations: Obligation[]
}

export interface GoalStatus {
  id: string
  name: string
  target: number
  saved: number
  remaining: number
  monthly_contribution: number
  months_to_go: number | null
  status: 'On track' | 'Slow' | 'Stalled' | 'Reached'
}

export interface Snapshot {
  days_to_payday: number
  due_before_payday: number
  goal_contributions_before_payday: number
  safe_to_spend: number
  daily_budget: number
  monthly_income: number
  monthly_essentials: number
  buffer_months: number
  buffer_status: 'Thin' | 'Building' | 'Healthy'
  goals: GoalStatus[]
}

export interface UpcomingBill {
  obligation_id: string
  name: string
  amount: number
  due: string
  days_away: number
}

export interface Persona {
  key: AvatarKey
  label: string
  identity: string
  voice: string
}

export interface AppState {
  profile: Profile
  snapshot: Snapshot
  upcoming: UpcomingBill[]
  blind_spot: UpcomingBill | null
  persona: Persona
  memory: MemoryEntry[]
  llm: { available: boolean; calls_left: number; session_cap: number }
  today: string
}

export interface Demo {
  key: string
  title: string
  blurb: string
  avatar: AvatarKey
}

export interface ContextLayer {
  layer: number
  name: string
  content: string
}

export interface Grounding {
  grounded: boolean
  references_user_numbers: boolean
  cited: number[]
  ungrounded: number[]
  rejected?: boolean
}

export interface VerdictFacts {
  item: string
  amount: number
  safe_to_spend: number
  safe_after: number
  daily_budget: number
  days_of_budget: number | null
  days_to_payday: number
  pct_of_safe: number | null
  buffer_status: string
  blind_spot: { name: string; amount: number; days_away: number } | null
  goal: { name: string; delay_months: number | null; monthly_contribution: number } | null
  verdict: VerdictKind
}

export interface VerdictMessage {
  type: 'verdict'
  verdict: VerdictKind
  headline: string
  directAnswer: string
  tradeoffs: string[]
  risksOrCaution: string
  nextStep: string
  followUps: string[]
  facts: VerdictFacts
  context_layers: ContextLayer[]
  grounding: Grounding
  source: 'llm' | 'fallback'
  llm_rejected: boolean
}

export interface TextMessage {
  type: 'text'
  text: string
  followUps: string[]
  source: 'llm' | 'fallback'
}

export interface ToolProposal {
  action: string
  params: Record<string, unknown>
  summary: string
}

export interface ToolMessage {
  type: 'tool_confirmation'
  proposal: ToolProposal
  impact: {
    safe_to_spend_before: number
    safe_to_spend_after: number
    daily_budget_before: number
    daily_budget_after: number
  }
}

export type BotMessage = VerdictMessage | TextMessage | ToolMessage

export interface ChatResponse {
  intent: string
  classifier: 'llm' | 'rules'
  messages: BotMessage[]
  llm: { used: boolean; reason: string | null; calls_left: number }
}

export interface Decision {
  id: number
  item: string
  amount: number
  verdict: VerdictKind
  status: 'waiting' | 'bought' | 'skipped'
  regret: 'good_call' | 'regret' | null
  age_days: number
  followup_due: boolean
}

export interface OnboardingBill {
  name: string
  amount: number
  frequency: BillFrequency
  next_due: string
  essential: boolean
  category: string
}

export interface OnboardingGoal {
  name: string
  target: number
  saved: number
  monthly_contribution: number
}

export interface OnboardingPayload {
  name: string
  avatar: AvatarKey
  pay_frequency: PayFrequency
  net_pay: number
  next_payday: string
  checking_balance: number
  savings_balance: number
  obligations: OnboardingBill[]
  goals: OnboardingGoal[]
}
