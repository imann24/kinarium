export interface BuildVersion { id: string; builtAt: number }
export function isBuildVersion(value: unknown): value is BuildVersion {
  if (!value || typeof value !== 'object') return false;
  const v = value as BuildVersion;
  return typeof v.id === 'string' && /^[a-f0-9-]{36}$/.test(v.id) && Number.isSafeInteger(v.builtAt) && v.builtAt > 0;
}
