import type { Role } from '../navigation/roles';
export type Account = { id: number; name: string; email: string; role: Role };
export type Session = { token: string; user: Account; expiresAt: number };
export async function loginRequest(baseUrl: string, email: string, password: string): Promise<Session> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/mobile/login.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim().toLowerCase(), password }), signal: controller.signal });
    } catch { throw new Error('Cannot reach the sign-in server. Start the backend and check your Wi-Fi and API address.'); }
    if (response.status === 401) throw new Error('Incorrect email or password. Please try again.');
    if (response.status === 403) throw new Error('This account uses the Web portal. Sign in there instead.');
    if (response.status === 429) throw new Error('Too many sign-in attempts. Please try again in 15 minutes.');
    if (!response.ok) throw new Error('Sign-in is unavailable right now. Please try again shortly.');
    const data = await response.json();
    const user = data?.user;
    if (typeof data.token !== 'string' || !data.token || !Number.isFinite(data.expiresIn) || data.expiresIn <= 0 || data.expiresIn > 86400 || !user || !Number.isInteger(user.id) || typeof user.name !== 'string' || typeof user.email !== 'string' || !['botanist', 'conservation_officer'].includes(user.role)) throw new Error('The server returned an invalid account. Please contact your administrator.');
    return { token: data.token, user: { id: user.id, name: user.name, email: user.email, role: user.role }, expiresAt: Date.now() + data.expiresIn * 1000 };
  } finally { clearTimeout(timer); }
}

// Best effort: the token is also forgotten locally, and it expires on the server regardless.
export async function logoutRequest(baseUrl: string, token: string) {
  try { await fetch(`${baseUrl}/mobile/logout.php`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' }); }
  catch { /* Offline sign-out still clears the device. */ }
}
