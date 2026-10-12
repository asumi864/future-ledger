import type { ComponentChildren } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { parseAmount } from '../lib/format'

const PATHS: Record<string, string> = {
  home: '<path d="M3.5 10.5 12 4l8.5 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-6v6H4.5a1 1 0 0 1-1-1z"/>',
  wish: '<path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1z"/>',
  chart: '<path d="M3.5 20.5h17M6 16.5l4-5 3.5 3L19 7"/><circle cx="19" cy="7" r="1.2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bolt: '<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.3"/>',
  split: '<rect x="3" y="6" width="18" height="12.5" rx="2.5"/><path d="M3 10.5h18M7 15h2M11 15h2M15 15h2"/>',
  coin: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  down: '<path d="M12 4v11M7 10.5 12 15.5l5-5M4.5 20h15"/>',
  up: '<path d="M12 15.5V4.5M7 9l5-5 5 5M4.5 20h15"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.1"/>',
  warn: '<path d="M12 4 21 19.5H3z"/><path d="M12 10v4.5M12 17v.1"/>',
  loop: '<path d="M4.5 12a7.5 7.5 0 0 1 13-5.1M19.5 12a7.5 7.5 0 0 1-13 5.1M17.5 3v4h-4M6.5 21v-4h4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  people: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.6-3 2.8-5 5.5-5s4.9 2 5.5 5"/><circle cx="16.5" cy="9.5" r="2.5"/><path d="M15.5 14.6c2.3.2 4 1.9 4.6 4.9"/>',
  bag: '<path d="M5 8h14l-1 12.5H6z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  paste: '<rect x="5" y="4.5" width="14" height="16.5" rx="2.5"/><path d="M9 4.5V3.5h6v1M9 11h6M9 15h4"/>',
}

export function Icon({ n, class: cls = '', style }: { n: string; class?: string; style?: string }) {
  return <svg class={`i ${cls}`} style={style} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: PATHS[n] ?? '' }} />
}

/* ---------- 画面遷移（ハッシュ）とシート ---------- */
export function useRoute(): string {
  const [r, setR] = useState(location.hash.slice(1) || '/')
  useEffect(() => {
    const f = () => { setR(location.hash.slice(1) || '/'); window.scrollTo(0, 0) }
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])
  return r
}
export const go = (path: string) => { location.hash = path }

type SheetState = { name: string; props?: Record<string, unknown> } | null
let sheet: SheetState = null
let toastMsg = ''
const subs = new Set<() => void>()
const emit = () => subs.forEach(f => f())
export function openSheet(name: string, props?: Record<string, unknown>) { sheet = { name, props }; emit() }
export function closeSheet() { sheet = null; emit() }
export function toast(msg: string) { toastMsg = msg; emit(); setTimeout(() => { toastMsg = ''; emit() }, 2200) }
export function useUI() {
  const [, set] = useState(0)
  useEffect(() => { const f = () => set(t => t + 1); subs.add(f); return () => { subs.delete(f) } }, [])
  return { sheet, toastMsg }
}

export function Sheet({ title, children, onClose = closeSheet }: { title: string; children: ComponentChildren; onClose?: () => void }) {
  return (
    <>
      <div class="dim" onClick={onClose} />
      <div class="sheet sheet-in" role="dialog" aria-label={title}>
        <div class="grab" />
        <div class="sh-h"><h2>{title}</h2><button onClick={onClose}>閉じる</button></div>
        {children}
      </div>
    </>
  )
}

/* ---------- 入力部品 ---------- */
export function Money({ value, onChange, hint, autoFocus }: { value: number; onChange: (n: number) => void; hint?: string; autoFocus?: boolean }) {
  return (
    <div class="inp money">
      <span class="pre">¥</span>
      <input inputMode="numeric" autoFocus={autoFocus} value={value ? value.toLocaleString('ja-JP') : ''} placeholder="0"
        onInput={e => onChange(parseAmount((e.target as HTMLInputElement).value))} />
      {hint && <span class="suf">{hint}</span>}
    </div>
  )
}

export function Text({ value, onChange, placeholder }: { value: string; onChange: (s: string) => void; placeholder?: string }) {
  return <div class="inp"><input value={value} placeholder={placeholder} onInput={e => onChange((e.target as HTMLInputElement).value)} /></div>
}

export function MonthInput({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return <div class="inp"><input type="month" value={value} onInput={e => onChange((e.target as HTMLInputElement).value)} /></div>
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string; sub?: string }[]; onChange: (v: T) => void }) {
  return (
    <div class="seg" role="radiogroup">
      {options.map(o => (
        <button type="button" role="radio" aria-checked={value === o.v} class={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)}>
          {o.label}{o.sub && <small>{o.sub}</small>}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (b: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} class={`sw3 ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />
}

export function Field({ label, children }: { label: string; children: ComponentChildren }) {
  return <div class="fld"><span class="lb">{label}</span>{children}</div>
}

export function Back({ to, label }: { to: string; label: string }) {
  return <a class="back" href={`#${to}`}><Icon n="left" />{label}</a>
}

/** 「今月やること」から進んだ画面に共通で置く、ホームへ戻るボタン */
export function HomeBack() {
  return <a class="back" href="#/" aria-label="ホームに戻る"><Icon n="left" />ホーム</a>
}

export function Nav({ active }: { active: string }) {
  const items = [['/', 'home', 'ホーム'], ['/wishes', 'wish', 'ほしいもの'], ['/review', 'chart', '振り返り'], ['/settings', 'gear', '設定']]
  return (
    <nav class="nav">
      {items.map(([p, ic, l]) => <a href={`#${p}`} class={active === p ? 'on' : ''}><Icon n={ic} />{l}</a>)}
    </nav>
  )
}

export const PRIORITY_LABEL = { need: '必要', want: '欲しい', dream: '憧れ' } as const
