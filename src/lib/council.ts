/**
 * AI委員会：相談文の作成と、AIの回答（JSON）の読み取り。
 * AIへの送信はアプリからは行わない（本人が個人のAIに貼り付ける）。
 */
import type { Plan } from './engine'
import { yen } from './format'
import type { DB, YM } from './types'
import { ymLabel } from './ym'

export type MemberId = 'fp' | 'index' | 'analyst' | 'behavior' | 'devil' | 'joy'
export type Stance = 'go' | 'wait' | 'care' | 'question' | 'yes'
export type Verdict = '現状維持' | '積立額の見直し' | '追加検討' | '情報不足'

export interface MemberOpinion { id: MemberId; stance: Stance; claim: string; reason: string }
export interface CouncilResult {
  members: MemberOpinion[]
  chair: { verdict: Verdict; summary: string; todos: string[]; homework: string[] }
}

export const MEMBERS: { id: MemberId; name: string; role: string; view: string }[] = [
  { id: 'fp', name: '守りのFP', role: '家計・生活防衛', view: '生活費と現金の余裕、前借り、近い支出を見て、積立が生活を圧迫していないかを判断する' },
  { id: 'index', name: '淡々と積む人', role: '長期インデックス', view: '低コスト・分散・長期継続を重んじ、短期の値動きで方針を変えない理由を示す' },
  { id: 'analyst', name: '決算を読む人', role: '企業分析', view: '個別株を検討する場合の事業・利益・キャッシュフロー・財務の見方を示し、見送る理由も必ず挙げる' },
  { id: 'behavior', name: '心のクセを見る人', role: '行動ファイナンス', view: '焦り・損失回避・人気への便乗・取り返したい気持ちなど、判断の偏りを指摘する' },
  { id: 'devil', name: 'あえて疑う人', role: '反対意見', view: '全員が賛成しそうな点にあえて反論し、うまくいかない条件や見落としを問いかける' },
  { id: 'joy', name: '今も大事にする人', role: '人生を楽しむ', view: '今の生活の満足度も資産形成の目的と考え、我慢しすぎや楽しみの削りすぎを指摘する' },
]

export const STANCES: Record<Stance, { label: string; cls: string; color: string }> = {
  go: { label: '継続', cls: 'p-ok', color: 'var(--ok)' },
  wait: { label: '様子見', cls: 'p-mute', color: '#7D879B' },
  care: { label: '注意', cls: 'p-warn', color: '#E0A12A' },
  question: { label: '問い', cls: 'p-neg', color: 'var(--neg)' },
  yes: { label: '賛成', cls: 'p-blue', color: '#6F8DFF' },
}
export const VERDICTS: Verdict[] = ['現状維持', '積立額の見直し', '追加検討', '情報不足']

export function buildPrompt(db: DB, plan: Plan, month: YM, quarterly: boolean): string {
  const s = db.settings
  const vals = db.valuations.filter(v => v.month <= month && !v.noPurchase).sort((a, b) => a.month.localeCompare(b.month))
  const cur = vals.find(v => v.month === month)
  const hist = vals.slice(-4).map(v => `- ${v.month}：評価額 ${yen(v.value)} / 累計買付 ${yen(v.invested)}`).join('\n') || '- 記録なし'
  const row = plan.rows.find(r => r.month === month)
  const fixed = db.expenses.filter(e => e.kind === 'fixed' && e.month >= month).map(e => `${e.name}（${ymLabel(e.month, month)}・${yen(e.amount)}）`)
  const splits = db.expenses.filter(e => e.kind === 'split').map(e => `${e.name}（分割${e.count}回）`)
  const wishes = db.wishes.filter(w => !w.boughtMonth && plan.wishes[w.id]?.eta).slice(0, 5)
    .map(w => `${w.name}（${yen(w.price)}・目安${ymLabel(plan.wishes[w.id].eta!, month)}）`)
  const prev = [...db.minutes].filter(m => m.month < month).sort((a, b) => b.month.localeCompare(a.month))[0]
  const prevRes = prev?.raw as CouncilResult | undefined
  const gain = cur ? cur.value - cur.invested : 0

  return `あなたは私の「投資委員会」です。以下の6人の委員と議長を演じ分け、私の${ymLabel(month)}の${quarterly ? '四半期の全体会議' : '月次点検'}をしてください。

# 前提とルール
- 私は投資初心者です。これは判断材料の整理であり、売買の指示や個別の投資助言ではありません。最終判断は私がします。
- 下の数字だけを根拠にし、分からないことは推測で埋めず「情報不足」としてください。
- 商品や制度の事実に触れるときは、公式資料に基づき確認日を添えてください。将来の値動きや利益を約束しないでください。
- 短期の値動きだけを理由に売買を勧めないでください。生活の変化を優先して確認してください。
- 先取りの貯金とNISA積立は生活防衛を優先して決めた額です。${quarterly ? '四半期なので、積立額が無理なく続けられるかも検討してください。' : '月次では、積立額の変更は原則として四半期の全体会議に回してください。'}

# 委員（id・名前・視点）
${MEMBERS.map(m => `- ${m.id}｜${m.name}（${m.role}）：${m.view}`).join('\n')}
- 議長：6人の意見の分かれ方を踏まえて結論・今月やること・次回までの宿題をまとめる。

# 今月の数字
- 積立中の商品：${s.fundName || '未記入'}（NISAつみたて投資枠・月${yen(s.nisa)}）
- 評価額：${cur ? yen(cur.value) : '未入力'} / 累計買付額：${cur ? yen(cur.invested) : '未入力'} / 運用損益：${cur ? `${yen(gain, true)}（${cur.invested ? ((gain / cur.invested) * 100).toFixed(1) : '0.0'}%）` : '未入力'}
- 直近の推移：
${hist}
- 先取り：現金貯金 月${yen(s.saving)}（現在 ${yen(s.cashNow)} / 目標 ${yen(s.cashGoal)}）
- 自由枠（ほしいもの等に使える残り）：今月 ${row ? yen(row.free) : '不明'}、月末の累計 ${row ? yen(row.balanceEnd) : '不明'}（マイナスは前借り）
- プラマイゼロの見込み：${plan.breakEven ? ymLabel(plan.breakEven, month) : '前借りなし'}
- 日程固定の予定：${fixed.join('、') || 'なし'}
- 分割払い：${splits.join('、') || 'なし'}
- 購入予定のほしいもの：${wishes.join('、') || 'なし'}
- 前回の結論：${prevRes ? `${prevRes.chair.verdict}／宿題：${prevRes.chair.homework.join('、') || 'なし'}` : 'なし（初回）'}
- 前回の私の決定：${prev?.decision || 'なし'}

# 回答の形式（厳守）
説明文を付けず、次の形のJSONだけを \`\`\`json のコードブロックで返してください。
- members は6人全員を上の順番で。stance は go（継続）/ wait（様子見）/ care（注意）/ question（問い）/ yes（賛成）のいずれか。
- claim は言い切りの1文、reason は2〜3文。です・ます調。
- verdict は「現状維持」「積立額の見直し」「追加検討」「情報不足」のいずれか。todos は3つ以内、homework は2つ以内。

\`\`\`json
{
  "members": [
    { "id": "fp", "stance": "go", "claim": "…", "reason": "…" }
  ],
  "chair": { "verdict": "現状維持", "summary": "…", "todos": ["…"], "homework": ["…"] }
}
\`\`\``
}

/** AIの回答から JSON を取り出して検証する。問題があれば日本語のエラーを投げる */
export function parseCouncil(text: string): CouncilResult {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const a = body.indexOf('{'), b = body.lastIndexOf('}')
  const broken = 'JSONの形が崩れています。AIに「JSONだけで返し直して」と頼んでください'
  if (a < 0) throw new Error('JSONが見つかりません。回答全体をコピーして貼り付けてください')
  if (b < a) throw new Error(broken)
  let x: unknown
  try { x = JSON.parse(body.slice(a, b + 1)) } catch { throw new Error(broken) }
  const r = x as CouncilResult
  if (!Array.isArray(r?.members) || !r.chair) throw new Error('members と chair が含まれていません')
  const ids = MEMBERS.map(m => m.id)
  const members: MemberOpinion[] = []
  for (const id of ids) {
    const m = r.members.find(y => y?.id === id)
    if (!m) throw new Error(`委員「${MEMBERS.find(y => y.id === id)!.name}」の意見がありません`)
    if (!(m.stance in STANCES)) throw new Error(`stance の値「${m.stance}」は使えません`)
    members.push({ id, stance: m.stance, claim: String(m.claim ?? ''), reason: String(m.reason ?? '') })
  }
  const verdict = VERDICTS.includes(r.chair.verdict) ? r.chair.verdict : '情報不足'
  return {
    members,
    chair: {
      verdict,
      summary: String(r.chair.summary ?? ''),
      todos: (r.chair.todos ?? []).map(String).slice(0, 3),
      homework: (r.chair.homework ?? []).map(String).slice(0, 2),
    },
  }
}

export function stanceSummary(r: CouncilResult): string {
  const c: Partial<Record<Stance, number>> = {}
  for (const m of r.members) c[m.stance] = (c[m.stance] ?? 0) + 1
  return (Object.keys(STANCES) as Stance[]).filter(k => c[k]).map(k => `${STANCES[k].label}${c[k]}`).join(' · ')
}
