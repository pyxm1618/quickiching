'use client';
import React from 'react';
import Image from 'next/image';
import type { CoinFace } from '@/domain/casting/three-coin/algorithm';

export function ThreeCoinFallback({
  faces,
  lightweight = false,
}: {
  faces: readonly [CoinFace, CoinFace, CoinFace];
  lightweight?: boolean;
}) {
  const suffix = lightweight ? "mobile-512" : "master";
  const size = lightweight ? 512 : 2048;
  return <div className="ritual-fallback" aria-hidden="true">{faces.map((face,index)=><Image
    key={index} unoptimized width={size} height={size}
    src={`/ritual/coin-${face==='yang'?'front':'back'}-${suffix}.png`} alt=""
  />)}</div>;
}
