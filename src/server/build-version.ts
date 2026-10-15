import { isBuildVersion } from '../build-version';

// Read the manifest from this Worker's asset deployment, never a public CDN URL.
export async function deployedVersion(request: Request, assets: Pick<Fetcher, 'fetch'>): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store, max-age=0', 'Content-Type': 'application/json' };
  const nonce = new URL(request.url).searchParams.get('nonce');
  if (!nonce || !/^[a-f0-9-]{36}$/.test(nonce)) return new Response('{}', { status: 400, headers });
  try {
    const asset = await assets.fetch(new Request(new URL('/build-version.json', request.url)));
    if (!asset.ok) throw new Error('Missing build');
    const version: unknown = await asset.json();
    if (!isBuildVersion(version)) throw new Error('Invalid build');
    return new Response(JSON.stringify({ ...version, nonce }), { headers });
  } catch {
    return new Response('{}', { status: 503, headers });
  }
}
