import axios from 'axios'

// Own key, deliberately distinct from practiq-fe's "practiq_token": the two
// apps log in independently (no SSO), each against the same auth-api-be, so
// each keeps its own token in its own localStorage.
const TOKEN_KEY = 'campus_token'
const REFRESH_TOKEN_KEY = 'campus_refresh_token'

const AUTH_BASE_URL = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:8082'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

/**
 * Swaps the refresh token for a new pair. Sessions created before refresh
 * tokens existed have none stored, so they simply end at the next 401 and
 * the person signs in again.
 *
 * Concurrent 401s share one in-flight call: a screen that fires five
 * requests at once would otherwise spend five refresh tokens, and rotation
 * means four of them come back already used.
 */
let refreshing: Promise<string | null> | null = null

async function refreshSession(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
  if (!refreshToken) return null

  try {
    const { data } = await axios.post(`${AUTH_BASE_URL}/auth/refresh`, {
      refresh_token: refreshToken
    })
    setToken(data.token)
    setRefreshToken(data.refresh_token)
    return data.token as string
  } catch {
    return null
  }
}

function refreshOnce(): Promise<string | null> {
  if (!refreshing) {
    refreshing = refreshSession()
    void refreshing.finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

function createAxiosInstance(baseURL: string) {
  const instance = axios.create({
    baseURL,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' }
  })

  instance.interceptors.request.use((config) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // Auth API ignores this. Campus API validates it as a selector, never as
    // authority; see RequireTenant in campus-be.
    const tenantID = localStorage.getItem('campus_tenant_id')
    if (tenantID && config.baseURL?.toString().includes('/api')) {
      config.headers['X-Campus-Tenant-ID'] = tenantID
    }
    return config
  })

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config
      const isRefreshCall = original?.url?.includes('/auth/refresh')

      if (error.response?.status === 401 && original && !original._retried && !isRefreshCall) {
        original._retried = true

        const token = await refreshOnce()
        if (token) {
          original.headers = original.headers ?? {}
          original.headers.Authorization = `Bearer ${token}`
          return instance(original)
        }

        removeToken()
        window.location.href = '/login'
      }

      return Promise.reject(error)
    }
  )

  return instance
}

// Shared identity service — login/register only, no other endpoint.
export const authApi = createAxiosInstance(
  import.meta.env.VITE_AUTH_API_URL || 'http://localhost:8082'
)

// Campus's own backend — everything else.
export const campusApi = createAxiosInstance(
  (import.meta.env.VITE_CAMPUS_API_URL || 'http://localhost:8084') + '/api'
)
