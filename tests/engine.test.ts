import { describe, expect, it } from 'vitest'
import { actualFree, forecastFree, simulate } from '../src/lib/engine'
import { emptyDB } from '../src/lib/defaults'
import type { DB, Priority, Wish } from '../src/lib/types'

let seq = 0
const wish = (name: string, price: number, priority: Priority, order = 0, hope?: string): Wish =>
  ({ id: name, name, price, priority, order, hope, createdAt: seq++ })

/** 手計算した基準シナリオ（自由枠2万円・必要は月5千円・全額ペース） */
function scenario(): DB {
  const db = emptyDB('2026-11')
  db.expenses.push(
    { id: 'nomi', kind: 'spent', name: '飲み会', amount: 30000, month: '2026-11', createdAt: 0 },
    { id: 'trip', kind: 'fixed', name: '京都旅行', amount: 60000, month: '2027-02', createdAt: 0 },
  )
  db.wishes.push(
    wish('靴', 10000, 'need', 0), wish('コート', 15000, 'need', 1),
    wish('イヤホン', 28000, 'want', 0), wish('本棚', 15000, 'want', 1), wish('文庫本', 3000, 'want', 2),
    wish('チェア', 68000, 'dream', 0, '2027-07'),
  )
  return db
}

describe('順番方式と取り戻し', () => {
  it('基準シナリオの購入月', () => {
    const p = simulate(scenario(), '2026-11')
    const eta = Object.fromEntries(Object.values(p.wishes).map(w => [w.id, w.eta]))
    expect(eta).toEqual({
      靴: '2026-12', コート: '2027-03', イヤホン: '2027-06', 本棚: '2027-06', 文庫本: '2027-07', チェア: '2027-10',
    })
  })

  it('同じ月に複数届く（6月にイヤホンと本棚）', () => {
    const p = simulate(scenario(), '2026-11')
    const jun = p.rows.find(r => r.month === '2027-06')!
    expect(jun.purchases.map(x => x.name)).toEqual(['イヤホン', '本棚'])
  })

  it('プラマイゼロの月と、いまの前借りが消える月', () => {
    const p = simulate(scenario(), '2026-11')
    expect(p.breakEven).toBe('2027-04')
    expect(p.debtCleared).toBe('2026-12')
    expect(p.rows[0].balanceEnd).toBe(-15000)
  })

  it('取り戻し中も「必要」は月5千円まで続き、「欲しい」は止まる', () => {
    const nov = simulate(scenario(), '2026-11').rows[0]
    expect(nov.alloc).toMatchObject({ need: 5000, rec: 15000, want: 0, dream: 0 })
  })

  it('日程固定の旅行は、前借りが消えた後に準備として積み立てる', () => {
    const jan = simulate(scenario(), '2026-11').rows.find(r => r.month === '2027-01')!
    expect(jan.alloc.fix).toBe(15000)
    expect(jan.alloc.rec).toBe(0)
  })

  it('希望の月に足りない額', () => {
    expect(simulate(scenario(), '2026-11').wishes['チェア'].shortfallAtHope).toBe(68000 - 19000)
  })

  it('ペースが半分だとプラマイゼロが遅れ、その分ほしいものが進む', () => {
    const db = scenario(); db.settings.pace.mode = 'half'
    const p = simulate(db, '2026-11')
    expect(p.breakEven! > '2027-04').toBe(true)
    const a = p.rows[0].alloc
    // 浮いた半分は順番方式で「必要」の残りから回る
    expect(a.need + a.want + a.dream).toBeGreaterThan(5000)
  })
})

describe('月の締め', () => {
  it('実際の自由枠＝手取り−（支出合計−登録済み）−先取り', () => {
    const db = scenario()
    const c = { month: '2026-11', takeHome: 384400, spendTotal: 330000, surplusTo: 'recovery' as const, closedAt: 0 }
    expect(actualFree(db, c)).toBe(24400)
    db.closes.push(c)
    expect(simulate(db, '2026-11').rows[0].balanceEnd).toBe(-10600)
  })

  it('余りを貯金に回すと、計画の自由枠は見込みのまま', () => {
    const db = scenario()
    db.closes.push({ month: '2026-11', takeHome: 384400, spendTotal: 330000, surplusTo: 'saving', closedAt: 0 })
    expect(simulate(db, '2026-11').rows[0].free).toBe(20000)
  })

  it('見込みは直近3か月の平均／最低額', () => {
    const db = emptyDB('2026-08')
    for (const [m, th] of [['2026-08', 380000], ['2026-09', 390000], ['2026-10', 400000]] as const)
      db.closes.push({ month: m, takeHome: th, spendTotal: 300000, surplusTo: 'recovery', closedAt: 0 })
    expect(forecastFree(db)).toBe(30000)
    db.settings.forecast = 'min'
    expect(forecastFree(db)).toBe(20000)
  })

  it('締め済みの月には「出費が重なる月」を二重に引かない', () => {
    const db = emptyDB('2026-11')
    db.settings.heavy.push({ id: 'h', month: 11, label: '年払い', amount: 12000 })
    expect(simulate(db, '2026-11').rows[0].heavy).toBe(12000)
    db.closes.push({ month: '2026-11', takeHome: 380000, spendTotal: 300000, surplusTo: 'recovery', closedAt: 0 })
    expect(simulate(db, '2026-11').rows[0].heavy).toBe(0)
  })
})

describe('分割・臨時収入・実際の購入', () => {
  it('分割は月額を自由枠から先に引く', () => {
    const db = emptyDB('2026-12')
    db.expenses.push({ id: 'cam', kind: 'split', name: 'カメラ', amount: 300000, count: 24, fee: 0, month: '2026-12', createdAt: 0 })
    db.wishes.push(wish('本', 50000, 'want'))
    const r = simulate(db, '2026-12').rows[0]
    expect(r.installments).toBe(12500)
    expect(r.alloc.want).toBe(7500)
  })

  it('臨時収入を取り戻しに回すとプラマイゼロが早まる', () => {
    const base = simulate(scenario(), '2026-11').breakEven!
    const db = scenario()
    db.incomes.push({ id: 'i', kind: 'side', amount: 15000, month: '2026-12', toRecovery: true, createdAt: 0 })
    expect(simulate(db, '2026-11').breakEven! < base).toBe(true)
  })

  it('積立が足りないまま買うと、差額は前借りになる', () => {
    const db = emptyDB('2026-11')
    db.wishes.push({ ...wish('急ぎ', 10000, 'want'), boughtMonth: '2026-11', boughtPrice: 12000 })
    const r = simulate(db, '2026-11').rows[0]
    expect(r.balanceStart - 12000 + 20000).toBe(r.balanceEnd)
  })
})
