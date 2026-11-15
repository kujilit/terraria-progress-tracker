import type { ItemStatus } from '../types'

export interface ProgressRecord {
  worldId: string
  playerId: string
  itemId: string
  status: ItemStatus
  quantity: number
  updatedAt: string
}

export interface TrackerApi {
  health(): Promise<{ status: 'ok'; apiVersion: string }>
  getProgress(worldId: string, playerId: string): Promise<ProgressRecord[]>
  setProgress(record: Omit<ProgressRecord, 'updatedAt'>): Promise<ProgressRecord>
}

export class ApiError extends Error {
  constructor(message: string, public readonly code: string, public readonly status?: number) {
    super(message)
    this.name = 'ApiError'
  }
}
