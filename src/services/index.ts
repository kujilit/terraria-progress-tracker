import type { TrackerApi } from './api'
import { SupabaseTrackerApi } from './supabase-api'
import { localApi } from './local-api'

const mode = import.meta.env.VITE_API_MODE || 'local'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''

export const trackerApi: TrackerApi =
  mode === 'remote'
    ? new SupabaseTrackerApi(supabaseUrl, publishableKey)
    : localApi

export const isRemoteMode = trackerApi.mode === 'remote'
