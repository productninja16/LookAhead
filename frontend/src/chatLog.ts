import type { BotMessage } from './types'

export type LogEntry =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'bot'; msg: BotMessage; resolved?: 'confirmed' | 'declined' | 'saved' }
  | { id: number; role: 'note'; text: string }

/** Chat history lives at module level so it survives navigating between tabs. */
let log: LogEntry[] = []
let nextId = 1

export const getLog = () => log
export const setLog = (l: LogEntry[]) => {
  log = l
}
export const newId = () => nextId++
export const resetChat = () => {
  log = []
}
