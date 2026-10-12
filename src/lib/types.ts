/** 'YYYY-MM' 形式の月 */
export type YM = string

export type Priority = 'need' | 'want' | 'dream'

export interface Wish {
  id: string
  name: string
  price: number
  priority: Priority
  /** いつ頃ほしいか（任意） */
  hope?: YM
  memo?: string
  /** 同じ優先度の中での順番（小さいほど先） */
  order: number
  createdAt: number
  /** 実際に買った月と金額。入っていれば積立の対象から外れる */
  boughtMonth?: YM
  boughtPrice?: number
}

/** fixed: 日程が決まっている / spent: もう使った / split: 分割で買う */
export type ExpenseKind = 'fixed' | 'spent' | 'split'

export interface BigExpense {
  id: string
  kind: ExpenseKind
  name: string
  /** fixed・spent は支払額、split は本体価格 */
  amount: number
  /** fixed は支払う月、spent は使った月、split は初回の引き落とし月 */
  month: YM
  /** split の回数 */
  count?: number
  /** split の手数料（合計） */
  fee?: number
  createdAt: number
}

export interface Income {
  id: string
  kind: 'bonus' | 'side' | 'other'
  /** 手取り額 */
  amount: number
  month: YM
  /** true なら取り戻しに優先して回す。false ならほしいものへ */
  toRecovery: boolean
  createdAt: number
}

export type SurplusTo = 'recovery' | 'wish' | 'saving'

/** 月の締め。month は「支出があった月」（例：10月の締め） */
export interface Close {
  month: YM
  takeHome: number
  spendTotal: number
  surplusTo: SurplusTo
  closedAt: number
}

export interface Valuation {
  month: YM
  /** 評価額 */
  value: number
  /** 累計買付額 */
  invested: number
  enteredAt: number
}

export interface HeavyMonth {
  id: string
  /** 1〜12 */
  month: number
  label: string
  amount: number
}

export type PaceMode = 'full' | 'half' | 'custom'

export interface Settings {
  /** 計算を始める月 */
  startMonth: YM
  /** 締めの実績がまだ無いときの自由枠 */
  defaultFree: number
  saving: number
  nisa: number
  cashGoal: number
  /** 現金貯金の現在額（ホームの進捗表示用） */
  cashNow: number
  forecast: 'avg' | 'min'
  pace: { mode: PaceMode; amount: number }
  /** 取り戻し中も「必要」に回す月額 */
  needDuringRecovery: number
  heavy: HeavyMonth[]
  /** 積立中の商品名（相談文に入れる。任意） */
  fundName?: string
}

export interface RoutineState {
  reviewed?: number
}

export interface Minutes {
  month: YM
  /** 検証済みの委員会の回答（CouncilResult） */
  raw: unknown
  savedAt: number
  quarterly?: boolean
  /** 本人の決定 */
  decision?: string
}

export interface DB {
  version: 1
  settings: Settings
  wishes: Wish[]
  expenses: BigExpense[]
  incomes: Income[]
  closes: Close[]
  valuations: Valuation[]
  minutes: Minutes[]
  routines: Record<YM, RoutineState>
  lastExport?: number
}
