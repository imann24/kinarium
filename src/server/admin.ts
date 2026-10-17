import { body, digest, equal, json } from './security';

const COOKIE = '__Host-kinarium_admin';
const LOCAL_COOKIE = 'kinarium_admin_local';
const SESSION_MS = 30 * 60_000;

// Admin writes require a browser Origin even if no cookies were supplied (login
// CSRF matters too). A missing Origin is allowed only for read-only requests.
export function adminRequestAllowed(request: Request) {
  const url = new URL(request.url);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !local) return false;
  const site = request.headers.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = request.headers.get('Origin');
  return request.method === 'GET' ? !origin || origin === url.origin : origin === url.origin;
}

export class AdminAccess {
  constructor(private sql: SqlStorage, private secret?: string) {
    sql.exec('CREATE TABLE IF NOT EXISTS admin_sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL)');
    sql.exec('CREATE TABLE IF NOT EXISTS admin_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)');
  }
  private cookieName(request: Request) { return new URL(request.url).protocol === 'https:' ? COOKIE : LOCAL_COOKIE; }
  private cookie(request: Request, token: string, age: number) {
    return `${this.cookieName(request)}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
  }
  private token(request: Request) {
    const values = (request.headers.get('Cookie') || '').split(';').map(c => c.trim()).filter(c => c.startsWith(`${this.cookieName(request)}=`));
    return values.length === 1 ? values[0].split('=')[1] : '';
  }
  private sessionKey(token: string) { return digest(`${this.secret}\0${token}`); }
  // Returns a response for login/logout/errors, or null for authenticated calls.
  async authorize(request: Request): Promise<Response | null> {
    if (!this.secret) return json({ error: 'Administration is disabled. Configure KINARIUM_ADMIN_PASSWORD on the server.' }, 503);
    if (!adminRequestAllowed(request)) return json({ error: 'A same-origin, secure admin request is required.' }, 403);
    const path = new URL(request.url).pathname;
    const now = Date.now();
    this.sql.exec('DELETE FROM admin_sessions WHERE expires <= ?', now);
    if (path === '/api/admin/login' && request.method === 'POST') {
      const key = await digest(request.headers.get('CF-Connecting-IP') || 'local');
      this.sql.exec('DELETE FROM admin_limits WHERE expires <= ?', now);
      // One central Durable Object serializes these reservations across workers.
      // The global ceiling also bounds distributed guesses and stored IP hashes.
      for (const [bucket, max] of [['global', 50], [key, 5]] as const) {
        const row = this.sql.exec<{ count: number; expires: number }>('SELECT count,expires FROM admin_limits WHERE key=?', bucket).toArray()[0];
        if (row && row.count >= max) return json({ error: 'Too many sign-in attempts. Try again later.' }, 429, { 'Retry-After': String(Math.max(1, Math.ceil((row.expires - now) / 1000))) });
      }
      for (const bucket of ['global', key]) this.sql.exec('INSERT INTO admin_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1', bucket, now + 15 * 60_000);
      let input: Record<string, unknown>;
      try { input = await body(request); } catch { return json({ error: 'Invalid sign-in request.' }, 400); }
      if (typeof input.password !== 'string' || input.password.length > 1024) return json({ error: 'Invalid sign-in request.' }, 400);
      // Compare fixed-size hashes; neither credential nor derived hash is stored.
      if (!equal(await digest(input.password), await digest(this.secret))) return json({ error: 'Incorrect admin password.' }, 401);
      const token = crypto.randomUUID() + crypto.randomUUID();
      // Reauthentication replaces this browser's old session; rotation of the
      // server secret invalidates every session without persisting the secret.
      const old = this.token(request);
      if (old) this.sql.exec('DELETE FROM admin_sessions WHERE token=?', await this.sessionKey(old));
      this.sql.exec('INSERT INTO admin_sessions(token,expires) VALUES(?,?)', await this.sessionKey(token), now + SESSION_MS);
      return json({ ok: true }, 200, { 'Set-Cookie': this.cookie(request, token, SESSION_MS / 1000) });
    }
    const token = this.token(request);
    if (!/^[a-f0-9-]{72}$/.test(token)) return json({ error: 'Sign in to administer houses.' }, 401);
    const key = await this.sessionKey(token);
    if (!this.sql.exec('SELECT token FROM admin_sessions WHERE token=? AND expires>?', key, now).toArray().length) return json({ error: 'Your admin session has expired. Sign in again.' }, 401);
    if (path === '/api/admin/logout' && request.method === 'POST') {
      this.sql.exec('DELETE FROM admin_sessions WHERE token=?', key);
      return json({ ok: true }, 200, { 'Set-Cookie': this.cookie(request, '', 0) });
    }
    return null;
  }
}
