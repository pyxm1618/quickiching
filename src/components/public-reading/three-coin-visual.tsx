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
  const [startScene,setStartScene]=useState(()=>props.phase!=='hero');
  useEffect(()=>{
    if(startScene)return;
    // A landing hero may defer the renderer, but the formal ritual mounts this component
    // only after Landing. Hero-exit and all casting phases therefore start immediately.
    if(props.phase!=='hero') {
      setStartScene(true);
      return;
    }
    let cancelled=false;
    const activate=()=>{if(!cancelled)setStartScene(true);};
    const events=['pointerdown','keydown','touchstart','scroll'] as const;
    events.forEach(event=>window.addEventListener(event,activate,{once:true,passive:true}));
    return ()=>{
      cancelled=true;
      events.forEach(event=>window.removeEventListener(event,activate));
    };
  },[props.phase,startScene]);
  return <SceneLoadBoundary {...props}>
    {startScene
      ? <Scene {...props} />
      : <div className="ritual-webgl" data-renderer="deferred-fallback"><ThreeCoinFallback faces={props.faces} lightweight /></div>}
  </SceneLoadBoundary>;
}
