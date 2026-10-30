'use client';
import React, { Component, useEffect, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { ThreeCoinFallback } from './three-coin-fallback';
import type { ThreeCoinSceneProps } from './three-coin-scene';

const Scene = dynamic(()=>import('./three-coin-scene'),{ssr:false});

class SceneLoadBoundary extends Component<ThreeCoinSceneProps & {children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError() {return {failed:true};}
  componentDidCatch(error:Error) {console.error('RITUAL_SCENE_LOAD_FAILED',error);this.props.onReady?.();}
  render() {
    return this.state.failed
      ? <div className="ritual-webgl" data-webgl-fallback="true" data-renderer="fallback">
          {!this.props.phase.endsWith('exit')?<ThreeCoinFallback faces={this.props.faces} />:null}
        </div>
      : this.props.children;
  }
}

export function ThreeCoinVisual(props:ThreeCoinSceneProps) {
  const [startScene,setStartScene]=useState(false);
  useEffect(()=>{
    if(startScene)return;
    // The idle homepage hero is decorative only. Loading the full Three.js scene before
    // intent creates avoidable main-thread work and does not produce any casting state.
    // Start it on the user's first real interaction, or immediately once the flow leaves
    // the idle hero (including restored/active casting sessions).
    const visualQaPinned=new URLSearchParams(window.location.search).has('ritualTime');
    if(props.phase!=='hero'||visualQaPinned) {
      let second=0;
      const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>setStartScene(true));});
      return ()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};
    }
    let cancelled=false;
    const activate=()=>{if(!cancelled)setStartScene(true);};
    const events=['pointerdown','keydown','touchstart'] as const;
    events.forEach(event=>window.addEventListener(event,activate,{once:true,passive:true}));
    return ()=>{
      cancelled=true;
      events.forEach(event=>window.removeEventListener(event,activate));
    };
  },[props.phase,startScene]);
  return <SceneLoadBoundary {...props}>{startScene?<Scene {...props} />:null}</SceneLoadBoundary>;
}
