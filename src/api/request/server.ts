import axios from 'axios'

// Own key, deliberately distinct from practiq-fe's "practiq_token": the two
// apps log in independently (no SSO), each against the same auth-api-be, so
// each keeps its own token in its own localStorage.
const TOKEN_KEY = 'campus_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY)
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
    (error) => {
      if (error.response?.status === 401) {
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
