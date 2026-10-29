'use client';
import React from 'react';
import {Bookmark,RotateCw} from 'lucide-react';
import type {PublicReading} from '@/domain/public-reading/types';

export function RitualResultCard({reading,primary,zh,onNewReading,onSave,saved}: {
 reading:PublicReading;primary:{englishName:string;chineseName:string;number:number;judgment:string;image:string};
 zh:boolean;onNewReading?:()=>void;onSave:()=>void;saved:boolean;
}) {
 return <section className="ritual-result-card" data-ritual-result-card aria-labelledby="ritual-primary-name">
  <header className="ritual-result-title"><h1 id="ritual-primary-name">{primary.englishName}</h1><p>{zh?`第 ${primary.number} 卦`:`Hexagram ${primary.number}`}</p><span className="ritual-result-seal">{primary.chineseName}</span></header>
  <div className="ritual-result-lines" aria-label={zh?'自下而上的六爻':'Six lines, bottom to top'}>
   {[5,4,3,2,1,0].map(index=><div key={index} className="ritual-result-bar" data-line-position={index+1} data-yang={reading.lineValuesBottomUp[index]===7||reading.lineValuesBottomUp[index]===9} aria-label={`${index+1}: ${reading.lineValuesBottomUp[index]}`}><i/><i/></div>)}
  </div>
  <div className="ritual-result-copy"><section><h2>{zh?'卦辞':'Judgment'}</h2><p>{primary.judgment}</p></section><section><h2>{zh?'象辞':'Image'}</h2><p>{primary.image}</p></section></div>
  <div className="ritual-result-actions">
   {onNewReading?<button type="button" onClick={onNewReading}><RotateCw aria-hidden="true"/>{zh?'重新起卦':'Cast Again'}</button>:null}
   <button type="button" onClick={onSave}><Bookmark aria-hidden="true"/>{saved?(zh?'已保存':'Saved'):(zh?'保存起卦':'Save Reading')}</button>
  </div>
 </section>;
}
