import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { modelOptions, resolveModel, validateModelSelection, enrichConversation, conversationCallCount, isLLMConfigured } from '../src/server/llm';
import { createWorld, applyCommand } from '../src/simulation/engine';
import { beginConversation } from '../src/simulation/conversations';
import { ModelSelection } from '../src/client/ModelSelection';
const config = { LLM_ALLOWED_MODELS: ' model-a, model-b, model-a, ,bad model', LLM_DEFAULT_MODEL: 'model-b' };
function fixture() {
  const world = createWorld({slug:'models',name:'Models'}, 0, 42);
  world.characters[0].model = 'model-a'; world.characters[1].model = 'model-b';
  const entry = beginConversation(world, world.characters[0], world.characters[1], false);
  return {world, entry};
}
describe('model configuration and selection', () => {
  it('trims, deduplicates, rejects malformed entries and resolves defaults', () => {
    expect(modelOptions(config)).toEqual({allowed:['model-a','model-b'],defaultModel:'model-b'});
    expect(resolveModel(config)).toBe('model-b'); expect(resolveModel(config,'removed')).toBe('model-b');
    expect(modelOptions({...config,LLM_DEFAULT_MODEL:'removed'}).defaultModel).toBe('model-a');
    expect(modelOptions({LLM_MODEL:' legacy '})).toEqual({allowed:['legacy'],defaultModel:'legacy'});
    expect(modelOptions({...config,LLM_ALLOWED_MODELS:' ,bad model, '}).defaultModel).toBeNull();
    expect(isLLMConfigured({...config,LLM_ALLOWED_MODELS:'',AI:{run:vi.fn()}})).toBe(false);
  });
  it('validates client values and persists choices through snapshot serialization', () => {
    expect(validateModelSelection(config,'')).toBeUndefined();
    for (const value of ['unknown',' model-a ',null,{},undefined]) expect(()=>validateModelSelection(config,value)).toThrow();
    const {world} = fixture();
    applyCommand(world,{type:'set-model',characterId:'c1',model:validateModelSelection(config,'model-b')},0);
    expect(JSON.parse(JSON.stringify(world)).characters[0].model).toBe('model-b');
    applyCommand(world,{type:'set-model',characterId:'c1'},0); expect(resolveModel(config,world.characters[0].model)).toBe('model-b');
  });
  it('renders a labeled native selector, default, removed-model explanation and busy state', () => {
    const {world} = fixture(); world.characters[0].model = 'removed';
    const html = renderToStaticMarkup(<ModelSelection character={world.characters[0]} models={modelOptions(config)} busy onChange={()=>{}}/>);
    expect(html).toContain('<label>Dialogue model'); expect(html).toContain('aria-describedby="model-help-c1"');
    expect(html).toContain('id="model-help-c1"'); expect(html).toContain('disabled=""');
    expect(html).toContain('no longer allowed'); expect(html).toContain('value="" selected=""');
  });
});
describe('mixed-model authorship', () => {
  it('routes each turn, shares growing context and bounds requests and tokens', async () => {
    const {world,entry} = fixture();
    const replies = ['Could we compare our ideas?', 'I would start with the quieter one.', 'Then let us leave that thought here.'];
    const run = vi.fn().mockImplementation(async (_model, inputs) => {
      const context = JSON.parse(inputs.messages[1].content);
      const speakerId = entry.characters[context.transcript.length % 2];
      return {response:JSON.stringify({turns:[{speakerId,text:replies[run.mock.calls.length-1]}]})};
    });
    expect(conversationCallCount(config,world,entry)).toBe(3);
    const result = await enrichConversation({...config,AI:{run}},world,entry);
    expect(result?.map(t=>t.text)).toEqual(replies);
    expect(run.mock.calls.map(c=>c[0])).toEqual(['model-b','model-a','model-b']);
    expect(run.mock.calls.map(c=>JSON.parse(c[1].messages[1].content).transcript.length)).toEqual([1,2,3]);
    expect(run.mock.calls.reduce((sum,c)=>sum+c[1].max_tokens,0)).toBe(900);
    expect(run.mock.calls[0][2].signal).toBe(run.mock.calls[2][2].signal);
    const context = JSON.parse(run.mock.calls[2][1].messages[1].content);
    expect(context.characters[0]).toHaveProperty('delivery'); expect(context.characters[0]).toHaveProperty('memories');
    expect(context.transcript[1].text).toBe(replies[0]); expect(entry.conversation!.turns).toHaveLength(1);
  });
  it('rejects another speaker and never publishes a partial plan or retries', async () => {
    const {world,entry} = fixture();
    const run = vi.fn().mockResolvedValueOnce({response:JSON.stringify({turns:[{speakerId:'c2',text:'A thought.'}]})}).mockRejectedValueOnce(new Error('offline'));
    expect(await enrichConversation({...config,AI:{run}},world,entry)).toBeNull(); expect(run).toHaveBeenCalledTimes(2);
    const wrong = vi.fn().mockResolvedValue({response:JSON.stringify({turns:[{speakerId:'c1',text:'Wrong author.'}]})});
    expect(await enrichConversation({...config,AI:{run:wrong}},world,entry)).toBeNull(); expect(wrong).toHaveBeenCalledTimes(1);
  });
  it('routes compatible-provider requests by speaker without changing credentials', async () => {
    const {world,entry} = fixture();
    const fetchMock = vi.fn().mockImplementation(async () => Response.json({choices:[{message:{content:JSON.stringify({turns:[{speakerId:entry.characters[fetchMock.mock.calls.length % 2],text:`Response number ${fetchMock.mock.calls.length}.`}]})}}]}));
    vi.stubGlobal('fetch',fetchMock);
    try {
      expect(await enrichConversation({...config,LLM_PROVIDER:'openai-compatible',LLM_BASE_URL:'https://example.invalid/v1',LLM_API_KEY:'test'},world,entry)).not.toBeNull();
      expect(fetchMock.mock.calls.map(c=>JSON.parse(c[1].body).model)).toEqual(['model-b','model-a','model-b']);
      expect(fetchMock.mock.calls.every(c=>c[1].headers.Authorization==='Bearer test')).toBe(true);
    } finally { vi.unstubAllGlobals(); }
  });
  it('does not start another request after the shared deadline expires', async () => {
    const {world,entry} = fixture();
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal,'timeout').mockReturnValue(controller.signal);
    const run = vi.fn().mockImplementation(async()=>{
      controller.abort();
      return {response:JSON.stringify({turns:[{speakerId:'c2',text:'A first thought.'}]})};
    });
    try { expect(await enrichConversation({...config,AI:{run}},world,entry)).toBeNull(); expect(run).toHaveBeenCalledTimes(1); }
    finally { timeout.mockRestore(); }
  });
  it('discards unrevealed old-model plans when a resident changes selection', () => {
    const {world,entry} = fixture();
    entry.conversation!.planned = [{speakerId:'c2',text:'Old-model reply.'}];
    const original = structuredClone(entry.conversation!.turns);
    applyCommand(world,{type:'set-model',characterId:'c1',model:'model-b'},0);
    expect(entry.conversation!.planned).toBeUndefined(); expect(entry.conversation!.turns).toEqual(original);
  });
  it('uses the default for legacy/removed choices and retains the one-model optimization', async () => {
    const {world,entry} = fixture(); world.characters[0].model = undefined; world.characters[1].model = 'removed';
    const run = vi.fn().mockResolvedValue({response:'invalid'});
    expect(conversationCallCount(config,world,entry)).toBe(1);
    await enrichConversation({...config,AI:{run}},world,entry); expect(run.mock.calls[0][0]).toBe('model-b');
  });
});
