import { describe, expect, it } from 'vitest'
import { emptyDB } from '../src/lib/defaults'
import { simulate } from '../src/lib/engine'
import { planICS, routineICS } from '../src/lib/ics'

describe('カレンダー用ファイル', () => {
  it('毎月1日と四半期の繰り返し予定を作る', () => {
    const s = routineICS('2026-10')
    expect(s).toContain('DTSTART;TZID=Asia/Tokyo:20261101T200000')
    expect(s).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=1')
    expect(s).toContain('DTSTART;TZID=Asia/Tokyo:20270108T200000')
    expect(s.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('予定のタイトルと本文に金額を入れない', () => {
    const db = emptyDB('2026-10')
    db.wishes.push({ id: 'a', name: '本棚', price: 15000, priority: 'want', order: 0, createdAt: 0 })
    db.expenses.push({ id: 'b', kind: 'fixed', name: '京都旅行', amount: 60000, month: '2027-02', createdAt: 0 })
    const s = planICS(db, simulate(db, '2026-10'))
    expect(s).toContain('予約帳：ほしいもの見直し（本棚）')
    expect(s).toContain('DTSTART;VALUE=DATE:20270201')
    expect(s).not.toMatch(/15,?000|60,?000|¥/)
  })
})
