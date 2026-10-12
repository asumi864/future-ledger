/**
 * Googleカレンダー（個人アカウント）へ取り込むための .ics を作る。
 * 予定のタイトル・本文には金額を入れない。
 */
import type { Plan } from './engine'
import type { DB, YM } from './types'
import { addMonths, ymOf } from './ym'

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
const ymd = (ym: YM, day: number) => `${ym.replace('-', '')}${String(day).padStart(2, '0')}`
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')

function wrap(events: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//future-ledger//ja', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n') + '\r\n'
}

function timed(uid: string, ym: YM, day: number, title: string, desc: string, rrule?: string): string {
  const d = ymd(ym, day)
  return [
    'BEGIN:VEVENT', `UID:${uid}@future-ledger`, `DTSTAMP:${stamp()}`,
    `DTSTART;TZID=Asia/Tokyo:${d}T200000`, `DTEND;TZID=Asia/Tokyo:${d}T201500`,
    ...(rrule ? [`RRULE:${rrule}`] : []),
    `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(desc)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'TRIGGER:-PT0M', 'END:VALARM',
    'END:VEVENT',
  ].join('\r\n')
}

function allDay(uid: string, ym: YM, title: string, desc: string): string {
  return [
    'BEGIN:VEVENT', `UID:${uid}@future-ledger`, `DTSTAMP:${stamp()}`,
    `DTSTART;VALUE=DATE:${ymd(ym, 1)}`, `DTEND;VALUE=DATE:${ymd(ym, 2)}`,
    `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(desc)}`, 'END:VEVENT',
  ].join('\r\n')
}

/** 毎月1日の点検と、四半期ごとの全体会議 */
export function routineICS(today: YM = ymOf(new Date())): string {
  const next = addMonths(today, 1)
  const q = [1, 4, 7, 10]
  let qm = next
  while (!q.includes(Number(qm.split('-')[1]))) qm = addMonths(qm, 1)
  return wrap([
    timed('routine-monthly', next, 1, '予約帳：今月やること', '月の締め・評価額の入力・ほしいものの見直し・データの書き出し（約12分）', 'FREQ=MONTHLY;BYMONTHDAY=1'),
    timed('routine-quarterly', qm, 8, '予約帳：四半期の全体会議', '委員会の全体会議で、積立額や方針を見直す日', 'FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=8'),
  ])
}

/** ほしいものの購入目安月と、日程固定の支払い月 */
export function planICS(db: DB, plan: Plan): string {
  const ev: string[] = []
  for (const w of db.wishes) {
    const eta = plan.wishes[w.id]?.eta
    if (w.boughtMonth || !eta) continue
    ev.push(allDay(`wish-${w.id}`, eta, `予約帳：ほしいもの見直し（${w.name}）`, '購入の目安月です。アプリで最新の目安を確認してください'))
  }
  for (const e of db.expenses) {
    if (e.kind !== 'fixed' || e.month < plan.today) continue
    ev.push(allDay(`fixed-${e.id}`, e.month, `予約帳：日程固定の支払い（${e.name}）`, '準備が足りているかアプリで確認してください'))
  }
  return wrap(ev)
}
