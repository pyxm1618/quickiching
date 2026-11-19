import { describe, expect, it } from 'vitest';
import {Euler,Quaternion,Vector3} from 'three';
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
  it('keeps coin B obliquely readable with the reference major-axis attitude at the canonical airborne sample',()=>{
    for(const face of ['yang','yin'] as const) {
      const pose=coinPose({phase:'casting',face,index:1,time:500,seed:1618,reducedMotion:false});
      const facing=Math.abs(Math.cos(pose.rotation[0])*Math.cos(pose.rotation[1]));
      expect(facing).toBeGreaterThan(.45);
      expect(facing).toBeLessThan(.95);
      const normal=new Vector3(0,0,1).applyQuaternion(new Quaternion().setFromEuler(new Euler(...pose.rotation,pose.rotationOrder)));
      const majorAxis=(Math.atan2(-normal.y,normal.x)*180/Math.PI+270)%180;
      expect(majorAxis).toBeGreaterThan(27);
      expect(majorAxis).toBeLessThan(29);
    }
  });
  it('keeps all canonical airborne ellipses face-independent without changing landing faces', () => {
    const targets=[{x:734,y:498,ratio:.57,angle:42,textureAngle:14},{x:918,y:418,ratio:.50,angle:28,textureAngle:8},{x:1005,y:608,ratio:.91,angle:50,textureAngle:24}];
    for(const face of ['yang','yin'] as const) for(let index=0;index<3;index++) {
      const pose=coinPose({phase:'casting',face,index,time:500,seed:1618,reducedMotion:false});
      const q=new Quaternion().setFromEuler(new Euler(...pose.rotation,pose.rotationOrder));
      const normal=new Vector3(0,0,1).applyQuaternion(q);
      const horizontal=new Vector3(1,0,0).applyQuaternion(q);
      const angle=(Math.atan2(-normal.y,normal.x)*180/Math.PI+270)%180;
      const textureAngle=(Math.atan2(-horizontal.y,horizontal.x)*180/Math.PI+180)%180;
      const target=targets[index];
      expect(Math.abs(pose.x-target.x)).toBeLessThan(2);
      expect(Math.abs(pose.y-target.y)).toBeLessThan(3);
      expect(Math.abs(Math.abs(normal.z)-target.ratio)).toBeLessThan(.02);
      expect(Math.abs(angle-target.angle)).toBeLessThan(2);
      expect(Math.abs(textureAngle-target.textureAngle)).toBeLessThan(2);
    }
  });
  it('changes Euler order at launch without a position or physical-orientation jump', () => {
    for(const face of ['yang','yin'] as const) for(let index=0;index<3;index++) {
      const input={face,index,seed:1618,reducedMotion:false};
      const ready=coinPose({...input,phase:'ready',time:0});
      const airborne=coinPose({...input,phase:'casting',time:80+index*65+.0000001});
      const before=new Quaternion().setFromEuler(new Euler(...ready.rotation,ready.rotationOrder));
      const after=new Quaternion().setFromEuler(new Euler(...airborne.rotation,airborne.rotationOrder));
      expect(before.angleTo(after)).toBeLessThan(.000001);
      expect(Math.hypot(airborne.x-ready.x,airborne.y-ready.y)).toBeLessThan(.000001);
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
  it('keeps all three coins visible in the ready state used for every next cast', () => {
    for (let index=0;index<3;index++) {
      const pose=coinPose({phase:'ready',face:'yang',index,time:0,seed:1618,reducedMotion:false});
      expect(pose.opacity).toBe(1);
      expect(pose.diameter).toBe(164);
      expect(pose.settled).toBe(false);
    }
  });

  it('reduced motion keeps one continuous visible 3D path from the cast origin to the authoritative result anchor', () => {
    for(const face of ['yang','yin'] as const) for(let index=0;index<3;index++) {
      const input={face,index,seed:1618,reducedMotion:true};
      const ready=coinPose({...input,phase:'ready',time:0});
      const start=coinPose({...input,phase:'casting',time:0});
      expect(start.x).toBeCloseTo(ready.x,8);
      expect(start.y).toBeCloseTo(ready.y,8);
      expect(start.rotation).toEqual(ready.rotation);
      expect(start.opacity).toBe(1);

      let previous=start;
      for(let time=10;time<280;time+=10) {
        const pose=coinPose({...input,phase:'casting',time});
        expect(pose.opacity).toBe(1);
        expect(Math.hypot(pose.x-previous.x,pose.y-previous.y)).toBeLessThan(.2*pose.diameter);
        previous=pose;
      }

      const midpoint=coinPose({...input,phase:'casting',time:140});
      const directMidY=(ready.y+560)/2;
      expect(directMidY-midpoint.y).toBeCloseTo(40,5);

      const landed=coinPose({...input,phase:'casting',time:280});
      expect(landed.x).toBe([565,835,1105][index]);
      expect(landed.y).toBe(560);
      expect(landed.opacity).toBe(1);
      expect(landed.settled).toBe(true);
    }
  });
  it('reduced motion retains authoritative faces and settles within 320ms', () => {
    for(const face of ['yang','yin'] as const) for(let index=0;index<3;index++) {
      const pose=coinPose({phase:'casting',face,index,time:320,seed:10,reducedMotion:true});
      expect(pose.settled).toBe(true);
      expect(Math.sign(Math.cos(pose.rotation[0])*Math.cos(pose.rotation[1]))).toBe(face==='yang'?1:-1);
    }
  });
});
