import { useState } from 'preact/hooks'
import { Field, Icon, Money, MonthInput, Sheet, Toggle, closeSheet, go, toast } from '../components/ui'
import { parseCouncil } from '../lib/council'
import { yen } from '../lib/format'
import { getDB, update, useDB } from '../lib/store'
import { ymOf } from '../lib/ym'

export function ValuationSheet() {
  const db = useDB()
  const [month, setMonth] = useState(ymOf(new Date()))
  const find = (m: string) => db.valuations.find(v => v.month === m)
  const prev = [...db.valuations].filter(v => v.month < month && !v.noPurchase).sort((a, b) => b.month.localeCompare(a.month))[0]
  const [value, setValue] = useState(find(month)?.value ?? 0)
  const [invested, setInvested] = useState(find(month)?.invested ?? (prev ? prev.invested + db.settings.nisa : 0))
  const [noPurchase, setNoPurchase] = useState(find(month)?.noPurchase ?? !prev)
  return (
    <Sheet title="評価額を入力">
      <Field label="月"><MonthInput value={month} onChange={m => { setMonth(m); setValue(find(m)?.value ?? 0); setInvested(find(m)?.invested ?? 0); setNoPurchase(find(m)?.noPurchase ?? false) }} /></Field>
      <div class="lst" style="box-shadow:none"><div class="it"><span style="flex:1">まだ買付前<span class="t11" style="display:block">初回の買付が成立していない月はオンに。今月の委員会は不要になります</span></span><Toggle on={noPurchase} onChange={setNoPurchase} label="まだ買付前" /></div></div>
      {!noPurchase && <Field label="評価額（iGrow「資産」→「保有商品」の時価評価額）"><Money value={value} onChange={setValue} autoFocus /></Field>}
      {!noPurchase && <Field label="累計の買付額（これまでに入れたお金）"><Money value={invested} onChange={setInvested} /></Field>}
      {!noPurchase && prev && <div class="t11">前回（{prev.month.replace('-', '.')}）の累計買付 {yen(prev.invested)} に、毎月の積立 {yen(db.settings.nisa)} を足した額を入れています。実際の額に直してください。</div>}
      <button class="btn b-p" disabled={!noPurchase && (!value || !invested)} onClick={() => {
        update(d => {
          d.valuations = d.valuations.filter(v => v.month !== month)
          d.valuations.push(noPurchase ? { month, value: 0, invested: 0, enteredAt: Date.now(), noPurchase: true } : { month, value, invested, enteredAt: Date.now() })
        })
        toast(noPurchase ? '今月は買付前として記録しました' : '評価額を保存しました'); closeSheet()
      }}><Icon n="check" />保存する</button>
    </Sheet>
  )
}

export function PasteSheet({ quarterly }: { quarterly: boolean }) {
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const month = ymOf(new Date())
  const save = () => {
    try {
      const r = parseCouncil(text)
      const exists = getDB().minutes.some(m => m.month === month)
      if (exists && !confirm('今月の議事録を、この回答で置き換えますか？')) return
      update(d => { d.minutes = d.minutes.filter(m => m.month !== month); d.minutes.push({ month, raw: r, savedAt: Date.now(), quarterly }) })
      closeSheet(); toast('議事録を保存しました'); go(`/minutes?m=${month}`)
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  return (
    <Sheet title="AIの回答を貼り付け">
      <textarea class="paste" placeholder="AIの回答をそのまま貼り付けてください（```json から始まる部分を含めて）" value={text}
        onInput={e => { setText((e.target as HTMLTextAreaElement).value); setErr('') }} />
      {err && <div class="note n-neg"><Icon n="warn" /><span>{err}</span></div>}
      <button class="btn b-p" disabled={!text.trim()} onClick={save}><Icon n="check" />議事録として保存</button>
    </Sheet>
  )
}

/** クリップボードが使えない環境向け：相談文を表示して手でコピーしてもらう */
export function PromptSheet({ text }: { text: string }) {
  return (
    <Sheet title="相談文">
      <div class="t11">自動でコピーできませんでした。下の文を長押しして全選択し、コピーしてください。</div>
      <textarea class="paste" readOnly value={text} onFocus={e => (e.target as HTMLTextAreaElement).select()} style="min-height:320px" />
    </Sheet>
  )
}
