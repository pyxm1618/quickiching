import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {generateThreeCoinLine} from '@/domain/casting/three-coin/algorithm';
import {RitualCastPresentation} from './ritual-cast-presentation';

const callbacks={onRecord:()=>{},onRestart:()=>{},onSound:()=>{}};
const common={zh:false,motion:'idle',complete:false,canRecord:false,resetting:false,restartDisabled:false,soundOn:false,...callbacks,children:null,error:null};
describe('Ritual presentation consumes authoritative casts',()=>{
 it.each([[false,'Casting Coins…'],[true,'铜钱起落…']] as const)('keeps one casting heading with intact localized text for zh=%s',(zh,text)=>{
  const html=renderToStaticMarkup(<RitualCastPresentation {...common} zh={zh} motion="casting" steps={[]} visibleStep={null}/>);
  const headings=[...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)];
  expect(headings).toHaveLength(1);
  expect(headings[0][1].replace(/<[^>]*>/g,'')).toBe(text);
  expect(headings[0][0]).toContain('qic-gilded-title');
  expect(headings[0][1]).not.toContain('<span');
 });
 it('labels the exact ordered authoritative faces without generating a second result',()=>{
  const bits=[true,false,false];let draws=0;
  const step=generateThreeCoinLine(0,()=>bits[draws++]);
  const html=renderToStaticMarkup(<RitualCastPresentation {...common} motion="settled" canRecord steps={[]} visibleStep={step}/>);
  expect([...html.matchAll(/data-face="([^"]+)"/g)].map(match=>match[1])).toEqual(step.coinFaces);
  expect(draws).toBe(3);
 });
 it.each([false,true])('keeps the record label and count free of arrows and line values during reset=%s',resetting=>{
  const step=generateThreeCoinLine(0,()=>true);
  const html=renderToStaticMarkup(<RitualCastPresentation {...common} motion="settled" canRecord steps={[]} visibleStep={step} resetting={resetting}/>);
  const actions=[...html.matchAll(/<div class="ritual-record-action[^\"]*"[^>]*>([\s\S]*?)<\/div>/g)].map(match=>match[1]);
  expect(actions).toHaveLength(resetting?2:1);
  for(const action of actions) {
   expect(action).toContain('>Record This Cast</button>');
   expect(action).toContain('>Cast 1 of 6</p>');
   expect(action).not.toContain('<svg');
   expect(action).not.toContain(' · ');
  }
 });
 it('keeps Record disabled until its visual entrance completes',()=>{
  const step=generateThreeCoinLine(0,()=>true);
  const html=renderToStaticMarkup(<RitualCastPresentation {...common} motion="settled" canRecord steps={[]} visibleStep={step}/>);
  expect(html.match(/<button[^>]*data-record-this-cast[^>]*>/)?.[0]).toContain('disabled');
 });
 it('locks the two reference Progress journey wraps without changing their wording',()=>{
  const step=generateThreeCoinLine(0,()=>true);
  const html=renderToStaticMarkup(<RitualCastPresentation {...common} steps={[step]} visibleStep={step}/>);
  expect(html).toContain('Throw 3 Coins<br/>(Repeat 6 Times)');
  expect(html).toContain('Repeat 6 Times to<br/>Complete All Six Lines');
 });
  it('keeps a non-interactive result departure layer during the reset after recording',()=>{
  const step=generateThreeCoinLine(0,()=>true);
  const html=renderToStaticMarkup(<RitualCastPresentation {...common} steps={[step]} visibleStep={step} resetting/>);
  expect(html).toContain('data-ritual-view="progress"');
  expect(html).toContain('data-result-departure="true"');
  expect(html).toContain('disabled');
 });
  it('matches the approved Progress reference order without changing recorded steps',()=>{
  const steps=[generateThreeCoinLine(0,()=>true),generateThreeCoinLine(1,()=>false)];
  const html=renderToStaticMarkup(<RitualCastPresentation {...common} steps={steps} visibleStep={steps[1]}/>);
  expect([...html.matchAll(/data-line-position="(\d)" data-state="([^"]+)"/g)].map(match=>[Number(match[1]),match[2]])).toEqual([[1,'done'],[2,'done'],[3,'waiting'],[4,'waiting'],[5,'waiting'],[6,'waiting']]);
 });
});
