import { useApiLoadingStore } from '../store/apiLoadingStore'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

declare global {
  interface Window {
    __aaFetchPatched?: boolean
  }
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function isApiRequest(input: RequestInfo | URL): boolean {
  const url = resolveUrl(input)
  if (!url) return false

  if (API_BASE) {
    return url.startsWith(API_BASE)
  }

  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.pathname.startsWith('/api/')
  } catch {
    return false
  }
}

export function setupGlobalApiLoading() {
  if (typeof window === 'undefined' || window.__aaFetchPatched) return

  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const shouldTrack = isApiRequest(input)

    if (shouldTrack) {
      useApiLoadingStore.getState().startRequest()
    }

    try {
      return await originalFetch(input, init)
    } finally {
      if (shouldTrack) {
        useApiLoadingStore.getState().finishRequest()
      }
    }
  }

  window.__aaFetchPatched = true
}
