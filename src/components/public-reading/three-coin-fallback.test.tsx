import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe,it,expect } from 'vitest';
import { ThreeCoinFallback } from './three-coin-fallback';

describe('fallback consumes the same authoritative faces',()=>{
 for(let mask=0;mask<8;mask++)it(`keeps combination ${mask} in its original order`,()=>{
  const faces=Array.from({length:3},(_,index)=>mask&(1<<index)?'yang':'yin') as ['yang'|'yin','yang'|'yin','yang'|'yin'];
  const html=renderToStaticMarkup(<ThreeCoinFallback faces={faces}/>);
  const sources=Array.from(html.matchAll(/<img[^>]+src="([^"]+)"/g),match=>match[1]);
  expect(sources).toEqual(faces.map(face=>face==='yang'?'/ritual/coin-front-master.png':'/ritual/coin-back-master.png'));
  expect(faces).toHaveLength(3);
 });
});
