import { useMemo } from 'preact/hooks'
import { Icon, Nav, go, openSheet } from '../components/ui'
import { actualFree, simulate, type MonthRow } from '../lib/engine'
import { yen } from '../lib/format'
import { useDB } from '../lib/store'
import type { DB, YM } from '../lib/types'
import { addMonths, monthNum, ymLabel, ymOf } from '../lib/ym'

export const PARTS: { k: keyof MonthRow['alloc'] | 'inst' | 'heavy'; label: string; color: string }[] = [
  { k: 'inst', label: '分割の支払い', color: 'var(--ink-2)' },
  { k: 'heavy', label: '出費が重なる月', color: 'var(--faint)' },
  { k: 'rec', label: '取り戻し', color: 'var(--neg)' },
  { k: 'fix', label: '日程固定の準備', color: 'var(--fixc)' },
  { k: 'need', label: '「必要」の積立', color: 'var(--ink)' },
  { k: 'want', label: '「欲しい」の積立', color: 'var(--blue)' },
  { k: 'dream', label: '「憧れ」の積立', color: 'var(--blue-3)' },
  { k: 'carry', label: '残り（繰り越し）', color: '#DDE3EC' },
]

export function partValue(r: MonthRow, k: (typeof PARTS)[number]['k']): number {
  if (k === 'inst') return r.installments
  if (k === 'heavy') return r.heavy
  return r.alloc[k]
}

interface Task { key: string; title: string; sub: string; due: string; done: boolean; doneAt?: string; to: string }

function tasks(db: DB, today: YM): Task[] {
  const prev = addMonths(today, -1)
  const m = monthNum(today)
  const close = db.closes.find(c => c.month === prev)
  const val = db.valuations.find(v => v.month === today)
  const mins = db.minutes.find(x => x.month === today)
  const verdict = (mins?.raw as { chair?: { verdict?: string } } | undefined)?.chair?.verdict
  const reviewed = db.routines[today]?.reviewed
  const exported = db.lastExport && ymOf(new Date(db.lastExport)) === today
  const d = (ts?: number) => (ts ? `${new Date(ts).getMonth() + 1}/${String(new Date(ts).getDate()).padStart(2, '0')} 済` : '')
  return [
    { key: 'close', title: `${ymLabel(prev)}の締め`, sub: close ? `自由枠 ${yen(actualFree(db, close))}` : '手取りとMEの支出合計を入力', due: `〜${m}/03`, done: !!close, doneAt: d(close?.closedAt), to: '/close' },
    { key: 'val', title: '評価額を入れて委員会へ', sub: mins ? `結論：${verdict ?? '記録済み'}` : val?.noPurchase ? 'まだ買付前のため今月は不要' : val ? '評価額は入力済み → 相談文をコピー' : '楽天証券の評価額を入力', due: `〜${m}/05`, done: !!mins || !!val?.noPurchase, doneAt: d(mins?.savedAt ?? (val?.noPurchase ? val.enteredAt : undefined)), to: '/review' },
    { key: 'rev', title: 'ほしいものの見直し', sub: '購入の目安月と優先度', due: `〜${m}/07`, done: !!reviewed, doneAt: d(reviewed), to: '/wishes' },
    { key: 'exp', title: 'データを書き出す', sub: '個人のDriveへ保存', due: `〜${m}/07`, done: !!exported, doneAt: d(db.lastExport), to: '/data' },
  ]
}

export function Home() {
  const db = useDB()
  const today = ymOf(new Date())
  const plan = useMemo(() => simulate(db, today), [db, today])
  const row = plan.rows.find(r => r.month === today)!
  const ts = tasks(db, today)
  const left = ts.filter(t => !t.done).length
  const nextKey = ts.find(t => !t.done)?.key
  const parts = PARTS.map(p => ({ ...p, v: partValue(row, p.k) })).filter(p => p.v > 0)
  const total = parts.reduce((a, p) => a + p.v, 0) || 1
  const s = db.settings
  const cashPct = s.cashGoal ? Math.min(100, Math.round((s.cashNow / s.cashGoal) * 100)) : 0
  const upcoming = [
    ...db.expenses.filter(e => e.kind === 'fixed' && e.month >= today).map(e => ({ m: e.month, title: e.name, sub: `${yen(e.amount)} · 日程固定`, tag: true })),
    ...db.wishes.filter(w => !w.boughtMonth && plan.wishes[w.id]?.eta).map(w => ({ m: plan.wishes[w.id].eta!, title: w.name, sub: `${yen(w.price)} · 購入の目安`, tag: false })),
  ].sort((a, b) => a.m.localeCompare(b.m)).slice(0, 3)
  const fresh = db.wishes.length === 0 && db.closes.length === 0

  return (
    <>
      <div class="body">
        <div class="hdr"><div><div class="ov">{today.replace('-', '.')} · {row.closed ? '締め済み' : '見込み'}</div><h1>{ymLabel(today)}のお金</h1></div></div>

        {fresh && (
          <div class="note n-blue"><Icon n="info" /><span>はじめに：設定で自由枠・貯金・NISAの額を確認し、ほしいものを登録してください。毎月の初めに「月の締め」を入れると、見込みが実績に置き換わります。</span></div>
        )}

        <button class="card" style="text-align:left" onClick={() => go('/recovery')}>
          <div class="row"><span class="ov">Free budget · 自由枠</span>
            {row.recovering && <span class={`pill ${row.balanceEnd < 0 ? 'p-neg' : 'p-warn'}`}>{row.balanceEnd < 0 ? '取り戻し中' : '準備中'}</span>}
          </div>
          <div class={`fig xl ${row.free < 0 ? 'c-neg' : ''}`} style="margin:12px 0 14px">{yen(row.free)}</div>
          <div class="split">{parts.map(p => <i style={`width:${(p.v / total) * 100}%;background:${p.color}`} />)}</div>
          <div style="margin-top:10px">
            {parts.map(p => <div class="lg-row"><span><span class="dot" style={`background:${p.color}`} />{p.label}</span><span class="fig">{yen(p.v)}</span></div>)}
          </div>
          <div class="hr" />
          <div class="row">
            {row.balanceEnd < 0 ? (
              <><div><div class="t11">前借りの残り</div><div class="fig md c-neg">{yen(row.balanceEnd)}</div></div>
                <div style="text-align:right"><div class="t11">解消の見込み</div><div class="fig md">{plan.debtCleared ? ymLabel(plan.debtCleared, today) : '3年以上先'}</div></div></>
            ) : plan.breakEven && plan.breakEven > today ? (
              <><div><div class="t11">いまの前借り</div><div class="fig md">なし</div></div>
                <div style="text-align:right"><div class="t11">計画上のプラマイゼロ</div><div class="fig md">{ymLabel(plan.breakEven, today)}</div></div></>
            ) : (
              <div><div class="t11">前借り</div><div class="fig md c-ok">なし</div></div>
            )}
            <Icon n="chev" class="chev" />
          </div>
        </button>

        <div class="card">
          <div style="display:flex;align-items:center;gap:14px">
            <div class="ring"><svg viewBox="0 0 56 56"><circle class="bg" cx="28" cy="28" r="22" /><circle class="fg" cx="28" cy="28" r="22" style={`stroke-dashoffset:${138.2 * (left / ts.length)}`} /></svg><b>{ts.length - left}<small>/{ts.length}</small></b></div>
            <div style="flex:1"><div class="ov">Monthly routine</div><div class="t13 b" style="font-size:16px;margin-top:4px">今月やること</div><div class="t11">{left ? `残り${left}件 · 約${left * 3}分` : 'すべて完了しました'}</div></div>
          </div>
          <div style="margin-top:12px">
            {ts.map(t => (
              <button class={`task ${t.done ? 'done' : t.key === nextKey ? 'next' : ''}`} style="text-align:left" onClick={() => go(t.to)}>
                <span class="st">{t.done && <Icon n="check" />}</span>
                <div class="tx"><b>{t.title}</b><span>{t.sub}</span></div>
                <span class="when">{t.done ? t.doneAt : t.due}</span>
                {!t.done && <Icon n="chev" class="chev" />}
              </button>
            ))}
          </div>
        </div>

        <div class="qa">
          <button onClick={() => openSheet('wish')}><span class="ic ic-b"><Icon n="plus" /></span>ほしいもの</button>
          <button onClick={() => openSheet('expense', { kind: 'spent' })}><span class="ic ic-n"><Icon n="bolt" /></span>大きな出費</button>
          <button onClick={() => openSheet('income')}><span class="ic ic-o"><Icon n="coin" /></span>臨時収入</button>
        </div>

        <div class="card">
          <div class="row"><span class="ov">Locked · 先取り</span><Icon n="lock" class="c-ok" style="width:16px;height:16px" /></div>
          <div class="row" style="margin-top:12px"><span class="t13">現金貯金</span><span class="fig md">{yen(s.saving)}<span class="t11"> /月</span></span></div>
          <div class="row" style="margin-top:6px"><span class="t13">NISA積立</span><span class="fig md">{yen(s.nisa)}<span class="t11"> /月</span></span></div>
          <div class="hr" />
          <div class="row"><span class="t11">現金目標 {yen(s.cashGoal)}（いま {yen(s.cashNow)}）</span><span class="fig c-ok" style="font-size:13px">{cashPct}%</span></div>
          <div class="gauge" style="margin-top:8px"><i style={`width:${cashPct}%;background:var(--ok)`} /></div>
          <div class="ticks">{Array.from({ length: 11 }, () => <span />)}</div>
        </div>

        {upcoming.length > 0 && (
          <div class="card">
            <div class="ov" style="margin-bottom:4px">Upcoming · 次の予定</div>
            {upcoming.map(u => (
              <div class="ev">
                <div class="d"><small>{u.m.slice(0, 4)}</small><b>{monthNum(u.m)}<span style="font-size:11px">月</span></b></div>
                <div style="flex:1"><div class="t13 b">{u.title} {u.tag && <span class="pill p-warn" style="margin-left:4px">日程固定</span>}</div><div class="t11">{u.sub}</div></div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Nav active="/" />
    </>
  )
}
