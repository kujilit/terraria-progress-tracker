import type {
  AuthInput, BossRecord, CreateWorldInput, InventoryRecord, JoinWorldInput,
  ProgressRecord, TrackerApi, TrackerSession, TrackerWorld, TrackerPlayer,
} from './api'
import { ApiError } from './api'

interface Envelope<T> { success: boolean; data: T | null; error: { code: string; message: string } | null }

export class AppsScriptTrackerApi implements TrackerApi {
  readonly mode = 'remote' as const
  constructor(private readonly endpoint: string) {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/(exec|dev)$/.test(endpoint)) {
      throw new Error('VITE_API_BASE_URL must be a Google Apps Script /exec or /dev URL.')
    }
  }

  private async request<T>(action: string, payload: object = {}, token?: string): Promise<T> {
    let response: Response
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        mode: 'cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...payload, ...(token ? { token } : {}) }),
      })
    } catch {
      throw new ApiError('Не удалось связаться с Apps Script. Проверь URL, доступность Web App и CORS. При проблемах с CORS понадобится proxy.', 'NETWORK_ERROR')
    }
    let envelope: Envelope<T>
    try { envelope = await response.json() as Envelope<T> }
    catch { throw new ApiError('Apps Script вернул неожиданный ответ. Проверь deployment URL и redirect.', 'INVALID_RESPONSE', response.status) }
    if (!response.ok || !envelope.success || envelope.data === null) {
      throw new ApiError(envelope.error?.message || 'API request failed.', envelope.error?.code || 'HTTP_ERROR', response.status)
    }
    return envelope.data
  }

  health() { return this.request<{status:'ok';apiVersion:string}>('health') }
  createWorld(input: CreateWorldInput) { return this.request<TrackerSession>('world.create',input) }
  joinWorld(input: JoinWorldInput) { return this.request<TrackerSession>('world.join',input) }
  login(input: AuthInput) { return this.request<TrackerSession>('auth.login',input) }
  async logout(token: string) { await this.request<{loggedOut:boolean}>('auth.logout',{},token) }
  worldInfo(token: string) { return this.request<TrackerWorld>('world.info',{},token) }
  listPlayers(token: string) { return this.request<TrackerPlayer[]>('players.list',{},token) }
  getProgress(token: string) { return this.request<ProgressRecord[]>('progress.list',{},token) }
  setProgress(token: string,input: {itemId:string;status:ProgressRecord['status'];quantity:number}) {
    return this.request<ProgressRecord>('progress.set',input,token)
  }
  listBosses(token: string) { return this.request<BossRecord[]>('bosses.list',{},token) }
  setBossStatus(token:string,input:{bossId:string;status:'defeated'|'pending'}) {
    return this.request<BossRecord>('boss.setStatus',input,token)
  }
  listInventory(token:string) { return this.request<InventoryRecord[]>('inventory.list',{},token) }
  setInventory(token:string,input:{itemId:string;quantity:number}) {
    return this.request<InventoryRecord>('inventory.set',input,token)
  }
  transferInventory(token:string,input:{toPlayerId:string;itemId:string;quantity:number;idempotencyKey:string}) {
    return this.request<{duplicate:boolean;transferId:string}>('inventory.transfer',input,token)
  }
}
