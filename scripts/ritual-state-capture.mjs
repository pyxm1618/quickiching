// Task-local seven-state QA. Fixtures control business inputs, never replace the algorithm.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import os from 'node:os';
import puppeteer from 'puppeteer-core';

const state=process.argv[2];
assert(['02','03','04','05','06','07'].includes(state),'Choose reference state 02–07');
const output=resolve(process.argv[3]||`.artifacts/ritual-qa/ref-${state}/pass-1`);
await mkdir(output,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-device-scale-factor=1','--window-size=1672,941']});
try {
 const page=await browser.newPage();await page.setViewport({width:1672,height:941,deviceScaleFactor:1});
 const errors=[];page.on('pageerror',error=>errors.push(String(error)));
 if(state==='07'){
  await page.setRequestInterception(true);
  page.on('request',request=>{
   if(new URL(request.url()).pathname.startsWith('/api/readings/ritual-qa-saved-cast/')){
    if(request.method()!=='GET')throw new Error('QA fixture must never write a reading');
    return request.respond({status:200,contentType:'application/json',body:JSON.stringify({status:'not_started'})});
   }
   request.continue();
  });
 }

 // Stable values [8,7,8,8,8,7] form hexagram 4 through the real application algorithm.
 const bits=state==='04'?[1,0,0]:[1,1,0,1,0,0,1,1,0,1,1,0,1,1,0,1,0,0];
 await page.evaluateOnNewDocument(fixture=>{
  window.__ritualBitDraws=0;const queue=[...fixture];const original=Crypto.prototype.getRandomValues;
  Crypto.prototype.getRandomValues=function(array){
   if(array instanceof Uint8Array&&array.length===1){if(!queue.length)throw new Error('QA_UNEXPECTED_BUSINESS_DRAW');array[0]=queue.shift();window.__ritualBitDraws++;return array;}
   return original.call(this,array);
  };
 },bits);
 const animationTime=state==='03'?500:2200;
 const url=state==='07'?'http://127.0.0.1:3028/ritual-qa-local?view=result':`http://127.0.0.1:3028/?ritualTime=${animationTime}`;
 await page.goto(url,{waitUntil:'networkidle0'});
 for(const button of await page.$$('button'))if(await button.evaluate(node=>node.textContent)==='Decline')await button.click();
 await page.evaluate(()=>document.fonts.ready);
 // Layout snapshots sample completed CSS entrances; motion is audited separately in real time.
 await page.addStyleTag({content:'*,*::before,*::after{animation-delay:0s!important;animation-duration:0s!important;transition:none!important;caret-color:transparent!important}'});
 if(state!=='07') {
  await page.waitForSelector('[data-renderer="three-webgl"]');
  await page.locator('[data-private-question]').fill('Should I continue on my current path?');
  await page.locator('[data-home-primary-action]').click();
  await page.waitForSelector('[data-question-confirm]');
  if(state==='02'){await page.$eval('textarea[data-private-question]',node=>{node.focus();node.select();});await page.keyboard.press('Backspace');await page.waitForFunction(()=>document.querySelector('.ritual-character-count')?.textContent.startsWith('0/'));await page.$eval('textarea[data-private-question]',node=>node.blur());}
  else {
   await page.locator('[data-home-primary-action]').click();
   if(state==='03') {
    await page.waitForSelector('.hold-button:not(:disabled)');await page.locator('.hold-button').click();
    await page.waitForSelector('[data-renderer="three-webgl"][data-phase="casting"]');
    const cdp=await page.createCDPSession();
    await cdp.send('Emulation.setVirtualTimePolicy',{policy:'pause'});
   } else {
    const count=state==='04'?1:state==='05'?4:6;
    for(let index=0;index<count;index++) {
     await page.waitForSelector('.hold-button:not(:disabled)');await page.locator('.hold-button').click();
     await page.waitForSelector('[data-record-this-cast]');
     if(state!=='04')await page.locator('[data-record-this-cast]').click();
    }
    if(state==='04')await page.waitForSelector('[data-record-this-cast]:not(:disabled)');
    if(state==='05'){await page.waitForSelector('.hold-button:not(:disabled)');await page.waitForSelector('[data-renderer="three-webgl"][data-phase="progress"]');}
    if(state==='06')await page.waitForSelector('[data-completed-cast-gate="auth-required"]');
   }
  }
 } else await page.waitForSelector('[data-ritual-result-card]');
 await page.addStyleTag({content:'*,*::before,*::after{animation-delay:0s!important;animation-duration:0s!important;transition:none!important;caret-color:transparent!important}'});
 await page.screenshot({path:output+'/runtime.png'});
 const observed=await page.evaluate(()=>({
  viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,zoom:visualViewport.scale,
  scene:document.querySelector('[data-renderer]')?{...document.querySelector('[data-renderer]').dataset}:null,
  stage:document.querySelector('[data-three-coin-home-stage]')?.dataset.experienceStage,
  gate:document.querySelector('[data-completed-cast-gate]')?.dataset.completedCastGate,
  businessBitDraws:window.__ritualBitDraws,
  session:JSON.parse(sessionStorage.getItem('quickiching:public-v1:three-coin')||'null'),
  background:document.querySelector('.ritual-room')?getComputedStyle(document.querySelector('.ritual-room')).backgroundImage:null,
  runtimeAssets:performance.getEntriesByType('resource').filter(item=>item.name.includes('/ritual/')).map(item=>item.name),
 }));
 assert.deepEqual(observed.viewport,[1672,941]);assert.equal(observed.dpr,1);assert.equal(observed.zoom,1);
 assert(observed.background?.includes('bg-stage-master-clean.lossless.webp'),'All states must use the same production room');
 if(['03','04','05'].includes(state)){assert.equal(observed.scene.renderer,'three-webgl','Desktop cannot use fallback');assert.equal(Number(observed.scene.renderDpr),1,'Canonical renderer DPR must stay 1');}
 if(state==='03')assert.equal(observed.scene.phase,'casting','Capture must occur while actual cast is running');
 if(state==='06')for(const selector of ['[data-primary-card]','[data-ritual-result-card]','[data-deep-reading-entry]'])assert.equal(await page.$(selector),null,'Gate must conceal '+selector);
 assert.equal(observed.businessBitDraws,{'02':0,'03':3,'04':3,'05':12,'06':18,'07':0}[state],'The fixture must use exactly the expected authoritative draws');
 if(errors.length)throw new Error(errors.join('\n'));
 await page.addStyleTag({content:'.ritual-question-stage,.ritual-webgl,.ritual-question-context,.ritual-cast-ui,.ritual-save-gate,[data-public-reading-result],body>header,body>header *{opacity:0!important;backdrop-filter:none!important}'});
 await page.screenshot({path:output+'/background-isolated.png'});
 const report={reference:state,status:'NOT PASS',browser:await browser.version(),runtime:{node:process.version,os:os.version()},buildId:(await readFile('.next/BUILD_ID','utf8')).trim(),fixture:{kind:state==='07'?'local-only saved-reading fixture; not live authentication/persistence evidence':'real UI and real algorithm with deterministic crypto inputs',visualSeed:observed.scene?1618+(observed.session?.data?.steps?.at(-1)?.lineIndex??0):null,animationTimeMs:animationTime,ambientEffectSampleMs:observed.scene?.phase==='progress'?700:null,cssMotion:'completed entrance snapshot'},observed,errors};
 await writeFile(output+'/environment.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({state,output,status:report.status,bitDraws:observed.businessBitDraws}));
} catch(error) {await writeFile(output+'/failure.json',JSON.stringify({error:String(error),stack:error.stack},null,2));throw error;}
finally {await browser.close();}
