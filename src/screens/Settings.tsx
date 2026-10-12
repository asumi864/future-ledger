import { useState } from 'preact/hooks'
import { Icon, Nav, Seg, go } from '../components/ui'
import { uid } from '../lib/defaults'
import { forecastFree } from '../lib/engine'
import { parseAmount, yen } from '../lib/format'
import { update, useDB } from '../lib/store'
import type { Settings as S } from '../lib/types'

function AmountRow({ label, icon, cls, value, onChange, note }: { label: string; icon: string; cls: string; value: number; onChange: (n: number) => void; note?: string }) {
  return (
    <label class="it">
      <span class={`ic ${cls}`}><Icon n={icon} /></span>
      <span style="flex:1">{label}{note && <span class="t11" style="display:block">{note}</span>}</span>
      <input inputMode="numeric" value={value.toLocaleString('ja-JP')} onInput={e => onChange(parseAmount((e.target as HTMLInputElement).value))} />
    </label>
  )
}

export function Settings() {
  const db = useDB()
  const s = db.settings
  const set = (fn: (s: S) => void) => update(d => fn(d.settings))
  const [hm, setHm] = useState({ month: 1, label: '', amount: 0 })
  const hasClose = db.closes.length > 0

  return (
    <>
      <div class="body">
        <div class="hdr"><div><div class="ov">Settings</div><h1>設定</h1></div></div>

        <div class="sec">Money flow · お金の流れ</div>
        <div class="lst">
          <AmountRow label="自由枠（締めの実績がないとき）" icon="wish" cls="ic-b" value={s.defaultFree} onChange={n => set(x => { x.defaultFree = n })}
            note={hasClose ? `いまの見込み ${yen(forecastFree(db))}（締めの実績から）` : '最初の締めまでの仮の額'} />
          <AmountRow label="現金貯金（先取り）" icon="lock" cls="ic-o" value={s.saving} onChange={n => set(x => { x.saving = n })} />
          <AmountRow label="NISA積立（先取り）" icon="lock" cls="ic-o" value={s.nisa} onChange={n => set(x => { x.nisa = n })} />
          <AmountRow label="現金目標" icon="chart" cls="ic-k" value={s.cashGoal} onChange={n => set(x => { x.cashGoal = n })} />
          <AmountRow label="現金貯金のいまの額" icon="coin" cls="ic-k" value={s.cashNow} onChange={n => set(x => { x.cashNow = n })} note="ホームの進捗表示に使います" />
        </div>
        <div class="fld"><span class="lb">自由枠の見込みの出し方</span>
          <Seg value={s.forecast} onChange={v => set(x => { x.forecast = v })} options={[{ v: 'avg', label: '直近3か月の平均' }, { v: 'min', label: '直近の最低額', sub: '慎重' }]} />
        </div>

        <div class="sec">Recovery · 取り戻しのルール</div>
        <div class="lst">
          <AmountRow label="取り戻し中も「必要」に回す額" icon="wish" cls="ic-k" value={s.needDuringRecovery} onChange={n => set(x => { x.needDuringRecovery = n })} note="0にすると取り戻しを最優先" />
          <button class="it" onClick={() => go('/recovery')}>標準のペース<span class="v">{s.pace.mode === 'full' ? '全額' : s.pace.mode === 'half' ? '半分' : `金額指定 ${yen(s.pace.amount)}`}</span><Icon n="chev" class="chev" /></button>
        </div>

        <div class="sec">Heavy months · 出費が重なる月</div>
        <div class="lst">
          {[...s.heavy].sort((a, b) => a.month - b.month).map(h => (
            <div class="it">
              <span class="fig" style="width:30px;color:var(--faint);font-size:13px">{String(h.month).padStart(2, '0')}</span>{h.label}
              <span class="v">{yen(-h.amount)}</span>
              <button aria-label="削除" onClick={() => set(x => { x.heavy = x.heavy.filter(y => y.id !== h.id) })}><Icon n="trash" class="chev" /></button>
            </div>
          ))}
          <div class="it" style="gap:8px">
            <select value={hm.month} onChange={e => setHm({ ...hm, month: Number((e.target as HTMLSelectElement).value) })} style="border:0;background:var(--line-2);border-radius:10px;padding:8px">
              {Array.from({ length: 12 }, (_, i) => <option value={i + 1}>{i + 1}月</option>)}
            </select>
            <input placeholder="例：年払い" value={hm.label} onInput={e => setHm({ ...hm, label: (e.target as HTMLInputElement).value })} style="flex:1;width:auto;text-align:left;font:500 13px var(--jp)" />
            <input inputMode="numeric" placeholder="金額" value={hm.amount ? hm.amount.toLocaleString('ja-JP') : ''} onInput={e => setHm({ ...hm, amount: parseAmount((e.target as HTMLInputElement).value) })} style="width:90px" />
            <button class="ic ic-b" aria-label="追加" disabled={!hm.label || !hm.amount} onClick={() => { set(x => { x.heavy.push({ id: uid(), ...hm }) }); setHm({ month: 1, label: '', amount: 0 }) }}><Icon n="plus" /></button>
          </div>
        </div>

        <div class="sec">Other</div>
        <div class="lst">
          <button class="it" onClick={() => go('/data')}><span class="ic ic-k"><Icon n="down" /></span>データとカレンダー<span class="v" /><Icon n="chev" class="chev" /></button>
          <div class="it"><span class="ic ic-k"><Icon n="clock" /></span>計算の開始月<span class="v"><input type="month" value={s.startMonth} onInput={e => set(x => { x.startMonth = (e.target as HTMLInputElement).value || x.startMonth })} style="width:140px" /></span></div>
        </div>
        <div class="t11" style="padding:0 4px">変更はすぐに端末へ保存され、購入の目安月や取り戻しプランに反映されます。</div>
      </div>
      <Nav active="/settings" />
    </>
  )
}
