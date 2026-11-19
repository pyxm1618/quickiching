'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  DirectionalLight,
  DoubleSide,
  Group,
  HalfFloatType,
  ImageBitmapLoader,
  ImageLoader,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PMREMGenerator,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { visualRuntimeAssets } from '@/lib/visual-runtime-assets';
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
  const group=new Group();
  const heroCurves=HERO_LIGHT_PATHS.map(points=>new CatmullRomCurve3(points.map(([x,y])=>new Vector3(x,y,0)),false,'centripetal'));
  const samples=420;
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new BufferAttribute(new Float32Array(samples*3),3));
  const sizes=Float32Array.from({length:samples},(_,i)=>i<130?1.1+visualNoise(seed,i+500)*1.6:0.45+visualNoise(seed,i+500)*0.45);
  geometry.setAttribute('size',new BufferAttribute(sizes,1));
  geometry.setAttribute('opacity',new BufferAttribute(new Float32Array(samples),1));
  const material=new ShaderMaterial({
    uniforms:{intensity:{value:0},dpr:{value:1},core:{value:new Vector3(2.8,1.18,.22)}},transparent:true,depthWrite:false,
    blending:AdditiveBlending,
    vertexShader:`attribute float size;attribute float opacity;varying float vOpacity;varying float vCore;varying float vPrimary;uniform float dpr;void main(){vPrimary=step(1.0,size);float diameter=size+mix(1.0,3.,vPrimary);vCore=size/diameter;vOpacity=opacity;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=diameter*dpr;}`,
    fragmentShader:`uniform float intensity;uniform vec3 core;varying float vOpacity;varying float vCore;varying float vPrimary;void main(){float d=length(gl_PointCoord-.5)*2.;float coreF=1.-smoothstep(vCore*.55,vCore,d);float halo=exp(-d*d*5.)*.22*(1.-coreF);float a=min(.6,(coreF+halo)*intensity*vOpacity*mix(.4,1.,vPrimary));vec3 color=mix(vec3(1.25,.38,.05),core,coreF);gl_FragColor=vec4(color,a);}`,
  });
  const points=new Points(geometry,material);group.add(points);
  // Warm curved traces and broad translucent qi ribbons are separate effects.
  const strands=Array.from({length:12},(_,index)=> {
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new BufferAttribute(new Float32Array(100*2*3),3));
    geometry.setAttribute('uv',new BufferAttribute(new Float32Array(100*2*2),2));
    const indices=[];for(let i=0;i<99;i++) {const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}geometry.setIndex(indices);
    const material=new ShaderMaterial({
      uniforms:{intensity:{value:0},soft:{value:.45},endsBase:{value:0},glints:{value:0},glintAt:{value:0},glintAt2:{value:-1},mist:{value:0},white:{value:0}},transparent:true,depthWrite:false,side:DoubleSide,blending:AdditiveBlending,
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`
        varying vec2 vUv;uniform float intensity;uniform float soft;uniform float endsBase;uniform float glints;uniform float glintAt;uniform float glintAt2;uniform float mist;uniform float white;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(cell),hash(cell+vec2(1.,0.)),f.x),mix(hash(cell+vec2(0.,1.)),hash(cell+vec2(1.,1.)),f.x),f.y);}
        void main(){
          float turbulence=(.02+.98*smoothstep(.25,.8,noise(vec2(vUv.x*18.,vUv.y*7.))*.7+noise(vec2(vUv.x*37.,vUv.y*15.))*.3))*(.15+.85*noise(vec2(vUv.y*9.,2.)));
          float d=abs(vUv.x-.5+mist*(sin(vUv.y*23.)*.1+(noise(vec2(vUv.y*6.,3.))-.5)*.22))*2.;
          float core=exp(-d*d*5.);float halo=exp(-d*d*2.)*soft;
          float ends=endsBase+(1.-endsBase)*sin(vUv.y*3.14159);
          float highlight=glints*(exp(-pow((vUv.y-glintAt)*45.,2.))+.65*exp(-pow((vUv.y-glintAt2)*55.,2.)));
          vec3 radiance=mix(mix(vec3(1.35,.62,.16),vec3(2.6,1.5,.55),core),vec3(1.6,.85,.33),mist)*(1.+highlight*12.);
          radiance=mix(radiance,vec3(2.5,2.25,1.75),white*core);
          float edgeFade=pow(sin(vUv.x*3.14159),2.);
          gl_FragColor=vec4(radiance,min(.5+highlight*.3,(core+halo)*ends*intensity*(1.+highlight*9.)*mix(1.,turbulence*edgeFade*(.35+.65*noise(vec2(vUv.y*5.,7.))),mist)));
        }`,

    });
    const ribbon=new Mesh(geometry,material);group.add(ribbon);return ribbon;
  });
  const glowMaterial=new ShaderMaterial({
    uniforms:{intensity:{value:0},radiance:{value:new Vector3(1.5,.6,.1)}},transparent:true,depthWrite:false,blending:AdditiveBlending,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float intensity;uniform vec3 radiance;void main(){vec2 p=(vUv-.5)*2.;float a=exp(-dot(p,p)*5.)*intensity;gl_FragColor=vec4(radiance,a);}`,
  });
  const glow=new Mesh(new PlaneGeometry(300,180),glowMaterial);group.add(glow);
  const baseGlowMaterial=glowMaterial.clone();baseGlowMaterial.uniforms.radiance.value.set(4,1.6,.22);
  const baseGlow=new Mesh(new PlaneGeometry(140,70),baseGlowMaterial);group.add(baseGlow);
  const qi=Array.from({length:6},(_,strand)=> {
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new BufferAttribute(new Float32Array(100*2*3),3));
    geometry.setAttribute('uv',new BufferAttribute(new Float32Array(100*2*2),2));
    const indices=[];for(let i=0;i<99;i++) {const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}geometry.setIndex(indices);
    const material=new ShaderMaterial({
      uniforms:{intensity:{value:0},flowTime:{value:0},strandSeed:{value:visualNoise(seed,strand+1200)*100},tint:{value:new Vector3(.78,.42,.16)},filaments:{value:0}}, transparent:true,depthWrite:false,side:DoubleSide,blending:AdditiveBlending,
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`
        varying vec2 vUv;uniform float intensity;uniform float flowTime;uniform float strandSeed;uniform vec3 tint;uniform float filaments;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+strandSeed)*43758.5453);}
        float noise(vec2 p){vec2 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(cell),hash(cell+vec2(1.,0.)),f.x),mix(hash(cell+vec2(0.,1.)),hash(cell+vec2(1.,1.)),f.x),f.y);}
        float wisps(vec2 p){return .57*noise(p)+.29*noise(p*2.03+17.1)+.14*noise(p*4.07+31.7);}
        void main(){
          vec2 drift=vec2(vUv.x*3.,vUv.y*8.-flowTime);
          float curl=wisps(drift*.7+strandSeed)-.5;
          float across=vUv.x+curl*mix(.32,.06,filaments);
          float edges=pow(max(0.,sin(clamp(across,0.,1.)*3.14159)),2.);
          float density=smoothstep(mix(.12,.16,filaments),mix(.52,.62,filaments),wisps(drift+vec2(curl,0.)));
          float bend=sin(vUv.y*4.+strandSeed)*mix(.12,.025,filaments)+curl*mix(.3,.025,filaments);
          float feather=wisps(vec2((across+bend+curl*.15)*24.,vUv.y*3.-flowTime));
          float threads=smoothstep(.48,.86,feather);
          float a=edges*sin(vUv.y*3.14159)*density*intensity*mix(1.,(.012+threads*.5)*(.25+.75*smoothstep(.03,.45,vUv.y)),filaments);
          gl_FragColor=vec4(tint,mix(a*.88,min(.36,a*.88),filaments));
        }`,
    });
    const mesh=new Mesh(geometry,material);group.add(mesh);return mesh;
  });
  const centers=Array.from({length:12},()=>new Float32Array(300));
  const projected=Array.from({length:12},()=>new Float32Array(200));
  return {group,points,strands,glow,baseGlow,qi,heroCurves,centers,projected};
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
    let renderer:WebGLRenderer;
    try {renderer=new WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});}
    catch(error) {console.error('RITUAL_WEBGL_UNAVAILABLE',error);setFallback(true);announceReady();return;}
    const scene=new Scene();
    performance.mark('ritual-pmrem-start');
    const environmentRoom=new RoomEnvironment();
    const environmentGenerator=new PMREMGenerator(renderer);
    const environmentTarget=environmentGenerator.fromScene(environmentRoom,0.04);
    scene.environment=environmentTarget.texture;
    environmentRoom.dispose();environmentGenerator.dispose();
    // Casting sheen: a broad warm source so oblique metal faces read as struck gold, not dark bronze.
    const castingRoom=new Scene();
    const castingShell=new Mesh(new SphereGeometry(60,32,16),new ShaderMaterial({side:BackSide,
      vertexShader:`varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec3 vDir;void main(){float band=smoothstep(.25,.75,abs(vDir.y));vec3 warm=mix(vec3(.30,.16,.07),vec3(2.6,1.65,.75),band);gl_FragColor=vec4(warm,1.);}`}));
    castingRoom.add(castingShell);
    const castingGenerator=new PMREMGenerator(renderer);
    const castingEnvironmentTarget=castingGenerator.fromScene(castingRoom,0.06);
    castingShell.geometry.dispose();castingShell.material.dispose();castingGenerator.dispose();
    performance.mark('ritual-pmrem-end');performance.measure('ritual-pmrem','ritual-pmrem-start','ritual-pmrem-end');
    const camera=new PerspectiveCamera(35,1672/941,1,10000);
    camera.position.z=941/(2*Math.tan(35*Math.PI/360));
    renderer.setClearColor(0,0);renderer.outputColorSpace=SRGBColorSpace;
    renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=0.9;
    const sceneTarget=new WebGLRenderTarget(1672,941,{type:HalfFloatType});
    const postTarget=new WebGLRenderTarget(1,1,{type:HalfFloatType,depthBuffer:false});
    const composer=new EffectComposer(renderer,postTarget);
    composer.addPass(new TexturePass(sceneTarget.texture));
    const bloom=new UnrealBloomPass(new Vector2(1672,941),0.3,0.25,0.9);
    composer.addPass(bloom);
    // Preserve the DOM room under transparent pixels; bloom never replaces the room.
    // ShaderPass clones uniforms and nulls render-target textures, so rebind after construction.
    const alphaPass=new ShaderPass({
      uniforms:{tDiffuse:{value:null},baseTexture:{value:null}},
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform sampler2D tDiffuse;uniform sampler2D baseTexture;varying vec2 vUv;
        void main(){vec4 lit=texture2D(tDiffuse,vUv);vec4 base=texture2D(baseTexture,vUv);
        vec3 aura=max(vec3(0.),lit.rgb-base.rgb);float glow=max(aura.r,max(aura.g,aura.b));
        float cover=clamp(base.a*1.8,0.,1.);
        gl_FragColor=vec4(lit.rgb,clamp(cover+glow*.35,0.,1.));}`,
    });
    alphaPass.uniforms.baseTexture.value=sceneTarget.texture;
    composer.addPass(alphaPass);
    composer.addPass(new OutputPass());
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden','true');
    let disposed=false;
    let texturesLoaded=0;
    function textureReady() {
      texturesLoaded+=1;
      if(texturesLoaded!==2)return;
      // Casting glow belongs to the characters only; the bronze body stays lit, not emissive.
      textures.forEach((texture,faceIndex)=>{
        const image=texture.image as CanvasImageSource&{width:number;height:number};
        const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
        const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
        const data=ctx.getImageData(0,0,canvas.width,canvas.height);const px=data.data;
        const base=new Uint8ClampedArray(px);
        for(let maskIndex=0;maskIndex<4;maskIndex++) {
          const threshold=[110,165,195,140][maskIndex];
          for(let i=0;i<px.length;i+=4){
            const radius=Math.hypot((i/4%canvas.width+.5)/canvas.width-.5,(Math.floor(i/4/canvas.width)+.5)/canvas.height-.5);
            const rimFalloff=Math.max(0,Math.min(1,(.39-radius)/.05));
            const v=Math.max(0,Math.min(1,(base[i]*.299+base[i+1]*.587+base[i+2]*.114-threshold)/50))*rimFalloff*255;
            px[i]=v;px[i+1]=v;px[i+2]=v;
          }
          ctx.putImageData(data,0,0);
          const mask=emissiveMasks[maskIndex][faceIndex];
          const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;
          copy.getContext('2d')!.drawImage(canvas,0,0);
          mask.image=copy;mask.flipY=texture.flipY;mask.colorSpace=SRGBColorSpace;mask.needsUpdate=true;
        }
      });
      render();
    }
    // Same artwork, bounded delivery resolution; retain off-main-thread ImageBitmap decode.
    const textureUrls=window.innerWidth<800
      ? [visualRuntimeAssets.coinFrontMobile,visualRuntimeAssets.coinBackMobile]
      : [visualRuntimeAssets.coinFrontDesktop,visualRuntimeAssets.coinBackDesktop];
    const textures=[new Texture(),new Texture()];
    const emissiveMasks=Array.from({length:4},()=>[new Texture(),new Texture()]);
    textures.forEach(texture=>{texture.colorSpace=SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();});
    if(typeof createImageBitmap==='function') {
      const loader=new ImageBitmapLoader();
      loader.setOptions({imageOrientation:'flipY',premultiplyAlpha:'none'});
      textureUrls.forEach((url,index)=>loader.load(url,bitmap=>{
        if(disposed){bitmap.close();return;}
        textures[index].image=bitmap;textures[index].flipY=false;textures[index].needsUpdate=true;textureReady();
      },undefined,onTextureError));
    } else {
      const loader=new ImageLoader();
      textureUrls.forEach((url,index)=>loader.load(url,image=>{
        if(disposed)return;
        textures[index].image=image;textures[index].needsUpdate=true;textureReady();
      },undefined,onTextureError));
    }
    const {geometry:coinGeometry}=createCoinGeometry();
    const edgeMaterial=new MeshStandardMaterial({map:textures[0],bumpMap:textures[0],bumpScale:0.0008,color:0x8a6a45,metalness:0.6,roughness:0.45,envMapIntensity:0.1,emissive:0xff8020,emissiveMap:textures[0],emissiveIntensity:0.4});
    const castingInnerShade={value:0};
    const rimHeat={value:0};
    const rimDirs=[new Vector2(.8,-.6),new Vector2(.7,-.7),new Vector2(.9,.35)];
    function hookEdge(material:MeshStandardMaterial,dir:Vector2) {
      material.onBeforeCompile=shader=>{
        shader.uniforms.castingInnerShade=castingInnerShade;shader.uniforms.rimHeat=rimHeat;shader.uniforms.rimDir={value:dir};
        shader.vertexShader='varying float coinRadius;varying vec3 vRimPos;varying vec3 vRimCenter;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncoinRadius=length(position.xy);vRimPos=(modelViewMatrix*vec4(position,1.)).xyz;vRimCenter=(modelViewMatrix*vec4(0.,0.,0.,1.)).xyz;');
        shader.fragmentShader='uniform float castingInnerShade;uniform float rimHeat;uniform vec2 rimDir;varying float coinRadius;varying vec3 vRimPos;varying vec3 vRimCenter;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight*=mix(1.,.12,castingInnerShade*(1.-step(.6,coinRadius)));\nvec2 rimD=normalize(vRimPos.xy-vRimCenter.xy);outgoingLight+=vec3(2.4,1.7,.85)*pow(max(0.,dot(rimD,normalize(rimDir))),24.)*smoothstep(.86,.99,coinRadius)*rimHeat;\n#include <opaque_fragment>');
      };
    }
    hookEdge(edgeMaterial,rimDirs[0]);
    const edgeMaterials=[edgeMaterial,...rimDirs.slice(1).map(dir=>{const clone=edgeMaterial.clone();hookEdge(clone,dir);return clone;})];
    const faceMaterials=textures.map(map=>new MeshStandardMaterial({map,color:0x8a6a45,bumpMap:map,bumpScale:0.0015,metalness:0.35,roughness:0.6,envMapIntensity:0.02,emissive:0xffd8b0,emissiveMap:map,emissiveIntensity:0.25}));
    const haloGeometry=new PlaneGeometry(3.2,3.2);
    const haloMaterial=new ShaderMaterial({uniforms:{strength:{value:.18},radius:{value:1},settled:{value:0},orbitStrength:{value:0},faceSign:{value:1}},transparent:true,depthWrite:false,side:DoubleSide,blending:AdditiveBlending,
      vertexShader:`varying vec2 p;void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float strength;uniform float radius;uniform float settled;uniform float orbitStrength;uniform float faceSign;varying vec2 p;void main(){float d=length(p);vec2 screenP=vec2(p.x,p.y*faceSign);float angle=atan(screenP.y,screenP.x);float glints=.2+.15*orbitStrength+8.*pow(max(0.,cos(angle-mix(.8,1.5,orbitStrength))),80.)+5.*orbitStrength*pow(max(0.,cos(angle-2.8)),70.)+3.*pow(max(0.,cos(angle+1.4)),60.);float ring=mix(exp(-pow(d-radius,2.)*55.),exp(-pow((d-radius)*75.,2.))*glints,settled);float aura=exp(-d*d*2.2)*mix(.16,.035+orbitStrength*.09,settled);vec2 orbitP=vec2(screenP.x/1.35,(screenP.y+.31)/.25);float orbitAngle=atan(orbitP.y,orbitP.x);float contour=length(orbitP)-1.+.03*sin(orbitAngle*7.)+.015*sin(orbitAngle*13.);float orbit=(exp(-pow(contour*65.,2.))+.5*exp(-pow((contour+.09+.08*sin(orbitAngle*2.+1.1))*70.,2.))+.25*exp(-pow((contour-.1+.03*sin(orbitAngle*5.))*80.,2.)))*orbitStrength*(.025+.8*pow(abs(sin(orbitAngle*2.+.5)),12.));float a=(ring*.9+aura+orbit)*strength;gl_FragColor=vec4(mix(vec3(1.,.5,.1),vec3(3.8,1.9,.7),settled),a);}`,
    });
    const coinFaceMaterials=Array.from({length:3},()=>faceMaterials.map(material=>{
      const clone=material.clone();
      const contrast={faceMask:{value:null as Texture|null},faceContrast:{value:0},faceSheen:{value:0}};
      clone.userData.contrast=contrast;
      clone.onBeforeCompile=shader=>{
        shader.uniforms.faceMask=contrast.faceMask;shader.uniforms.faceContrast=contrast.faceContrast;shader.uniforms.faceSheen=contrast.faceSheen;
        shader.fragmentShader='uniform sampler2D faceMask;uniform float faceContrast;uniform float faceSheen;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat faceM=texture2D(faceMask,vMapUv).r;\nfloat faceL=dot(diffuseColor.rgb,vec3(.299,.587,.114));\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(faceL)*vec3(1.08,1.,.9),faceContrast*.38*(1.-faceM));');
        shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight+=vec3(1.15,.72,.28)*faceContrast*faceM*.55;\noutgoingLight+=vec3(1.5,1.4,1.2)*faceSheen*pow(max(0.,dot(normal,normalize(vec3(-.45,-.55,.7)))),6.);\n#include <opaque_fragment>');
      };
      return clone;
    }));
    const coins=Array.from({length:3},(_,index)=> {
      const coin=new Group();
      const halo=new Mesh(haloGeometry,haloMaterial.clone());halo.position.z=0.13;coin.add(halo);
      coin.add(new Mesh(coinGeometry,[coinFaceMaterials[index][0],coinFaceMaterials[index][1],edgeMaterials[index]]));
      scene.add(coin);return coin;
    });
    const ambient=new AmbientLight(0xffffff,0.02);scene.add(ambient);
    const key=new DirectionalLight(0xffd9a0,1.15);key.position.set(-600,-450,600);scene.add(key);
    const rim=new DirectionalLight(0xffae48,4.5);rim.position.set(700,-100,-600);scene.add(rim);
    const fill=new DirectionalLight(0xffd9a0,0.16);fill.position.set(700,-200,800);scene.add(fill);
    const effects=makeEffects(current.current.visualSeed);scene.add(effects.group);
    effects.group.position.z=-480;effects.group.scale.setScalar((camera.position.z+480)/camera.position.z);
    let shadersReady=false;
    void renderer.compileAsync(scene,camera).then(()=>{
      if(disposed)return;
      shadersReady=true;render();
    }).catch(error=>{
      if(disposed)return;
      console.warn('RITUAL_SHADER_PRECOMPILE_FALLBACK',error);
      shadersReady=true;render();
    });
    let frame=0;let firstRenderMeasured=false;
    // A terminal stage restored before the module loads must not replay absent Hero coins.
    let start=performance.now()-(current.current.phase==='hero-exit'?260:current.current.phase==='exit'?500:0);
    let previousPhase=current.current.phase;let previousSeed=current.current.visualSeed;let previousCasting=false;let previousSettled=false;
    let width=1672,height=941,renderDpr=1;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const rimPoint=new Vector3(),projection=new Vector3();
    const inverseEffects=new Matrix4();
    function onTextureError(error:unknown) {if(!disposed){console.error('RITUAL_TEXTURE_UNAVAILABLE',error);setFallback(true);announceReady();}}
    function contextLost(event:Event) {event.preventDefault();setFallback(true);announceReady();}
    renderer.domElement.addEventListener('webglcontextlost',contextLost);
    function resize() {
      const rect=container!.getBoundingClientRect();width=rect.width;height=rect.height;
      renderDpr=width<800?Math.min(window.devicePixelRatio,1):Math.min(window.devicePixelRatio,2);
      renderer.setPixelRatio(renderDpr);renderer.setSize(width,height,false);
      sceneTarget.setSize(width*renderDpr,height*renderDpr);
      composer.setPixelRatio(renderDpr);composer.setSize(width,height);
      camera.aspect=width/height;camera.updateProjectionMatrix();
      render();
    }
    function render() {
      if(disposed||!shadersReady||document.hidden)return;
      const input=current.current;
      if(input.phase!==previousPhase || input.visualSeed!==previousSeed) {start=performance.now();previousPhase=input.phase;previousSeed=input.visualSeed;}
      if(texturesLoaded<2)return;
      const measureFirst=!firstRenderMeasured;if(measureFirst)performance.mark('ritual-first-render-start');
      const time=input.phase==='hero'?700:fixedTime===null?performance.now()-start:Number(fixedTime);
      const scale=Math.min(width/1672,height/941)*941/height;
      let layerOpacity=0;
      const settledScene=input.phase==='settled';
      const castingScene=input.phase==='casting';
      bloom.radius=castingScene?.6:.25;
      key.intensity=input.phase==='progress'?.22:settledScene?.35:input.phase==='hero'||input.phase==='hero-exit'?.70:castingScene?.5:.6;
      rim.intensity=input.phase==='progress'?.72:settledScene?.25:input.phase==='hero'||input.phase==='hero-exit'?1.75:castingScene?3:1.2;
      fill.intensity=input.phase==='progress'?.035:settledScene?0:input.phase==='hero'||input.phase==='hero-exit'?.09:castingScene?.04:.03;
      // RoomEnvironment IBL washes the bronze to gray; casting and settled rely on warm emissive+lights.
      scene.environment=settledScene||castingScene?null:environmentTarget.texture;
      ambient.intensity=settledScene?.45:castingScene?.65:.02;
      const lightingChanged=castingScene!==previousCasting||settledScene!==previousSettled;
      previousCasting=castingScene;previousSettled=settledScene;
      castingInnerShade.value=castingScene?1:0;
      rimHeat.value=castingScene?1:0;
      edgeMaterials.forEach(material=>{
        material.color.setHex(castingScene?0xffe0a0:0x8a6a45);
        material.emissive.setHex(castingScene?0xffd080:0xff8020);
        material.envMap=castingScene?castingEnvironmentTarget.texture:null;
        material.envMapIntensity=castingScene?.7:.1;
        material.roughness=castingScene?.25:.45;
        material.metalness=castingScene?.9:.6;
        material.map=textures[0];
        material.bumpMap=textures[0];
        if(lightingChanged)material.needsUpdate=true;
        material.emissiveIntensity=settledScene?.6:castingScene?.3:.4;
      });
      coins.forEach((coin,index)=> {
        coinFaceMaterials[index].forEach((material,faceIndex)=> {
          material.color.setHex(castingScene?[0xbfb9ae,0xb5afa4,0x716c63][index]:settledScene?[0x704b28,0xb4b1a8,0xb4b1a8][index]:0x8a6a45);
          const contrast=material.userData.contrast as {faceMask:{value:Texture|null};faceContrast:{value:number};faceSheen:{value:number}};
          contrast.faceContrast.value=castingScene&&index<2?1:0;
          contrast.faceSheen.value=castingScene&&index<2?.3:0;
          contrast.faceMask.value=emissiveMasks[1][faceIndex];
          material.metalness=.35;
          material.roughness=castingScene?[.5,.46,.45][index]:settledScene?.4:.6;
          material.envMap=castingScene||settledScene?castingEnvironmentTarget.texture:null;
          material.envMapIntensity=castingScene?[.7,.65,1.2][index]:settledScene?.35:.02;
          material.bumpScale=castingScene?.012:.0015;
          material.emissiveMap=castingScene?emissiveMasks[index===0?1:index][faceIndex]:settledScene?emissiveMasks[index===0?3:1][faceIndex]:textures[faceIndex];
          material.emissive.setHex(castingScene?[0xffe8c7,0xffe8c7,0xffcf99][index]:settledScene?[0xffb348,0xffbc70,0xffbc70][index]:0xffd8b0);
          material.emissiveIntensity=settledScene?[2,1.3,1.3][index]:castingScene?[.12,.18,.95][index]:.25;
          if(lightingChanged)material.needsUpdate=true;
        });
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
        const halo=coin.children[0] as Mesh<PlaneGeometry,ShaderMaterial>;
        halo.material.uniforms.strength.value=settledScene?(index===0?1:.3):castingScene?0:.18;
        halo.material.uniforms.radius.value=settledScene?(index===0?.9:.87):1;
        halo.material.uniforms.settled.value=settledScene?1:0;
        halo.material.uniforms.orbitStrength.value=settledScene&&index===0?1:0;
        halo.material.uniforms.faceSign.value=settledScene&&input.faces[index]==='yin'?-1:1;
        halo.scale.setScalar(settledScene?1.2:1);
        halo.position.z=settledScene?(input.faces[index]==='yang'?-.13:.13):.13;
        coin.userData.targetFace=input.faces[index];coin.userData.settled=pose.settled;
      });
      container!.style.opacity=String(layerOpacity);
      const progressScene=input.phase==='progress';
      const heroScene=input.phase==='hero'||input.phase==='hero-exit'||progressScene;
      const active=!reduced.matches && (heroScene||castingScene||settledScene);
      const envelope=settledScene?.45:heroScene?0.65:Math.sin(Math.min(1,time/2110)*Math.PI);
      const energy=active?Math.max(0,envelope):0;
      effects.group.visible=energy>0;
      effects.strands.forEach(ribbon=>{ribbon.visible=!settledScene;});
      effects.qi.forEach(mesh=>{mesh.visible=!settledScene;});
      effects.glow.visible=!settledScene;effects.baseGlow.visible=!settledScene;
      if(active) {
      const effectTime=heroScene?700:time;
      const originX=progressScene?1008:heroScene?1120:835;
      const originY=790;
      const position=effects.points.geometry.getAttribute('position') as BufferAttribute;
      const opacities=effects.points.geometry.getAttribute('opacity') as BufferAttribute;
      const sizes=effects.points.geometry.getAttribute('size') as BufferAttribute;
      for(let i=0;i<position.count;i++) {
        sizes.setX(i,(i<130?1.1+visualNoise(input.visualSeed,i+500)*1.6:0.45+visualNoise(input.visualSeed,i+500)*0.45)*(settledScene?.5:input.phase==='casting'?(i<130?.7:1.4):1));
        const n=visualNoise(input.visualSeed,i);const altitude=Math.pow(visualNoise(input.visualSeed,i+200),1.35)*(heroScene?500:430);
        const angle=n*Math.PI*2+effectTime/1000*0.3;
        const age=((effectTime+n*1900)%1900)/1900;
        const radius=visualNoise(input.visualSeed,i+300)*(i%20<13?150:280);
        let x=originX+Math.cos(angle)*radius;
        let y=originY-altitude-age*45;
        if(heroScene && i%20>=13 && i%20<18) {
          const anchor=effects.heroCurves[i%effects.heroCurves.length].getPoint(n);
          x=anchor.x+(progressScene?-112:0)+(visualNoise(input.visualSeed,i+400)-.5)*20;
          y=(progressScene?770+(anchor.y-770)*.70:anchor.y)-age*20;
        }
        if(input.phase==='casting'&&i%20<13){const ci=i%3;const cp=coinPose({phase:'casting',face:input.faces[ci],index:ci,time:effectTime,seed:input.visualSeed,reducedMotion:false});const ja=visualNoise(input.visualSeed,i+700)*Math.PI*2;const jr=cp.diameter*(.52+visualNoise(input.visualSeed,i+800)*.32);x=cp.x+Math.cos(ja)*jr;y=cp.y+Math.sin(ja)*jr*.8;}
        if(settledScene){const ci=i%20<18?0:i%2+1;const cp=coinPose({phase:'settled',face:input.faces[ci],index:ci,time:effectTime,seed:input.visualSeed,reducedMotion:false});const r=82+visualNoise(input.visualSeed,i+800)*48;x=cp.x+Math.cos(angle)*r;y=cp.y+Math.sin(angle)*r;}
        const birth=effectTime-age*1900;
        opacities.setX(i,particleCanEmit(birth,input.visualSeed,i)&&(!settledScene||visualNoise(input.visualSeed,i+1000)<.35)?Math.min(1,age*8,(1-age)*8):0);
        position.setXYZ(i,(x-836)*scale,(470.5-y)*scale,20);
      }
      position.needsUpdate=true;opacities.needsUpdate=true;sizes.needsUpdate=true;
      const particleMaterial=effects.points.material as ShaderMaterial;
      particleMaterial.uniforms.intensity.value=energy*(settledScene?.8:input.phase==='casting'?3.4:1.6);particleMaterial.uniforms.dpr.value=renderDpr;
      const sparkCore=particleMaterial.uniforms.core.value as Vector3;
      if(castingScene||settledScene)sparkCore.set(3.2,2.0,.85);else sparkCore.set(2.8,1.18,.22);
      if(!settledScene){
      effects.strands.forEach((ribbon,index)=> {
        const positions=ribbon.geometry.getAttribute('position') as BufferAttribute;
        const uv=ribbon.geometry.getAttribute('uv') as BufferAttribute;
        if(input.phase==='casting') {
          camera.updateMatrixWorld();effects.group.updateMatrixWorld(true);inverseEffects.copy(effects.group.matrixWorld).invert();
          const ci=index%3,variant=Math.floor(index/3);
          const pose=coinPose({phase:'casting',face:input.faces[ci],index:ci,time:effectTime,seed:input.visualSeed,reducedMotion:false});
          const depth=camera.position.z*(1-190/pose.diameter);
          const facing=Math.abs(Math.cos(pose.rotation[0])*Math.cos(pose.rotation[1]));
          const [pitch,yaw,roll]=pose.rotation;
          const nx=pose.rotationOrder==='XYZ'?Math.sin(yaw):Math.cos(roll)*Math.sin(yaw)*Math.cos(pitch)+Math.sin(roll)*Math.sin(pitch);
          const ny=pose.rotationOrder==='XYZ'?-Math.sin(pitch)*Math.cos(yaw):Math.sin(roll)*Math.sin(yaw)*Math.cos(pitch)-Math.cos(roll)*Math.sin(pitch);
          const tilt=Math.atan2(-ny,nx)+Math.PI/2;
          const centers=effects.centers[index],screen=effects.projected[index];
          for(let i=0;i<100;i++) {
            const t=i/99;
            let x:number,y:number,z:number;
            if(variant<2) {
              const rx=pose.diameter*(variant===0?[.58,.60,.56][ci]:[.52,.66,.64][ci]);
              const ry=rx*(variant===1&&ci===0?.9:Math.max(.35,facing))*(variant===0&&ci===2?.9:1.06);
              const ang=(variant===1&&ci===0?-1.5-t*3.8:t*Math.PI*2*(variant===0?1.05:.9)+ci*1.7+variant*2.1)+effectTime/2600;
              const ex=Math.cos(ang)*rx,ey=Math.sin(ang)*ry;
              const arcTilt=variant===1&&ci===0?0:tilt;
              x=pose.x+ex*Math.cos(arcTilt)-ey*Math.sin(arcTilt)+(variant===1&&ci===0?-75+t*40:0);
              y=pose.y+ex*Math.sin(arcTilt)+ey*Math.cos(arcTilt)+(variant===1&&ci===0?-50+t*20:0);
              z=depth-45+Math.sin(ang)*12*scale+(variant===0?160*(Math.exp(-Math.pow((t-[.73,.76,.68][ci])*45,2))+.65*Math.exp(-Math.pow((t-[.1,.35,-1][ci])*55,2)))*scale:0);
            } else {
              const spread=(variant-2.5)*18;
              const endX=pose.x+pose.diameter*[.28,.28,-.46][ci];
              const endY=pose.y+pose.diameter*[.3,.33,-.02][ci];
              const c1x=[1130,1070,1070][ci]+spread,c2x=[680,770,1090][ci]+spread;
              const c1y=[750,710,750][ci],c2y=[650,590,680][ci];
              const u=1-t;
              x=u*u*u*originX+3*u*u*t*c1x+3*u*t*t*c2x+t*t*t*endX;
              y=u*u*u*originY+3*u*u*t*c1y+3*u*t*t*c2y+t*t*t*endY;
              z=12*(1-t)+depth*t;
            }
            const correction=(camera.position.z-z)/camera.position.z;
            const wx=(x-836)*scale*correction,wy=(470.5-y)*scale*correction;
            centers[i*3]=wx;centers[i*3+1]=wy;centers[i*3+2]=z;
            projection.set(wx,wy,z).project(camera);
            screen[i*2]=projection.x*camera.aspect*941/2;screen[i*2+1]=projection.y*941/2;
          }
          for(let i=0;i<100;i++) {
            const before=Math.max(0,i-1),after=Math.min(99,i+1);
            const dx=screen[after*2]-screen[before*2],dy=screen[after*2+1]-screen[before*2+1],length=Math.hypot(dx,dy)||1;
            const depthScale=(camera.position.z-centers[i*3+2])/camera.position.z;
            for(let side=0;side<2;side++) {
              const t=i/99;
              const curl=Math.sin(t*Math.PI*2.2+index*1.35)*Math.sin(t*Math.PI)*2*scale*depthScale;
              const offset=((side-.5)*(variant===1?(ci===0?80:42):2.5)*scale*depthScale)+curl;
              rimPoint.set(centers[i*3]-dy/length*offset,centers[i*3+1]+dx/length*offset,centers[i*3+2]).applyMatrix4(inverseEffects);
              positions.setXYZ(i*2+side,rimPoint.x,rimPoint.y,rimPoint.z);uv.setXY(i*2+side,side,i/99);
            }
          }
          ribbon.material.uniforms.intensity.value=energy*castTrailIntensity(effectTime,ci)*(variant===0?.8:variant===1?[.38,.28,.28][ci]:[.48,.4,.36][ci]);
          ribbon.material.uniforms.mist.value=variant===1?1:0;
          ribbon.material.uniforms.soft.value=variant===1?2:.25;ribbon.material.uniforms.endsBase.value=variant===1?0:.15;
          ribbon.material.uniforms.glints.value=variant===0?1:0;
          ribbon.material.uniforms.glintAt.value=(variant===0?[.73,.76,.68]:[.34,.08,.45])[ci];
          ribbon.material.uniforms.glintAt2.value=variant===0?[.1,.35,-1][ci]:-1;
          ribbon.material.uniforms.white.value=variant===2?1:0;
        } else {
          const centers=effects.centers[index];
          for(let i=0;i<100;i++) {const point=effects.heroCurves[index].getPoint(i/99);centers[i*3]=point.x+(progressScene?-112:0);centers[i*3+1]=progressScene?770+(point.y-770)*.70:point.y;}
          for(let i=0;i<100;i++) {
            const before=Math.max(0,i-1),after=Math.min(99,i+1),centers=effects.centers[index];
            const dx=centers[after*3]-centers[before*3],dy=centers[after*3+1]-centers[before*3+1],length=Math.hypot(dx,dy)||1;
            for(let side=0;side<2;side++) {
              const offset=(side-.5)*8.5;
              positions.setXYZ(i*2+side,(centers[i*3]-836-dy/length*offset)*scale,(470.5-centers[i*3+1]-dx/length*offset)*scale,0);
              uv.setXY(i*2+side,side,i/99);
            }
          }
          ribbon.material.uniforms.intensity.value=energy*(progressScene?(index<8?.38:.22):(index<8?.58:.34));
          ribbon.material.uniforms.soft.value=.45;ribbon.material.uniforms.endsBase.value=0;
          ribbon.material.uniforms.mist.value=0;
          ribbon.material.uniforms.glints.value=0;
          ribbon.material.uniforms.white.value=0;
        }
        positions.needsUpdate=true;uv.needsUpdate=true;
      });
      effects.qi.forEach((mesh,index)=> {
        const positions=mesh.geometry.getAttribute('position') as BufferAttribute;
        const uv=mesh.geometry.getAttribute('uv') as BufferAttribute;
        const ci=index%3;
        const pose=castingScene?coinPose({phase:'casting',face:input.faces[ci],index:ci,time:effectTime,seed:input.visualSeed,reducedMotion:false}):null;
        for(let i=0;i<100;i++) {
          const t=i/99;const angle=t*7.2+index*1.5+effectTime/4200;
          const sway=Math.sin(t*Math.PI);
          const u=1-t;
          const c1x=[1130,1070,1070][ci]+(index<3?-12:12),c2x=[680,770,1090][ci]+(index<3?-12:12);
          const c1y=[750,710,750][ci],c2y=[650,590,680][ci];
          const endX=pose?pose.x+pose.diameter*[.28,.28,-.46][ci]:originX;
          const endY=pose?pose.y+pose.diameter*[.3,.33,-.02][ci]:originY;
          const x=pose?u*u*u*originX+3*u*u*t*c1x+3*u*t*t*c2x+t*t*t*endX:originX+Math.sin(angle)*t*185;
          const y=pose?u*u*u*originY+3*u*u*t*c1y+3*u*t*t*c2y+t*t*t*endY:originY-t*490-((effectTime-index*200)%1300)/1000*25;
          const dx=3*u*u*(c1x-originX)+6*u*t*(c2x-c1x)+3*t*t*(endX-c2x);
          const dy=3*u*u*(c1y-originY)+6*u*t*(c2y-c1y)+3*t*t*(endY-c2y);
          const length=Math.hypot(dx,dy)||1;
          const ddx=6*u*(c2x-2*c1x+originX)+6*t*(endX-2*c2x+c1x);
          const ddy=6*u*(c2y-2*c1y+originY)+6*t*(endY-2*c2y+c1y);
          const curvature=Math.abs(dx*ddy-dy*ddx)/(length*length*length);
          const bandWidth=pose?Math.min(10+sway*[180,110,150][ci],1.5/Math.max(curvature,.001)):14+sway*70;
          for(let side=0;side<2;side++) {
            const offset=(side-.5)*bandWidth;
            positions.setXYZ(i*2+side,(x-836+offset*(pose?-dy/length:1))*scale,(470.5-y-offset*(pose?dx/length:0))*scale,12);
            uv.setXY(i*2+side,side,t);
          }
        }
        const delay=castingScene?ci*80:index*200;
        positions.needsUpdate=true;uv.needsUpdate=true;const age=((effectTime-delay)%1300)/1000;
        const birth=effectTime-age*1000;
        mesh.material.uniforms.intensity.value=effectTime<delay||age<0||age>1||birth>1850?0:energy*(progressScene?.46:castingScene?[.85,.65,.75][ci]:.34)*Math.sin(age*Math.PI);
        mesh.material.uniforms.flowTime.value=effectTime/4000;
        mesh.material.uniforms.filaments.value=castingScene?1:0;
        (mesh.material.uniforms.tint.value as Vector3).set(...(castingScene?[2.2,1.5,.8] as [number,number,number]:[.78,.42,.16] as [number,number,number]));
      });
      effects.glow.position.set((originX-836)*scale,(470.5-(heroScene?650:660))*scale,-5);effects.glow.scale.set(scale,scale*(heroScene?2:1),scale);
      effects.glow.material.uniforms.intensity.value=energy*(input.phase==='casting'?.16:.4);
      effects.baseGlow.visible=true;
      effects.baseGlow.position.set(((progressScene?1008:heroScene?1118:835)-836)*scale,(470.5-(progressScene?770:heroScene?785:800))*scale,-4);
      effects.baseGlow.scale.setScalar(scale*(castingScene?.55:1));
      effects.baseGlow.material.uniforms.intensity.value=energy*(castingScene?1.4:.65);
      (effects.baseGlow.material.uniforms.radiance.value as Vector3).set(4,castingScene?2.6:1.6,castingScene?.9:.22);
      }
      }
      renderer.setRenderTarget(sceneTarget);renderer.clear();renderer.render(scene,camera);
      renderer.setRenderTarget(null);composer.render();
      if(measureFirst){firstRenderMeasured=true;performance.mark('ritual-first-render-end');performance.measure('ritual-first-render','ritual-first-render-start','ritual-first-render-end');}
      container!.dataset.renderer='three-webgl';container!.dataset.renderDpr=String(renderDpr);container!.dataset.phase=input.phase;container!.dataset.faces=input.faces.join(',');
      // Observed mesh orientation for QA only; never fed into casting/session state.
      container!.dataset.visibleFaces=coins.map(coin=>new Vector3(0,0,1).applyQuaternion(coin.quaternion).z>=0?'yang':'yin').join(',');
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
        const mesh=object as Mesh;
        mesh.geometry?.dispose();
        if(mesh.material) (Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(material=>material.dispose());
      });
      haloMaterial.dispose();coinFaceMaterials.forEach(pair=>pair.forEach(material=>material.dispose()));faceMaterials.forEach(material=>material.dispose());edgeMaterials.forEach(material=>material.dispose());emissiveMasks.forEach(pair=>pair.forEach(texture=>texture.dispose()));textures.forEach(texture=>{const image=texture.image as ImageBitmap|undefined;if(image&&typeof image.close==='function')image.close();texture.dispose();});environmentTarget.dispose();castingEnvironmentTarget.dispose();composer.passes.forEach(pass=>pass.dispose());composer.dispose();sceneTarget.dispose();renderer.dispose();renderer.domElement.remove();
    };
  },[]);
  useEffect(()=>invalidate.current(),[props.phase,props.faces,props.visualSeed]);
  return <div className="ritual-webgl" ref={host} data-webgl-fallback={fallback||undefined}>
    {fallback && !props.phase.endsWith('exit')?<ThreeCoinFallback faces={props.faces} />:null}
  </div>;
}
