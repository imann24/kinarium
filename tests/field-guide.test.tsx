import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import FieldGuide from '../src/client/FieldGuide';

describe('FieldGuide', () => {
  it('renders a concise intro and collapsible accordion sections', () => {
    const html = renderToStaticMarkup(<FieldGuide />);
    const accordions = html.match(/<details class="guide-item"/g) ?? [];
    expect(accordions.length).toBe(5);
    expect(html).toContain('<details class="guide-item" open=""');
    expect(html).toContain('Meet the residents');
    expect(html).toContain('Conversations &amp; relationships');
    expect(html).toContain('Journal, bonds &amp; insights');
    expect(html).toContain('Give the house a nudge');
    expect(html).toContain('Shared worlds, time &amp; AI');
  });

  it('keeps total copy concise and free of internal server variable jargon', () => {
    const html = renderToStaticMarkup(<FieldGuide />);
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = text.split(' ').length;
    expect(wordCount).toBeLessThan(200);
    expect(text).not.toContain('LLM_ALLOWED_MODELS');
    expect(text).not.toContain('20 map units');
  });
});
