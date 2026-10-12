import { useEffect, useState } from 'preact/hooks'
import type { DB } from './types'
import { emptyDB } from './defaults'
import { ymOf } from './ym'

const DB_NAME = 'future-ledger'
const STORE = 'kv'
const KEY = 'db'

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}

async function readDB(): Promise<DB | null> {
  const d = await idb()
  return new Promise((res, rej) => {
    const r = d.transaction(STORE).objectStore(STORE).get(KEY)
    r.onsuccess = () => res((r.result as DB) ?? null)
    r.onerror = () => rej(r.error)
  })
}

async function writeDB(v: DB): Promise<void> {
  const d = await idb()
  return new Promise((res, rej) => {
    const t = d.transaction(STORE, 'readwrite')
    t.objectStore(STORE).put(v, KEY)
    t.oncomplete = () => res()
    t.onerror = () => rej(t.error)
  })
}

let state: DB = emptyDB(ymOf(new Date()))
let ready = false
const subs = new Set<() => void>()
const notify = () => subs.forEach(f => f())

export async function initStore(): Promise<void> {
  const saved = await readDB().catch(() => null)
  if (saved && saved.version === 1) state = saved
  else await writeDB(state).catch(() => undefined)
  ready = true
  // ブラウザの容量整理で消されにくくする（拒否されても動作は続ける）
  navigator.storage?.persist?.().catch(() => undefined)
  notify()
}

export function getDB(): DB {
  return state
}

export function update(fn: (d: DB) => void): void {
  const next = structuredClone(state)
  fn(next)
  state = next
  writeDB(state).catch(e => console.error('保存に失敗しました', e))
  notify()
}

export function replaceDB(next: DB): void {
  state = next
  writeDB(state).catch(e => console.error('保存に失敗しました', e))
  notify()
}

export function useDB(): DB {
  const [, setTick] = useState(0)
  useEffect(() => {
    const f = () => setTick(t => t + 1)
    subs.add(f)
    return () => { subs.delete(f) }
  }, [])
  return state
}

export function isReady(): boolean {
  return ready
}
