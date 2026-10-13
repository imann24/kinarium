export class ApiError extends Error { constructor(message: string, public status: number, public data: Record<string, unknown>) { super(message); } }
export async function api<T>(path: string, data?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api${path}`, { method: data === undefined ? 'GET' : 'POST', headers: data === undefined ? {} : { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), signal });
  const result = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new ApiError(typeof result.error === 'string' ? result.error : 'Something went wrong.', response.status, result);
  return result as T;
}
