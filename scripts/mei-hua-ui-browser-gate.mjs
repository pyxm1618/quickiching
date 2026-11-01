// Production UI verification. Auth responses below are explicitly test-only browser seams.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { resolveChromeExecutable } from './browser-runtime.mjs';

const BASE=process.env.PUBLIC_V1_TEST_BASE_URL||'http://127.0.0.1:3078';
const OUT=process.env.MEI_HUA_QA_OUTPUT||'docs/qa/mei-hua-78/screenshots';
const CAST_KEY='quickiching:public-v1:mei-hua-number-time-v1';
const COMPLETED_KEY='quickiching:public-v1:completed-reading';
await mkdir(OUT,{recursive:true});
const runtime=await resolveChromeExecutable(chromium);
const browser=await puppeteer.launch({executablePath:runtime.executablePath,headless:true,args:['--no-sandbox']});
const results={base:BASE,authVerification:'Browser-only /api/user/me seam; real provider login requires staging acceptance',captures:[],checks:[]};

const button=async(p,text)=>{
  await p.waitForFunction(t=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===t&&!b.disabled),{},text);
  const h=await p.evaluateHandle(t=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t),text);
  await h.asElement().click();await h.dispose();
};
async function ready(p){await p.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));await Promise.all([...document.images].map(i=>i.decode()));});}
async function capture(p,name,fullPage=false){
  await ready(p);
  if(name==='desktop-shared-reference')assert(await p.$eval('[data-reading-choice="free"]',e=>e.getBoundingClientRect().bottom<=innerHeight),"Free Reading must fit the reference desktop viewport");
  const overflow=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1;}).map(e=>({tag:e.tagName,cls:typeof e.className==='string'?e.className:'',text:e.textContent.slice(0,80),right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).slice(0,25)}));
  if(overflow.scroll>overflow.width){console.error(JSON.stringify(overflow,null,2));await p.screenshot({path:`${OUT}/overflow-diagnostic.png`});}
  assert.equal(overflow.scroll>overflow.width,false,`${name}: horizontal overflow`);
  const clip=fullPage?await p.evaluate(()=>{const e=document.querySelector('.mei-scene')||document.querySelector('.shared-reading-summary');return {x:0,y:0,width:innerWidth,height:Math.ceil(e.getBoundingClientRect().bottom+scrollY)};}):undefined;
  await p.screenshot({path:`${OUT}/${name}.png`,...(clip?{clip,captureBeyondViewport:true}:{fullPage:false})});
  results.captures.push({name,url:p.url(),viewport:p.viewport(),fullPage:false,clip,screenshotScale:'css',metadata:await p.evaluate(()=>({title:document.title,dpr:devicePixelRatio,scrollWidth:document.documentElement.scrollWidth,clientWidth:innerWidth,fonts:document.fonts.status}))});
}
let qaPage;
async function preparePage(viewport){
  const p=qaPage??(qaPage=await browser.newPage());
  await p.setViewport(viewport);
  await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await p.evaluateOnNewDocument(()=>localStorage.setItem('quickiching:analytics-consent:v1','denied'));
  return p;
}
async function clearMeiSession(p){
  if(!p.url().startsWith(BASE))await p.goto(BASE,{waitUntil:'domcontentloaded'});
  await p.evaluate((castKey,completedKey)=>{
    sessionStorage.removeItem(castKey);
    sessionStorage.removeItem(completedKey);
    for(const key of Object.keys(sessionStorage))if(key.startsWith('quickiching:reading-entry:'))sessionStorage.removeItem(key);
  },CAST_KEY,COMPLETED_KEY);
}

let authFixture=null;
try {
  for(const viewport of [{width:1670,height:942,deviceScaleFactor:1},{width:375,height:812,deviceScaleFactor:1}]){
    const p=await preparePage(viewport);const size=viewport.width===375?'mobile':'desktop';console.log(`START ${size}`);
    await clearMeiSession(p);
    await p.goto(`${BASE}/methods/mei-hua-yi-shu`,{waitUntil:'networkidle0'});
    await p.waitForSelector('#mei-hua-question');await capture(p,`${size}-step-1`);
    await p.type('#mei-hua-question','Should I change to a new job?');await p.click('.mei-ask button');await p.waitForSelector('#mei-hua-number');
    await p.type('#mei-hua-number','17');await capture(p,`${size}-step-2`);
    await p.click('.mei-choose button');await p.waitForSelector('.mei-moment');await capture(p,`${size}-step-3`,size==='mobile');

    await button(p,'Change Number');await p.waitForSelector('#mei-hua-number');assert.equal(await p.$eval('#mei-hua-number',e=>e.value),'17');
    await button(p,'✎ Edit');await p.waitForSelector('#mei-hua-question');
    await p.locator('#mei-hua-question').fill('Should I change to a new job? This year.');
    await p.click('.mei-ask button');await p.waitForSelector('#mei-hua-number');assert.equal(await p.$eval('#mei-hua-number',e=>e.value),'');
    await p.type('#mei-hua-number','29');await p.click('.mei-choose button');await p.waitForSelector('.mei-moment');
    assert.equal(await p.evaluate(k=>JSON.parse(sessionStorage.getItem(k)).data,CAST_KEY),undefined);

    const before=Date.now();await button(p,'☯Confirm & Cast');await p.waitForSelector('[data-mei-hua-shared-reading]');await p.waitForSelector('[data-shared-reading-summary]');const after=Date.now();
    const sealed=await p.evaluate(k=>JSON.parse(sessionStorage.getItem(k)),CAST_KEY);
    assert.equal(sealed.data.input.number,29);
    assert.equal(sealed.data.input.ianaTimeZone,await p.evaluate(()=>Intl.DateTimeFormat().resolvedOptions().timeZone));
    assert(sealed.data.input.utcMillis>=before&&sealed.data.input.utcMillis<=after);
    assert.equal(sealed.coreQuestionAtCast,'Should I change to a new job? This year.');
    assert.equal(sealed.coreQuestionFrozenAtCast,true);
    assert.equal(sealed.data.result.algorithmVersion,'mei-hua-number-moment-classical-v1');
    assert.equal(sealed.data.result.methodCalculation.number,29);
    assert.equal(sealed.data.result.methodCalculation.utcMillis,sealed.data.input.utcMillis);
    assert.equal(sealed.data.result.methodCalculation.ianaTimeZone,sealed.data.input.ianaTimeZone);
    assert.equal(sealed.data.result.lineValuesBottomUp.length,6);
    assert.equal(sealed.data.result.movingLinePosition>=1&&sealed.data.result.movingLinePosition<=6,true);
    assert.equal(Number.isInteger(sealed.data.result.primaryHexagramNumber),true);
    assert.equal(Number.isInteger(sealed.data.result.relatingHexagramNumber),true);
    assert.equal(await p.$('[data-mei-hua-step="4"]'),null);
    assert.equal(await p.$('[data-mei-hua-algorithm-boundary]'),null);

    const fingerprint=await p.$eval('[data-public-reading-result]',e=>e.dataset.readingFingerprint);
    assert(fingerprint?.includes('mei-hua-number-moment-classical-v1'));
    if(size==='desktop'){
      await capture(p,'desktop-shared-reading');
      await p.setViewport({width:1983,height:793,deviceScaleFactor:1});await capture(p,'desktop-shared-reference');
      await p.setViewport(viewport);
    }else{
      await capture(p,'mobile-shared-reading',true);
    }

    const original=await p.evaluate(k=>sessionStorage.getItem(k),CAST_KEY);
    await p.reload({waitUntil:'networkidle0'});await p.waitForSelector('[data-mei-hua-shared-reading]');
    assert.equal(await p.evaluate(k=>sessionStorage.getItem(k),CAST_KEY),original);
    assert.equal(await p.$eval('[data-public-reading-result]',e=>e.dataset.readingFingerprint),fingerprint);
    assert.equal(await p.$('#mei-hua-number'),null);
    results.checks.push(`${size}: edit/reset, Change Number, exact click-time seal, real hexagram, Shared Reading, immutable reload, no Step 4/fallback PASS`);
    console.log(results.checks.at(-1));
    if(size==='mobile')authFixture={sealed,original,fingerprint};
  }

  assert(authFixture);
  const p=await preparePage({width:1670,height:942,deviceScaleFactor:1});
  const {sealed,original,fingerprint}=authFixture;
  let signedIn=false;
  await p.setRequestInterception(true);
  p.on('request',r=>{
    const u=new URL(r.url());
    if(u.pathname==='/api/user/me')return r.respond({status:200,contentType:'application/json',body:JSON.stringify({user:signedIn?{id:'qa-auth-seam',email:'qa@example.invalid'}:null})});
    if(u.pathname==='/signin'&&r.isNavigationRequest())return r.respond({status:200,contentType:'text/html',body:'<h1>Test-only login handoff</h1>'});
    return r.continue();
  });

  for(const choice of ['free','deep']){
    signedIn=false;
    await p.evaluate((id,key)=>{sessionStorage.removeItem(`quickiching:reading-entry:${id}`);sessionStorage.removeItem(key);},sealed.id,COMPLETED_KEY);
    await p.goto(`${BASE}/methods/mei-hua-yi-shu`,{waitUntil:'networkidle0'});
    await p.waitForSelector('[data-shared-reading-summary]');
    assert.equal(await p.evaluate(k=>sessionStorage.getItem(k),CAST_KEY),original);
    await p.click(`[data-reading-choice="${choice}"]`);
    await p.waitForFunction(()=>location.pathname==='/signin');
    const login=new URL(p.url());
    const callback=login.searchParams.get('callbackURL');
    assert(callback);
    const callbackUrl=new URL(callback,BASE);
    assert.equal(callbackUrl.pathname,'/methods/mei-hua-yi-shu');
    assert.equal(callbackUrl.searchParams.get('session'),sealed.id);
    assert(callback.endsWith(`#reading-${choice}`));
    assert.equal(await p.evaluate(k=>sessionStorage.getItem(k),CAST_KEY),original);

    signedIn=true;
    await p.goto(`${BASE}${callback}`,{waitUntil:'networkidle0'});
    if(choice==='free'){
      await p.waitForSelector('[data-reading-open="free"]');
      assert.equal(await p.$eval('[data-public-reading-result]',e=>e.dataset.readingFingerprint),fingerprint);
      assert.equal(await p.$eval('[data-shared-reading-summary]',e=>e.dataset.castId),sealed.id);
      assert.equal(await p.evaluate(k=>sessionStorage.getItem(k),CAST_KEY),original);
      await p.click('[data-save-reading]');
      await p.waitForFunction(()=>document.querySelector('[data-save-reading]')?.textContent?.toLowerCase().includes('saved'));
      await p.goto(`${BASE}/history`,{waitUntil:'networkidle0'});
      await p.waitForSelector('[data-history-page]');
      await p.waitForSelector('[data-public-reading-result]');
      assert.equal(await p.$eval('[data-public-reading-result]',e=>e.dataset.readingFingerprint),fingerprint);
      assert.equal(await p.$eval('[data-public-reading-result]',e=>e.dataset.readingFingerprint),fingerprint);
      results.checks.push('Mei Hua History: save → History render → identical fingerprint PASS');
    }else{
      await p.waitForFunction(()=>location.pathname==='/readings/deep');
      assert.equal(new URL(p.url()).searchParams.get('session'),sealed.id);
      const completed=JSON.parse(await p.evaluate(k=>sessionStorage.getItem(k),COMPLETED_KEY));
      assert.equal(completed.id,sealed.id);
      assert.equal(completed.question,sealed.coreQuestionAtCast);
      assert.equal(completed.methodVersion,sealed.data.result.algorithmVersion);
      assert.deepEqual(completed.lineValuesBottomUp,sealed.data.result.lineValuesBottomUp);
      assert.equal(completed.primaryHexagram,sealed.data.result.primaryHexagramNumber);
      assert.deepEqual(completed.changingLines,[sealed.data.result.movingLinePosition]);
      assert.equal(completed.relatingHexagram,sealed.data.result.relatingHexagramNumber);
      assert.equal(completed.evidence.calculation.methodCalculation.number,sealed.data.input.number);
      assert.equal(completed.evidence.calculation.methodCalculation.utcMillis,sealed.data.input.utcMillis);
      assert.equal(completed.evidence.calculation.methodCalculation.ianaTimeZone,sealed.data.input.ianaTimeZone);
      // Local CI does not possess the provider session. A real-account staging run is a separate acceptance gate.
      await p.waitForSelector('[data-completed-cast-gate="auth-required"]');
      assert.equal(await p.evaluate(k=>sessionStorage.getItem(k),CAST_KEY),original);
    }
    results.checks.push(`Mei Hua ${choice}: anonymous Shared Reading → login callback → same cast/session and intent PASS; provider login NOT VERIFIED by this browser seam`);
  }

  results.realMeiHua={
    id:sealed.id,
    createdAt:sealed.createdAt,
    question:sealed.coreQuestionAtCast,
    number:sealed.data.input.number,
    utcMillis:sealed.data.input.utcMillis,
    ianaTimeZone:sealed.data.input.ianaTimeZone,
    lines:sealed.data.result.lineValuesBottomUp,
    primary:sealed.data.result.primaryHexagramNumber,
    changingLine:sealed.data.result.movingLinePosition,
    relating:sealed.data.result.relatingHexagramNumber,
    algorithmVersion:sealed.data.result.algorithmVersion,
    fingerprint,
  };
  await writeFile(`${OUT}/verification.json`,JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
}catch(error){
  console.error(error);throw error;
}finally{
  const timeout=setTimeout(()=>browser.process()?.kill('SIGTERM'),5000);timeout.unref();
  await browser.close();clearTimeout(timeout);
}
