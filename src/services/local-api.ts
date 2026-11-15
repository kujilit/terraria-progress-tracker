import type { ItemStatus } from '../types'
import type { ProgressRecord, TrackerApi } from './api'

const STORAGE_KEY = 'terraria-progress-v1'
type Store = Record<string, ProgressRecord>

function readStore(): Store {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Store }
  catch { return {} }
}

/** Local adapter. Keeps the app usable before a remote backend is configured. */
export const localApi: TrackerApi = {
  async health() { return { status: 'ok', apiVersion: 'local-v1' } },
  async getProgress(worldId, playerId) {
    return Object.values(readStore()).filter(x => x.worldId === worldId && x.playerId === playerId)
  },
  async setProgress(input) {
    const record: ProgressRecord = { ...input, updatedAt: new Date().toISOString() }
    const store = readStore()
    store[`${record.worldId}:${record.playerId}:${record.itemId}`] = record
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    return record
  },
}

export function normalizeStatus(value: string): ItemStatus {
  const allowed: ItemStatus[] = ['owned', 'planned', 'crafting', 'missing', 'skipped']
  return allowed.includes(value as ItemStatus) ? value as ItemStatus : 'missing'
}
