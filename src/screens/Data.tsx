import { HomeBack, Icon, toast } from '../components/ui'
import { getDB, replaceDB, update, useDB } from '../lib/store'
import type { DB } from '../lib/types'
import { simulate } from '../lib/engine'
import { planEventCount, planICS, routineICS } from '../lib/ics'
import { ymOf } from '../lib/ym'

function download(name: string, text: string, type: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function isDB(x: unknown): x is DB {
  const d = x as DB
  return !!d && d.version === 1 && !!d.settings && Array.isArray(d.wishes) && Array.isArray(d.expenses) && Array.isArray(d.closes)
}

export function Data() {
  const db = useDB()
  const plan = simulate(db, ymOf(new Date()))
  const planCount = planEventCount(db, plan)
  const last = db.lastExport ? new Date(db.lastExport) : null
  const days = last ? Math.floor((Date.now() - last.getTime()) / 86400000) : null

  const exportJSON = () => {
    const d = new Date()
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    update(x => { x.lastExport = Date.now() })
    download(`future-ledger-backup-${stamp}.json`, JSON.stringify(getDB(), null, 2), 'application/json')
    toast('書き出しました。個人のDriveに保存してください')
  }
  const importJSON = (f: File) => {
    f.text().then(t => {
      const x = JSON.parse(t)
      if (!isDB(x)) throw new Error('形式が違います')
      if (!confirm('いまの端末のデータを、読み込むファイルの内容で置き換えます。よろしいですか？')) return
      replaceDB(x)
      toast('読み込みました')
    }).catch(() => toast('読み込めませんでした（未来の予約帳のバックアップではありません）'))
  }

  return (
    <div class="body nonav">
      <div class="hdr"><div><HomeBack /><div class="ov" style="margin-top:12px">Data</div><h1>データ</h1></div></div>
      <div class="card">
        <div class="row" style="justify-content:flex-start;gap:12px"><span class="ic ic-o"><Icon n="lock" /></span><div><div class="t13 b">この端末にだけ保存</div><div class="t11">サーバーには送信しません。機種変更やブラウザのデータ削除で消えます</div></div></div>
        <div class="hr" />
        <div class="row"><span class="t11">最後の書き出し</span><span class="fig" style="font-size:14px">{last ? `${last.getFullYear()}.${String(last.getMonth() + 1).padStart(2, '0')}.${String(last.getDate()).padStart(2, '0')}` : 'まだありません'}</span></div>
        {days !== null && days > 31 && <div class="t11 c-warn" style="margin-top:6px">前回から{days}日たっています</div>}
      </div>
      <button class="btn b-p" onClick={exportJSON}><Icon n="down" />JSONを書き出す（個人のDriveへ）</button>
      <label class="btn b-s" style="cursor:pointer"><Icon n="up" />JSONを読み込む（PC⇄スマホ）
        <input type="file" accept="application/json,.json" style="display:none" onChange={e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) importJSON(f) }} />
      </label>
      <div class="note n-blue"><Icon n="info" /><span>書き出したファイルは個人のGoogle Driveに保存してください。仕事用のアカウントやチャットには貼り付けないでください。</span></div>
      <div class="sec">Calendar · 個人のGoogleアカウント</div>
      <div class="lst">
        <button class="it" onClick={() => { download('future-ledger-routine.ics', routineICS(), 'text/calendar'); toast('書き出しました') }}>
          <span class="ic ic-b"><Icon n="cal" /></span><span style="flex:1">定期の予定<span class="t11" style="display:block">毎月1日の「今月やること」・四半期の全体会議</span></span><span class="v">.ics</span><Icon n="down" class="chev" />
        </button>
        <button class="it" onClick={() => {
          if (!planCount) { toast('書き出す予定がありません。ほしいもの・日程固定の出費を登録してください'); return }
          download('future-ledger-plan.ics', planICS(db, plan), 'text/calendar'); toast(`${planCount}件を書き出しました`)
        }}>
          <span class="ic ic-w"><Icon n="cal" /></span><span style="flex:1">ほしいもの・日程固定の予定月<span class="t11" style="display:block">{planCount ? `いま${planCount}件 · 計画が変わったら書き出し直してください` : 'まだ予定がありません（この端末のデータから作ります）'}</span></span><span class="v">{planCount}件</span><Icon n="down" class="chev" />
        </button>
      </div>
      <div class="note n-blue"><Icon n="info" /><span>予定のタイトルに金額は入りません。PCで個人のGoogleカレンダーを開き、設定 → インポートで取り込むと、Androidにも通知が届きます。</span></div>
    </div>
  )
}
