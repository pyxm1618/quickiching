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
  const phase = props.phase;

  useEffect(()=>{
    if (typeof window === 'undefined') return;

    // Desktop (viewport >= 800px) and active casting/progression phases mount immediately
    // to preserve 100% identical Desktop Pixel QA and deterministic testing semantics.
    const isDesktop = window.innerWidth >= 800;
    if (isDesktop || phase !== 'hero') {
      let second = 0;
      const first = requestAnimationFrame(()=>{second = requestAnimationFrame(()=>setStartScene(true));});
      return ()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};
    }

    // Mobile hero phase (question-asking stage): defer heavy WebGL bundle and 512x512 coin
    // textures until early user interaction occurs or idle, in accordance with Technical Design
    // lines 612-613 and 1021 (mobile visual budget & non-blocking hydration).
    let cancelled = false;
    const activate = () => {
      if (!cancelled) setStartScene(true);
    };

    const interactionEvents = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;
    const onInteract = () => {
      interactionEvents.forEach(e => window.removeEventListener(e, onInteract));
      activate();
    };
    interactionEvents.forEach(e => window.addEventListener(e, onInteract, { once: true, passive: true }));

    // Safety timer so visual background coins eventually mount if user idles on mobile
    const timerId = setTimeout(activate, 5000);

    return () => {
      cancelled = true;
      interactionEvents.forEach(e => window.removeEventListener(e, onInteract));
      clearTimeout(timerId);
    };
  },[phase]);

  return <SceneLoadBoundary {...props}>{startScene?<Scene {...props} />:null}</SceneLoadBoundary>;
}
