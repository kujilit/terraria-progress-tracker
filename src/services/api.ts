export interface ProgressRecord { worldId: string; playerId: string; itemId: string; status: string; quantity: number }
export interface TrackerApi {
  listProgress(worldId: string): Promise<ProgressRecord[]>
  setProgress(record: ProgressRecord): Promise<void>
}
export class ApiError extends Error {
  constructor(message: string, public readonly code: string) { super(message); this.name = 'ApiError' }
}
