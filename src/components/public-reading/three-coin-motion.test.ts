import { describe, expect, it } from 'vitest';
import { coinPose, visualNoise, particleCanEmit, castTrailIntensity, COIN_MOTION_END_MS } from './three-coin-motion';

describe('pure Three.js presentation contract', () => {
  it('lands each of all eight authoritative combinations on the requested visible face', () => {
    for (let bits=0;bits<8;bits++) for(let index=0;index<3;index++) {
      const face = bits & (1<<index) ? 'yang' : 'yin';
      const pose=coinPose({phase:'casting',face,index,time:COIN_MOTION_END_MS,seed:12,reducedMotion:false});
      expect(Math.sign(Math.cos(pose.rotation[0])*Math.cos(pose.rotation[1]))).toBe(face==='yang'?1:-1);
      expect(pose.settled).toBe(true);
    }
  });
  it('keeps coin B obliquely readable at the canonical airborne sample',()=>{
    for(const face of ['yang','yin'] as const) {
      const pose=coinPose({phase:'casting',face,index:1,time:500,seed:1618,reducedMotion:false});
      const facing=Math.abs(Math.cos(pose.rotation[0])*Math.cos(pose.rotation[1]));
      expect(facing).toBeGreaterThan(.45);
      expect(facing).toBeLessThan(.95);
    }
  });
  it('freezes the same seed/time to identical poses and decorative samples', () => {
    const input={phase:'casting' as const,face:'yang' as const,index:1,time:700,seed:47,reducedMotion:false};
    expect(coinPose(input)).toEqual(coinPose(input));
    expect(visualNoise(47,8)).toBe(visualNoise(47,8));
    expect(visualNoise(47,8)).not.toBe(visualNoise(48,8));
  });
  it('does not let a decorative seed change the final orientation or result anchors', () => {
    for(const face of ['yang','yin'] as const) {
      const input={phase:'casting' as const,face,index:2,time:COIN_MOTION_END_MS,reducedMotion:false};
      expect(coinPose({...input,seed:3})).toEqual(coinPose({...input,seed:82}));
    }
  });
  it('reduces late particle emission by 60–80% and stops new emission after landing', () => {
    const samples=Array.from({length:1000},(_,index)=>index);
    expect(samples.every(index=>particleCanEmit(500,1618,index))).toBe(true);
    const lateRate=samples.filter(index=>particleCanEmit(1450,1618,index)).length/samples.length;
    expect(lateRate).toBeGreaterThanOrEqual(.2);
    expect(lateRate).toBeLessThanOrEqual(.4);
    expect(samples.some(index=>particleCanEmit(1851,1618,index))).toBe(false);
  });
  it('preserves a fading trail for 220ms after each authoritative landing', () => {
    for(const [index,landing] of [1600,1645,1750].entries()) {
      const atLanding=castTrailIntensity(landing,index);
      expect(atLanding).toBeGreaterThan(.01);
      expect(castTrailIntensity(landing+110,index)).toBeGreaterThan(0);
      expect(castTrailIntensity(landing+110,index)).toBeLessThan(atLanding);
      expect(castTrailIntensity(landing+220,index)).toBeCloseTo(0);
    }
    expect(castTrailIntensity(79,0)).toBeCloseTo(0);
  });
  it('reduced motion uses short visible lifts and begins the direct rotation at the ready orientation', () => {
    const input={face:'yin' as const,index:0,seed:1618,reducedMotion:true};
    let visibleRunStart:{x:number;y:number}|undefined;
    for(let time=0;time<=320;time+=10) {
      const pose=coinPose({...input,phase:'casting',time});
      if(pose.opacity<.1){visibleRunStart=undefined;continue;}
      visibleRunStart??=pose;
      expect(Math.hypot(pose.x-visibleRunStart.x,pose.y-visibleRunStart.y)).toBeLessThanOrEqual(.3*pose.diameter);
    }
    expect(coinPose({...input,phase:'casting',time:0}).rotation).toEqual(coinPose({...input,phase:'ready',time:0}).rotation);
  });
  it('reduced motion retains authoritative faces and settles within 320ms', () => {
    for(const face of ['yang','yin'] as const) for(let index=0;index<3;index++) {
      const pose=coinPose({phase:'casting',face,index,time:320,seed:10,reducedMotion:true});
      expect(pose.settled).toBe(true);
      expect(Math.sign(Math.cos(pose.rotation[0])*Math.cos(pose.rotation[1]))).toBe(face==='yang'?1:-1);
    }
  });
});
