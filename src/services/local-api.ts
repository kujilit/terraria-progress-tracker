import type { ProgressRecord, TrackerApi } from './api'
const STORAGE_KEY = 'terraria-progress-v1'
export class LocalTrackerApi implements TrackerApi {
  async listProgress(worldId: string): Promise<ProgressRecord[]> {
    const all = this.read()
    return all.filter(record => record.worldId === worldId)
  }
  async setProgress(record: ProgressRecord): Promise<void> {
    const all = this.read().filter(item => !(item.worldId === record.worldId && item.playerId === record.playerId && item.itemId === record.itemId))
    all.push(record)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  }
  private read(): ProgressRecord[] {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as ProgressRecord[] }
    catch { return [] }
  }
}
