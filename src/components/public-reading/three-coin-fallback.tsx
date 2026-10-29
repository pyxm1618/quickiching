'use client';
import React from 'react';
import Image from 'next/image';
import type { CoinFace } from '@/domain/casting/three-coin/algorithm';

export function ThreeCoinFallback({faces}:{faces:readonly [CoinFace,CoinFace,CoinFace]}) {
  return <div className="ritual-fallback" aria-hidden="true">{faces.map((face,index)=><Image
    key={index} unoptimized width={2048} height={2048}
    src={`/ritual/coin-${face==='yang'?'front':'back'}-master.png`} alt=""
  />)}</div>;
}
