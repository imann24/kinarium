import { describe, expect, it } from 'vitest';
import { assertAppropriate, isAppropriate } from '../src/simulation/content-filter';

describe('content filter', () => {
  it.each(['fuck', 'F U C K this', 'f.u.c.k', 'sh1t house', 'fuuuuck', 'The b!tch', 'a$$hole', 'n1gger', 'Nazi Haven'])('rejects %s', text => {
    expect(isAppropriate(text)).toBe(false);
  });
  it.each(['Scunthorpe', 'Dickens', 'Cassidy', 'Assistant', 'The Common House', 'Hancock Place', 'A pot of tea and a quiet bass line', "Grace O'Malley", 'Café Crème', '日本の家'])('allows %s', text => {
    expect(isAppropriate(text)).toBe(true);
  });
  it('throws a friendly labelled error', () => {
    expect(() => assertAppropriate('shit', 'house name')).toThrow(/different house name/);
    expect(() => assertAppropriate(undefined, 'x')).not.toThrow();
  });
});
