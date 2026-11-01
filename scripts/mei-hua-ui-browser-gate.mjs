// Production UI verification for the Mei Hua casting layer and the shared post-Reading auth boundary.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

const BASE=process.env.PUBLIC_V1_TEST_BASE_URL||"http://127.0.0.1:3078";
const OUT=process.env.MEI_HUA_QA_OUTPUT||"docs/qa/mei-hua-78/screenshots";
const CAST_KEY="quickiching:public-v1:mei-hua-number-time-v1";
const COMPLETED_KEY="quickiching:public-v1:completed-reading";
await mkdir(OUT,{recursive:true});
const runtime=await resolveChromeExecutable(chromium);
const browser=await puppeteer.launch({executablePath:runtime.executablePath,headless:true,args:["--no-sandbox"]});
const results={base:BASE,authVerification:"Anonymous shared-auth boundary verified; real provider login requires staging acceptance",captures:[],checks:[]};

const button=async(p,text)=>{
  const state=await p.evaluate(t=>{
    const candidate=[...document.querySelectorAll("button")].find(b=>b.textContent.trim()===t);
    if(!candidate)return null;
    const rect=candidate.getBoundingClientRect();
    return {disabled:candidate.disabled,width:rect.width,height:rect.height,pointerEvents:getComputedStyle(candidate).pointerEvents};
  },text);
  assert(state&&state.disabled===false&&state.width>0&&state.height>0&&state.pointerEvents!=="none",`${text}: visible enabled button required`);
  await p.evaluate(t=>[...document.querySelectorAll("button")].find(b=>b.textContent.trim()===t)?.click(),text);
};
const setControlledValue=async(p,selector,value)=>{
  await p.$eval(selector,(element,nextValue)=>{
    const prototype=element instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    const setter=Object.getOwnPropertyDescriptor(prototype,"value")?.set;
    if(!setter)throw new Error("CONTROLLED_VALUE_SETTER_UNAVAILABLE");
    setter.call(element,nextValue);
    element.dispatchEvent(new Event("input",{bubbles:true}));
    element.dispatchEvent(new Event("change",{bubbles:true}));
  },value);
};
async function ready(p){await p.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});}
async function noOverflow(p,label){
  const overflow=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.equal(overflow.scroll>overflow.width,false,`${label}: horizontal overflow`);
}
async function capture(p,name){
  await ready(p);await noOverflow(p,name);
  await p.screenshot({path:`${OUT}/${name}.png`,fullPage:false});
  results.captures.push({name,url:p.url(),viewport:p.viewport()});
}
async function clearSessions(p){
  if(!p.url().startsWith(BASE))await p.goto(BASE,{waitUntil:"domcontentloaded"});
  await p.evaluate((castKey,completedKey)=>{sessionStorage.removeItem(castKey);sessionStorage.removeItem(completedKey);},CAST_KEY,COMPLETED_KEY);
}
function callbackFromHref(href){
  const login=new URL(href,BASE);
  const raw=login.searchParams.get("callbackURL");
  assert(raw,"callbackURL required");
  return {login,callback:new URL(raw,BASE)};
}
async function runCase({path,viewport,zh=false,capturePrefix}){
  const p=await browser.newPage();
  try{
    await p.setViewport(viewport);
    await p.emulateMediaFeatures([{name:"prefers-reduced-motion",value:"reduce"}]);
    await p.evaluateOnNewDocument(()=>localStorage.setItem("quickiching:analytics-consent:v1","denied"));
    await clearSessions(p);
    await p.goto(`${BASE}${path}`,{waitUntil:"networkidle0"});
    await p.waitForSelector("#mei-hua-question");
    if(capturePrefix)await capture(p,`${capturePrefix}-step-1`);
    await setControlledValue(p,"#mei-hua-question",zh?"今年是否适合换一份新工作？":"Should I change to a new job this year?");
    await p.click(".mei-ask button");
    await p.waitForSelector("#mei-hua-number");
    await setControlledValue(p,"#mei-hua-number","29");
    if(capturePrefix)await capture(p,`${capturePrefix}-step-2`);
    await p.click(".mei-choose button");
    await p.waitForSelector(".mei-moment");
    if(capturePrefix)await capture(p,`${capturePrefix}-step-3`);

    const before=Date.now();
    await button(p,zh?"☯确认并起卦":"☯Confirm & Cast");
    const expectedResult=zh?"/zh/readings/result":"/readings/result";
    await p.waitForFunction(expected=>location.pathname===expected,{},expectedResult);
    await p.waitForSelector('[data-completed-cast-gate="auth-required"]');
    const after=Date.now();

    const sealed=await p.evaluate(k=>JSON.parse(sessionStorage.getItem(k)),CAST_KEY);
    const completed=await p.evaluate(k=>JSON.parse(sessionStorage.getItem(k)),COMPLETED_KEY);
    assert.equal(sealed.data.input.number,29);
    assert(sealed.data.input.utcMillis>=before&&sealed.data.input.utcMillis<=after);
    assert.equal(sealed.data.result.algorithmVersion,"mei-hua-number-moment-classical-v1");
    assert.equal(completed.id,sealed.id);
    assert.equal(completed.method,"mei-hua-yi-shu");
    assert.equal(completed.methodVersion,sealed.data.result.algorithmVersion);
    assert.deepEqual(completed.lineValuesBottomUp,sealed.data.result.lineValuesBottomUp);
    assert.equal(completed.evidence.calculation.methodCalculation.number,29);

    const freeHref=await p.$eval('[data-auth-reading-intent="free"]',e=>e.getAttribute("href"));
    const deepHref=await p.$eval('[data-auth-reading-alternate-intent="deep"]',e=>e.getAttribute("href"));
    const free=callbackFromHref(freeHref),deep=callbackFromHref(deepHref);
    assert.equal(free.login.pathname,zh?"/zh/signin":"/signin");
    assert.equal(free.callback.pathname,expectedResult);
    assert.equal(free.callback.searchParams.get("session"),sealed.id);
    assert.equal(deep.callback.pathname,zh?"/zh/readings/deep":"/readings/deep");
    assert.equal(deep.callback.searchParams.get("session"),sealed.id);

    if(capturePrefix)await capture(p,`${capturePrefix}-shared-reading`);
    const beforeReload=await p.evaluate(k=>sessionStorage.getItem(k),COMPLETED_KEY);
    await p.reload({waitUntil:"networkidle0"});
    await p.waitForSelector('[data-completed-cast-gate="auth-required"]');
    assert.equal(await p.evaluate(k=>sessionStorage.getItem(k),COMPLETED_KEY),beforeReload);
    assert.equal(new URL(p.url()).searchParams.get("session"),sealed.id);
    results.checks.push(`${zh?"ZH":"EN"} ${viewport.width}px: number+moment cast → canonical Reading → shared auth Free/Deep callbacks → reload same cast PASS`);
    return {id:sealed.id,algorithmVersion:sealed.data.result.algorithmVersion};
  }finally{await p.close();}
}

try{
  await runCase({path:"/methods/mei-hua-yi-shu",viewport:{width:1670,height:942,deviceScaleFactor:1},capturePrefix:"desktop"});
  await runCase({path:"/methods/mei-hua-yi-shu",viewport:{width:375,height:812,deviceScaleFactor:1},capturePrefix:"mobile"});
  await runCase({path:"/zh/methods/mei-hua-yi-shu",viewport:{width:390,height:844,deviceScaleFactor:1},zh:true});
  await writeFile(`${OUT}/verification.json`,JSON.stringify(results,null,2)+"\n");
  console.log(JSON.stringify(results,null,2));
}catch(error){console.error(error);throw error;}
finally{await browser.close();}
