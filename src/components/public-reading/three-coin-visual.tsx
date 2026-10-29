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
    let second=0;
    const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>setStartScene(true));});
    return ()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};
  },[]);
  return <SceneLoadBoundary {...props}>{startScene?<Scene {...props} />:null}</SceneLoadBoundary>;
}
