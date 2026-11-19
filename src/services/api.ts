import type { GameClass, Item, ItemStatus } from '../types'

export interface TrackerWorld {
  id: string; name: string; joinCode: string; gameVersion: string
  difficulty: string; evilBiome: string; seed: string
}
export interface TrackerPlayer {
  id: string; name: string; gameClass: GameClass; role: 'owner' | 'admin' | 'member'
}
export interface TrackerSession {
  token: string; expiresAt: string | null; world: TrackerWorld; player: TrackerPlayer
}
export interface ProgressRecord {
  id: string; worldId: string; playerId: string; itemId: string
  status: ItemStatus; quantity: number; updatedAt: string
}
export interface BossRecord {
  id: string; worldId: string; bossId: string; status: 'defeated' | 'pending'
  defeatedAt: string; updatedBy: string
}
export interface InventoryRecord {
  id: string; worldId: string; playerId: string; itemId: string
  quantity: number; reservedQuantity: number; updatedAt: string
}
export interface AuthInput { joinCode: string; playerName: string; pin: string }
export interface CreateWorldInput {
  worldName: string; playerName: string; pin: string; gameClass: GameClass; gameVersion?: string
  difficulty?: string; evilBiome?: string; seed?: string
}
export interface JoinWorldInput extends AuthInput { gameClass: GameClass }

export interface TeamNote { id:string; title:string; body:string; status:'backlog'|'doing'|'done'; priority:'low'|'normal'|'high'; playerIds:string[]; createdBy:string; createdAt:string; updatedAt:string }

export interface TrackerApi {
  readonly mode: 'local' | 'remote'
  health(): Promise<{ status: 'ok'; apiVersion: string }>
  getCatalog(token: string): Promise<Item[]>
  createWorld(input: CreateWorldInput): Promise<TrackerSession>
  joinWorld(input: JoinWorldInput): Promise<TrackerSession>
  login(input: AuthInput): Promise<TrackerSession>
  logout(token: string): Promise<void>
  worldInfo(token: string): Promise<TrackerWorld>
  listPlayers(token: string): Promise<TrackerPlayer[]>
  setPlayerAdmin(token: string, playerId: string, isAdmin: boolean): Promise<TrackerPlayer>
  removePlayer(token: string, playerId: string): Promise<{ playerId: string }>
  getProgress(token: string): Promise<ProgressRecord[]>
  setProgress(token: string, input: { itemId: string; status: ItemStatus; quantity: number }): Promise<ProgressRecord>
  listBosses(token: string): Promise<BossRecord[]>
  setBossStatus(token: string, input: { bossId: string; status: 'defeated' | 'pending' }): Promise<BossRecord>
  listInventory(token: string): Promise<InventoryRecord[]>
  setInventory(token: string, input: { itemId: string; quantity: number }): Promise<InventoryRecord>
  transferInventory(token: string, input: { toPlayerId: string; itemId: string; quantity: number; idempotencyKey: string }): Promise<{ duplicate: boolean; transferId: string }>
  listNotes(token: string): Promise<TeamNote[]>
  saveNote(token: string, input: { id?: string; title: string; body: string; status: TeamNote['status']; priority: TeamNote['priority']; playerIds: string[] }): Promise<TeamNote>
  deleteNote(token: string, noteId: string): Promise<void>
}

export class ApiError extends Error {
  constructor(message: string, public readonly code: string, public readonly status?: number) {
    super(message)
    this.name = 'ApiError'
  }
}
