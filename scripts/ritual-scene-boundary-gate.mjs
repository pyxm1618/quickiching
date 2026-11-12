// Local-only browser regressions. Crypto is a named test fixture; production algorithm is unchanged.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
const base=process.env.PUBLIC_V1_TEST_BASE_URL||'http://127.0.0.1:3028';
if(new URL(base).hostname!=='127.0.0.1')throw new Error('This fixture gate only runs on 127.0.0.1');
const key='quickiching:public-v1:three-coin';
const output='.artifacts/ritual-qa/business-boundary';await mkdir(output,{recursive:true});
const acceptanceOutput=output+'/three-coin-ui-state';await mkdir(acceptanceOutput,{recursive:true});
const assets=JSON.parse(await readFile('docs/performance/pr-76-assets.json','utf8'));
const outcomes=[];
async function runCase({id,bits,zh=false,reduced=false,fallback=false,storageFailure=false,moduleFailure=false,completedFlow=false,deferTextures=false,remountReadiness=false}) {
 let page;
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--force-device-scale-factor=1',...(fallback?['--disable-webgl']:[])]});
 try {
  page=await browser.newPage();await page.setViewport({width:1672,height:941,deviceScaleFactor:1});
  const heldTextureRequests=[];
  const heldRemountTextureRequests=[];
  let holdRemountTextures=false;
  if(remountReadiness) {
   await page.setCacheEnabled(false);
   await page.setRequestInterception(true);
   page.on('request',request=>{
    if(holdRemountTextures&&[assets.coinFrontDesktop.url,assets.coinBackDesktop.url].some(url=>request.url().endsWith(url)))heldRemountTextureRequests.push(request);
    else request.continue();
   });
  }
  if(deferTextures) {
   await page.setRequestInterception(true);
   page.on('request',request=>{
    if([assets.coinFrontDesktop.url,assets.coinBackDesktop.url].some(url=>request.url().endsWith(url)))heldTextureRequests.push(request);
    else request.continue();
   });
  }
  if(moduleFailure) {
   const manifest=JSON.parse(await readFile('.next/react-loadable-manifest.json','utf8'));
   const entry=Object.entries(manifest).find(([name])=>name.includes('three-coin-visual')&&name.includes('three-coin-scene'))?.[1];
   assert(entry,'The actual build must declare its scene chunk');
   const chunk=entry.files.find(file=>file.split('/').at(-1).startsWith(String(entry.id)+'.'));
   assert(chunk,'The actual scene chunk must be identified before blocking it');
   await page.setRequestInterception(true);
   page.on('request',request=>request.url().includes('/_next/'+chunk)?request.abort('failed'):request.continue());
  }
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]);
  await page.evaluateOnNewDocument((fixtureBits,storageKey,failStorage)=>{
   try { localStorage.setItem('quickiching:analytics-consent:v1','denied'); } catch {}
   window.__ritualBitDraws=0;const remaining=[...fixtureBits];
   const originalRandom=Crypto.prototype.getRandomValues;
   Crypto.prototype.getRandomValues=function(array){
    if(array instanceof Uint8Array && array.length===1) {
     if(!remaining.length)throw new Error('UNEXPECTED_EXTRA_BUSINESS_BIT_DRAW');
     array[0]=remaining.shift();window.__ritualBitDraws++;return array;
    }
    return originalRandom.call(this,array);
   };
   window.__blockCastStorage=failStorage;
   const originalSet=Storage.prototype.setItem;
   Storage.prototype.setItem=function(name,value){
    if(name===storageKey && window.__blockCastStorage) {
     const parsed=JSON.parse(value);
     if(parsed.data?.steps?.length)throw new DOMException('QA named cast storage failure','QuotaExceededError');
    }
    return originalSet.call(this,name,value);
   };
  },bits,key,storageFailure);
  await page.goto(base+(zh?'/zh':''),{waitUntil:deferTextures?'domcontentloaded':'networkidle0'});
  await page.waitForSelector('[data-experience-stage="landing"]');
  const freshLanding=await page.evaluate(storageKey=>{
   const raw=sessionStorage.getItem(storageKey),session=raw?JSON.parse(raw):null;
   return {
    businessDraws:window.__ritualBitDraws,
    steps:session?.data?.steps?.length??0,
    visualLayer:Boolean(document.querySelector('.ritual-webgl')),
    renderer:Boolean(document.querySelector('[data-renderer]')),
    fallbackCoins:document.querySelectorAll('.ritual-fallback img').length,
   };
  },key);
  assert.equal(freshLanding.businessDraws,0,'Fresh Landing must not draw business randomness');
  assert.equal(freshLanding.steps,0,'Fresh Landing must not pre-generate line one');
  assert.equal(freshLanding.visualLayer,false,'Fresh Landing must not render the formal Three-Coin foreground layer');
  assert.equal(freshLanding.renderer,false,'Fresh Landing must not render a Three-Coin renderer');
  assert.equal(freshLanding.fallbackCoins,0,'Fresh Landing must not render fallback coins');
  if(completedFlow)await page.screenshot({path:acceptanceOutput+'/'+id+'-A-fresh-landing.png'});
  await page.locator('[data-private-question]').fill(zh?'测试：如何理解当前变化？':'QA fixture: how should I understand this transition?');
  await page.locator('[data-home-primary-action]').click();
  await page.waitForSelector('[data-question-confirm]');
  assert.equal(await page.evaluate(()=>window.__ritualBitDraws),0,'Home action must not create line one');
  // P1 intentionally keeps the formal Three-Coin renderer unmounted on Landing.
  // Question confirmation preserves the existing interaction-deferred scene activation;
  // the user's Cast the Coins interaction starts the real renderer without drawing business randomness.
  await page.locator('[data-home-primary-action]').click();
  assert.equal(await page.evaluate(()=>window.__ritualBitDraws),0,'Entering ritual must not manufacture a cast');
  if(completedFlow) {
   await page.waitForSelector('[data-three-coin-presentation="ritual"] .hold-button:not(:disabled)');
   await page.waitForFunction(()=>document.querySelector('[data-renderer="three-webgl"]')?.getAttribute('data-phase')==='ready');
   const firstReady=await page.evaluate(storageKey=>{
    const raw=sessionStorage.getItem(storageKey),session=raw?JSON.parse(raw):null;
    return {
     businessDraws:window.__ritualBitDraws,
     steps:session?.data?.steps?.length??0,
     done:document.querySelectorAll('.ritual-six-lines li[data-state="done"]').length,
     phase:document.querySelector('[data-renderer="three-webgl"]')?.getAttribute('data-phase'),
    };
   },key);
   assert.equal(firstReady.businessDraws,0,'First Cast Ready must not draw business randomness');
   assert.equal(firstReady.steps,0,'First Cast Ready must not pre-generate line one');
   assert.equal(firstReady.done,0,'First Cast Ready must not show a completed line');
   assert.equal(firstReady.phase,'ready','First Cast Ready must show the real three-coin ready scene');
   await page.screenshot({path:acceptanceOutput+'/'+id+'-B-first-cast-ready.png'});
   if(remountReadiness) {
    await page.locator('[data-ritual-view="ready"] .ritual-back').click();
    await page.waitForSelector('[data-experience-stage="landing"]');
    const returnedLanding=await page.evaluate(storageKey=>{
     const raw=sessionStorage.getItem(storageKey),current=raw?JSON.parse(raw):null;
     return {
      businessDraws:window.__ritualBitDraws,
      steps:current?.data?.steps?.length??0,
      visualLayer:Boolean(document.querySelector('.ritual-webgl')),
     };
    },key);
    assert.equal(returnedLanding.businessDraws,0,'Returning to Landing before any cast must not draw business randomness');
    assert.equal(returnedLanding.steps,0,'Returning to Landing before any cast must keep zero steps');
    assert.equal(returnedLanding.visualLayer,false,'Returning to Landing must unmount the formal Three-Coin foreground');

    await page.locator('[data-private-question]').fill(zh?'测试：重新进入后如何理解当前变化？':'QA fixture: verify renderer readiness after re-entering the ritual');
    await page.locator('[data-home-primary-action]').click();
    await page.waitForSelector('[data-question-confirm]');
    await page.waitForSelector('[data-home-primary-action]:not(:disabled)');
    holdRemountTextures=true;
    await page.locator('[data-home-primary-action]').click();
    await page.waitForSelector('[data-three-coin-presentation="ritual"] .hold-button');
    const remountDeadline=Date.now()+15000;
    while(heldRemountTextureRequests.length<2&&Date.now()<remountDeadline)await new Promise(resolve=>setTimeout(resolve,25));
    assert.equal(heldRemountTextureRequests.length,2,'Re-entered renderer must request both official textures before becoming ready');
    assert.equal(await page.$eval('.hold-button',node=>node.disabled),true,'Re-entered ritual must keep casting disabled until the new renderer is ready');
    await page.$eval('.hold-button',node=>node.click());
    assert.equal(await page.evaluate(()=>window.__ritualBitDraws),0,'A stale readiness flag must not allow a business cast before the remounted renderer is ready');
    const beforeRemountReady=await page.evaluate(storageKey=>{
     const raw=sessionStorage.getItem(storageKey),current=raw?JSON.parse(raw):null;
     return current?.data?.steps?.length??0;
    },key);
    assert.equal(beforeRemountReady,0,'A stale readiness flag must not create a step before the remounted renderer is ready');
    holdRemountTextures=false;
    await Promise.all(heldRemountTextureRequests.map(request=>request.continue()));
    await page.waitForSelector('[data-three-coin-presentation="ritual"] .hold-button:not(:disabled)');
    await page.waitForFunction(()=>document.querySelector('[data-renderer="three-webgl"]')?.getAttribute('data-phase')==='ready');
   }
  }
  if(deferTextures) {
   await page.waitForSelector('.ritual-webgl canvas');
   const deadline=Date.now()+15000;
   while(heldTextureRequests.length<2 && Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,25));
   assert.equal(heldTextureRequests.length,2,'Both official textures must be requested');
   await page.waitForSelector('[data-three-coin-presentation="ritual"] .hold-button');
   assert.equal(await page.$eval('.hold-button',node=>node.disabled),true,'A real cast must wait for its textures');
   await page.$eval('.hold-button',node=>node.click());
   assert.equal(await page.evaluate(()=>window.__ritualBitDraws),0,'Waiting for the renderer must not generate a business result');
   const before=await page.evaluate(storageKey=>JSON.parse(sessionStorage.getItem(storageKey)),key);
   assert.notEqual(before.coreQuestionFrozenAtCast,true,'The question remains editable while textures load');
   await Promise.all(heldTextureRequests.map(request=>request.continue()));
   await page.waitForSelector('[data-renderer="three-webgl"]');
  }
  await page.waitForSelector('[data-three-coin-presentation="ritual"] .hold-button:not(:disabled)');
  await page.locator('[data-three-coin-presentation="ritual"] .hold-button').click();
  if(storageFailure) {
   await page.waitForSelector('[data-three-coin-storage-error]');
   assert.equal(await page.evaluate(()=>window.__ritualBitDraws),3);
   assert.equal(await page.$('[data-record-this-cast]'),null,'Failed storage must not permit record');
   await page.evaluate(()=>{window.__blockCastStorage=false;});
   assert.equal(await page.$eval('[data-three-coin-storage-error] button',node=>node.textContent),'Retry saving this cast');
   await page.locator('[data-three-coin-storage-error] button').click();
  }
  await page.waitForSelector('[data-record-this-cast]');
  if(completedFlow)await page.waitForSelector('[data-record-this-cast]:not(:disabled)');
  const session=await page.evaluate(storageKey=>JSON.parse(sessionStorage.getItem(storageKey)),key);
  assert.equal(session.data.steps.length,1);
  assert.equal(session.data.steps[0].lineIndex,0);
  assert.equal(session.coreQuestionFrozenAtCast,true);
  assert.equal(await page.evaluate(()=>window.__ritualBitDraws),3,'Cast 1 must use exactly three business bits');
  if(completedFlow) {
   const firstResult=await page.evaluate(()=>({
    phase:document.querySelector('[data-renderer="three-webgl"]')?.getAttribute('data-phase'),
    faces:document.querySelectorAll('.ritual-face-labels > span').length,
    recordVisible:Boolean(document.querySelector('[data-record-this-cast]:not(:disabled)')),
   }));
   assert.equal(firstResult.phase,'settled','First Cast Result must show the settled three-coin result');
   assert.equal(firstResult.faces,3,'First Cast Result must show all three authoritative coin faces');
   assert.equal(firstResult.recordVisible,true,'First Cast Result must expose Record This Cast');
   await page.screenshot({path:acceptanceOutput+'/'+id+'-C-first-cast-result.png'});
   assert.equal(await page.$('.hold-button'),null,'An unrecorded result must not expose a second cast control');
   assert.equal(await page.evaluate(()=>window.__ritualBitDraws),3,'Trying to continue before Record This Cast must not draw more business bits');
   const stillOne=await page.evaluate(storageKey=>JSON.parse(sessionStorage.getItem(storageKey)).data.steps.length,key);
   assert.equal(stillOne,1,'Trying to continue before Record This Cast must not create line two');
  }
  const authoritative=session.data.steps[0].coinFaces;
  if(fallback || moduleFailure) {
   await page.waitForSelector('[data-webgl-fallback="true"]');
   const sources=await page.$$eval('.ritual-fallback img',nodes=>nodes.map(node=>node.getAttribute('src')));
   assert.equal(sources.length,3);
   sources.forEach((source,index)=>assert(decodeURIComponent(source).includes(authoritative[index]==='yang'?assets.coinFrontDesktop.url:assets.coinBackDesktop.url)));
  } else {
   await page.waitForFunction(expected=>document.querySelector('[data-renderer="three-webgl"]')?.getAttribute('data-visible-faces')===expected,{},authoritative.join(','));
   assert.equal(await page.$eval('[data-renderer="three-webgl"]',node=>node.dataset.faces),authoritative.join(','));
  }
  assert.equal(await page.evaluate(()=>window.__ritualBitDraws),3,'Presentation/retry may not draw another business result');
  if(process.argv.includes('--capture'))await page.screenshot({path:output+'/'+id+'-settled.png'});
  await page.waitForSelector('[data-record-this-cast]:not(:disabled)');
  await page.locator('[data-record-this-cast]').click();
  const after=await page.evaluate(storageKey=>JSON.parse(sessionStorage.getItem(storageKey)),key);
  assert.deepEqual(after.data.steps,session.data.steps,'Recording may not replace the authoritative step');
  assert.equal(after.id,session.id);
  if(completedFlow) {
   await page.waitForSelector('[data-ritual-view="progress"]');
   await page.waitForSelector('[data-three-coin-presentation="ritual"] .hold-button:not(:disabled)');
   await page.waitForFunction(()=>document.querySelector('[data-renderer="three-webgl"]')?.getAttribute('data-phase')==='ready');
   const secondReady=await page.evaluate(storageKey=>{
    const raw=sessionStorage.getItem(storageKey),current=raw?JSON.parse(raw):null;
    const button=document.querySelector('.hold-button');
    const style=button?getComputedStyle(button):null;
    const rect=button?.getBoundingClientRect();
    return {
     steps:current?.data?.steps?.length??0,
     businessDraws:window.__ritualBitDraws,
     done:document.querySelectorAll('.ritual-six-lines li[data-state="done"]').length,
     waiting:document.querySelectorAll('.ritual-six-lines li[data-state="waiting"]').length,
     phase:document.querySelector('[data-renderer="three-webgl"]')?.getAttribute('data-phase'),
     label:button?.getAttribute('data-visual-label')??'',
     button:{width:rect?.width??0,height:rect?.height??0,color:style?.color??'',background:style?.backgroundColor??'',border:style?.borderTopWidth??'',opacity:style?.opacity??''},
    };
   },key);
   assert.equal(secondReady.steps,1,'Recording line one must not pre-generate line two');
   assert.equal(secondReady.businessDraws,3,'Recording line one must not draw line two');
   assert.equal(secondReady.done,1,'Line 1 must be done after Record This Cast');
   assert.equal(secondReady.waiting,5,'Lines 2–6 must remain waiting after line one');
   assert.equal(secondReady.phase,'ready','Line 1 Recorded / Cast 2 Ready must restore the three-coin ready scene');
   assert.match(secondReady.label,zh?/按住摇动 · 松开起爻/:/Press & hold to shake/,'Cast 2 Ready must expose the locale-appropriate formal casting instruction');
   assert(secondReady.button.width>100&&secondReady.button.height>30,'Cast 2 Ready control must have a visible hit area');
   assert.notEqual(secondReady.button.color,'rgba(0, 0, 0, 0)','Cast 2 Ready control text must not be transparent');
   assert.notEqual(secondReady.button.background,'rgba(0, 0, 0, 0)','Cast 2 Ready control must not be a transparent hot zone');
   assert.notEqual(secondReady.button.border,'0px','Cast 2 Ready control must retain the formal ritual border');
   assert.notEqual(secondReady.button.opacity,'0','Cast 2 Ready control must be visible');
   await page.screenshot({path:acceptanceOutput+'/'+id+'-D-line-1-recorded-cast-2-ready.png'});

   for(let line=1;line<6;line++) {
    const beforeCast=await page.evaluate(storageKey=>{
     const current=JSON.parse(sessionStorage.getItem(storageKey));
     return {steps:current.data.steps.length,businessDraws:window.__ritualBitDraws};
    },key);
    assert.equal(beforeCast.steps,line,'Cast '+(line+1)+' must start with exactly '+line+' recorded step(s)');
    assert.equal(beforeCast.businessDraws,line*3,'Cast '+(line+1)+' requires a new user interaction before drawing randomness');
    await page.waitForSelector('[data-three-coin-presentation="ritual"] .hold-button:not(:disabled)');
    await page.waitForFunction(()=>document.querySelector('[data-renderer="three-webgl"]')?.getAttribute('data-phase')==='ready');
    await page.locator('[data-three-coin-presentation="ritual"] .hold-button').click();
    await page.waitForSelector('[data-record-this-cast]:not(:disabled)');
    const current=await page.evaluate(storageKey=>JSON.parse(sessionStorage.getItem(storageKey)),key);
    assert.equal(current.id,session.id,'All six casts must stay in one session');
    assert.equal(current.data.steps.length,line+1);
    assert.deepEqual(current.data.steps.slice(0,line),after.data.steps,'A later cast must preserve earlier authoritative steps');
    after.data.steps=current.data.steps;
    assert.equal(current.data.steps[line].lineIndex,line,'Authoritative line order stays bottom-up');
    assert.equal(await page.evaluate(()=>window.__ritualBitDraws),(line+1)*3,'Cast '+(line+1)+' must consume exactly three new business bits');
    await page.locator('[data-record-this-cast]').click();
   }
   await page.waitForSelector('[data-result-choice]');
   assert.equal(await page.$('[data-completed-cast-gate]'),null,'Result Choice must precede authentication');
   assert.equal(await page.evaluate(()=>window.__ritualBitDraws),18,'Six casts require exactly eighteen business bits');
   for(const selector of ['[data-primary-card]','[data-relating-card]','[data-deep-reading-entry]']) {
    assert.equal(await page.$(selector),null,'Result Choice must not render Free/Deep result content '+selector);
   }
   const completed=await page.evaluate(storageKey=>JSON.parse(sessionStorage.getItem(storageKey)),key);
   assert.equal(completed.id,session.id);
   assert.deepEqual(completed.data.steps,after.data.steps);
   await page.reload({waitUntil:'networkidle0'});
   await page.waitForSelector('[data-completed-cast-gate="auth-required"]');
   const restored=await page.evaluate(storageKey=>JSON.parse(sessionStorage.getItem(storageKey)),key);
   assert.deepEqual(restored,completed,'Refreshing Result Choice preserves the same completed cast');
  }
  const outcome={bits,zh,reduced,fallback,moduleFailure,storageFailure,completedFlow,deferTextures,remountReadiness,faces:authoritative,lineValue:session.data.steps[0].lineValue,status:'PASS'};
  outcomes.push(outcome);console.log(JSON.stringify(outcome));
 } catch(error) {
  if(page) {
   await page.screenshot({path:output+'/failure.png'});
   await writeFile(output+'/failure.json',JSON.stringify({error:String(error),stack:error.stack,body:await page.$eval('body',node=>node.innerText),buttons:await page.$$eval('button',nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {text:node.textContent,rect:{x:r.x,y:r.y,width:r.width,height:r.height},hit:top?.outerHTML.slice(0,200)}}))},null,2));
  }
  throw error;
 } finally {await browser.close();}
}
const cases=Array.from({length:8},(_,mask)=>({id:`faces-${mask}`,bits:[mask&1,(mask>>1)&1,(mask>>2)&1]}));
cases.push({id:'reduced',bits:[1,0,0],reduced:true},{id:'fallback',bits:[0,1,0],fallback:true},{id:'zh',bits:[1,0,1],zh:true},{id:'storage-retry',bits:[1,0,0],storageFailure:true},{id:'module-fallback',bits:[0,0,1],moduleFailure:true});
cases.push({id:'six-lines-auth',bits:Array.from({length:18},(_,i)=>i%2),completedFlow:true,remountReadiness:true},{id:'six-lines-auth-zh-reduced',bits:Array.from({length:18},(_,i)=>(i+1)%2),completedFlow:true,zh:true,reduced:true});
cases.push({id:'texture-readiness',bits:[1,0,1],deferTextures:true});
const requested=process.argv.find(arg=>arg.startsWith('--case='))?.slice(7);
const selected=requested?cases.filter(item=>item.id===requested):process.argv.includes('--smoke')?cases.slice(0,1):cases;
assert(selected.length>0,'Unknown fixture case');
for(const fixture of selected) {
 try {await runCase(fixture);outcomes.at(-1).id=fixture.id;}
 catch(error) {const outcome={...fixture,status:'FAIL',error:String(error)};outcomes.push(outcome);console.error(JSON.stringify(outcome));process.exitCode=1;}
 await writeFile(output+(requested?'/results-'+requested+'.json':'/results.json'),JSON.stringify({kind:'isolated local business fixture / real algorithm and real renderer; not Pixel or real-account acceptance',originalTotal:selected.length,pass:outcomes.filter(item=>item.status==='PASS').length,fail:outcomes.filter(item=>item.status==='FAIL').length,unreviewed:selected.length-outcomes.length,outcomes},null,2)+'\n');
}
assert.equal(outcomes.length,selected.length,'Every selected fixture must be accounted for');
