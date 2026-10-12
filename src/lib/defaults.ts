import type { DB, Settings, YM } from './types'

export function defaultSettings(startMonth: YM): Settings {
  return {
    startMonth,
    defaultFree: 20000,
    saving: 50000,
    nisa: 10000,
    cashGoal: 3000000,
    cashNow: 0,
    forecast: 'avg',
    pace: { mode: 'full', amount: 10000 },
    needDuringRecovery: 5000,
    heavy: [],
  }
}

export function emptyDB(startMonth: YM): DB {
  return {
    version: 1,
    settings: defaultSettings(startMonth),
    wishes: [],
    expenses: [],
    incomes: [],
    closes: [],
    valuations: [],
    minutes: [],
    routines: {},
  }
}

export function uid(): string {
  return crypto.randomUUID()
}
