export function json(value: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
}
export async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new Error('Send JSON with Content-Type application/json.');
  const reader = request.body?.getReader(); if (!reader) throw new Error('Missing request body.');
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 8192) { await reader.cancel(); throw new Error('Request is too large.'); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const value = JSON.parse(new TextDecoder().decode(bytes));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object.');
  return value;
}
export function string(value: unknown, max: number, fallback = '') { if (value === undefined) return fallback; if (typeof value !== 'string' || value.length > max) throw new Error(`Text must be no more than ${max} characters.`); return value.trim(); }
export function validOrigin(request: Request) { const origin = request.headers.get('Origin'); return !origin || origin === new URL(request.url).origin; }
const hex = (value: ArrayBuffer) => [...new Uint8Array(value)].map(b => b.toString(16).padStart(2, '0')).join('');
export async function digest(value: string) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))); }
export async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100_000, hash: 'SHA-256' }, key, 256));
}
export function equal(a: string, b: string) { let diff = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return diff === 0; }
