import type { CoinFace } from '@/domain/casting/three-coin/algorithm';

export type CoinScenePhase = 'hero' | 'hero-exit' | 'ready' | 'progress' | 'casting' | 'settled' | 'reset' | 'exit';
export const COIN_LAUNCH_LEAD_MS = 80;
export const COIN_MOTION_END_MS = 1750;
export const CAST_ACTION_MS = 2070;
export const COIN_RESET_MS = 320;
export const COIN_EXIT_MS = 500;
const FLIGHT_DURATIONS = [1520,1500,1540] as const;
const PI = Math.PI;
const clamp = (value:number) => Math.max(0,Math.min(1,value));
const mix = (a:number,b:number,t:number) => a+(b-a)*t;
const smooth = (t:number) => t*t*(3-2*t);
const initialRotations: readonly [number,number,number][]=[[-.16,.09,.06],[.18,-.12,-.08],[-.15,.1,.1]];

export type CoinPose = {
  x:number;y:number;diameter:number;rotation:[number,number,number];rotationOrder:'XYZ'|'ZYX';settled:boolean;opacity:number;
};

// Decorative samples only: no casting random, derivation, persistence or navigation.
export function visualNoise(seed:number,sample:number):number {
  let value=(seed^Math.imul(sample+1,0x9e3779b9))>>>0;
  value=Math.imul(value^(value>>>16),0x21f0aaad);
  value=Math.imul(value^(value>>>15),0x735a2d97);
  return ((value^(value>>>15))>>>0)/4294967296;
}

// Presentation envelopes shared by the renderer and its specification tests.
export function particleCanEmit(birth:number,seed:number,sample:number):boolean {
  const settleStart=COIN_LAUNCH_LEAD_MS+FLIGHT_DURATIONS[0]*.82;
  return birth<=COIN_MOTION_END_MS+100 && (birth<settleStart || visualNoise(seed,sample+900)<.3);
}

export function castTrailIntensity(time:number,index:number):number {
  const launch=COIN_LAUNCH_LEAD_MS+index*65;
  if(time<launch)return 0;
  const progress=clamp((time-launch)/FLIGHT_DURATIONS[index]);
  const fade=1-smooth(clamp((time-launch-FLIGHT_DURATIONS[index])/220));
  return .48*(.25+.75*Math.sin(progress*PI))*fade;
}

// Integral of the specified acceleration / fast-spin / deceleration / settle envelope.
function spinProgress(progress:number,accelerationPower:number):number {
  const accelerationArea=.18/(accelerationPower+1);
  const total=accelerationArea+.5875;
  if(progress<=.18)return accelerationArea*Math.pow(progress/.18,accelerationPower+1)/total;
  if(progress<=.62)return (accelerationArea+progress-.18)/total;
  if(progress<=.82) {
    const t=progress-.62;return (accelerationArea+.44+t-1.875*t*t)/total;
  }
  const t=progress-.82;
  return (accelerationArea+.565+.25*t-.25*t*t/.36)/total;
}

export function coinPose(input:{
  phase:CoinScenePhase;face:CoinFace;index:number;time:number;seed:number;reducedMotion:boolean;
}):CoinPose {
  const {phase,face,index,time,seed,reducedMotion}=input;
  const resultX=[565,835,1105][index];
  const originX=835+(index-1)*60.8;
  const finalRotation:[number,number,number]=[face==='yang'?0:PI,0,0];
  const final:CoinPose={x:resultX,y:560,diameter:164,rotation:finalRotation,rotationOrder:'ZYX',settled:true,opacity:1};
  const initial=initialRotations[index];
  const ready:CoinPose={x:originX,y:800,diameter:164,rotation:[...initial],rotationOrder:'ZYX',settled:false,opacity:1};
  if(phase==='hero'||phase==='hero-exit') {
    const hero:CoinPose={x:[1017,1199,1213][index],y:[449,350,543][index],diameter:[185,165,205][index],
      rotation:[[-.87,.48,.40],[-.93,-.45,-.35],[-1.0,-.50,-.25]][index] as [number,number,number],rotationOrder:'XYZ',settled:true,opacity:1};
    if(phase==='hero')return hero;
    const t=smooth(clamp(time/(reducedMotion?140:260)));
    return {...hero,x:reducedMotion?hero.x:mix(hero.x,835,t),y:reducedMotion?hero.y:mix(hero.y,800,t),diameter:hero.diameter*(reducedMotion?1:1-.04*t),opacity:1-t};
  }
  if(phase==='settled')return final;
  if(phase==='progress')return {x:1008,y:542,diameter:235,rotation:[face==='yang'?-.08:PI-.08,.12,.06],rotationOrder:'ZYX',settled:true,opacity:index===0?1:0};
  if(phase==='ready')return ready;
  if(phase==='exit') {
    const t=smooth(clamp(reducedMotion?time/160:(time-220)/280));
    return {...final,y:reducedMotion?560:560-10*t,diameter:164*(reducedMotion?1:1-.04*t),opacity:1-t};
  }
  if(phase==='reset') {
    const t=clamp(time/(reducedMotion?140:COIN_RESET_MS));
    if(reducedMotion)return t<.5?{...final,opacity:1-t*2}:{...ready,opacity:(t-.5)*2};
    const eased=smooth(t);
    return {...ready,x:mix(resultX,originX,eased),y:mix(560,800,eased),diameter:164*(1-.06*Math.sin(t*PI)),
      rotation:initial.map((value,axis)=>mix(finalRotation[axis],value,eased)) as [number,number,number],opacity:1-.15*Math.sin(t*PI)};
  }
  const duration=reducedMotion?280:FLIGHT_DURATIONS[index];
  const delay=reducedMotion?0:COIN_LAUNCH_LEAD_MS+index*65;
  const progress=clamp((time-delay)/duration);
  if(progress===1)return final;
  if(reducedMotion) {
    const target:[number,number,number]=[face==='yin'?(initial[0]<0?-PI:PI):0,0,0];
    const eased=smooth(progress);
    const rotation=initial.map((value,axis)=>mix(value,target[axis],eased)) as [number,number,number];
    const lift=Math.sin(progress*PI)*40;
    return {
      x:mix(originX,resultX,eased),
      y:mix(800,560,eased)-lift,
      diameter:164,
      rotation,
      rotationOrder:'ZYX',
      settled:false,
      opacity:1,
    };
  }
  const peakDiameter=[210,190,215][index];
  const variance=visualNoise(seed,index)*3;
  const elevation=[2.4*210+variance,3.1*190-variance,2.3*215+variance][index];
  const peakX=[668,970,1079][index];
  const peakY=800-elevation;
  const rise=progress<=.46;
  const u=clamp(progress/.46);
  const vertical=index===0?smooth(Math.pow(u,1.127))
    :index===1?1.15*u+(3-2*1.15)*u*u+(1.15-2)*u*u*u
    :.06*u+(3-2*.06)*u*u+(.06-2)*u*u*u;
  const horizontal=index===0?smooth(Math.pow(u,1.58)):1-Math.pow(1-u,index===1?1.4:2);
  const descent=smooth(clamp((progress-.46)/.54));
  const x=rise?mix(originX,peakX,horizontal):mix(peakX,resultX,descent);
  const y=rise?mix(800,peakY,vertical):mix(peakY,560,descent);
  const guidance=smooth(clamp((progress-.72)/.28));
  const sizeEntry=smooth(clamp(progress/.18));
  const diameter=mix(mix(164,peakDiameter,sizeEntry),164,guidance);
  const spin=spinProgress(progress,index===2?8:index===1?1.8:1);
  const targetAngle=(index===1&&face==='yang'?6*PI:4*PI)+(face==='yin'?PI:0);
  const precession=Math.pow(Math.sin(spin*PI),index===0?2.5:2)*[1.53,2.4,2.7][index];
  const roll=Math.pow(Math.sin(clamp(progress/.72)*PI),index===2?10:1)*[.8,-.5,.5][index];
  return {x,y,diameter,rotation:[
    initial[0]*(1-spin)+targetAngle*spin,
    (precession+initial[1]*(1-spin))*(1-guidance),
    (roll+initial[2]*(1-spin))*(1-guidance),
  ],rotationOrder:'ZYX',settled:false,opacity:1};
}
