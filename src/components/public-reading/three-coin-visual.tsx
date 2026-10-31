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
    // Landing and question-confirm are form states; the Three.js scene is decorative there.
    // Starting it before the user enters the casting chamber can monopolize the main thread
    // and delay the confirmation controls. Canonical visual QA pins ritualTime and keeps the
    // original eager scene so pixel captures remain comparable.
    const visualQaPinned=new URLSearchParams(window.location.search).has('ritualTime');
    if((props.phase==='hero'||props.phase==='hero-exit')&&!visualQaPinned)return;
    let second=0;
    const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>setStartScene(true));});
    return ()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};
  },[props.phase,startScene]);
  return <SceneLoadBoundary {...props}>{startScene?<Scene {...props} />:null}</SceneLoadBoundary>;
}
