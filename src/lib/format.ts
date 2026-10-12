export function yen(n: number, signed = false): string {
  const v = Math.round(n)
  const s = Math.abs(v).toLocaleString('ja-JP')
  if (v < 0) return `−¥${s}`
  return signed && v > 0 ? `+¥${s}` : `¥${s}`
}

export function num(n: number): string {
  return Math.round(n).toLocaleString('ja-JP')
}

/** 入力文字列から数値だけを取り出す（全角数字も可） */
export function parseAmount(v: string): number {
  const half = v.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  const n = Number(half.replace(/[^\d]/g, ''))
  return Number.isFinite(n) ? n : 0
}
