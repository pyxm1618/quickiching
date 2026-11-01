'use client';
import React from 'react';
import Image from 'next/image';
import { visualRuntimeAssets } from '@/lib/visual-runtime-assets';
import type { CoinFace } from '@/domain/casting/three-coin/algorithm';

export function ThreeCoinFallback({
  faces,
  lightweight = false,
}: {
  faces: readonly [CoinFace, CoinFace, CoinFace];
  lightweight?: boolean;
}) {
  const size = lightweight ? 512 : 1024;
  return <div className="ritual-fallback" aria-hidden="true">{faces.map((face,index)=><Image
    key={index} quality={95} width={size} height={size} sizes="(max-width:800px) 160px, 250px"
    unoptimized={lightweight}
    src={face==='yang'?(lightweight?visualRuntimeAssets.coinFrontMobile:visualRuntimeAssets.coinFrontDesktop):(lightweight?visualRuntimeAssets.coinBackMobile:visualRuntimeAssets.coinBackDesktop)} alt=""
  />)}</div>;
}
