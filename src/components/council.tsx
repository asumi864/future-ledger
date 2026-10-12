import { MEMBERS, STANCES, stanceSummary, type CouncilResult, type MemberId } from '../lib/council'

const BASE = import.meta.env.BASE_URL

export function Avatar({ id, size }: { id: MemberId | 'chair'; size: number }) {
  return <span class="av" role="img" aria-label={id === 'chair' ? '議長' : MEMBERS.find(m => m.id === id)?.name}
    style={`width:${size}px;height:${size}px;background-image:url(${BASE}avatars/${id}.svg)`} />
}

/** 議長の結論カード（振り返り・議事録で共通） */
export function ChairCard({ r, full, onOpen }: { r: CouncilResult; full?: boolean; onOpen?: () => void }) {
  const body = (
    <>
      <div class="row" style="justify-content:flex-start;gap:12px">
        <Avatar id="chair" size={full ? 50 : 44} />
        <div><div class="ov">Chair · 議長{full ? '（まとめ役）' : 'のまとめ'}</div><h3 style="margin-top:4px">結論：{r.chair.verdict}</h3></div>
      </div>
      {full && r.chair.summary && <p class="t12" style="color:#C9D0DD;margin-top:12px">{r.chair.summary}</p>}
      {r.chair.todos.length > 0 && (
        <>
          {full && <div class="ov" style="margin:16px 0 10px">This month · 今月やること</div>}
          <ol class="todo" style={full ? '' : 'margin-top:14px'}>{r.chair.todos.map(t => <li>{t}</li>)}</ol>
        </>
      )}
      {full && r.chair.homework.length > 0 && (
        <>
          <div class="ov" style="margin:16px 0 10px">Homework · 次回までの宿題</div>
          <ol class="todo">{r.chair.homework.map(t => <li>{t}</li>)}</ol>
        </>
      )}
      {!full && (
        <>
          <div class="hr" style="background:#232B3B" />
          <div class="seats">
            {r.members.map(m => <div class="seat"><Avatar id={m.id} size={34} /><em style={`background:${STANCES[m.stance].color}`} /></div>)}
          </div>
          <div class="row" style="margin-top:12px"><span class="t11" style="color:#9AA3B5">{stanceSummary(r)}</span><span class="t11" style="color:#fff;font-weight:700">議事録を読む ›</span></div>
        </>
      )}
    </>
  )
  return onOpen
    ? <button class="card ink verdict" style="text-align:left;width:100%" onClick={onOpen}>{body}</button>
    : <div class="card ink verdict">{body}</div>
}
