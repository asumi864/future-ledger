import type { YM } from './types'

export function ymOf(d: Date): YM {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function addMonths(ym: YM, n: number): YM {
  const [y, m] = ym.split('-').map(Number)
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

export function diffMonths(a: YM, b: YM): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}

export function monthNum(ym: YM): number {
  return Number(ym.split('-')[1])
}

/** 「12月」、年が変わるときは「2027年1月」 */
export function ymLabel(ym: YM, base?: YM): string {
  const [y, m] = ym.split('-').map(Number)
  if (base && Number(base.split('-')[0]) !== y) return `${y}年${m}月`
  return `${m}月`
}

export function ymDot(ym: YM): string {
  return ym.replace('-', '.')
}
