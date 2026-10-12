import { useMemo } from 'preact/hooks'
import { HomeBack, Icon, Nav, PRIORITY_LABEL, go, openSheet, toast } from '../components/ui'
import { simulate, sortWishes } from '../lib/engine'
import { yen } from '../lib/format'
import { update, useDB } from '../lib/store'
import type { Wish } from '../lib/types'
import { addMonths, monthNum, ymLabel, ymOf } from '../lib/ym'
import { PARTS, partValue } from './Home'

const COLS = 9

export function Wishes() {
  const db = useDB()
  const today = ymOf(new Date())
  const plan = useMemo(() => simulate(db, today), [db, today])
  const months = Array.from({ length: COLS }, (_, i) => addMonths(today, i))
  const rows = months.map(m => plan.rows.find(r => r.month === m)!)
  const recoveringAhead = plan.rows.some(r => r.month >= today && r.recovering)
  const active = sortWishes(db.wishes.filter(w => !w.boughtMonth))
  const bought = db.wishes.filter(w => w.boughtMonth).sort((a, b) => (b.boughtMonth ?? '').localeCompare(a.boughtMonth ?? ''))

  const groups = new Map<string, Wish[]>()
  for (const w of active) {
    const k = plan.wishes[w.id]?.eta ?? 'none'
    groups.set(k, [...(groups.get(k) ?? []), w])
  }
  const keys = [...groups.keys()].sort((a, b) => (a === 'none' ? 1 : b === 'none' ? -1 : a.localeCompare(b)))
  const reviewed = db.routines[today]?.reviewed

  return (
    <>
      <div class="body">
        <div class="hdr"><div><HomeBack /><div class="ov" style="margin-top:12px">Wishlist · 順番方式 · 自由枠 {yen(plan.forecastFree)}/月</div><h1>ほしいもの</h1></div></div>

        {recoveringAhead && plan.breakEven && (
          <button class="banner" style="text-align:left" onClick={() => go('/recovery')}>
            <span class="ic"><Icon n="loop" /></span>
            <div style="flex:1"><b>取り戻し中 · {ymLabel(plan.breakEven, today)}にプラマイゼロ</b><span>それまで「欲しい」「憧れ」は一時停止、「必要」は継続</span></div>
            <Icon n="chev" class="chev" />
          </button>
        )}

        <div class="card">
          <div class="row" style="margin-bottom:6px"><span class="ov">Reservation · 予約カレンダー</span><span class="t11">{months[0].replace('-', '.')} — {months[COLS - 1].replace('-', '.')}</span></div>
          <div class="t11" style="margin-bottom:12px">棒＝その月の自由枠の使い道　数字＝その月に買う件数　タップで内訳</div>
          <div class="stack">
            {rows.map((r, i) => {
              const parts = PARTS.map(p => ({ ...p, v: partValue(r, p.k) })).filter(p => p.v > 0)
              const tot = parts.reduce((a, p) => a + p.v, 0) || 1
              const fixed = db.expenses.some(e => e.kind === 'fixed' && e.month === r.month)
              const n = r.purchases.length + db.wishes.filter(w => w.boughtMonth === r.month).length
              return (
                <button class={i === 0 ? 'now' : ''} onClick={() => openSheet('month', { month: r.month })} aria-label={`${ymLabel(r.month)}の内訳`}>
                  <span class={`bd ${n ? '' : fixed ? 'fx' : 'e'}`}>{n || (fixed ? '旅' : '')}</span>
                  <div class="col">{parts.map(p => <i style={`height:${(p.v / tot) * 100}%;background:${p.color}`} />)}</div>
                  <span class="m">{String(monthNum(r.month)).padStart(2, '0')}</span>
                </button>
              )
            })}
          </div>
          <div class="mkey"><span><i style="background:var(--ink)" />必要</span><span><i style="background:var(--blue)" />欲しい</span><span><i style="background:var(--blue-3)" />憧れ</span><span><i style="background:var(--fixc)" />日程固定の準備</span><span><i style="background:var(--neg)" />取り戻し</span></div>
        </div>

        {active.length === 0 && <div class="empty">まだ登録がありません。右下の＋から、ほしいものを追加してください。</div>}

        {keys.map(k => {
          const ws = groups.get(k)!
          return (
            <>
              <div class="mgrp">
                {k === 'none' ? <b style="font-size:13px">3年以内には届かない</b> : <b>{monthNum(k)}<small>月{k.slice(0, 4) !== today.slice(0, 4) ? `（${k.slice(0, 4)}）` : ''}</small></b>}
                <span>{ws.length}件{ws.length > 1 && k !== 'none' ? ' · 同じ月にまとめて' : ''}</span>
              </div>
              <div class="wl">
                {ws.map(w => {
                  const p = plan.wishes[w.id]
                  const pct = Math.min(100, Math.round((p.savedNow / w.price) * 100))
                  const note = p.shortfallAtHope ? `希望は${ymLabel(w.hope!, today)} → ${yen(p.shortfallAtHope)} 不足` : w.memo || `積立 ${yen(p.savedNow)} / ${yen(w.price)}`
                  return (
                    <button class="wi" style="text-align:left" onClick={() => openSheet('wish', { id: w.id })}>
                      <span class={`pill p-${w.priority}`}>{PRIORITY_LABEL[w.priority]}</span>
                      <div class="tx"><b>{w.name}</b><small class={p.shortfallAtHope ? 'c-warn' : ''}>{note}</small>
                        {p.savedNow > 0 && <div class="bar2"><i style={`width:${pct}%;background:${w.priority === 'need' ? 'var(--ink)' : 'var(--blue)'}`} /></div>}
                      </div>
                      <div class="am"><span class="fig">{yen(w.price)}</span></div>
                    </button>
                  )
                })}
              </div>
            </>
          )
        })}

        {active.length > 0 && (
          <div class="note n-blue"><Icon n="info" /><span>順番方式：優先度の高いものから1つずつ満額にします。満額になった月の余りは次のものへ回るので、安いものは同じ月に複数届きます。並び順はほしいものを開いて変えられます。</span></div>
        )}

        {bought.length > 0 && (
          <>
            <div class="sec">Bought · 買ったもの</div>
            <div class="wl">
              {bought.slice(0, 6).map(w => (
                <button class="wi" style="text-align:left" onClick={() => openSheet('wish', { id: w.id })}>
                  <span class="ic ic-o" style="width:30px;height:30px"><Icon n="check" /></span>
                  <div class="tx"><b>{w.name}</b><small>{ymLabel(w.boughtMonth!, today)}に購入</small></div>
                  <div class="am"><span class="fig">{yen(w.boughtPrice ?? w.price)}</span></div>
                </button>
              ))}
            </div>
          </>
        )}

        <button class={`btn ${reviewed ? 'b-s' : 'b-p'}`} onClick={() => { update(d => { d.routines[today] = { ...d.routines[today], reviewed: Date.now() } }); toast('今月の見直しを記録しました') }}>
          <Icon n="check" />{reviewed ? '今月の見直しは完了済み' : '今月の見直しを完了する'}
        </button>
        <div style="height:56px" />
      </div>
      <button class="fab" aria-label="記録する" onClick={() => openSheet('menu')}><Icon n="plus" /></button>
      <Nav active="/wishes" />
    </>
  )
}
