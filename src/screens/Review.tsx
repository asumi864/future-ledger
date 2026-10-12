import { HomeBack, Icon, Nav } from '../components/ui'

/** 段階2（振り返り・委員会）で実装する。いまは導線だけ用意する */
export function Review() {
  return (
    <>
      <div class="body">
        <div class="hdr"><div><HomeBack /><div class="ov" style="margin-top:12px">Review</div><h1>振り返り</h1></div></div>
        <div class="card">
          <div class="row" style="justify-content:flex-start;gap:12px"><span class="ic ic-b"><Icon n="people" /></span>
            <div><div class="t13 b">次の段階で追加します</div><div class="t11">評価額の入力、相談文のコピー、AIの回答の貼り付け、委員会の議事録</div></div></div>
        </div>
      </div>
      <Nav active="/review" />
    </>
  )
}
