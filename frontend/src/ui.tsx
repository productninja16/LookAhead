import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { VerdictKind } from './types'

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0d3b3c" />
      <path
        d="M7 20c3-6 7-9 12-9m0 0-3-3m3 3-3 3"
        fill="none"
        stroke="#5eead4"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="23" r="2" fill="#5eead4" />
    </svg>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(15,42,43,0.04)] ${className}`}>{children}</div>
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'subtle' | 'danger' }

export function Btn({ variant = 'primary', className = '', ...rest }: BtnProps) {
  const styles = {
    primary: 'bg-forest text-white hover:bg-forest-soft disabled:bg-forest/40',
    ghost: 'border border-line bg-white text-ink hover:bg-mint/60 disabled:text-muted',
    subtle: 'bg-mint text-forest hover:bg-mint-deep/40',
    danger: 'border border-stop/30 bg-white text-stop hover:bg-stop-bg',
  }[variant]
  return (
    <button
      {...rest}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${styles} ${className}`}
    />
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal">{children}</p>
}

const VERDICT_STYLE: Record<VerdictKind, { bg: string; fg: string; dot: string; label: string }> = {
  yes: { bg: 'bg-yes-bg', fg: 'text-yes', dot: 'bg-yes', label: 'Go ahead' },
  caution: { bg: 'bg-caution-bg', fg: 'text-caution', dot: 'bg-caution', label: 'Caution' },
  not_now: { bg: 'bg-stop-bg', fg: 'text-stop', dot: 'bg-stop', label: 'Not now' },
}

export const verdictStyle = (v: VerdictKind) => VERDICT_STYLE[v]

export function VerdictPill({ verdict }: { verdict: VerdictKind }) {
  const s = VERDICT_STYLE[verdict]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.bg} ${s.fg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
    </span>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex items-center justify-center p-10">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-teal" />
    </div>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-stop-bg px-3 py-2 text-sm text-stop">
      {children}
    </p>
  )
}
