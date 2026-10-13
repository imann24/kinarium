import { afterEach, describe, expect, it, vi } from 'vitest';
import { body, equal, passwordHash, validOrigin } from '../src/server/security';
import { DEFAULT_CLOUDFLARE_MODEL, enrichDialogue, isLLMConfigured, type LLMConfig } from '../src/server/llm';
import { createWorld } from '../src/simulation/engine';
const world = createWorld({ slug: 'test', name: 'Test' }, 0, 42);
const entry = { id: 10, minute: 480, kind: 'conversation' as const, text: 'Milo shares a moment with Juniper. “Hello.”', characters: ['c1','c2'] };
const compatible = { LLM_PROVIDER: 'openai-compatible', LLM_API_KEY: 'test-key', LLM_BASE_URL: 'https://provider.example/v1/', LLM_MODEL: 'small-model' };
afterEach(() => vi.unstubAllGlobals());
describe('provider boundary', () => {
  it('requires no network or key for ordinary procedural play', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch',fetch); expect(await enrichDialogue({},world,entry)).toBeNull(); expect(fetch).not.toHaveBeenCalled();
  });
  it('uses the native Cloudflare binding by default with bounded output and cancellation', async () => {
    const run = vi.fn().mockResolvedValue({response:'“I kept the kettle warm for you.”'});
    const fetch = vi.fn(); vi.stubGlobal('fetch',fetch);
    expect(await enrichDialogue({AI:{run}},world,entry)).toBe('I kept the kettle warm for you.');
    expect(run.mock.calls[0][0]).toBe(DEFAULT_CLOUDFLARE_MODEL);
    expect(run.mock.calls[0][1]).toMatchObject({max_tokens:90,temperature:.8});
    expect(run.mock.calls[0][2].signal).toBeInstanceOf(AbortSignal);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('accepts a different Cloudflare model without changing the simulation', async () => {
    const run = vi.fn().mockResolvedValue({response:'Hello.'});
    await enrichDialogue({AI:{run},LLM_MODEL:'@cf/meta/llama-3.2-3b-instruct'},world,entry);
    expect(run.mock.calls[0][0]).toBe('@cf/meta/llama-3.2-3b-instruct');
  });
  it.each(['disabled','unknown'])('does not call a provider or spend budget when %s', async LLM_PROVIDER => {
    const run = vi.fn(); const fetch = vi.fn(); vi.stubGlobal('fetch',fetch);
    const config = {...compatible, AI:{run}, LLM_PROVIDER};
    expect(isLLMConfigured(config)).toBe(false);
    expect(await enrichDialogue(config,world,entry)).toBeNull();
    expect(run).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('requires the selected provider to be configured before reserving a daily attempt', () => {
    expect(isLLMConfigured({...compatible,LLM_PROVIDER:'cloudflare'})).toBe(false);
    expect(isLLMConfigured({LLM_PROVIDER:'openai-compatible',LLM_API_KEY:'key'})).toBe(false);
    expect(isLLMConfigured(compatible)).toBe(true);
    expect(isLLMConfigured({AI:{run:vi.fn()}})).toBe(true);
  });
  it.each([null, {}, {response:42}, {response:'""'}, {response:'a'.repeat(300)}])('keeps procedural dialogue on malformed Cloudflare output %j', async result => {
    const run = vi.fn().mockResolvedValue(result);
    expect(await enrichDialogue({AI:{run}},world,entry)).toBeNull();
  });
  it('keeps procedural dialogue on Cloudflare errors without retrying another provider', async () => {
    const run = vi.fn().mockRejectedValue(new Error('quota exceeded'));
    const fetch = vi.fn(); vi.stubGlobal('fetch',fetch);
    expect(await enrichDialogue({...compatible,LLM_PROVIDER:'cloudflare',AI:{run}},world,entry)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('retains the old gateway key as an alias for explicitly configured compatible providers', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: 'Hello.' } }] })); vi.stubGlobal('fetch',fetch);
    const config: LLMConfig = {...compatible,LLM_API_KEY:undefined,AI_GATEWAY_API_KEY:'legacy-key'};
    expect(await enrichDialogue(config,world,entry)).toBe('Hello.');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer legacy-key');
  });
  it('switches compatible providers and bounds generated output', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: 'I kept the kettle warm for you.' } }] })); vi.stubGlobal('fetch',fetch);
    expect(await enrichDialogue(compatible,world,entry)).toBe('I kept the kettle warm for you.');
    expect(fetch.mock.calls[0][0]).toBe('https://provider.example/v1/chat/completions');
    const sent = JSON.parse(fetch.mock.calls[0][1].body); expect(sent.model).toBe('small-model'); expect(sent.max_tokens).toBe(90);
  });
  it.each(['failed','long','empty','throw'])('keeps procedural dialogue on %s provider output', async failure => {
    const fetch = failure === 'throw' ? vi.fn().mockRejectedValue(new Error('offline')) : vi.fn().mockResolvedValue(failure === 'failed' ? new Response('no', { status: 429 }) : Response.json({choices:[{message:{content: failure === 'long' ? 'a'.repeat(300) : ''}}]}));
    vi.stubGlobal('fetch',fetch); expect(await enrichDialogue(compatible,world,entry)).toBeNull();
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
