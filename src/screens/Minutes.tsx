import { useState } from 'preact/hooks'
import { Avatar, ChairCard } from '../components/council'
import { Back, Field, Icon, Seg, Text, go, toast } from '../components/ui'
import { MEMBERS, STANCES, VERDICTS, type CouncilResult, type Verdict } from '../lib/council'
import { yen } from '../lib/format'
import { update, useDB } from '../lib/store'
import { ymLabel, ymOf } from '../lib/ym'

export function MinutesScreen() {
  const db = useDB()
  const month = new URLSearchParams(location.hash.split('?')[1] ?? '').get('m') ?? ymOf(new Date())
  const mins = db.minutes.find(m => m.month === month)
  const r = mins?.raw as CouncilResult | undefined
  const [dv, setDv] = useState<Verdict>((mins?.decision?.split('：')[0] as Verdict) ?? r?.chair.verdict ?? '現状維持')
  const [memo, setMemo] = useState(mins?.decision?.split('：').slice(1).join('：') ?? '')
  const val = db.valuations.find(v => v.month === month)

  if (!mins || !r) {
    return <div class="body nonav"><Back to="/review" label="振り返り" /><div class="empty">この月の議事録はありません。</div></div>
  }
  const save = () => {
    update(d => { const m = d.minutes.find(x => x.month === month)!; m.decision = memo ? `${dv}：${memo}` : dv })
    toast('本人の決定を記録しました')
  }

  return (
    <div class="body nonav">
      <div class="hdr"><div><Back to="/review" label="振り返り" /><div class="ov" style="margin-top:12px">Minutes · {month.replace('-', '.')} {mins.quarterly ? '四半期の全体会議' : '月次点検'}</div><h1>委員会の議事録</h1></div></div>
      {val && <div class="note n-blue"><Icon n="people" /><span><b>議題</b>　評価額 {yen(val.value)} ／ 運用損益 {yen(val.value - val.invested, true)}</span></div>}
      <div class="card">
        {r.members.map(o => {
          const m = MEMBERS.find(x => x.id === o.id)!
          return (
            <div class="member">
              <Avatar id={o.id} size={46} />
              <div style="min-width:0">
                <div class="who"><b>{m.name}</b><small>{m.role}</small><span class={`pill ${STANCES[o.stance].cls}`}>{STANCES[o.stance].label}</span></div>
                <div class="claim">{o.claim}</div>
                <div class="why">{o.reason}</div>
              </div>
            </div>
          )
        })}
      </div>
      <ChairCard r={r} full />
      <div class="t11" style="padding:0 4px">委員会の発言は、個人のAIの回答を表示したものです。判断材料であり、売買の指示ではありません。決めるのは本人です。</div>

      <div class="sec">Decision · 本人の決定</div>
      <Field label="決めたこと"><Seg value={dv} onChange={setDv} options={VERDICTS.map(v => ({ v, label: v }))} /></Field>
      <Field label="メモ（任意）"><Text value={memo} onChange={setMemo} placeholder="例：積立はそのまま。来月も同じ金額で" /></Field>
      <button class="btn b-p" onClick={save}><Icon n="check" />{mins.decision ? '決定を更新する' : '本人の決定を記録'}</button>
      {mins.decision && <div class="t11" style="padding:0 4px">記録済み：{mins.decision}（次回の相談文に「前回の私の決定」として入ります）</div>}
      <button class="btn b-danger" onClick={() => {
        if (!confirm(`${ymLabel(month)}の議事録を削除しますか？`)) return
        update(d => { d.minutes = d.minutes.filter(x => x.month !== month) }); go('/review')
      }}><Icon n="trash" />この議事録を削除</button>
    </div>
  )
}
