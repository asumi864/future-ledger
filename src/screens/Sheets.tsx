import { useMemo, useState } from 'preact/hooks'
import { Field, Icon, Money, MonthInput, PRIORITY_LABEL, Seg, Sheet, Text, Toggle, closeSheet, go, openSheet, toast, useUI } from '../components/ui'
import { uid } from '../lib/defaults'
import { installmentOf, simulate, sortWishes } from '../lib/engine'
import { yen } from '../lib/format'
import { getDB, update, useDB } from '../lib/store'
import type { BigExpense, ExpenseKind, Income, Priority, Wish } from '../lib/types'
import { addMonths, ymLabel, ymOf } from '../lib/ym'
import { PARTS, partValue } from './Home'

export function Sheets() {
  const { sheet, toastMsg } = useUI()
  return (
    <>
      {sheet?.name === 'menu' && <Menu />}
      {sheet?.name === 'wish' && <WishForm id={sheet.props?.id as string | undefined} />}
      {sheet?.name === 'expense' && <ExpenseForm kind={(sheet.props?.kind as ExpenseKind) ?? 'spent'} />}
      {sheet?.name === 'income' && <IncomeForm />}
      {sheet?.name === 'month' && <MonthDetail month={sheet.props!.month as string} />}
      {toastMsg && <div class="toast" role="status">{toastMsg}</div>}
    </>
  )
}

function Menu() {
  const it = (ic: string, cls: string, t: string, s: string, f: () => void) => (
    <button class="mi" style="text-align:left" onClick={f}><span class={`ic ${cls}`}><Icon n={ic} /></span><div style="flex:1"><b>{t}</b><small>{s}</small></div><Icon n="chev" class="chev" /></button>
  )
  return (
    <Sheet title="何を記録しますか？">
      <div>{it('plus', 'ic-b', 'ほしいもの', 'いつ買えるかを計算して予約', () => openSheet('wish'))}</div>
      <div class="grp">Big expense · 大きな出費</div>
      <div>
        {it('cal', 'ic-w', '日程が決まっている', '旅行・結婚式など、時期をずらせない', () => openSheet('expense', { kind: 'fixed' }))}
        {it('bolt', 'ic-n', 'もう使った', '飲み会・急な出費。前借りとして記録', () => openSheet('expense', { kind: 'spent' }))}
        {it('split', 'ic-k', '分割で買う', 'カメラ・機材。毎月の固定の支払いに', () => openSheet('expense', { kind: 'split' }))}
      </div>
      <div class="grp">Income · 入ってきたお金</div>
      <div>{it('coin', 'ic-o', '臨時収入', 'ボーナス・副業など。取り戻しに優先して回す', () => openSheet('income'))}</div>
    </Sheet>
  )
}

function WishForm({ id }: { id?: string }) {
  const db = useDB()
  const today = ymOf(new Date())
  const orig = id ? db.wishes.find(w => w.id === id) : undefined
  const [name, setName] = useState(orig?.name ?? '')
  const [price, setPrice] = useState(orig?.price ?? 0)
  const [priority, setPriority] = useState<Priority>(orig?.priority ?? 'want')
  const [hope, setHope] = useState(orig?.hope ?? '')
  const [memo, setMemo] = useState(orig?.memo ?? '')
  const [buying, setBuying] = useState(false)
  const [boughtPrice, setBoughtPrice] = useState(orig?.price ?? 0)

  const nextOrder = (p: Priority) => Math.max(-1, ...getDB().wishes.filter(w => w.priority === p).map(w => w.order)) + 1
  const draft: Wish = orig
    ? { ...orig, name, price, priority, hope: hope || undefined, memo: memo || undefined, order: orig.priority === priority ? orig.order : nextOrder(priority) }
    : { id: 'draft', name, price, priority, hope: hope || undefined, memo: memo || undefined, order: nextOrder(priority), createdAt: Date.now() }
  const preview = useMemo(() => {
    if (!price || !name) return null
    const d = structuredClone(db)
    d.wishes = [...d.wishes.filter(w => w.id !== draft.id), draft]
    return simulate(d, today).wishes[draft.id]
  }, [db, name, price, priority, hope])

  const save = () => {
    update(d => {
      if (orig) d.wishes = d.wishes.map(w => (w.id === orig.id ? draft : w))
      else d.wishes.push({ ...draft, id: uid() })
    })
    toast(orig ? '更新しました' : '予約しました')
    closeSheet()
  }
  const move = (dir: -1 | 1) => update(d => {
    const same = sortWishes(d.wishes.filter(w => w.priority === orig!.priority && !w.boughtMonth))
    const i = same.findIndex(w => w.id === orig!.id)
    const j = i + dir
    if (j < 0 || j >= same.length) return
    const a = d.wishes.find(w => w.id === same[i].id)!, b = d.wishes.find(w => w.id === same[j].id)!
    const t = a.order; a.order = b.order; b.order = t
    if (a.order === b.order) a.order += dir
  })

  if (buying && orig) {
    return (
      <Sheet title={`${orig.name}を買った`}>
        <Field label="実際に払った額"><Money value={boughtPrice} onChange={setBoughtPrice} autoFocus /></Field>
        <div class="note n-blue"><Icon n="info" /><span>積立が足りない分は前借りとして記録されます。月の締めでは、この支払いをMEの支出合計から自動で除きます。</span></div>
        <button class="btn b-p" disabled={!boughtPrice} onClick={() => {
          update(d => { const w = d.wishes.find(x => x.id === orig.id)!; w.boughtMonth = today; w.boughtPrice = boughtPrice })
          toast('購入を記録しました'); closeSheet()
        }}><Icon n="check" />購入を記録する</button>
      </Sheet>
    )
  }

  return (
    <Sheet title={orig ? 'ほしいものを編集' : 'ほしいものを追加'}>
      <Field label="名前"><Text value={name} onChange={setName} placeholder="例：本棚" /></Field>
      <Field label="金額"><Money value={price} onChange={setPrice} /></Field>
      <Field label="優先度"><Seg<Priority> value={priority} onChange={setPriority} options={(['need', 'want', 'dream'] as const).map(v => ({ v, label: PRIORITY_LABEL[v] }))} /></Field>
      <Field label="いつ頃ほしい？（任意）"><MonthInput value={hope} onChange={setHope} /></Field>
      <Field label="メモ・URL（任意）"><Text value={memo} onChange={setMemo} placeholder="例：幅80cmまで" /></Field>
      {preview && !orig?.boughtMonth && (
        <div class="preview">
          <div class="ov" style="color:var(--blue)">Estimate · この条件だと</div>
          <div class="row" style="margin-top:8px"><span class="fig lg c-blue">{preview.eta ? `${ymLabel(preview.eta, today)}頃` : '3年以上先'}</span></div>
          {preview.shortfallAtHope && <div class="t11" style="margin-top:4px;color:var(--warn)">希望の{ymLabel(hope, today)}には {yen(preview.shortfallAtHope)} 足りません。優先度か並び順を上げると早まります。</div>}
        </div>
      )}
      <button class="btn b-p" disabled={!name || !price} onClick={save}>{orig ? '保存する' : '予約する'}</button>
      {orig && !orig.boughtMonth && (
        <>
          <div class="btns">
            <button class="btn b-s" onClick={() => move(-1)}>順番を上げる</button>
            <button class="btn b-s" onClick={() => move(1)}>順番を下げる</button>
          </div>
          <button class="btn b-s" onClick={() => setBuying(true)}><Icon n="bag" />買った</button>
        </>
      )}
      {orig && <button class="btn b-danger" onClick={() => { if (confirm(`「${orig.name}」を削除しますか？`)) { update(d => { d.wishes = d.wishes.filter(w => w.id !== orig.id) }); closeSheet() } }}><Icon n="trash" />削除</button>}
    </Sheet>
  )
}

function ExpenseForm({ kind: k0 }: { kind: ExpenseKind }) {
  const today = ymOf(new Date())
  const db = useDB()
  const [kind, setKind] = useState<ExpenseKind>(k0)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(0)
  const [month, setMonth] = useState(kind === 'split' ? addMonths(today, 1) : today)
  const [count, setCount] = useState(24)
  const [fee, setFee] = useState(0)
  const draft: BigExpense = { id: uid(), kind, name, amount, month, count: kind === 'split' ? count : undefined, fee: kind === 'split' ? fee : undefined, createdAt: Date.now() }
  const per = kind === 'split' ? installmentOf(draft) : 0
  const free = simulate(db, today).forecastFree
  const types: [ExpenseKind, string, string, string, string][] = [
    ['fixed', 'cal', 'ic-w', '日程が\n決まっている', '旅行・結婚式'],
    ['spent', 'bolt', 'ic-n', 'もう\n使った', '飲み会・急な出費'],
    ['split', 'split', 'ic-k', '分割で\n買う', 'カメラ・機材'],
  ]
  const save = () => {
    update(d => { d.expenses.push(draft) })
    closeSheet(); go('/recovery'); toast('登録しました')
  }
  return (
    <Sheet title="大きな出費">
      <div class="types">
        {types.map(([v, ic, cls, t, s]) => (
          <button class={kind === v ? 'on' : ''} onClick={() => { setKind(v); if (v === 'split' && month === today) setMonth(addMonths(today, 1)) }}>
            <span class={`ic ${kind === v ? '' : cls}`} style={kind === v ? 'background:#fff;color:var(--blue)' : ''}><Icon n={ic} /></span>
            <b style="white-space:pre-line">{t}</b><small>{s}</small>
          </button>
        ))}
      </div>
      <Field label="名前"><Text value={name} onChange={setName} placeholder={kind === 'fixed' ? '例：京都旅行' : kind === 'spent' ? '例：飲み会' : '例：ミラーレスカメラ'} /></Field>
      <Field label={kind === 'split' ? '本体価格' : '金額'}><Money value={amount} onChange={setAmount} /></Field>
      {kind === 'split' && (
        <div class="row" style="gap:8px;align-items:stretch">
          <div style="flex:1"><Field label="回数"><div class="inp"><input inputMode="numeric" value={count} onInput={e => setCount(Math.max(1, Number((e.target as HTMLInputElement).value.replace(/\D/g, '')) || 1))} /><span class="suf">回</span></div></Field></div>
          <div style="flex:1.3"><Field label="分割手数料（合計）"><Money value={fee} onChange={setFee} /></Field></div>
        </div>
      )}
      <Field label={kind === 'fixed' ? '支払う月' : kind === 'spent' ? '使った月' : '初回の引き落とし月'}><MonthInput value={month} onChange={setMonth} /></Field>
      {kind === 'split' && amount > 0 && (
        <div class="preview">
          <div class="ov" style="color:var(--blue)">Fixed commitment · 毎月の固定の支払い</div>
          <div class="fig lg" style="margin:8px 0 2px">{yen(per)} <span style="font-size:15px;color:var(--sub)">× {count}回</span></div>
          <div class="t11">{month.replace('-', '.')} — {addMonths(month, count - 1).replace('-', '.')}{fee > 0 ? ` · 支払い総額 ${yen(amount + fee)}` : ''}</div>
          <div class="row t12" style="color:var(--ink-2);margin-top:10px"><span>その間の自由枠</span><span class="fig" style="font-size:14px"><span class="c-sub">{yen(free)} →</span> {yen(free - per)}</span></div>
          <div class="row t12" style="color:var(--ink-2)"><span>先に貯めて一括で買うなら</span><span class="fig" style="font-size:14px">約{Math.ceil(amount / Math.max(1, free))}か月後</span></div>
        </div>
      )}
      {kind === 'split' && per > free && <div class="note n-warn"><Icon n="warn" /><span>月額が自由枠を超えています。このままだと毎月前借りが増えます。貯金のペースを下げるかどうかは、設定でご自身で決めてください。</span></div>}
      <button class="btn b-p" disabled={!name || !amount} onClick={save}>登録して取り戻しプランを見る<Icon n="chev" /></button>
    </Sheet>
  )
}

function IncomeForm() {
  const today = ymOf(new Date())
  const db = useDB()
  const [kind, setKind] = useState<Income['kind']>('bonus')
  const [amount, setAmount] = useState(0)
  const [month, setMonth] = useState(today)
  const [toRecovery, setToRecovery] = useState(true)
  const draft: Income = { id: uid(), kind, amount, month, toRecovery, createdAt: Date.now() }
  const before = useMemo(() => simulate(db, today).breakEven, [db])
  const after = useMemo(() => { const d = structuredClone(db); d.incomes.push(draft); return simulate(d, today).breakEven }, [db, amount, month, toRecovery])
  return (
    <Sheet title="臨時収入を記録">
      <Field label="種類"><Seg value={kind} onChange={setKind} options={[{ v: 'bonus', label: 'ボーナス' }, { v: 'side', label: '副業' }, { v: 'other', label: 'その他' }]} /></Field>
      <div class="row" style="gap:8px;align-items:stretch">
        <div style="flex:1"><Field label="手取り額"><Money value={amount} onChange={setAmount} autoFocus /></Field></div>
        <div style="flex:1"><Field label="入金月"><MonthInput value={month} onChange={setMonth} /></Field></div>
      </div>
      <div class="lst" style="box-shadow:none"><div class="it">取り戻しに優先して回す<span class="v"><Toggle on={toRecovery} onChange={setToRecovery} label="取り戻しに優先" /></span></div></div>
      {amount > 0 && before && (
        <div class="preview">
          <div class="ov" style="color:var(--blue)">Break-even · プラマイゼロ</div>
          <div class="row" style="margin-top:8px;justify-content:flex-start;gap:12px">
            <span class="fig lg c-sub" style={after !== before ? 'text-decoration:line-through' : ''}>{ymLabel(before, today)}</span>
            {after !== before && <><Icon n="chev" class="c-blue" /><span class="fig lg c-blue">{after ? ymLabel(after, today) : '前借りなし'}</span></>}
          </div>
        </div>
      )}
      <div class="t11">副業の収入は、税金の分を引いた手取りで入力してください。</div>
      <button class="btn b-p" disabled={!amount} onClick={() => { update(d => { d.incomes.push(draft) }); toast('記録しました'); closeSheet() }}>記録する</button>
    </Sheet>
  )
}

function MonthDetail({ month }: { month: string }) {
  const db = useDB()
  const today = ymOf(new Date())
  const r = simulate(db, today).rows.find(x => x.month === month)!
  const parts = PARTS.map(p => ({ ...p, v: partValue(r, p.k) })).filter(p => p.v > 0)
  const fixed = db.expenses.filter(e => e.kind === 'fixed' && e.month === month)
  return (
    <Sheet title={`${ymLabel(month, today)}の内訳`}>
      <div class="row"><span class="t12">自由枠（{r.closed ? '実績' : '見込み'}）</span><span class="fig md">{yen(r.free)}</span></div>
      <div class="card" style="box-shadow:none">
        {parts.length ? parts.map(p => <div class="lg-row"><span><span class="dot" style={`background:${p.color}`} />{p.label}</span><span class="fig">{yen(p.v)}</span></div>) : <div class="t12">割り振りはありません</div>}
      </div>
      {(r.purchases.length > 0 || fixed.length > 0) && (
        <div class="wl">
          {fixed.map(e => <div class="wi"><span class="pill p-warn">日程固定</span><div class="tx"><b>{e.name}</b></div><span class="fig">{yen(e.amount)}</span></div>)}
          {r.purchases.map(p => <div class="wi"><span class={`pill p-${p.priority}`}>{PRIORITY_LABEL[p.priority]}</span><div class="tx"><b>{p.name}</b><small>この月に届く見込み</small></div><span class="fig">{yen(p.price)}</span></div>)}
        </div>
      )}
      <div class="row t11"><span>月末の累計（前借りを含む）</span><span class={`fig ${r.balanceEnd < 0 ? 'c-neg' : ''}`}>{yen(r.balanceEnd)}</span></div>
    </Sheet>
  )
}
