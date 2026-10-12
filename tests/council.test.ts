import { describe, expect, it } from 'vitest'
import { MEMBERS, buildPrompt, parseCouncil, stanceSummary } from '../src/lib/council'
import { emptyDB } from '../src/lib/defaults'
import { simulate } from '../src/lib/engine'

const sample = {
  members: MEMBERS.map((m, i) => ({ id: m.id, stance: i < 2 ? 'go' : i === 4 ? 'question' : 'wait', claim: `${m.name}の主張`, reason: '理由です。' })),
  chair: { verdict: '現状維持', summary: 'まとめ', todos: ['a', 'b', 'c', 'd'], homework: ['h'] },
}

describe('相談文', () => {
  it('委員・数字・回答の形式を含む', () => {
    const db = emptyDB('2026-10')
    db.valuations.push({ month: '2026-10', value: 63200, invested: 60000, enteredAt: 0 })
    const p = buildPrompt(db, simulate(db, '2026-10'), '2026-10', false)
    for (const m of MEMBERS) expect(p).toContain(`${m.id}｜${m.name}`)
    expect(p).toContain('評価額：¥63,200')
    expect(p).toContain('+¥3,200（5.3%）')
    expect(p).toContain('```json')
    expect(p).toContain('個別の投資助言ではありません')
  })
})

describe('回答の読み取り', () => {
  it('コードブロック付きの回答から取り出し、todos は3つまでに切る', () => {
    const r = parseCouncil('はい。\n```json\n' + JSON.stringify(sample) + '\n```\n以上です')
    expect(r.members).toHaveLength(6)
    expect(r.chair.todos).toEqual(['a', 'b', 'c'])
    expect(stanceSummary(r)).toBe('継続2 · 様子見3 · 問い1')
  })

  it('コードブロックが無くても読める', () => {
    expect(parseCouncil(JSON.stringify(sample)).chair.verdict).toBe('現状維持')
  })

  it('委員が欠けていればエラー', () => {
    const bad = { ...sample, members: sample.members.slice(0, 5) }
    expect(() => parseCouncil(JSON.stringify(bad))).toThrow('今も大事にする人')
  })

  it('壊れたJSONはエラー', () => {
    expect(() => parseCouncil('```json\n{ "members": [ \n```')).toThrow('JSONの形が崩れています')
  })

  it('想定外の結論は「情報不足」に寄せる', () => {
    expect(parseCouncil(JSON.stringify({ ...sample, chair: { ...sample.chair, verdict: '全部売る' } })).chair.verdict).toBe('情報不足')
  })
})
