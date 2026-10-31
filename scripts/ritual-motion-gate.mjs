// Task-local real-time motion/business boundary QA. API responses below are named fixtures.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
const base=process.env.PUBLIC_V1_TEST_BASE_URL||'http://127.0.0.1:3028',key='quickiching:public-v1:three-coin';
const output='.artifacts/ritual-qa/final-closeout/motion';await mkdir(output,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-device-scale-factor=1']});
const outcomes=[];
async function run(reduced,suppressed=false){
 const context=await browser.createBrowserContext(),page=await context.newPage();
 const prefix=suppressed?'animation-suppressed':reduced?'reduced':'normal';
 try{
  await page.setViewport({width:1672,height:941,deviceScaleFactor:1});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]);
  await page.evaluateOnNewDocument(()=>{
   const bits=[1,1,0,1,0,0,1,1,0,1,1,0,1,1,0,1,0,0];
   const original=Crypto.prototype.getRandomValues;window.__motionDraws=0;
   Crypto.prototype.getRandomValues=function(array){if(array instanceof Uint8Array&&array.length===1){assertQueue();array[0]=bits.shift();window.__motionDraws++;return array;}return original.call(this,array);};
   function assertQueue(){if(!bits.length)throw new Error('MOTION_QA_EXTRA_BUSINESS_DRAW');}
  });
  await page.goto(base+'/?ritualTime=700',{waitUntil:'networkidle0'});
  for(const button of await page.$$('button'))if(await button.evaluate(node=>node.textContent)==='Decline')await button.click();
  await page.waitForSelector('[data-renderer="three-webgl"]');
  if(suppressed)await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});
  await page.evaluate(()=>window.__motionCanvas=document.querySelector('.ritual-webgl canvas'));
  await page.locator('[data-private-question]').fill('How should I understand this transition?');
  await page.locator('[data-home-primary-action]').click();
  await page.waitForSelector('[data-question-confirm]');
  await page.screenshot({path:`${output}/${prefix}-question-enter.png`});
  assert.equal(await page.evaluate(()=>window.__motionDraws),0);
  await page.waitForSelector('[data-home-primary-action]:not(:disabled)');
  await page.locator('[data-home-primary-action]').click();
  await page.waitForSelector('.hold-button:not(:disabled)');
  assert.equal(await page.evaluate(()=>window.__motionDraws),0);
  await page.evaluate(()=>{
   window.__motionFrames=[];window.__motionStart=performance.now();
   document.addEventListener('pointerup',()=>{window.__motionFrames=[];window.__motionStart=performance.now();},{once:true,capture:true});
   const sample=()=>{
    const elapsed=performance.now()-window.__motionStart;
    const labels=document.querySelector('.ritual-face-labels > span'),record=document.querySelector('[data-record-this-cast]');
    window.__motionFrames.push({elapsed,view:document.querySelector('[data-ritual-view]')?.dataset.ritualView,phase:document.querySelector('[data-renderer]')?.dataset.phase,labelOpacity:labels?Number(getComputedStyle(labels).opacity):0,recordEnabled:Boolean(record&&!record.disabled)});
    if(elapsed<2600)requestAnimationFrame(sample);
   };requestAnimationFrame(sample);
  });
  await page.locator('.hold-button').click();
  await page.waitForSelector('[data-record-this-cast]:not(:disabled)');
  await page.waitForFunction(()=>window.__motionFrames.some(frame=>frame.recordEnabled));
  const frames=await page.evaluate(()=>window.__motionFrames);
  const firstResult=frames.find(frame=>frame.view==='result'),firstLabel=frames.find(frame=>frame.labelOpacity>.05),firstAction=frames.find(frame=>frame.recordEnabled);
  assert(firstResult&&firstLabel&&firstAction,'All real-time result phases must be observed');
  if(!reduced&&!suppressed){
   assert(firstResult.elapsed>=1750&&firstResult.elapsed<2050,`Heading time ${firstResult.elapsed}`);
   assert(firstLabel.elapsed>=1850&&firstLabel.elapsed<2200,`Label time ${firstLabel.elapsed}`);
   assert(firstAction.elapsed>=2050&&firstAction.elapsed<2400,`Record time ${firstAction.elapsed}`);
  }else if(reduced)assert(firstAction.elapsed<800,'Reduced cast must not replay the full throw');
  assert.equal(await page.evaluate(()=>window.__motionCanvas===document.querySelector('.ritual-webgl canvas')),true);
  const session=await page.evaluate(storageKey=>JSON.parse(sessionStorage.getItem(storageKey)),key);
  const visible=await page.$eval('[data-renderer]',node=>node.dataset.visibleFaces.split(','));
  assert.deepEqual(visible,session.data.steps[0].coinFaces);
  await page.screenshot({path:`${output}/${prefix}-settled.png`});
  await writeFile(`${output}/${prefix}-frames.json`,JSON.stringify(frames,null,2));
  await page.locator('[data-record-this-cast]').click();
  if(suppressed){outcomes.push({mode:prefix,coverage:'first-cast cancellation recovery',status:'PASS',firstResult,firstLabel,firstAction});return;}
  for(let cast=1;cast<6;cast++){
   await page.waitForSelector('.hold-button:not(:disabled)');await page.locator('.hold-button').click();
   await page.waitForSelector('[data-record-this-cast]:not(:disabled)');await page.locator('[data-record-this-cast]').click();
  }
  await page.waitForSelector('[data-shared-reading-summary]');
  assert.equal(await page.$('[data-auth-required-before-reveal]'),null);
  assert.equal(await page.evaluate(()=>window.__motionDraws),18);
  await page.screenshot({path:`${output}/${prefix}-anonymous-summary.png`});
  const completed=await page.evaluate(storageKey=>JSON.parse(sessionStorage.getItem(storageKey)),key);
  assert.equal(await page.$eval('.shared-reading-content',node=>getComputedStyle(node).display),'none');
  assert(await page.$('[data-reading-choice="free"]'));
  assert(await page.$('[data-reading-choice="deep"]'));
  await page.reload({waitUntil:'networkidle0'});
  await page.waitForSelector('[data-shared-reading-summary]');
  assert.deepEqual(await page.evaluate(storageKey=>JSON.parse(sessionStorage.getItem(storageKey)),key),completed);
  outcomes.push({mode:prefix,status:'PASS',firstResult,firstLabel,firstAction,anonymousSummary:true,sameCast:true,note:'Login continuation is separately exercised by mei-hua-ui-browser-gate with named test-only auth responses.'});
 }finally{await context.close();}
}
try{for(const [reduced,suppressed] of [[false,false],[true,false],[false,true]]){try{await run(reduced,suppressed);}catch(error){outcomes.push({mode:suppressed?'animation-suppressed':reduced?'reduced':'normal',status:'FAIL',error:String(error),stack:error.stack});process.exitCode=1;}}}
finally{await writeFile(`${output}/results.json`,JSON.stringify({browser:await browser.version(),viewport:[1672,941],dpr:1,originalTotal:3,pass:outcomes.filter(item=>item.status==='PASS').length,fail:outcomes.filter(item=>item.status==='FAIL').length,unreviewed:3-outcomes.length,outcomes,note:'Observed timing and business boundaries only; image/motion fidelity is a separate human gate.'},null,2));await browser.close();}
