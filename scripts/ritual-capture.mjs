// Local visual QA: installed Chrome, fixed CSS viewport/DPR and a real WebGL renderer.
import puppeteer from 'puppeteer-core';
import os from 'node:os';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const output=resolve(process.argv[2]||'.artifacts/ritual-qa/ref-01/iteration-01');
await mkdir(output,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--window-size=1672,941','--force-device-scale-factor=1']});
try {
 const page=await browser.newPage();await page.setViewport({width:1672,height:941,deviceScaleFactor:1});
 const errors=[];page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.goto('http://127.0.0.1:3028/?ritualTime=700',{waitUntil:'networkidle0'});
 const consentButtons=await page.$$('button');
 for(const button of consentButtons) {if((await button.evaluate(node=>node.textContent))==='Decline') await button.click();}
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForSelector('[data-renderer="three-webgl"]',{timeout:15000});
 if(await page.$('[data-webgl-fallback="true"]'))throw new Error('Desktop Pixel QA cannot use fallback');
 const cdp=await page.createCDPSession();await cdp.send('DOM.enable');await cdp.send('CSS.enable');
 const {root}=await cdp.send('DOM.getDocument');const platformFonts={};
 for(const selector of ['.ritual-home-heading h1','.ritual-question-card label','.ritual-gold-button']) {
  const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector});
  platformFonts[selector]=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
 }
 await cdp.detach();
 const typography=await page.evaluate(()=>Array.from(document.querySelectorAll('.ritual-home-heading h1,.ritual-question-card label,.ritual-gold-button')).map(node=>{const s=getComputedStyle(node),r=node.getBoundingClientRect();return {element:node.className||node.tagName,fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight,tracking:s.letterSpacing,x:r.x,y:r.y,width:r.width,height:r.height};}));
 const environment=await page.evaluate(()=> {
  const gl=document.querySelector('canvas').getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');
  return {userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,zoom:visualViewport.scale,renderDpr:Number(document.querySelector('[data-renderer="three-webgl"]').dataset.renderDpr),webgl:gl.getParameter(gl.VERSION),renderer:gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)};
 });
 const runtimeAssets=await page.evaluate(()=>performance.getEntriesByType('resource').filter(item=>item.name.includes('/ritual/')).map(item=>({url:item.name,transferBytes:item.transferSize})));
 if(environment.renderDpr!==1)throw new Error('Canonical Desktop renderer must retain DPR 1');
 const assetCodecs=await page.evaluate(async()=>{
  const comparisons=[];
  for(const [source,target,crop] of [
   ['/ritual/bg-stage-master-clean.png','/ritual/bg-stage-master-clean.lossless.webp',null],
   ['/ritual/bg-stage-master-clean.png','/ritual/bg-stage-portrait-crop.webp',[571,0,529,941]],
   ['/ritual/hexagram-result-card-blank.png','/ritual/question-parchment-crop.png',[512,350,646,184]],
   ['/ritual/hexagram-result-card-blank.png','/ritual/question-parchment-mobile-crop.png',[635,350,400,184]],
   ['/ritual/decorative-elements-master.png','/ritual/decor/gold-cloud.png',[1120,105,850,340]],
   ['/ritual/decorative-elements-master.png','/ritual/decor/yin-yang.png',[1210,465,165,170]],
   ['/ritual/decorative-elements-master.png','/ritual/decor/ink-circle.png',[45,0,810,682]],
   ['/ritual/decorative-elements-master.png','/ritual/decor/yin-yang-divider.png',[750,465,1170,170]],
  ]) {
   const images=await Promise.all([source,target].map(async url=>{const img=new Image();img.src=url;await img.decode();return img;}));
   const width=crop?.[2]??images[0].naturalWidth,height=crop?.[3]??images[0].naturalHeight;
   if(images[1].naturalWidth!==width||images[1].naturalHeight!==height)throw new Error('LOSSLESS_ASSET_DIMENSIONS_INVALID: '+target);
   const pixels=images.map((img,index)=>{const croppedSource=index===0&&crop;const canvas=document.createElement('canvas');canvas.width=croppedSource?img.naturalWidth:width;canvas.height=croppedSource?img.naturalHeight:height;const context=canvas.getContext('2d');context.drawImage(img,0,0);return context.getImageData(croppedSource?crop[0]:0,croppedSource?crop[1]:0,width,height).data;});
   let differentChannels=0;for(let index=0;index<pixels[0].length;index++)if(pixels[0][index]!==pixels[1][index])differentChannels++;
   comparisons.push({source,target,crop,dimensions:[width,height],differentChannels,status:differentChannels===0?'PASS':'NOT PASS'});
  }
  return comparisons;
 });
 await writeFile(output+'/asset-codec-verification.json',JSON.stringify(assetCodecs,null,2)+'\n');
 if(assetCodecs.some(item=>item.differentChannels!==0))errors.push('LOSSLESS_ASSET_BROWSER_PIXEL_MISMATCH');
 await page.screenshot({path:output+'/runtime.png'});
 await page.addStyleTag({content:'.ritual-question-stage,.ritual-webgl,.ritual-question-context,body>header{opacity:0!important;backdrop-filter:none!important}body>header *{opacity:0!important;backdrop-filter:none!important}'});
 await page.screenshot({path:output+'/background-isolated.png'});
 const report={runtime:{platform:os.platform(),release:os.release(),version:os.version(),captureNode:process.version},buildId:(await readFile('.next/BUILD_ID','utf8')).trim(),browser:await browser.version(),environment,runtimeAssets,platformFonts,typography,fixture:{applicationState:'landing; fresh browser profile',visualSeed:1618,animationTimeMs:700},errors,status:'NOT PASS'};
 await writeFile(output+'/environment.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({output,...report}));
 if(errors.length)process.exitCode=1;
} finally {await browser.close();}
