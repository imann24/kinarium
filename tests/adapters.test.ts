import { afterEach, describe, expect, it, vi } from 'vitest';
import { body, equal, passwordHash, validOrigin } from '../src/server/security';
import { enrichDialogue } from '../src/server/llm';
import { createWorld } from '../src/simulation/engine';
const world = createWorld({ slug: 'test', name: 'Test' }, 0, 42);
const entry = { id: 10, minute: 480, kind: 'conversation' as const, text: 'Milo shares a moment with Juniper. “Hello.”', characters: ['c1','c2'] };
afterEach(() => vi.unstubAllGlobals());
describe('provider boundary', () => {
  it('requires no network or key for ordinary procedural play', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch',fetch); expect(await enrichDialogue({},world,entry)).toBeNull(); expect(fetch).not.toHaveBeenCalled();
  });
  it('switches compatible providers and bounds generated output', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: 'I kept the kettle warm for you.' } }] })); vi.stubGlobal('fetch',fetch);
    expect(await enrichDialogue({ AI_GATEWAY_API_KEY:'test-key', LLM_BASE_URL:'https://provider.example/v1/', LLM_MODEL:'small-model' },world,entry)).toBe('I kept the kettle warm for you.');
    expect(fetch.mock.calls[0][0]).toBe('https://provider.example/v1/chat/completions');
    const sent = JSON.parse(fetch.mock.calls[0][1].body); expect(sent.model).toBe('small-model'); expect(sent.max_tokens).toBe(90);
  });
  it.each(['failed','long','empty','throw'])('keeps procedural dialogue on %s provider output', async failure => {
    const fetch = failure === 'throw' ? vi.fn().mockRejectedValue(new Error('offline')) : vi.fn().mockResolvedValue(failure === 'failed' ? new Response('no', { status: 429 }) : Response.json({choices:[{message:{content: failure === 'long' ? 'a'.repeat(300) : ''}}]}));
    vi.stubGlobal('fetch',fetch); expect(await enrichDialogue({AI_GATEWAY_API_KEY:'test-key'},world,entry)).toBeNull();
  });
});
describe('request and password boundary', () => {
  it('uses salted password derivation and rejects wrong passwords', async () => {
    const a = await passwordHash('password','salt-one'); const b = await passwordHash('password','salt-two'); const c = await passwordHash('wrong','salt-one');
    expect(a).not.toBe(b); expect(equal(a,c)).toBe(false); expect(equal(a,await passwordHash('password','salt-one'))).toBe(true);
  });
  it('rejects oversized and malformed JSON bodies', async () => {
    const req = (value: string) => new Request('https://example.com/api', {method:'POST',headers:{'Content-Type':'application/json'},body:value});
    await expect(body(req(JSON.stringify({text:'x'.repeat(9000)})))).rejects.toThrow('large');
    await expect(body(req('null'))).rejects.toThrow('object'); await expect(body(req('[]'))).rejects.toThrow('object');
    await expect(body(req('{bad}'))).rejects.toThrow(); expect(await body(req('{"type":"test"}'))).toEqual({type:'test'});
  });
  it('only accepts same-origin browser requests', () => {
    expect(validOrigin(new Request('https://kinarium.example/api',{headers:{Origin:'https://other.example'}}))).toBe(false);
    expect(validOrigin(new Request('https://kinarium.example/api',{headers:{Origin:'https://kinarium.example'}}))).toBe(true);
  });
});
