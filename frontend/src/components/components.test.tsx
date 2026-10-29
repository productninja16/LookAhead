import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ToolMessage, VerdictMessage } from '../types'
import ToolConfirmationCard from './ToolConfirmationCard'
import VerdictCard from './VerdictCard'

afterEach(cleanup)

const verdict: VerdictMessage = {
  type: 'verdict',
  verdict: 'caution',
  headline: 'You can, but watch out',
  directAnswer: 'You can technically afford headphones at $549.',
  tradeoffs: ['It equals 4.5 days of your $123/day budget.'],
  risksOrCaution: 'Renters insurance ($168) is due in 61 days.',
  nextStep: 'Wait 48 hours.',
  followUps: ['What if I wait until payday?'],
  facts: {
    item: 'headphones',
    amount: 549,
    safe_to_spend: 1109,
    safe_after: 560,
    daily_budget: 123,
    days_of_budget: 4.5,
    days_to_payday: 9,
    pct_of_safe: 50,
    buffer_status: 'Building',
    blind_spot: null,
    goal: null,
    verdict: 'caution',
  },
  context_layers: [{ layer: 1, name: 'Financial snapshot', content: 'Take-home $2,100' }],
  grounding: { grounded: true, references_user_numbers: true, cited: [549, 123], ungrounded: [] },
  source: 'fallback',
  llm_rejected: false,
}

function order(container: HTMLElement) {
  const text = container.textContent ?? ''
  return ['Trade-offs', 'Watch out', 'Next step'].sort((a, b) => text.indexOf(a) - text.indexOf(b))
}

describe('VerdictCard', () => {
  const props = { msg: verdict, saved: false, onSave: () => {}, onFollowUp: () => {}, showChips: true }

  it('shows the headline, verdict pill and answer', () => {
    render(<VerdictCard {...props} avatar="strategist" />)
    expect(screen.getByText('You can, but watch out')).toBeInTheDocument()
    expect(screen.getByText('Caution')).toBeInTheDocument()
    expect(screen.getByText(/technically afford headphones/)).toBeInTheDocument()
  })

  it('leads with the caution for the Adventurer but with trade-offs for the Strategist', () => {
    const a = render(<VerdictCard {...props} avatar="adventurer" />)
    expect(order(a.container)[0]).toBe('Watch out')
    cleanup()
    const s = render(<VerdictCard {...props} avatar="strategist" />)
    expect(order(s.container)[0]).toBe('Trade-offs')
  })

  it('reveals the computation panel with the grounding result on demand', async () => {
    render(<VerdictCard {...props} avatar="builder" />)
    expect(screen.queryByTestId('computation-panel')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /how this was computed/i }))
    expect(screen.getByTestId('computation-panel')).toHaveTextContent(/trace back to your profile/)
  })

  it('flags untraceable figures and discarded AI drafts', async () => {
    const bad = { ...verdict, llm_rejected: true, grounding: { ...verdict.grounding, ungrounded: [77777] } }
    render(<VerdictCard {...props} msg={bad} avatar="builder" />)
    await userEvent.click(screen.getByRole('button', { name: /how this was computed/i }))
    expect(screen.getByTestId('computation-panel')).toHaveTextContent(/Untraceable figures: \$77,777/)
    expect(screen.getByTestId('computation-panel')).toHaveTextContent(/discarded/)
  })

  it('disables saving once saved and fires follow-up chips', async () => {
    const onFollowUp = vi.fn()
    render(<VerdictCard {...props} saved avatar="builder" onFollowUp={onFollowUp} />)
    expect(screen.getByRole('button', { name: /saved to decisions/i })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'What if I wait until payday?' }))
    expect(onFollowUp).toHaveBeenCalledWith('What if I wait until payday?')
  })
})

describe('ToolConfirmationCard', () => {
  const msg: ToolMessage = {
    type: 'tool_confirmation',
    proposal: { action: 'add_bonus', params: { amount: 1000 }, summary: 'Add a one-time $1,000 to your checking balance?' },
    impact: { safe_to_spend_before: 152, safe_to_spend_after: 1152, daily_budget_before: 19, daily_budget_after: 144 },
  }

  it('shows before/after impact and wires confirm and decline', async () => {
    const onConfirm = vi.fn()
    const onDecline = vi.fn()
    render(<ToolConfirmationCard msg={msg} busy={false} onConfirm={onConfirm} onDecline={onDecline} />)
    expect(screen.getByText('$152 → $1,152')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onDecline).toHaveBeenCalledOnce()
  })

  it('replaces the buttons with the outcome once resolved', () => {
    render(<ToolConfirmationCard msg={msg} resolved="declined" busy={false} onConfirm={() => {}} onDecline={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument()
    expect(screen.getByText(/Nothing was changed/)).toBeInTheDocument()
  })
})
