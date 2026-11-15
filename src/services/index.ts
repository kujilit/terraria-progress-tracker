import type { TrackerApi } from './api'
import { AppsScriptTrackerApi } from './apps-script-api'
import { localApi } from './local-api'

const mode = import.meta.env.VITE_API_MODE || 'local'
const endpoint = import.meta.env.VITE_API_BASE_URL || ''

export const trackerApi: TrackerApi =
  mode === 'remote' && endpoint
    ? new AppsScriptTrackerApi(endpoint)
    : localApi

export const isRemoteMode = trackerApi.mode === 'remote'
