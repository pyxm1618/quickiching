import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {generateThreeCoinLine} from '@/domain/casting/three-coin/algorithm';
import {RitualCastPresentation} from './ritual-cast-presentation';

const callbacks={onRecord:()=>{},onRestart:()=>{},onSound:()=>{}};
const common={zh:false,motion:'idle',complete:false,canRecord:false,resetting:false,restartDisabled:false,soundOn:false,...callbacks,children:null,error:null};
describe('Ritual presentation consumes authoritative casts',()=>{
 it('labels the exact ordered authoritative faces without generating a second result',()=>{
  const bits=[true,false,false];let draws=0;
  const step=generateThreeCoinLine(0,()=>bits[draws++]);
  const html=renderToStaticMarkup(<RitualCastPresentation {...common} motion="settled" canRecord steps={[]} visibleStep={step}/>);
  expect([...html.matchAll(/data-face="([^"]+)"/g)].map(match=>match[1])).toEqual(step.coinFaces);
  expect(draws).toBe(3);
 });
 it('keeps Record disabled until its visual entrance completes',()=>{
  const step=generateThreeCoinLine(0,()=>true);
  const html=renderToStaticMarkup(<RitualCastPresentation {...common} motion="settled" canRecord steps={[]} visibleStep={step}/>);
  expect(html.match(/<button[^>]*data-record-this-cast[^>]*>/)?.[0]).toContain('disabled');
 });
 it('shows line six at the top, line one at the bottom, using only recorded steps',()=>{
  const steps=[generateThreeCoinLine(0,()=>true),generateThreeCoinLine(1,()=>false)];
  const html=renderToStaticMarkup(<RitualCastPresentation {...common} steps={steps} visibleStep={steps[1]}/>);
  expect([...html.matchAll(/data-line-position="(\d)" data-state="([^"]+)"/g)].map(match=>[Number(match[1]),match[2]])).toEqual([[6,'waiting'],[5,'waiting'],[4,'waiting'],[3,'waiting'],[2,'done'],[1,'done']]);
 });
});
