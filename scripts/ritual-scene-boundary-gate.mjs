// Local-only browser regressions. Crypto is a named test fixture; production algorithm is unchanged.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
const base=process.env.PUBLIC_V1_TEST_BASE_URL||'http://127.0.0.1:3028';
if(new URL(base).hostname!=='127.0.0.1')throw new Error('This fixture gate only runs on 127.0.0.1');
const key='quickiching:public-v1:three-coin';
const output='.artifacts/ritual-qa/business-boundary';await mkdir(output,{recursive:true});
const assets=JSON.parse(await readFile('docs/performance/pr-76-assets.json','utf8'));
const outcomes=[];
async function runCase({id,bits,zh=false,reduced=false,fallback=false,storageFailure=false,moduleFailure=false,completedFlow=false,deferTextures=false}) {
 let page;
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-device-scale-factor=1',...(fallback?['--disable-webgl']:[])]});
 try {
  page=await browser.newPage();await page.setViewport({width:1672,height:941,deviceScaleFactor:1});
  const heldTextureRequests=[];
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
  if(!fallback && !moduleFailure) {
   if(deferTextures) {
    await page.waitForSelector('.ritual-webgl canvas');
    const deadline=Date.now()+15000;
    while(heldTextureRequests.length<2 && Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,25));
    assert.equal(heldTextureRequests.length,2,'Both official textures must be requested');
   } else await page.waitForSelector('[data-renderer="three-webgl"]');
   await page.evaluate(()=>{window.__initialRitualCanvas=document.querySelector('.ritual-webgl canvas');});
  }
  await page.locator('[data-private-question]').fill(zh?'测试：如何理解当前变化？':'QA fixture: how should I understand this transition?');
  await page.locator('[data-home-primary-action]').click();
  assert.equal(await page.evaluate(()=>window.__ritualBitDraws),0,'Home action must not create line one');
  await page.locator('[data-home-primary-action]').click();
  assert.equal(await page.evaluate(()=>window.__ritualBitDraws),0,'Entering ritual must not manufacture a cast');
  if(deferTextures) {
   await page.waitForSelector('[data-three-coin-presentation="home-ritual"] .hold-button');
   assert.equal(await page.$eval('.hold-button',node=>node.disabled),true,'A real cast must wait for its textures');
   await page.$eval('.hold-button',node=>node.click());
   assert.equal(await page.evaluate(()=>window.__ritualBitDraws),0,'Waiting for the renderer must not generate a business result');
   const before=await page.evaluate(storageKey=>JSON.parse(sessionStorage.getItem(storageKey)),key);
   assert.notEqual(before.coreQuestionFrozenAtCast,true,'The question remains editable while textures load');
   await Promise.all(heldTextureRequests.map(request=>request.continue()));
   await page.waitForSelector('[data-renderer="three-webgl"]');
  }
  if(!fallback && !moduleFailure)assert.equal(await page.evaluate(()=>window.__initialRitualCanvas===document.querySelector('[data-renderer="three-webgl"] canvas')),true,'Home, question and casting must retain one renderer canvas');
  await page.waitForSelector('[data-three-coin-presentation="home-ritual"] .hold-button:not(:disabled)');
  await page.locator('[data-three-coin-presentation="home-ritual"] .hold-button').click();
  if(storageFailure) {
   await page.waitForSelector('[data-three-coin-storage-error]');
   assert.equal(await page.evaluate(()=>window.__ritualBitDraws),3);
   assert.equal(await page.$('[data-record-this-cast]'),null,'Failed storage must not permit record');
   await page.evaluate(()=>{window.__blockCastStorage=false;});
   assert.equal(await page.$eval('[data-three-coin-storage-error] button',node=>node.textContent),'Retry saving this cast');
   await page.locator('[data-three-coin-storage-error] button').click();
  }
  await page.waitForSelector('[data-record-this-cast]');
  const session=await page.evaluate(storageKey=>JSON.parse(sessionStorage.getItem(storageKey)),key);
  assert.equal(session.data.steps.length,1);
  assert.equal(session.coreQuestionFrozenAtCast,true);
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
  await page.locator('[data-record-this-cast]').click();
  const after=await page.evaluate(storageKey=>JSON.parse(sessionStorage.getItem(storageKey)),key);
  assert.deepEqual(after.data.steps,session.data.steps,'Recording may not replace the authoritative step');
  assert.equal(after.id,session.id);
  if(completedFlow) {
   for(let line=1;line<6;line++) {
    await page.waitForSelector('[data-three-coin-presentation="home-ritual"] .hold-button:not(:disabled)');
    await page.locator('[data-three-coin-presentation="home-ritual"] .hold-button').click();
    await page.waitForSelector('[data-record-this-cast]');
    const current=await page.evaluate(storageKey=>JSON.parse(sessionStorage.getItem(storageKey)),key);
    assert.equal(current.id,session.id,'All six casts must stay in one session');
    assert.equal(current.data.steps.length,line+1);
    assert.deepEqual(current.data.steps.slice(0,line),after.data.steps,'A later cast must preserve earlier authoritative steps');
    after.data.steps=current.data.steps;
    assert.equal(current.data.steps[line].lineIndex,line,'Authoritative line order stays bottom-up');
    await page.locator('[data-record-this-cast]').click();
   }
   await page.waitForSelector('[data-completed-cast-gate="auth-required"]');
   assert.equal(await page.evaluate(()=>window.__ritualBitDraws),18,'Six casts require exactly eighteen business bits');
   for(const selector of ['[data-primary-card]','[data-relating-card]','[data-deep-reading-entry]']) {
    assert.equal(await page.$(selector),null,'Auth gate must conceal '+selector);
   }
   const completed=await page.evaluate(storageKey=>JSON.parse(sessionStorage.getItem(storageKey)),key);
   assert.equal(completed.id,session.id);
   assert.deepEqual(completed.data.steps,after.data.steps);
   await page.reload({waitUntil:'networkidle0'});
   await page.waitForSelector('[data-completed-cast-gate="auth-required"]');
   const restored=await page.evaluate(storageKey=>JSON.parse(sessionStorage.getItem(storageKey)),key);
   assert.deepEqual(restored,completed,'Refreshing the gate preserves the same completed cast');
  }
  const outcome={bits,zh,reduced,fallback,moduleFailure,storageFailure,completedFlow,deferTextures,faces:authoritative,lineValue:session.data.steps[0].lineValue,status:'PASS'};
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
cases.push({id:'six-lines-auth',bits:Array.from({length:18},(_,i)=>i%2),completedFlow:true},{id:'six-lines-auth-zh-reduced',bits:Array.from({length:18},(_,i)=>(i+1)%2),completedFlow:true,zh:true,reduced:true});
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
