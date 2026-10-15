import { ref } from 'vue'
export const currentUser = ref(null)
export const csrfTokenStr = ref('') 
let csrf = '', sessionRequest = null
export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status }
}
export function clearIdentity() { currentUser.value = null; csrf = '' }
export async function request(path, options = {}) {
  options.headers = options.headers || {}
  if (options.method && options.method !== 'GET') {
    options.headers['X-CSRF-Token'] = csrfTokenStr.value
  }

  let response
  try { 
    response = await fetch(path, { ...options, credentials: 'include' }) 
  } catch { 
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0) 
  }
  
  let body
  try { 
    body = await response.json() 
  } catch { 
    throw new ApiError('The server is unavailable. Please try again shortly.', response.status) 
  }
  if (body && body.csrf_token) {
    csrfTokenStr.value = body.csrf_token
  }
  if (!response.ok) {
    throw new ApiError(body.error || 'Request failed.', response.status)
  }
  return body
}
export async function refreshSession() {
  if (sessionRequest) return sessionRequest
  sessionRequest = (async () => {
    try {
      const body = await request('/auth/me.php')
      currentUser.value = body.user; csrf = body.csrf_token
      return body.user
    } catch (error) { if (error.status === 401) return null; throw error }
  })()
  try { return await sessionRequest } finally { sessionRequest = null }
}
export async function login(email, password) {
  csrf = (await request('/auth/csrf.php')).csrf_token
  const body = await request('/auth/login.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify({ email, password }) })
  currentUser.value = body.user; csrf = body.csrf_token
  return body.user
}
export async function register(name, email, password) {
  csrf = (await request('/auth/csrf.php')).csrf_token
  const body = await request('/auth/register.php', { 
    method: 'POST', 
    headers: { 
      'Content-Type': 'application/json', 
      'X-CSRF-Token': csrf
    }, 
    body: JSON.stringify({ name, email, password }) 
  })
  if (body.csrf_token) {
    csrf = body.csrf_token
  }
  return body
}

export async function logout() {
  if (await refreshSession()) await request('/auth/logout.php', { method: 'POST', headers: { 'X-CSRF-Token': csrf } })
  clearIdentity()
}
