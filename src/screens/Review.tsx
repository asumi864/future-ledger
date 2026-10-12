import { useMemo, useState } from 'preact/hooks'
import { ChairCard } from '../components/council'
import { HomeBack, Icon, Nav, Seg, go, openSheet, toast } from '../components/ui'
import { buildPrompt, type CouncilResult } from '../lib/council'
import { simulate } from '../lib/engine'
import { yen } from '../lib/format'
import { useDB } from '../lib/store'
import { monthNum, ymLabel, ymOf } from '../lib/ym'

const QUARTER = [1, 4, 7, 10]

export function Review() {
  const db = useDB()
  const today = ymOf(new Date())
  const plan = useMemo(() => simulate(db, today), [db, today])
  const [quarterly, setQuarterly] = useState(QUARTER.includes(monthNum(today)))
  const vals = [...db.valuations].sort((a, b) => a.month.localeCompare(b.month))
  const cur = vals.find(v => v.month === today)
  const mins = db.minutes.find(m => m.month === today)
  const result = mins?.raw as CouncilResult | undefined
  const past = db.minutes.filter(m => m.month !== today).sort((a, b) => b.month.localeCompare(a.month))
  const gain = cur ? cur.value - cur.invested : 0

  const copy = () => {
    const text = buildPrompt(db, plan, today, quarterly)
    navigator.clipboard?.writeText(text)
      .then(() => toast('相談文をコピーしました。個人のAIに貼り付けてください'))
      .catch(() => openSheet('prompt', { text }))
  }

  // グラフ：直近12か月の評価額（線）と累計買付（面）
  const pts = vals.slice(-12)
  const max = Math.max(1, ...pts.map(v => Math.max(v.value, v.invested)))
  const x = (i: number) => (pts.length < 2 ? 150 : (i / (pts.length - 1)) * 292)
  const y = (n: number) => 80 - (n / max) * 70

  return (
    <>
      <div class="body">
        <div class="hdr">
          <div><HomeBack /><div class="ov" style="margin-top:12px">Review · {db.settings.fundName || 'NISA'}</div><h1>{ymLabel(today)}の振り返り</h1></div>
          {cur && <span class="pill p-ok"><Icon n="check" style="width:12px;height:12px;stroke-width:2.4" />評価額 入力済み</span>}
        </div>

        <button class="card" style="text-align:left" onClick={() => openSheet('valuation')}>
          {cur ? (
            <>
              <div class="row">
                <div><div class="t11">評価額</div><div class="fig lg">{yen(cur.value)}</div></div>
                <div style="text-align:right"><div class="t11">運用損益</div>
                  <div class={`fig md ${gain >= 0 ? 'c-ok' : 'c-neg'}`}>{yen(gain, true)} <span style="font-size:12px">{cur.invested ? `${gain >= 0 ? '+' : ''}${((gain / cur.invested) * 100).toFixed(1)}%` : ''}</span></div></div>
              </div>
              {pts.length >= 2 ? (
                <svg class="chart" viewBox="0 0 300 96" width="100%" style="margin-top:12px;overflow:visible" role="img" aria-label="評価額と累計買付の推移">
                  <defs><linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2F5BFF" stop-opacity=".18" /><stop offset="1" stop-color="#2F5BFF" stop-opacity="0" /></linearGradient></defs>
                  <g stroke="var(--line-2)"><line x1="0" y1="10" x2="300" y2="10" /><line x1="0" y1="45" x2="300" y2="45" /><line x1="0" y1="80" x2="300" y2="80" /></g>
                  <path d={`M0 80 ${pts.map((v, i) => `L${x(i)} ${y(v.invested)}`).join(' ')} L${x(pts.length - 1)} 80 Z`} fill="var(--line-2)" />
                  <path d={`M${x(0)} ${y(pts[0].value)} ${pts.map((v, i) => `L${x(i)} ${y(v.value)}`).join(' ')} L${x(pts.length - 1)} 80 L0 80 Z`} fill="url(#gA)" />
                  <polyline points={pts.map((v, i) => `${x(i)},${y(v.invested)}`).join(' ')} fill="none" stroke="var(--faint)" stroke-width="1.2" stroke-dasharray="3 3" />
                  <polyline points={pts.map((v, i) => `${x(i)},${y(v.value)}`).join(' ')} fill="none" stroke="var(--blue)" stroke-width="2.2" stroke-linejoin="round" />
                  <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1].value)} r="4" fill="#fff" stroke="var(--blue)" stroke-width="2" />
                  <g><text x="0" y="94">{String(monthNum(pts[0].month)).padStart(2, '0')}</text><text x="292" y="94" text-anchor="end">{String(monthNum(pts[pts.length - 1].month)).padStart(2, '0')}</text></g>
                </svg>
              ) : <div class="t11" style="margin-top:10px">2か月分たまると推移のグラフが出ます</div>}
              <div class="mkey" style="margin-top:6px"><span><i style="background:var(--blue)" />評価額</span><span><i style="background:var(--faint)" />累計買付 {yen(cur.invested)}（入れたお金）</span></div>
            </>
          ) : (
            <div class="row"><div><div class="t13 b">{ymLabel(today)}の評価額を入力</div><div class="t11">楽天証券の「保有商品」の評価額と、累計の買付額</div></div><Icon n="chev" class="chev" /></div>
          )}
        </button>

        {result ? (
          <ChairCard r={result} onOpen={() => go(`/minutes?m=${today}`)} />
        ) : (
          <div class="card">
            <div class="ov" style="margin-bottom:6px">Council · 委員会に相談する</div>
            <div class="steps">
              <div class={`step ${cur ? 'done' : ''}`}><span class="n">{cur ? <Icon n="check" style="width:13px;height:13px;stroke-width:2.6" /> : 1}</span><span class="t13">評価額を入力する</span></div>
              <div class="step"><span class="n">2</span><span class="t13">相談文をコピーし、個人のAIに貼る</span></div>
              <div class="step"><span class="n">3</span><span class="t13">AIの回答を「回答を貼り付け」に入れる</span></div>
            </div>
          </div>
        )}

        <div class="fld"><span class="lb">相談の種類</span>
          <Seg value={quarterly ? 'q' : 'm'} onChange={v => setQuarterly(v === 'q')} options={[{ v: 'm', label: '月次点検', sub: '短く・方針は変えない' }, { v: 'q', label: '四半期の全体会議', sub: '積立額も見直す' }]} />
        </div>
        <div class="btns">
          <button class="btn b-blue" onClick={copy}><Icon n="copy" />相談文をコピー</button>
          <button class="btn b-s" onClick={() => openSheet('paste', { quarterly })}><Icon n="paste" />回答を貼り付け</button>
        </div>
        <div class="note n-warn"><Icon n="warn" /><span>相談文には金額が含まれます。個人で使っているAIに貼ってください。仕事用のアカウントには貼らないでください。</span></div>

        {past.length > 0 && (
          <>
            <div class="sec">Archive · これまでの議事録</div>
            <div class="lst">
              {past.map(m => {
                const r = m.raw as CouncilResult
                return <button class="it" onClick={() => go(`/minutes?m=${m.month}`)}>{m.month.replace('-', '.')}{m.quarterly ? ' 全体会議' : ''}<span class="v">{r.chair.verdict}</span><Icon n="chev" class="chev" /></button>
              })}
            </div>
          </>
        )}
      </div>
      <Nav active="/review" />
    </>
  )
}
