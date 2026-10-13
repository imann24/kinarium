import { describe, expect, it } from 'vitest';
import { characterMentions } from '../src/client/character-mentions';

describe('character names in historical text', () => {
  it('links repeated names throughout narrative and generated dialogue without altering text', () => {
    const text = 'Milo talks to Fern. “Fern, I saved you a seat.”';
    const parts = characterMentions(text,[{id:'c1',name:'Milo'},{id:'c2',name:'Fern'}],['c1','c2']);
    expect(parts.map(p=>p.text).join('')).toBe(text);
    expect(parts.filter(p=>p.characterIds).map(p=>p.characterIds)).toEqual([['c1'],['c2'],['c2']]);
  });
  it('matches full names first, Unicode names, punctuation, and possessives without partial words', () => {
    const text = "Ann Marie listens to Ann. Jo's and Élodie's notebooks are here; Joanne and Élodienne are not residents. A+B waves.";
    const names=['Ann','Ann Marie','Jo','Élodie','A+B'].map((name,i)=>({id:`c${i}`,name}));
    const parts=characterMentions(text,names);
    expect(parts.filter(p=>p.characterIds).map(p=>p.text)).toEqual(['Ann Marie','Ann','Jo','Élodie','A+B']);
    expect(parts.map(p=>p.text).join('')).toBe(text);
  });
  it('uses a recorded participant to distinguish duplicate names, and offers all IDs when ambiguous', () => {
    const names=[{id:'c1',name:'Milo'},{id:'c2',name:'Milo'}];
    expect(characterMentions('Milo leaves.',names,['c2'])[0].characterIds).toEqual(['c2']);
    expect(characterMentions('Milo speaks.',names,['c1','c2'])[0].characterIds).toEqual(['c1','c2']);
    expect(characterMentions('Milo speaks.',names)[0].characterIds).toEqual(['c1','c2']);
  });
  it('links mentions beyond the recorded participants and keeps unknown names as plain text', () => {
    expect(characterMentions('Fern remembers Wren.',[{id:'c1',name:'Fern'},{id:'c9',name:'Wren'}],['c1']).filter(p=>p.characterIds).map(p=>p.characterIds)).toEqual([['c1'],['c9']]);
    expect(characterMentions('Unknown people arrive.',[])).toEqual([{text:'Unknown people arrive.'}]);
  });
});
