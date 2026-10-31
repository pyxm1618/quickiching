'use client';
import React from 'react';
import Image from 'next/image';
import { visualRuntimeAssets } from '@/lib/visual-runtime-assets';
import type { CoinFace } from '@/domain/casting/three-coin/algorithm';

export function ThreeCoinFallback({faces}:{faces:readonly [CoinFace,CoinFace,CoinFace]}) {
  return <div className="ritual-fallback" aria-hidden="true">{faces.map((face,index)=><Image
    key={index} quality={95} width={1024} height={1024} sizes="(max-width:800px) 160px, 250px"
    src={face==='yang'?visualRuntimeAssets.coinFrontDesktop:visualRuntimeAssets.coinBackDesktop} alt=""
  />)}</div>;
}
