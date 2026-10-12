/**
 * 計算エンジン（画面から独立した純粋関数）
 *
 * モデル：
 * - 自由枠 = 手取り − 生活費（自由に使った分を含む）− 先取り（貯金・NISA）
 *   つまり「その月に実際に手元に残ったお金」。締めの前は見込み額を使う。
 * - プール残高 B は前借りを含む自由枠の累計。もう使った出費・日程固定の支払い・
 *   積立が足りないまま買ったものは B から引く。
 * - 毎月の割り振り順：分割の固定額 → 「必要」（取り戻し中は上限つき）→
 *   取り戻し／日程固定の準備 → ほしいもの（順番方式：優先度順に1つずつ満額）
 * - 先取りの貯金・NISA はここに一切含めない（触れない）。
 */
import type { BigExpense, Close, DB, Priority, Wish, YM } from './types'
import { addMonths, diffMonths, monthNum } from './ym'

export const PRIORITY_RANK: Record<Priority, number> = { need: 0, want: 1, dream: 2 }
const PREP_WINDOW = 12

export interface Alloc { rec: number; fix: number; need: number; want: number; dream: number; carry: number }

export interface Purchase { id: string; name: string; price: number; priority: Priority }

export interface MonthRow {
  month: YM
  closed: boolean
  free: number
  heavy: number
  installments: number
  windfall: number
  spent: number
  fixedPaid: number
  balanceStart: number
  balanceEnd: number
  recovering: boolean
  alloc: Alloc
  purchases: Purchase[]
}

export interface WishPlan {
  id: string
  eta?: YM
  /** today 時点の積立額 */
  savedNow: number
  /** 希望の月に足りない額（間に合う場合は undefined） */
  shortfallAtHope?: number
}

export interface Plan {
  rows: MonthRow[]
  wishes: Record<string, WishPlan>
  /** 計画期間中の最後のマイナスが解消される月 */
  breakEven?: YM
  /** today 時点の前借りが解消される月 */
  debtCleared?: YM
  forecastFree: number
  today: YM
}

export function sortWishes(ws: Wish[]): Wish[] {
  return [...ws].sort((a, b) =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.order - b.order || a.createdAt - b.createdAt)
}

export function installmentOf(e: BigExpense): number {
  const n = Math.max(1, e.count ?? 1)
  return Math.round((e.amount + (e.fee ?? 0)) / n)
}

function installmentIn(e: BigExpense, m: YM): number {
  if (e.kind !== 'split') return 0
  const d = diffMonths(e.month, m)
  return d >= 0 && d < Math.max(1, e.count ?? 1) ? installmentOf(e) : 0
}

/** その月に、アプリに登録済みの支払い（MEの支出合計から除く分） */
export function registeredIn(db: DB, m: YM): number {
  let sum = 0
  for (const e of db.expenses) {
    if ((e.kind === 'spent' || e.kind === 'fixed') && e.month === m) sum += e.amount
    sum += installmentIn(e, m)
  }
  for (const w of db.wishes) if (w.boughtMonth === m) sum += w.boughtPrice ?? w.price
  return sum
}

export function actualFree(db: DB, c: Close): number {
  return c.takeHome - (c.spendTotal - registeredIn(db, c.month)) - db.settings.saving - db.settings.nisa
}

/** before より前の締め（直近3か月）から自由枠の見込みを出す */
export function forecastFree(db: DB, before?: YM): number {
  const past = db.closes
    .filter(c => !before || c.month < before)
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-3)
    .map(c => actualFree(db, c))
  if (past.length === 0) return db.settings.defaultFree
  const v = db.settings.forecast === 'min' ? Math.min(...past) : past.reduce((a, b) => a + b, 0) / past.length
  return Math.round(v / 100) * 100
}

export function simulate(db: DB, today: YM, horizon = 36): Plan {
  const s = db.settings
  const start = s.startMonth < today ? s.startMonth : today
  const saved: Record<string, number> = {}
  const done = new Set<string>()
  const plans: Record<string, WishPlan> = {}
  const hopeSaved: Record<string, number> = {}
  const order = sortWishes(db.wishes)
  for (const w of order) { saved[w.id] = 0; plans[w.id] = { id: w.id, savedNow: 0 } }

  let B = 0
  const rows: MonthRow[] = []

  // 順番方式で amount を queue に配る。使った額を優先度別に返す
  const distribute = (amount: number, m: YM, onlyNeed: boolean, row: MonthRow) => {
    let left = amount
    for (const w of order) {
      if (left <= 0) break
      if (done.has(w.id) || (w.boughtMonth && w.boughtMonth < m)) continue
      if (w.boughtMonth && w.boughtMonth === m) continue
      if (onlyNeed && w.priority !== 'need') continue
      const put = Math.min(left, w.price - saved[w.id])
      if (put <= 0) continue
      saved[w.id] += put
      left -= put
      row.alloc[w.priority] += put
      if (saved[w.id] >= w.price && !w.boughtMonth) {
        done.add(w.id)
        plans[w.id].eta = m
        row.purchases.push({ id: w.id, name: w.name, price: w.price, priority: w.priority })
      }
    }
    return amount - left
  }

  for (let i = 0; i <= horizon; i++) {
    const m = addMonths(start, i)
    const close = db.closes.find(c => c.month === m)
    const planned = forecastFree(db, m)
    let free = close ? actualFree(db, close) : planned
    let extraWish = 0
    if (close && free > planned) {
      if (close.surplusTo === 'saving') free = planned
      if (close.surplusTo === 'wish') { extraWish = free - planned; free = planned }
    }
    const heavy = close ? 0 : s.heavy.filter(h => h.month === monthNum(m)).reduce((a, h) => a + h.amount, 0)
    const installments = db.expenses.reduce((a, e) => a + installmentIn(e, m), 0)
    const incomes = db.incomes.filter(x => x.month === m)
    const wfRec = incomes.filter(x => x.toRecovery).reduce((a, x) => a + x.amount, 0)
    const wfWish = incomes.filter(x => !x.toRecovery).reduce((a, x) => a + x.amount, 0)
    const spent = db.expenses.filter(e => e.kind === 'spent' && e.month === m).reduce((a, e) => a + e.amount, 0)
    const fixedPaid = db.expenses.filter(e => e.kind === 'fixed' && e.month === m).reduce((a, e) => a + e.amount, 0)

    const row: MonthRow = {
      month: m, closed: !!close, free, heavy, installments, windfall: wfRec + wfWish, spent, fixedPaid,
      balanceStart: B, balanceEnd: B, recovering: false,
      alloc: { rec: 0, fix: 0, need: 0, want: 0, dream: 0, carry: 0 }, purchases: [],
    }

    B -= spent + fixedPaid
    // 実際に買ったもの：積立で足りなかった分はプールから
    for (const w of order) {
      if (w.boughtMonth !== m) continue
      B -= Math.max(0, (w.boughtPrice ?? w.price) - saved[w.id])
      saved[w.id] = 0
      done.add(w.id)
      plans[w.id].eta = m
    }

    let avail = free - heavy - installments + wfRec
    if (avail < 0) { B += avail; avail = 0 }

    const target = db.expenses
      .filter(e => e.kind === 'fixed' && e.month > m && diffMonths(m, e.month) <= PREP_WINDOW)
      .reduce((a, e) => a + e.amount, 0)
    const need = target - B
    if (need > 0) {
      row.recovering = true
      avail -= distribute(Math.min(s.needDuringRecovery, avail), m, true, row)
      const pace = s.pace.mode === 'full' ? avail : s.pace.mode === 'half' ? Math.round(avail / 2) : Math.min(s.pace.amount, avail)
      const r = Math.min(pace, need)
      const recPart = Math.min(r, Math.max(0, -B))
      row.alloc.rec += recPart
      row.alloc.fix += r - recPart
      B += r
      avail -= r
    }
    avail += wfWish + extraWish
    avail -= distribute(avail, m, false, row)
    row.alloc.carry = avail
    B += avail
    row.balanceEnd = B
    rows.push(row)

    if (m === today) for (const w of order) plans[w.id].savedNow = done.has(w.id) && !w.boughtMonth ? w.price : saved[w.id]
    for (const w of order) if (w.hope === m) hopeSaved[w.id] = done.has(w.id) ? w.price : saved[w.id]
  }

  for (const w of order) {
    const p = plans[w.id]
    if (w.hope && !w.boughtMonth && (!p.eta || p.eta > w.hope)) {
      p.shortfallAtHope = w.price - (hopeSaved[w.id] ?? 0)
    }
  }

  let breakEven: YM | undefined
  let lastNeg = -1
  rows.forEach((r, i) => { if (r.balanceEnd < 0) lastNeg = i })
  if (lastNeg >= 0 && lastNeg + 1 < rows.length) breakEven = rows[lastNeg + 1].month

  let debtCleared: YM | undefined
  const ti = rows.findIndex(r => r.month === today)
  if (ti >= 0 && rows[ti].balanceEnd < 0) debtCleared = rows.slice(ti + 1).find(r => r.balanceEnd >= 0)?.month

  return { rows, wishes: plans, breakEven, debtCleared, forecastFree: forecastFree(db), today }
}
