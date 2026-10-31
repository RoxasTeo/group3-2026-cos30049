/** Shared HTTP client for the future Vue web app. Never put MySQL credentials in a frontend. */
export function createNiahApi({ baseUrl, getToken = () => null, fetchImpl = globalThis.fetch }) {
  const base = baseUrl.replace(/\/+$/, '');
  async function request(path, { method = 'GET', body, authenticated = true } = {}) {
    const token = getToken();
    if (authenticated && !token) throw new Error('Sign in before accessing records.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetchImpl(`${base}${path}`, { method, signal: controller.signal, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const data = await response.json();
      if (!response.ok) { const error = new Error(data.error || 'Request failed.'); error.status = response.status; throw error; }
      return data;
    } finally { clearTimeout(timer); }
  }
  return {
    login: (email, password) => request('/auth/login', { method: 'POST', authenticated: false, body: { email: email.trim().toLowerCase(), password } }),
    me: () => request('/auth/me'),
    listPlants: ({ search = '', limit = 25, offset = 0 } = {}) => request(`/plants?${new URLSearchParams({ search, limit: String(limit), offset: String(offset) })}`),
    getPlant: plantId => request(`/plants/${encodeURIComponent(plantId)}`),
    createPlant: record => request('/plants', { method: 'POST', body: record }),
  };
}
