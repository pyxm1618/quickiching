'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createCoinGeometry } from './three-coin-geometry';
import { ThreeCoinFallback } from './three-coin-fallback';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { TexturePass } from 'three/addons/postprocessing/TexturePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { CoinFace } from '@/domain/casting/three-coin/algorithm';
import { HERO_LIGHT_PATHS } from './ritual-light-paths';
import { coinPose, visualNoise, particleCanEmit, castTrailIntensity, CAST_ACTION_MS, type CoinScenePhase } from './three-coin-motion';

export type ThreeCoinSceneProps = {
  faces: readonly [CoinFace,CoinFace,CoinFace];
  phase: CoinScenePhase;
  visualSeed: number;
  onReady?:()=>void;
};

function makeEffects(seed:number) {
  const group=new THREE.Group();
  const heroCurves=HERO_LIGHT_PATHS.map(points=>new THREE.CatmullRomCurve3(points.map(([x,y])=>new THREE.Vector3(x,y,0)),false,'centripetal'));
  const samples=210;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(samples*3),3));
  const sizes=Float32Array.from({length:samples},(_,i)=>i<90?1.5+visualNoise(seed,i+500)*2.5:0.6+visualNoise(seed,i+500)*0.6);
  geometry.setAttribute('size',new THREE.BufferAttribute(sizes,1));
  geometry.setAttribute('opacity',new THREE.BufferAttribute(new Float32Array(samples),1));
  const material=new THREE.ShaderMaterial({
    uniforms:{intensity:{value:0},dpr:{value:1}},transparent:true,depthWrite:false,
    blending:THREE.AdditiveBlending,
    vertexShader:`attribute float size;attribute float opacity;varying float vOpacity;varying float vCore;varying float vPrimary;uniform float dpr;void main(){vPrimary=step(1.5,size);float diameter=size+mix(1.2,4.,vPrimary);vCore=size/diameter;vOpacity=opacity;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=diameter*dpr;}`,
    fragmentShader:`uniform float intensity;varying float vOpacity;varying float vCore;varying float vPrimary;void main(){float d=length(gl_PointCoord-.5)*2.;float core=1.-smoothstep(vCore*.55,vCore,d);float halo=exp(-d*d*5.)*.18*(1.-core);float a=min(.5,(core+halo)*intensity*vOpacity*mix(.4,1.,vPrimary));vec3 color=mix(vec3(1.25,.38,.05),vec3(2.8,1.18,.22),core);gl_FragColor=vec4(color,a);}`,
  });
  const points=new THREE.Points(geometry,material);group.add(points);
  // Warm curved traces and broad translucent qi ribbons are separate effects.
  const strands=Array.from({length:12},(_,index)=> {
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(100*2*3),3));
    geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(100*2*2),2));
    const indices=[];for(let i=0;i<99;i++) {const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}geometry.setIndex(indices);
    const material=new THREE.ShaderMaterial({
      uniforms:{intensity:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec2 vUv;uniform float intensity;void main(){float d=abs(vUv.x-.5)*2.;float core=exp(-d*d*24.);float halo=exp(-d*d*5.)*.25;float ends=sin(vUv.y*3.14159);vec3 radiance=mix(vec3(1.35,.4,.07),vec3(2.45,1.08,.2),core);gl_FragColor=vec4(radiance,min(.28,(core+halo)*ends*intensity));}`,
    });
    const ribbon=new THREE.Mesh(geometry,material);group.add(ribbon);return ribbon;
  });
  const glowMaterial=new THREE.ShaderMaterial({
    uniforms:{intensity:{value:0},radiance:{value:new THREE.Vector3(1.5,.6,.1)}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float intensity;uniform vec3 radiance;void main(){vec2 p=(vUv-.5)*2.;float a=exp(-dot(p,p)*5.)*intensity;gl_FragColor=vec4(radiance,a);}`,
  });
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(300,180),glowMaterial);group.add(glow);
  const baseGlowMaterial=glowMaterial.clone();baseGlowMaterial.uniforms.radiance.value.set(4,1.6,.22);
  const baseGlow=new THREE.Mesh(new THREE.PlaneGeometry(140,70),baseGlowMaterial);group.add(baseGlow);
  const qi=Array.from({length:4},(_,strand)=> {
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(100*2*3),3));
    geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(100*2*2),2));
    const indices=[];for(let i=0;i<99;i++) {const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}geometry.setIndex(indices);
    const material=new THREE.ShaderMaterial({
      uniforms:{intensity:{value:0},flowTime:{value:0},strandSeed:{value:visualNoise(seed,strand+1200)*100}},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`
        varying vec2 vUv;uniform float intensity;uniform float flowTime;uniform float strandSeed;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+strandSeed)*43758.5453);}
        float noise(vec2 p){vec2 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(cell),hash(cell+vec2(1.,0.)),f.x),mix(hash(cell+vec2(0.,1.)),hash(cell+vec2(1.,1.)),f.x),f.y);}
        float wisps(vec2 p){return .57*noise(p)+.29*noise(p*2.03+17.1)+.14*noise(p*4.07+31.7);}
        void main(){
          vec2 drift=vec2(vUv.x*3.,vUv.y*8.-flowTime);
          float curl=wisps(drift*.7+strandSeed)-.5;
          float across=vUv.x+curl*.32;
          float edges=pow(max(0.,sin(clamp(across,0.,1.)*3.14159)),2.);
          float density=smoothstep(.18,.62,wisps(drift+vec2(curl,0.)));
          float a=edges*sin(vUv.y*3.14159)*density*intensity;
          gl_FragColor=vec4(.91,.73,.53,a);
        }`,
    });
    const mesh=new THREE.Mesh(geometry,material);group.add(mesh);return mesh;
  });
  const historyMatrices=Array.from({length:3},()=>Array.from({length:100},()=>new THREE.Matrix4()));
  const centers=Array.from({length:12},()=>new Float32Array(300));
  const projected=Array.from({length:12},()=>new Float32Array(200));
  return {group,points,strands,glow,baseGlow,qi,heroCurves,historyMatrices,centers,projected};
}

export default function ThreeCoinScene(props:ThreeCoinSceneProps) {
  const host=useRef<HTMLDivElement>(null);
  const current=useRef(props);current.current=props;
  const invalidate=useRef<()=>void>(()=>{});
  const [fallback,setFallback]=useState(false);
  useEffect(()=> {
    const container=host.current;if(!container)return;
    const requestedTime=location.hostname==='127.0.0.1'?new URLSearchParams(location.search).get('ritualTime'):null;
    const fixedTime=requestedTime===null?null:Number(requestedTime);
    if(fixedTime!==null && (!Number.isFinite(fixedTime)||fixedTime<0||fixedTime>10000))throw new Error('RITUAL_QA_TIME_INVALID: expected finite milliseconds between 0 and 10000');
    let readinessAnnounced=false;
    function announceReady() {if(!readinessAnnounced){readinessAnnounced=true;current.current.onReady?.();}}
    let renderer:THREE.WebGLRenderer;
    try {renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});}
    catch(error) {console.error('RITUAL_WEBGL_UNAVAILABLE',error);setFallback(true);announceReady();return;}
    const scene=new THREE.Scene();
    const environmentRoom=new RoomEnvironment();
    const environmentGenerator=new THREE.PMREMGenerator(renderer);
    const environmentTarget=environmentGenerator.fromScene(environmentRoom,0.04);
    scene.environment=environmentTarget.texture;
    environmentRoom.dispose();environmentGenerator.dispose();
    const camera=new THREE.PerspectiveCamera(35,1672/941,1,10000);
    camera.position.z=941/(2*Math.tan(35*Math.PI/360));
    renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
    const sceneTarget=new THREE.WebGLRenderTarget(1672,941,{type:THREE.HalfFloatType});
    const composer=new EffectComposer(renderer);
    composer.addPass(new TexturePass(sceneTarget.texture));
    const bloom=new UnrealBloomPass(new THREE.Vector2(1672,941),0.6,0.3,1.0);
    composer.addPass(bloom);
    // Preserve the DOM room under transparent pixels; bloom never replaces the room.
    composer.addPass(new ShaderPass({
      uniforms:{tDiffuse:{value:null},baseTexture:{value:sceneTarget.texture}},
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform sampler2D tDiffuse;uniform sampler2D baseTexture;varying vec2 vUv;
        void main(){vec4 lit=texture2D(tDiffuse,vUv);vec4 base=texture2D(baseTexture,vUv);
        vec3 aura=max(vec3(0.),lit.rgb-base.rgb);float glow=max(aura.r,max(aura.g,aura.b));
        gl_FragColor=vec4(lit.rgb,clamp(base.a+glow*.35,0.,1.));}`,
    }));
    composer.addPass(new OutputPass());
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden','true');
    const loader=new THREE.TextureLoader();
    let disposed=false;
    let texturesLoaded=0;
    function textureReady() {texturesLoaded+=1;if(texturesLoaded===2)render();}
    // Non-QA phones sample the same master artwork at a bounded texture resolution.
    // Canonical Desktop always loads both untouched production masters directly.
    const textureSuffix=window.innerWidth<800?'mobile-512':'master';
    const textures=[loader.load(`/ritual/coin-front-${textureSuffix}.png`,textureReady,undefined,onTextureError),loader.load(`/ritual/coin-back-${textureSuffix}.png`,textureReady,undefined,onTextureError)];
    textures.forEach(texture=>{texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();});
    const {geometry:coinGeometry}=createCoinGeometry();
    const edgeMaterial=new THREE.MeshStandardMaterial({map:textures[0],bumpMap:textures[0],bumpScale:0.0008,color:0x9a6b32,metalness:0.9,roughness:0.36});
    const faceMaterials=textures.map(map=>new THREE.MeshStandardMaterial({map,color:0x5f5f5f,bumpMap:map,bumpScale:0.0015,metalness:0.82,roughness:0.4,envMapIntensity:0.12,emissive:0xb77022,emissiveMap:map,emissiveIntensity:0.003}));
    const haloGeometry=new THREE.PlaneGeometry(2.5,2.5);
    const haloMaterial=new THREE.ShaderMaterial({uniforms:{strength:{value:.18}},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
      vertexShader:`varying vec2 p;void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float strength;varying vec2 p;void main(){float d=(length(p)-1.);float a=exp(-d*d*350.)*(.2+.8*pow(max(0.,dot(normalize(p),normalize(vec2(-1.,1.)))),3.));gl_FragColor=vec4(1.,.6,.15,a*strength);}`,
    });
    const coins=Array.from({length:3},()=> {
      const coin=new THREE.Group();
      const halo=new THREE.Mesh(haloGeometry,haloMaterial.clone());halo.position.z=-0.13;coin.add(halo);
      coin.add(new THREE.Mesh(coinGeometry,[faceMaterials[0],faceMaterials[1],edgeMaterial]));
      scene.add(coin);return coin;
    });
    scene.add(new THREE.AmbientLight(0xffffff,0.12));
    const key=new THREE.DirectionalLight(0xfff1d3,1.15);key.position.set(700,-500,500);scene.add(key);
    const rim=new THREE.DirectionalLight(0xffae48,4.5);rim.position.set(700,-100,-600);scene.add(rim);
    const fill=new THREE.DirectionalLight(0xffefcd,0.16);fill.position.set(-700,-200,800);scene.add(fill);
    const effects=makeEffects(current.current.visualSeed);scene.add(effects.group);
    effects.group.position.z=-480;effects.group.scale.setScalar((camera.position.z+480)/camera.position.z);
    let frame=0;
    // A terminal stage restored before the module loads must not replay absent Hero coins.
    let start=performance.now()-(current.current.phase==='hero-exit'?260:current.current.phase==='exit'?500:0);
    let previousPhase=current.current.phase;let previousSeed=current.current.visualSeed;
    let width=1672,height=941,renderDpr=1;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const samplePosition=new THREE.Vector3(),sampleDirection=new THREE.Vector3(),sampleScale=new THREE.Vector3();
    const sampleOrientation=new THREE.Quaternion(),sampleLocal=new THREE.Quaternion();
    const sampleEuler=new THREE.Euler(),rimPoint=new THREE.Vector3(),projection=new THREE.Vector3();
    const normalZ=new THREE.Vector3(0,0,1),inverseEffects=new THREE.Matrix4();
    function onTextureError(error:unknown) {if(!disposed){console.error('RITUAL_TEXTURE_UNAVAILABLE',error);setFallback(true);announceReady();}}
    function contextLost(event:Event) {event.preventDefault();setFallback(true);announceReady();}
    renderer.domElement.addEventListener('webglcontextlost',contextLost);
    function resize() {
      const rect=container!.getBoundingClientRect();width=rect.width;height=rect.height;
      renderDpr=width<800?Math.min(window.devicePixelRatio,1):window.devicePixelRatio;
      renderer.setPixelRatio(renderDpr);renderer.setSize(width,height,false);
      sceneTarget.setSize(width*renderDpr,height*renderDpr);
      composer.setPixelRatio(renderDpr);composer.setSize(width,height);
      camera.aspect=width/height;camera.updateProjectionMatrix();
      render();
    }
    function render() {
      if(disposed)return;
      const input=current.current;
      if(input.phase!==previousPhase || input.visualSeed!==previousSeed) {start=performance.now();previousPhase=input.phase;previousSeed=input.visualSeed;}
      if(texturesLoaded<2)return;
      const time=input.phase==='hero'?700:fixedTime===null?performance.now()-start:Number(fixedTime);
      const scale=Math.min(width/1672,height/941)*941/height;
      let layerOpacity=0;
      key.intensity=input.phase==='progress'?.55:1.15;fill.intensity=input.phase==='progress'?.1:.16;
      coins.forEach((coin,index)=> {
        const pose=coinPose({phase:input.phase,face:input.faces[index],index,time,seed:input.visualSeed,reducedMotion:reduced.matches});
        const physicalDiameter=190;
        const depth=camera.position.z*(1-physicalDiameter/pose.diameter);
        const projectionCorrection=(camera.position.z-depth)/camera.position.z;
        coin.position.set((pose.x-836)*scale*projectionCorrection,(470.5-pose.y)*scale*projectionCorrection,depth);
        coin.scale.setScalar(physicalDiameter*scale/(2*1.012));
        coin.lookAt(camera.position);
        const viewOrientation=coin.quaternion.clone();
        coin.rotation.set(...pose.rotation,pose.rotationOrder);coin.quaternion.premultiply(viewOrientation);
        coin.visible=pose.opacity>0;layerOpacity=Math.max(layerOpacity,pose.opacity);
        const halo=coin.children[0] as THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
        halo.material.uniforms.strength.value=input.phase==='settled'?(index===0?.55:.06):.18;
        coin.userData.targetFace=input.faces[index];coin.userData.settled=pose.settled;
      });
      container!.style.opacity=String(layerOpacity);
      const progressScene=input.phase==='progress';
      const heroScene=input.phase==='hero'||input.phase==='hero-exit'||progressScene;
      const active=!reduced.matches && (heroScene||input.phase==='casting');
      const envelope=heroScene?0.65:Math.sin(Math.min(1,time/2110)*Math.PI);
      const energy=active?Math.max(0,envelope):0;
      effects.group.visible=energy>0;
      if(active) {
      const effectTime=heroScene?700:time;
      const originX=progressScene?1008:heroScene?1120:835;
      const originY=790;
      const position=effects.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      const opacities=effects.points.geometry.getAttribute('opacity') as THREE.BufferAttribute;
      const sizes=effects.points.geometry.getAttribute('size') as THREE.BufferAttribute;
      for(let i=0;i<position.count;i++) {
        sizes.setX(i,i<90?1.5+visualNoise(input.visualSeed,i+500)*2.5:0.6+visualNoise(input.visualSeed,i+500)*0.6);
        const n=visualNoise(input.visualSeed,i);const altitude=Math.pow(visualNoise(input.visualSeed,i+200),1.35)*(heroScene?500:430);
        const angle=n*Math.PI*2+effectTime/1000*0.3;
        const age=((effectTime+n*1900)%1900)/1900;
        const radius=visualNoise(input.visualSeed,i+300)*(i%20<13?150:280);
        let x=originX+Math.cos(angle)*radius;
        let y=originY-altitude-age*45;
        if(heroScene && i%20>=13 && i%20<18) {
          const anchor=effects.heroCurves[i%effects.heroCurves.length].getPoint(n);
          x=anchor.x+(progressScene?-112:0)+(visualNoise(input.visualSeed,i+400)-.5)*20;
          y=anchor.y-age*20;
        }
        const birth=effectTime-age*1900;
        opacities.setX(i,particleCanEmit(birth,input.visualSeed,i)?Math.min(1,age*8,(1-age)*8):0);
        position.setXYZ(i,(x-836)*scale,(470.5-y)*scale,20);
      }
      position.needsUpdate=true;opacities.needsUpdate=true;sizes.needsUpdate=true;
      const particleMaterial=effects.points.material as THREE.ShaderMaterial;
      particleMaterial.uniforms.intensity.value=energy*0.95;particleMaterial.uniforms.dpr.value=renderDpr;
      if(input.phase==='casting') {
        camera.updateMatrixWorld();effects.group.updateMatrixWorld(true);inverseEffects.copy(effects.group.matrixWorld).invert();
        for(let coinIndex=0;coinIndex<3;coinIndex++)for(let sample=0;sample<100;sample++) {
          const pose=coinPose({phase:'casting',face:input.faces[coinIndex],index:coinIndex,time:Math.max(0,effectTime-260*(1-sample/99)),seed:input.visualSeed,reducedMotion:false});
          const depth=camera.position.z*(1-190/pose.diameter),correction=(camera.position.z-depth)/camera.position.z;
          samplePosition.set((pose.x-836)*scale*correction,(470.5-pose.y)*scale*correction,depth);
          sampleDirection.copy(camera.position).sub(samplePosition).normalize();sampleOrientation.setFromUnitVectors(normalZ,sampleDirection);
          sampleEuler.set(...pose.rotation,pose.rotationOrder);sampleLocal.setFromEuler(sampleEuler);sampleOrientation.multiply(sampleLocal);
          sampleScale.setScalar(190*scale/(2*1.012));
          effects.historyMatrices[coinIndex][sample].compose(samplePosition,sampleOrientation,sampleScale);
        }
      }
      effects.strands.forEach((ribbon,index)=> {
        const positions=ribbon.geometry.getAttribute('position') as THREE.BufferAttribute;
        const uv=ribbon.geometry.getAttribute('uv') as THREE.BufferAttribute;
        if(input.phase==='casting') {
          const angle=Math.floor(index/3)*Math.PI/2,centers=effects.centers[index],screen=effects.projected[index];
          for(let i=0;i<100;i++) {
            rimPoint.set(Math.cos(angle)*1.012,Math.sin(angle)*1.012,0).applyMatrix4(effects.historyMatrices[index%3][i]);
            centers[i*3]=rimPoint.x;centers[i*3+1]=rimPoint.y;centers[i*3+2]=rimPoint.z;
            projection.copy(rimPoint).project(camera);screen[i*2]=projection.x*camera.aspect*941/2;screen[i*2+1]=projection.y*941/2;
          }
          for(let i=0;i<100;i++) {
            const before=Math.max(0,i-1),after=Math.min(99,i+1);
            const dx=screen[after*2]-screen[before*2],dy=screen[after*2+1]-screen[before*2+1],length=Math.hypot(dx,dy)||1;
            const depthScale=(camera.position.z-centers[i*3+2])/camera.position.z;
            for(let side=0;side<2;side++) {
              const offset=(side-.5)*4*scale*depthScale;
              rimPoint.set(centers[i*3]-dy/length*offset,centers[i*3+1]+dx/length*offset,centers[i*3+2]).applyMatrix4(inverseEffects);
              positions.setXYZ(i*2+side,rimPoint.x,rimPoint.y,rimPoint.z);uv.setXY(i*2+side,side,i/99);
            }
          }
          ribbon.material.uniforms.intensity.value=energy*castTrailIntensity(effectTime,index%3);
        } else {
          const centers=effects.centers[index];
          for(let i=0;i<100;i++) {const point=effects.heroCurves[index].getPoint(i/99);centers[i*3]=point.x+(progressScene?-112:0);centers[i*3+1]=progressScene?770+(point.y-770)*.85:point.y;}
          for(let i=0;i<100;i++) {
            const before=Math.max(0,i-1),after=Math.min(99,i+1),centers=effects.centers[index];
            const dx=centers[after*3]-centers[before*3],dy=centers[after*3+1]-centers[before*3+1],length=Math.hypot(dx,dy)||1;
            for(let side=0;side<2;side++) {
              const offset=(side-.5)*4;
              positions.setXYZ(i*2+side,(centers[i*3]-836-dy/length*offset)*scale,(470.5-centers[i*3+1]-dx/length*offset)*scale,0);
              uv.setXY(i*2+side,side,i/99);
            }
          }
          ribbon.material.uniforms.intensity.value=energy*(index<8?.5:.24);
        }
        positions.needsUpdate=true;uv.needsUpdate=true;
      });
      effects.qi.forEach((mesh,index)=> {
        const positions=mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        const uv=mesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
        for(let i=0;i<100;i++) {
          const t=i/99;const angle=t*9+index*1.5+effectTime/4000;
          const x=originX+Math.sin(angle)*t*210;
          const y=originY-t*490-((effectTime-index*200)%1300)/1000*25;
          for(let side=0;side<2;side++) {
            positions.setXYZ(i*2+side,(x-836+(side-.5)*(8+Math.sin(t*Math.PI)*48))*scale,(470.5-y)*scale,12);
            uv.setXY(i*2+side,side,t);
          }
        }
        positions.needsUpdate=true;uv.needsUpdate=true;const age=((effectTime-index*200)%1300)/1000;
        const birth=effectTime-age*1000;
        mesh.material.uniforms.intensity.value=effectTime<index*200||age<0||age>1||birth>1850?0:energy*.22*Math.sin(age*Math.PI);
        mesh.material.uniforms.flowTime.value=effectTime/4000;
      });
      effects.glow.position.set((originX-836)*scale,(470.5-(heroScene?650:660))*scale,-5);effects.glow.scale.set(scale,scale*(heroScene?2:1),scale);
      effects.glow.material.uniforms.intensity.value=energy*0.4;
      effects.baseGlow.visible=true;
      effects.baseGlow.position.set(((progressScene?1008:heroScene?1118:835)-836)*scale,(470.5-(progressScene?770:heroScene?785:800))*scale,-4);
      effects.baseGlow.scale.setScalar(scale);effects.baseGlow.material.uniforms.intensity.value=energy*.65;
      }
      renderer.setRenderTarget(sceneTarget);renderer.clear();renderer.render(scene,camera);
      renderer.setRenderTarget(null);composer.render();
      container!.dataset.renderer='three-webgl';container!.dataset.renderDpr=String(renderDpr);container!.dataset.phase=input.phase;container!.dataset.faces=input.faces.join(',');
      // Observed mesh orientation for QA only; never fed into casting/session state.
      container!.dataset.visibleFaces=coins.map(coin=>new THREE.Vector3(0,0,1).applyQuaternion(coin.quaternion).z>=0?'yang':'yin').join(',');
      announceReady();
    }
    function tick() {
      if(document.hidden)return;
      render();
      const duration=current.current.phase==='casting'?CAST_ACTION_MS:current.current.phase==='reset'?(reduced.matches?140:320):current.current.phase==='hero-exit'?(reduced.matches?140:260):current.current.phase==='exit'?(reduced.matches?160:500):0;
      if(performance.now()-start<duration && fixedTime===null) frame=requestAnimationFrame(tick);
    }
    function invalidateScene() {cancelAnimationFrame(frame);tick();}
    invalidate.current=invalidateScene;
    document.addEventListener('visibilitychange',invalidateScene);
    reduced.addEventListener('change',invalidateScene);
    const observer=new ResizeObserver(resize);observer.observe(container);resize();tick();
    return ()=> {
      disposed=true;cancelAnimationFrame(frame);observer.disconnect();
      invalidate.current=()=>{};document.removeEventListener('visibilitychange',invalidateScene);reduced.removeEventListener('change',invalidateScene);
      renderer.domElement.removeEventListener('webglcontextlost',contextLost);
      scene.traverse(object=> {
        const mesh=object as THREE.Mesh;
        mesh.geometry?.dispose();
        if(mesh.material) (Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(material=>material.dispose());
      });
      haloMaterial.dispose();textures.forEach(texture=>texture.dispose());environmentTarget.dispose();composer.passes.forEach(pass=>pass.dispose());composer.dispose();sceneTarget.dispose();renderer.dispose();renderer.domElement.remove();
    };
  },[]);
  useEffect(()=>invalidate.current(),[props.phase,props.faces,props.visualSeed]);
  return <div className="ritual-webgl" ref={host} data-webgl-fallback={fallback||undefined}>
    {fallback && !props.phase.endsWith('exit')?<ThreeCoinFallback faces={props.faces} />:null}
  </div>;
}
