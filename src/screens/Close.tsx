import { useState } from 'preact/hooks'
import { HomeBack, Field, Icon, Money, MonthInput, Seg, go, toast } from '../components/ui'
import { actualFree, forecastFree, registeredIn } from '../lib/engine'
import { yen } from '../lib/format'
import { update, useDB } from '../lib/store'
import type { Close as CloseT, SurplusTo } from '../lib/types'
import { addMonths, ymLabel, ymOf } from '../lib/ym'

export function Close() {
  const db = useDB()
  const [month, setMonth] = useState(addMonths(ymOf(new Date()), -1))
  const existing = db.closes.find(c => c.month === month)
  const [takeHome, setTakeHome] = useState(existing?.takeHome ?? 0)
  const [spend, setSpend] = useState(existing?.spendTotal ?? 0)
  const [to, setTo] = useState<SurplusTo>(existing?.surplusTo ?? 'recovery')
  const s = db.settings

  const reg = registeredIn(db, month)
  const draft: CloseT = { month, takeHome, spendTotal: spend, surplusTo: to, closedAt: Date.now() }
  const free = actualFree(db, draft)
  const planned = forecastFree(db, month)
  const diff = free - planned
  const ready = takeHome > 0 && spend > 0
  const regItems = [
    ...db.expenses.filter(e => (e.kind === 'spent' || e.kind === 'fixed') && e.month === month).map(e => e.name),
    ...db.wishes.filter(w => w.boughtMonth === month).map(w => w.name),
    ...db.expenses.filter(e => e.kind === 'split').filter(e => registeredIn({ ...db, expenses: [e], wishes: [] }, month) > 0).map(e => `${e.name}（分割）`),
  ]

  const save = () => {
    update(d => {
      d.closes = d.closes.filter(c => c.month !== month)
      d.closes.push(draft)
    })
    toast(`${ymLabel(month)}の締めを保存しました`)
    go('/')
  }

  return (
    <div class="body nonav">
      <div class="hdr"><div><HomeBack /><div class="ov" style="margin-top:12px">Monthly close</div><h1>{ymLabel(month)}の締め</h1></div><span class="t11">約3分</span></div>
      <Field label="締める月（支出があった月）"><MonthInput value={month} onChange={m => {
        setMonth(m)
        const c = db.closes.find(x => x.month === m)
        setTakeHome(c?.takeHome ?? 0); setSpend(c?.spendTotal ?? 0); setTo(c?.surplusTo ?? 'recovery')
      }} /></Field>
      <Field label="その月の手取り給与（振り込まれた額）"><Money value={takeHome} onChange={setTakeHome} hint="給与明細の差引支給額" /></Field>
      <Field label="その月の支出の合計（マネーフォワード ME）"><Money value={spend} onChange={setSpend} hint="ME › 月次 › 支出" /></Field>
      <div class="note n-blue"><Icon n="info" /><span>
        {reg > 0 ? `アプリに登録済みの ${regItems.join('・')}（計 ${yen(reg)}）は自動で除きます。` : 'この月にアプリへ登録した支出はありません。'}
        MEの支出は使った日で集計されるため、アプリも「使った月」でそろえます。
      </span></div>

      <div class="card ledger">
        <div class="ov" style="margin-bottom:6px">Calculation · 計算</div>
        <div class="ln"><span>手取り給与</span><span class="fig">{yen(takeHome)}</span></div>
        <div class="ln"><span>生活費（{yen(spend)} − 登録済み {yen(reg)}）</span><span class="fig">{yen(-(spend - reg))}</span></div>
        <div class="ln"><span>先取り（貯金・NISA）</span><span class="fig">{yen(-(s.saving + s.nisa))}</span></div>
        <div class="ln tot"><span>実際の自由枠</span><span class={`fig ${free < 0 ? 'c-neg' : ''}`} style="font-size:22px">{ready ? yen(free) : '—'}</span></div>
        {ready && <div class="row" style="margin-top:8px"><span class="t11">見込み {yen(planned)} との差</span><span class={`pill ${diff >= 0 ? 'p-ok' : 'p-neg'}`}>{yen(diff, true)}</span></div>}
      </div>

      {ready && free < 0 && (
        <div class="note n-neg"><Icon n="warn" /><span>今月は先取り（貯金・NISA）が実質的に守れていません。不足の {yen(free)} は前借りとして記録されます。貯金額や積立額を見直すかは、設定で決めてください。</span></div>
      )}
      {ready && diff > 0 && (
        <Field label={`見込みより多かった ${yen(diff)} の行き先`}>
          <Seg value={to} onChange={setTo} options={[
            { v: 'recovery', label: '取り戻しへ', sub: '優先ルール' },
            { v: 'wish', label: 'ほしいもの', sub: '積立へ' },
            { v: 'saving', label: '貯金', sub: '現金目標へ' },
          ]} />
        </Field>
      )}
      {ready && diff < 0 && free >= 0 && (
        <div class="note n-warn"><Icon n="warn" /><span>見込みより {yen(-diff)} 少なかった分、取り戻しやほしいものの積立が遅くなります。購入の目安月は自動で更新されます。</span></div>
      )}
      <button class="btn b-p" disabled={!ready} onClick={save}><Icon n="check" />{existing ? '締めを更新する' : '締めを完了する'}</button>
    </div>
  )
}
