import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  AuthInput, BossRecord, CreateWorldInput, InventoryRecord, Item, JoinWorldInput,
  ProgressRecord, TrackerApi, TrackerPlayer, TrackerSession, TrackerWorld,
} from './api'
import { ApiError } from './api'

type RpcEnvelope<T> = {
  success: boolean
  data: T | null
  error: { code: string; message: string } | null
}

export class SupabaseTrackerApi implements TrackerApi {
  readonly mode = 'remote' as const
  private readonly client: SupabaseClient | null

  constructor(url: string, publishableKey: string) {
    this.client = url && publishableKey
      ? createClient(url, publishableKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        })
      : null
  }

  private async rpc<T>(functionName: string, args: Record<string, unknown> = {}): Promise<T> {
    if (!this.client) {
      throw new ApiError(
        'Supabase не настроен. Добавь VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY в GitHub Actions Variables.',
        'CONFIGURATION_ERROR',
      )
    }

    const { data, error } = await this.client.rpc(functionName, args)
    if (error) {
      const rawMessage = error.message || 'Supabase request failed.'
      const match = rawMessage.match(/^([A-Z_]+):\s*(.*)$/)
      throw new ApiError(match?.[2] || rawMessage, match?.[1] || error.code || 'SUPABASE_ERROR')
    }

    if (data && typeof data === 'object' && 'success' in data) {
      const envelope = data as RpcEnvelope<T>
      if (!envelope.success || envelope.data === null) {
        throw new ApiError(
          envelope.error?.message || 'Supabase authentication failed.',
          envelope.error?.code || 'API_ERROR',
        )
      }
      return envelope.data
    }

    return data as T
  }

  health() {
    return this.rpc<{ status: 'ok'; apiVersion: string }>('tracker_health')
  }

  getCatalog(token: string) {
    return this.rpc<Item[]>('tracker_catalog_list', { p_token: token })
  }

  createWorld(input: CreateWorldInput) {
    return this.rpc<TrackerSession>('tracker_world_create', {
      p_world_name: input.worldName,
      p_player_name: input.playerName,
      p_pin: input.pin,
      p_game_class: input.gameClass,
      p_game_version: input.gameVersion || '1.4.5.x',
      p_difficulty: input.difficulty || 'Master',
      p_evil_biome: input.evilBiome || 'Crimson',
      p_seed: input.seed || '',
    })
  }

  joinWorld(input: JoinWorldInput) {
    return this.rpc<TrackerSession>('tracker_world_join', {
      p_join_code: input.joinCode,
      p_player_name: input.playerName,
      p_pin: input.pin,
      p_game_class: input.gameClass,
    })
  }

  login(input: AuthInput) {
    return this.rpc<TrackerSession>('tracker_auth_login', {
      p_join_code: input.joinCode,
      p_player_name: input.playerName,
      p_pin: input.pin,
    })
  }

  async logout(token: string) {
    await this.rpc<{ loggedOut: boolean }>('tracker_auth_logout', { p_token: token })
  }

  worldInfo(token: string) {
    return this.rpc<TrackerWorld>('tracker_world_info', { p_token: token })
  }

  listPlayers(token: string) {
    return this.rpc<TrackerPlayer[]>('tracker_players_list', { p_token: token })
  }

  getProgress(token: string) {
    return this.rpc<ProgressRecord[]>('tracker_progress_list', { p_token: token })
  }

  setProgress(token: string, input: { itemId: string; status: ProgressRecord['status']; quantity: number }) {
    return this.rpc<ProgressRecord>('tracker_progress_set', {
      p_token: token,
      p_item_id: input.itemId,
      p_status: input.status,
      p_quantity: input.quantity,
    })
  }

  listBosses(token: string) {
    return this.rpc<BossRecord[]>('tracker_bosses_list', { p_token: token })
  }

  setBossStatus(token: string, input: { bossId: string; status: 'defeated' | 'pending' }) {
    return this.rpc<BossRecord>('tracker_boss_set_status', {
      p_token: token,
      p_boss_id: input.bossId,
      p_status: input.status,
    })
  }

  listInventory(token: string) {
    return this.rpc<InventoryRecord[]>('tracker_inventory_list', { p_token: token })
  }

  setInventory(token: string, input: { itemId: string; quantity: number }) {
    return this.rpc<InventoryRecord>('tracker_inventory_set', {
      p_token: token,
      p_item_id: input.itemId,
      p_quantity: input.quantity,
    })
  }

  transferInventory(
    token: string,
    input: { toPlayerId: string; itemId: string; quantity: number; idempotencyKey: string },
  ) {
    return this.rpc<{ duplicate: boolean; transferId: string }>('tracker_inventory_transfer', {
      p_token: token,
      p_to_player_id: input.toPlayerId,
      p_item_id: input.itemId,
      p_quantity: input.quantity,
      p_idempotency_key: input.idempotencyKey,
    })
  }
}
