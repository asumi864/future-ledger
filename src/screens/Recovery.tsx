import { useMemo } from 'preact/hooks'
import { HomeBack, Field, Icon, Money, Seg, openSheet } from '../components/ui'
import { installmentOf, simulate } from '../lib/engine'
import { yen } from '../lib/format'
import { update, useDB } from '../lib/store'
import type { DB, PaceMode } from '../lib/types'
import { addMonths, monthNum, ymLabel, ymOf } from '../lib/ym'

function breakEvenWith(db: DB, today: string, mode: PaceMode, amount?: number) {
  const d = structuredClone(db)
  d.settings.pace = { mode, amount: amount ?? d.settings.pace.amount }
  return simulate(d, today).breakEven
}

export function Recovery() {
  const db = useDB()
  const today = ymOf(new Date())
  const plan = useMemo(() => simulate(db, today), [db, today])
  const months = Array.from({ length: 8 }, (_, i) => addMonths(today, i - 1))
  const rows = months.map(m => plan.rows.find(r => r.month === m)).filter(Boolean) as typeof plan.rows
  const nowRow = plan.rows.find(r => r.month === today)!
  // 目盛りは前借りと準備の大きさに合わせる（繰り越しが増えても前借りが見えるように）
  const max = Math.max(10000, ...rows.map(r => (r.balanceEnd < 0 || r.alloc.fix > 0 ? Math.abs(r.balanceEnd) : 0)))
  const H = 45 // 0線から上下の最大の高さ
  const pace = db.settings.pace
  const alt = useMemo(() => ({
    full: breakEvenWith(db, today, 'full'),
    half: breakEvenWith(db, today, 'half'),
    custom: breakEvenWith(db, today, 'custom'),
  }), [db, today])
  const lab = (m?: string) => (m ? ymLabel(m, today) : 'なし')
  const items = db.expenses
    .filter(e => (e.kind === 'split' ? addMonths(e.month, (e.count ?? 1) - 1) >= today : e.month >= addMonths(today, -2)))
    .sort((a, b) => a.month.localeCompare(b.month))
  const del = (id: string) => { if (confirm('この出費を削除しますか？')) update(d => { d.expenses = d.expenses.filter(e => e.id !== id) }) }

  return (
    <div class="body nonav">
      <div class="hdr"><div><HomeBack /><div class="ov" style="margin-top:12px">Recovery plan</div><h1>取り戻しプラン</h1></div></div>
      <div class="card">
        <div class="ov">Break-even · プラマイゼロ</div>
        <div class="row" style="align-items:flex-end;margin-top:8px">
          <div class="fig" style="font-size:48px;line-height:.95">{plan.breakEven ? <>{monthNum(plan.breakEven)}<span style="font-size:20px;margin-left:2px">月</span></> : <span style="font-size:26px">前借りなし</span>}</div>
          <div style="text-align:right"><div class="t11">いまの残高</div><div class={`fig md ${nowRow.balanceEnd < 0 ? 'c-neg' : 'c-ok'}`}>{yen(nowRow.balanceEnd)}</div></div>
        </div>
        <svg class="chart" viewBox="0 0 300 150" width="100%" style="margin-top:14px;overflow:visible" role="img" aria-label="自由枠の累計の推移">
          <g stroke="var(--line)" stroke-dasharray="2 3"><line x1="0" y1="27" x2="300" y2="27" /><line x1="0" y1="117" x2="300" y2="117" /></g>
          <line x1="0" y1="72" x2="300" y2="72" stroke="var(--ink)" />
          <text x="0" y="68" style="fill:var(--ink)">0</text>
          <text x="0" y="23">+{Math.round(max / 1000)}k</text><text x="300" y="113" text-anchor="end">−{Math.round(max / 1000)}k</text>
          <g class="bars">
            {rows.map((r, i) => {
              const h = Math.max(3, Math.min(H, (Math.abs(r.balanceEnd) / max) * H))
              const neg = r.balanceEnd < 0
              const color = neg ? 'var(--neg)' : r.alloc.fix > 0 ? 'var(--fixc)' : 'var(--ok)'
              return <rect class={neg ? 'dn' : 'up'} x={20 + i * 35} y={neg ? 72 : 72 - h} width="26" height={h} rx="4" fill={color} style={`animation-delay:${i * 0.05}s`} />
            })}
          </g>
          <g text-anchor="middle">{rows.map((r, i) => <text x={33 + i * 35} y="140" style={r.month === today ? 'fill:var(--ink)' : r.month === plan.breakEven ? 'fill:var(--ok)' : ''}>{String(monthNum(r.month)).padStart(2, '0')}</text>)}</g>
        </svg>
        <div class="mkey"><span><i style="background:var(--neg)" />前借り</span><span><i style="background:var(--fixc)" />日程固定の準備</span><span><i style="background:var(--ok)" />回復</span></div>
      </div>

      <Field label={`取り戻すペース（「必要」の積立 ${yen(db.settings.needDuringRecovery)} を除く）`}>
        <Seg<PaceMode> value={pace.mode} onChange={v => update(d => { d.settings.pace.mode = v })} options={[
          { v: 'full', label: '全額', sub: lab(alt.full) },
          { v: 'half', label: '半分', sub: lab(alt.half) },
          { v: 'custom', label: '金額指定', sub: `${yen(pace.amount)} · ${lab(alt.custom)}` },
        ]} />
      </Field>
      {pace.mode === 'custom' && <Field label="毎月取り戻しに回す額"><Money value={pace.amount} onChange={n => update(d => { d.settings.pace.amount = n })} /></Field>}

      {items.length > 0 ? (
        <div class="card" style="padding:4px 16px">
          {items.map(e => (
            <div class="mi" style="padding:14px 0">
              <span class={`ic ${e.kind === 'spent' ? 'ic-n' : e.kind === 'fixed' ? 'ic-w' : 'ic-k'}`}><Icon n={e.kind === 'spent' ? 'bolt' : e.kind === 'fixed' ? 'cal' : 'split'} /></span>
              <div style="flex:1;min-width:0">
                <div class="row"><b>{e.name} · {ymLabel(e.month, today)}</b><span class={`fig ${e.kind === 'spent' ? 'c-neg' : ''}`} style="font-size:15px">{e.kind === 'split' ? `${yen(installmentOf(e))}/月` : yen(e.kind === 'spent' ? -e.amount : e.amount)}</span></div>
                <small>{e.kind === 'spent' ? 'もう使った · 前借りとして記録' : e.kind === 'fixed' ? '日程固定 · それまでに準備' : `分割 ${e.count}回 · ${ymLabel(addMonths(e.month, (e.count ?? 1) - 1), today)}まで`}</small>
              </div>
              <button aria-label="削除" onClick={() => del(e.id)}><Icon n="trash" class="chev" /></button>
            </div>
          ))}
        </div>
      ) : <div class="empty">大きな出費の登録はまだありません。</div>}

      <div class="btns">
        <button class="btn b-s" onClick={() => openSheet('menu')}><Icon n="plus" />出費を登録</button>
        <button class="btn b-s" onClick={() => openSheet('income')}><Icon n="coin" class="c-ok" />臨時収入</button>
      </div>
      <div class="note n-blue"><Icon n="lock" /><span>取り戻し中も「必要」の積立は続け、「欲しい」「憧れ」だけ一時停止します。先取りの貯金・NISAには触れません。</span></div>
    </div>
  )
}
