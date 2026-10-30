'use client';
import React,{useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';

// Presentation only: the caller has already decided auth, persistence and readiness.
export function RitualRevealTransition({stage,children}:{stage:'gate'|'result';children:ReactNode}) {
 const [cleared,setCleared]=useState(stage==='result');
 const lastGate=useRef<ReactNode>(null);
 useLayoutEffect(()=>{if(stage==='gate')lastGate.current=children;},[stage,children]);
 useEffect(()=>{
  if(stage==='gate'){setCleared(false);return;}
  if(!lastGate.current){setCleared(true);return;}
  const duration=window.matchMedia('(prefers-reduced-motion: reduce)').matches?160:240;
  const timer=setTimeout(()=>{setCleared(true);lastGate.current=null;},duration);
  return ()=>clearTimeout(timer);
 },[stage]);
 return <div data-ritual-reveal-stage={stage==='gate'?'gate':cleared?'result':'gate-exit'}>
  {stage==='gate'?children:cleared?children:<div className="ritual-gate-exiting" inert>{lastGate.current}</div>}
 </div>;
}
