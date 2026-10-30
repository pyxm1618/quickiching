'use client';
import React, {useEffect,useState,type ReactNode} from 'react';
import {COIN_MOTION_END_MS} from './three-coin-motion';
import {ArrowRight,Check} from 'lucide-react';
import type {ThreeCoinStep} from '@/domain/casting/three-coin/algorithm';

export function RitualCastPresentation({zh,motion,steps,visibleStep,complete,canRecord,resetting,restartDisabled,onRecord,onRestart,soundOn,onSound,children,error}: {
 zh:boolean;
 motion:string;steps:readonly ThreeCoinStep[];visibleStep:ThreeCoinStep|null;complete:boolean;canRecord:boolean;resetting:boolean;restartDisabled:boolean;
 onRecord:()=>void;onRestart:()=>void;soundOn:boolean;onSound:()=>void;children:ReactNode;error:ReactNode;
}) {
 const [castBeat,setCastBeat]=useState<'flight'|'landing'|'result'>('flight');
 const [recordEntered,setRecordEntered]=useState(false);
 useEffect(()=>{
  if(motion!=='casting'){setCastBeat('flight');return;}
  setRecordEntered(false);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  setCastBeat('flight');
  const exit=setTimeout(()=>setCastBeat('landing'),reduced?240:COIN_MOTION_END_MS-100);
  const result=setTimeout(()=>setCastBeat('result'),reduced?300:COIN_MOTION_END_MS+60);
  return ()=>{clearTimeout(exit);clearTimeout(result);};
 },[motion]);
 const t=(en:string,cn:string)=>zh?cn:en;
 const state=complete?'complete':canRecord||(motion==='casting'&&castBeat==='result')?'result':motion==='casting'?'casting':steps.length>0?'progress':'ready';
 useEffect(()=>{
  if(state!=='result')return;
  const duration=window.matchMedia('(prefers-reduced-motion: reduce)').matches?180:265;
  const timer=setTimeout(()=>setRecordEntered(true),duration);
  return ()=>clearTimeout(timer);
 },[state]);
 return <div className="ritual-cast-ui" data-ritual-view={state} data-resetting={resetting} data-flight-beat={castBeat}>
  <button type="button" className="ritual-back" onClick={onRestart} disabled={restartDisabled}>← {t('Back','返回')}</button>
  <button type="button" className="ritual-sound" onClick={onSound} aria-pressed={soundOn}>{soundOn?t('Sound on','声音开'):t('Sound off','声音关')}</button>
  <div className="ritual-cast-heading" key={state}>
   {state==='result'?<>
    <p className="ritual-stage-number">{t('Step 4 of 6','第 4 步 / 共 6 步')}</p>
    <h2 id="three-coin-tool-title">{t('Casting Result','掷币结果')}</h2>
    <p>{t('These are the faces of your three coins.','这是本次三枚铜钱落定的正反面。')}<br/>{t('Click below to record this cast.','点击下方记录这一爻。')}</p>
   </>:state==='progress'||state==='complete'?<>
    <p className="ritual-stage-number">{t('Step 5','第 5 步')}</p>
    <h2 id="three-coin-tool-title">{complete?t('Your Six Lines','六爻已成'):t('Repeat 6 Times','重复六次')}<br/>{complete?t('Are Complete','本次起卦已完成'):t('to Complete All Six Lines','完成全部六爻')}</h2>
    <p>{t('Cast the coins 6 times in order.','依次掷币六次。')}<br/>{t('Each result will form one line of the hexagram.','每次结果形成卦象中的一爻。')}</p>
   </>:<>
    <span className="ritual-ink" aria-hidden="true"/>
    <h2 id="three-coin-tool-title">{state==='casting'?t('Casting Coins…','铜钱起落…'):t('Cast the Coins','掷下铜钱')}</h2>
    <span className="ritual-cloud" aria-hidden="true"/>
    <p>{t('Focus on your question, keep a calm mind…','专注于你的问题，静下心来…')}<br/>{t('Three coins are being cast, and the result is about to reveal itself.','三枚铜钱即将落定，为你呈现本次结果。')}</p>
   </>}
  </div>
  {resetting&&!complete&&visibleStep?<div className="ritual-result-departure" data-result-departure aria-hidden="true">
   <div className="ritual-departing-result-heading">
    <p className="ritual-stage-number">{t('Step 4 of 6','第 4 步 / 共 6 步')}</p>
    <h2>{t('Casting Result','掷币结果')}</h2>
    <p>{t('These are the faces of your three coins.','这是本次三枚铜钱落定的正反面。')}<br/>{t('Click below to record this cast.','点击下方记录这一爻。')}</p>
   </div>
   <div className="ritual-face-labels ritual-departing-face-labels">{visibleStep.coinFaces.map((face,index)=><span key={index} data-face={face}>{face==='yang'?t('Heads','阳面'):t('Tails','阴面')}</span>)}</div>
   <div className="ritual-record-action ritual-departing-record-action">
    <button type="button" className="ritual-gold-button" disabled>{t('Record This Cast','记录这一爻')} <ArrowRight size={28}/></button>
    <p className="ritual-stage-number">{zh?`第 ${visibleStep.lineIndex+1} 爻 / 共 6 爻`:`Cast ${visibleStep.lineIndex+1} of 6`} · {visibleStep.lineValue}</p>
   </div>
  </div>:null}
  {state==='result'&&visibleStep?<>
   <div className="ritual-face-labels" aria-live="polite">{visibleStep.coinFaces.map((face,index)=><span key={index} data-face={face}>{face==='yang'?t('Heads','阳面'):t('Tails','阴面')}</span>)}</div>
   <div className="ritual-record-action" data-entered={recordEntered} data-settled-awaiting-record onAnimationEnd={event=>{if(event.target===event.currentTarget)setRecordEntered(true);}}>
    <button type="button" className="ritual-gold-button" data-record-this-cast disabled={!canRecord||!recordEntered} onClick={onRecord}>{t('Record This Cast','记录这一爻')} <ArrowRight size={28}/></button>
    <p className="ritual-stage-number">{zh?`第 ${visibleStep.lineIndex+1} 爻 / 共 6 爻`:`Cast ${visibleStep.lineIndex+1} of 6`} · {visibleStep.lineValue}</p>
   </div>
  </>:null}
  {state==='progress'||state==='complete'?<>
   <ol className="ritual-journey" aria-label={t('Ritual steps','起卦流程')}>
    {[['Open the Home Page','打开首页'],['Enter Your Question','输入问题'],['Throw 3 Coins (Repeat 6 Times)','掷三枚铜钱（重复六次）'],['View the 3 Coins Result','查看掷币结果'],['Repeat 6 Times to Complete All Six Lines','重复六次形成六爻'],['Generate Hexagram and Interpretation','保存后揭示卦象与解读']].map(([en,cn],index)=><li key={en} data-active={index===4} data-done={index<4}><span>{zh?`第 ${index+1} 步`:`Step ${index+1}`}</span><p>{zh?cn:index===2?<>{'Throw 3 Coins'}<br/>{'(Repeat 6 Times)'}</>:index===4?<>{'Repeat 6 Times to'}<br/>{'Complete All Six Lines'}</>:en}</p></li>)}
   </ol>
   <ol className="ritual-six-lines" aria-label={t('Six lines, bottom to top','自下而上的六爻')}>
    {[5,4,3,2,1,0].map(index=>{const step=steps[index];const yang=step?.lineValue===7||step?.lineValue===9;return <li key={index} data-line-position={index+1} data-state={step?'done':'waiting'} data-just-recorded={index===steps.length-1}>
     <span className="ritual-line-check">{step?<Check size={17}/>:null}</span><span>{zh?`第 ${index+1} 爻`:`No.${index+1}`}</span><span>{zh?step?`爻值 ${step.lineValue}`:'待起':`Line ${index+1}`}</span>
     <span className="ritual-line-symbol" data-yang={yang} data-sealed={Boolean(step)} aria-label={step?`${index+1}: ${step.lineValue}`:t('Not yet cast','尚未起出')}><i/><i/></span>
    </li>;})}
   </ol>
  </>:null}
  {state!=='result'&&state!=='complete'?<div className="ritual-cast-control">{children}<p>{t(`Cast ${steps.length+1} of 6 · Press, hold and release`, `第 ${steps.length+1} 爻 / 共 6 爻 · 按住并松开`)}</p></div>:null}
  {complete?<div data-completed-cast className="ritual-completion-status" role="status">{t('Six lines sealed. Preparing your saved reading…','六爻已落定，正在准备保存本次起卦…')}</div>:null}
  <div className="ritual-storage-notice">{error}</div>
 </div>;
}
