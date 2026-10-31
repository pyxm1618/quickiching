import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('next/link', () => ({default: ({href, children, ...rest}: any) => <a href={href} {...rest}>{children}</a>}));
import { ThreeCoinResultClient } from './three-coin-result-client';
const question = 'Should I change to a new job?';
const props = {
  initialUser: {id:'user',email:'test@example.com'}, initialCredits:1,
  initialState: {kind:'ready' as const,lineValues:[7,7,7,7,7,7],question},
  initialCastingView: {castingId:'saved-cast',context:question,lineValuesBottomUp:[7,7,7,7,7,7],readingReport:null,owns:true},
};
describe('one reading system with independent pages', () => {
  it('Free links to the dedicated deep page and has no questionnaire or paid body', () => {
    const html=renderToStaticMarkup(<ThreeCoinResultClient {...props}/>);
    expect(html).toContain('/readings/deep?session=saved-cast');
    expect(html).not.toContain('data-context-enrichment-form');
    expect(html).not.toContain('data-start-deep-reading');
    expect(html).not.toContain('data-deep-reading-report');
  });
  it('Deep uses the locked question without duplicating the free hexagram interpretation', () => {
    const html=renderToStaticMarkup(<ThreeCoinResultClient {...props} pageMode="deep"/>);
    expect(html).toContain('AI Deep Reading');
    expect(html).toContain('Your Question');
    expect(html).toContain(question);
    expect(html).toContain('View Free Reading');
    expect(html).toContain('href="/readings/result?session=saved-cast"');
    expect(html).toContain('data-start-deep-reading');
    expect(html).not.toContain('Cast Basis');
    expect(html).not.toContain('Primary Hexagram');
    expect(html).not.toContain('Relating Hexagram');
    expect(html).not.toContain('data-context-enrichment-form');
    expect(html).not.toContain('data-public-reading-result');
    expect(html).not.toContain('<textarea');
  });
});
