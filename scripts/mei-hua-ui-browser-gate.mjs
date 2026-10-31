// Production UI verification. Auth responses below are explicitly test-only browser seams.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { resolveChromeExecutable } from './browser-runtime.mjs';
const BASE=process.env.PUBLIC_V1_TEST_BASE_URL||'http://127.0.0.1:3078';
const OUT=process.env.MEI_HUA_QA_OUTPUT||'docs/qa/mei-hua-78/screenshots';
await mkdir(OUT,{recursive:true});
const runtime=await resolveChromeExecutable(chromium);
const browser=await puppeteer.launch({executablePath:runtime.executablePath,headless:true,args:['--no-sandbox']});
const results={base:BASE,authVerification:'Test-only /api/user/me response and callback navigation; real provider login NOT VERIFIED',captures:[],checks:[]};
const button=async(p,text)=>{await p.waitForFunction(t=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===t&&!b.disabled),{},text);const h=await p.evaluateHandle(t=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t),text);await h.asElement().click();await h.dispose();};
async function ready(p){await p.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));await Promise.all([...document.images].map(i=>i.decode()));});}
async function capture(p,name,fullPage=false){await ready(p);if(name==='desktop-shared-reference')assert(await p.$eval('[data-reading-choice="free"]',e=>e.getBoundingClientRect().bottom<=innerHeight),"Free Reading must fit the reference desktop viewport");const overflow=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1;}).map(e=>({tag:e.tagName,cls:typeof e.className==='string'?e.className:'',text:e.textContent.slice(0,80),right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).slice(0,25)}));if(overflow.scroll>overflow.width){console.error(JSON.stringify(overflow,null,2));await p.screenshot({path:`${OUT}/overflow-diagnostic.png`});}assert.equal(overflow.scroll>overflow.width,false,`${name}: horizontal overflow`);const clip=fullPage?await p.evaluate(()=>{const e=document.querySelector('.mei-scene')||document.querySelector('.shared-reading-summary');return {x:0,y:0,width:innerWidth,height:Math.ceil(e.getBoundingClientRect().bottom+scrollY)};}):undefined;await p.screenshot({path:`${OUT}/${name}.png`,...(clip?{clip,captureBeyondViewport:true}:{fullPage:false})});results.captures.push({name,url:p.url(),viewport:p.viewport(),fullPage:false,clip,screenshotScale:'css',metadata:await p.evaluate(()=>({title:document.title,dpr:devicePixelRatio,scrollWidth:document.documentElement.scrollWidth,clientWidth:innerWidth,fonts:document.fonts.status}))});}
let qaPage;
async function preparePage(viewport){const p=qaPage??(qaPage=await browser.newPage());await p.setViewport(viewport);await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await p.evaluateOnNewDocument(()=>localStorage.setItem('quickiching:analytics-consent:v1','denied'));return p;}
try {
 for(const viewport of [{width:1670,height:942,deviceScaleFactor:1},{width:375,height:812,deviceScaleFactor:1}]){
  const p=await preparePage(viewport);const size=viewport.width===375?'mobile':'desktop';console.log(`START ${size}`);
  if(p.url().startsWith(BASE))await p.evaluate(()=>{sessionStorage.removeItem("quickiching:public-v1:mei-hua-number-time-v1");sessionStorage.removeItem("quickiching:public-v1:mei-hua-v2");});
  await p.goto(`${BASE}/methods/mei-hua-yi-shu`,{waitUntil:'networkidle0'});
  await p.waitForSelector('#mei-hua-question');await capture(p,`${size}-step-1`);
  await p.type('#mei-hua-question','Should I change to a new job?');await p.click('.mei-ask button');await p.waitForSelector('#mei-hua-number');
  await p.type('#mei-hua-number','17');await capture(p,`${size}-step-2`);
  await p.click('.mei-choose button');await p.waitForSelector('.mei-moment');await capture(p,`${size}-step-3`,size==='mobile');
  await button(p,'Change Number');await p.waitForSelector('#mei-hua-number');assert.equal(await p.$eval('#mei-hua-number',e=>e.value),'17');
  await button(p,'✎ Edit');await p.waitForSelector('#mei-hua-question');await p.locator('#mei-hua-question').fill('Should I change to a new job? This year.');await p.click('.mei-ask button');await p.waitForSelector('#mei-hua-number');assert.equal(await p.$eval('#mei-hua-number',e=>e.value),'');
  await p.type('#mei-hua-number','29');await p.click('.mei-choose button');await p.waitForSelector('.mei-moment');
  const key='quickiching:public-v1:mei-hua-number-time-v1';
  assert.equal(await p.evaluate(k=>JSON.parse(sessionStorage.getItem(k)).data,key),undefined);
  const before=Date.now();await button(p,'☯Confirm & Cast');await p.waitForSelector('[data-mei-hua-locked="true"]');const after=Date.now();
  const sealed=await p.evaluate(k=>JSON.parse(sessionStorage.getItem(k)),key);
  assert.equal(sealed.data.input.number,29);assert.equal(sealed.data.input.ianaTimeZone,await p.evaluate(()=>Intl.DateTimeFormat().resolvedOptions().timeZone));assert(sealed.data.input.utcMillis>=before&&sealed.data.input.utcMillis<=after);assert.equal(sealed.coreQuestionAtCast,'Should I change to a new job? This year.');assert.equal(sealed.coreQuestionFrozenAtCast,true);assert.equal(sealed.data.algorithmStatus,'unverified');assert.equal(sealed.data.result,undefined);assert.equal(await p.$('[data-mei-hua-step="4"]'),null);
  await p.reload({waitUntil:'networkidle0'});await p.waitForSelector('[data-mei-hua-locked="true"]');assert.deepEqual(await p.evaluate(k=>JSON.parse(sessionStorage.getItem(k)),key),sealed);assert.equal(await p.$('#mei-hua-number'),null);
  results.checks.push(`${size}: edit/reset, change-number, click-time seal, immutable reload, no Step 4, algorithm blocker PASS`);console.log(results.checks.at(-1));
 }
 // A real six-line browser cast, generated by the existing Three Coin flow.
 const p=await preparePage({width:1670,height:942,deviceScaleFactor:1});
 await p.goto(BASE,{waitUntil:'networkidle0'});await p.type('textarea[data-private-question]','Should I change to a new job?');await button(p,'Start Divination');await p.waitForSelector('[data-question-confirm]');await button(p,'Cast the Coins');
 for(let line=1;line<=6;line++){await p.waitForSelector('.hold-button:not(:disabled)');await p.click('.hold-button');await button(p,'Record This Cast');if(line<6)await p.waitForFunction(n=>document.querySelectorAll('.ritual-six-lines li[data-state="done"]').length===n,{},line);}
 await p.waitForFunction(()=>location.pathname==='/readings/result');await p.waitForSelector('[data-shared-reading-summary]');
 const castKey='quickiching:public-v1:three-coin';const original=await p.evaluate(k=>sessionStorage.getItem(k),castKey);assert(original);const sealed=JSON.parse(original);assert.equal(sealed.data.steps.length,6);
 const fingerprint=await p.$eval('[data-public-reading-result]',e=>e.dataset.readingFingerprint);
 assert.equal(await p.$('[data-auth-required-before-reveal]'),null);assert.equal(await p.$eval('.shared-reading-content',e=>getComputedStyle(e).display),'none');
 await capture(p,'desktop-shared-reading');await p.setViewport({width:1983,height:793,deviceScaleFactor:1});await capture(p,'desktop-shared-reference');await p.setViewport({width:375,height:812,deviceScaleFactor:1});await capture(p,'mobile-shared-reading',true);
 // Both continuation intents, with an explicit browser-only authenticated response.
 let signedIn=false;await p.setRequestInterception(true);p.on('request',r=>{const u=new URL(r.url());if(u.pathname==='/api/user/me')return r.respond({status:200,contentType:'application/json',body:JSON.stringify({user:signedIn?{id:'qa-auth-seam',email:'qa@example.invalid'}:null})});if(u.pathname==='/signin'&&r.isNavigationRequest())return r.respond({status:200,contentType:'text/html',body:'<h1>Test-only login handoff</h1>'});return r.continue();});
 for(const choice of ['free','deep']){signedIn=false;await p.evaluate(id=>sessionStorage.removeItem(`quickiching:reading-entry:${id}`),sealed.id);await p.goto(`${BASE}/readings/result`,{waitUntil:'networkidle0'});await p.waitForSelector('[data-shared-reading-summary]');await p.click(`[data-reading-choice="${choice}"]`);await p.waitForFunction(()=>location.pathname==='/signin');const login=new URL(p.url());const callback=login.searchParams.get('callbackURL');assert(callback.endsWith(`#reading-${choice}`));assert(callback.startsWith('/readings/result'));assert.equal(new URL(callback,BASE).searchParams.get('session'),sealed.id);assert.equal(await p.evaluate(k=>sessionStorage.getItem(k),castKey),original);
  signedIn=true;
  for(const loseTabIntent of [false,true]) {
   if(loseTabIntent)await p.evaluate(id=>sessionStorage.removeItem(`quickiching:reading-entry:${id}`),sealed.id);
   await p.goto(`${BASE}${callback}`,{waitUntil:'networkidle0'});
   if(loseTabIntent)await p.reload({waitUntil:'networkidle0'});
   if(choice==='free') {
    await p.waitForSelector('[data-reading-open="free"]');
    assert.equal(await p.$eval('[data-public-reading-result]',e=>e.dataset.readingFingerprint),fingerprint);
    assert.equal(await p.$eval('[data-shared-reading-summary]',e=>e.dataset.castId),sealed.id);
    assert.equal(await p.$eval('[data-shared-reading-summary]',e=>e.dataset.castCreatedAt),sealed.createdAt);
   } else {
    await p.waitForFunction(()=>location.pathname==='/readings/deep');
    assert.equal(new URL(p.url()).searchParams.get('session'),sealed.id);
    // This local server has no authenticated provider session. Its existing Deep
    // authorization gate is expected; do not claim a live authenticated Deep result.
    await p.waitForSelector('[data-completed-cast-gate="auth-required"]');
   }
   assert.equal(await p.evaluate(id=>sessionStorage.getItem(`quickiching:reading-entry:${id}`),sealed.id),choice);
   assert.equal(await p.evaluate(k=>sessionStorage.getItem(k),castKey),original);
  }
  results.checks.push(`Three Coin ${choice}: anonymous summary → callback with same cast ID and selected destination PASS; provider login NOT VERIFIED (test-only auth seam)`);
 }
 results.realThreeCoin={id:sealed.id,createdAt:sealed.createdAt,lines:sealed.data.steps.map(s=>s.lineValue),fingerprint};
 await writeFile(`${OUT}/verification.json`,JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
}catch(error){console.error(error);throw error;}finally{const timeout=setTimeout(()=>browser.process()?.kill('SIGTERM'),5000);timeout.unref();await browser.close();clearTimeout(timeout);}
