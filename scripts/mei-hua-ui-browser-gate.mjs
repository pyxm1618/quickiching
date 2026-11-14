// Production UI verification for Mei Hua completion, shared Result Choice, and downstream auth handoff.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer-core";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

const BASE=process.env.PUBLIC_V1_TEST_BASE_URL||"http://127.0.0.1:3078";
const OUT=process.env.MEI_HUA_QA_OUTPUT||"docs/qa/mei-hua-78/screenshots";
const CAST_KEY="quickiching:public-v1:mei-hua-number-time-v1";
const PENDING_PREFIX="quickiching:public-v1:pending-completed-reading:";
await mkdir(OUT,{recursive:true});
const runtime=await resolveChromeExecutable({ executablePath: async () => { throw new Error("CHROME_PATH_OR_SYSTEM_CHROME_REQUIRED"); } });
const browser=await puppeteer.launch({executablePath:runtime.executablePath,headless:true,args:["--no-sandbox"]});
const results={base:BASE,authVerification:"Anonymous Result Choice verified before downstream Free/Deep auth; real provider login requires staging acceptance",captures:[],checks:[]};

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
async function ready(p){
  await p.evaluate(async()=>{
    await document.fonts.ready;
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const visible=[...document.images].filter(image=>{
      const rect=image.getBoundingClientRect();
      const style=getComputedStyle(image);
      return rect.width>0&&rect.height>0&&style.display!=="none"&&style.visibility!=="hidden";
    });
    await Promise.all(visible.map(image=>Promise.race([
      image.decode().catch(()=>{}),
      new Promise(resolve=>setTimeout(resolve,3000)),
    ])));
  });
}
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
  await p.evaluate((castKey,pendingPrefix)=>{sessionStorage.removeItem(castKey);for(let i=localStorage.length-1;i>=0;i-=1){const key=localStorage.key(i);if(key?.startsWith(pendingPrefix))localStorage.removeItem(key);}},CAST_KEY,PENDING_PREFIX);
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
    const expectedChoice=zh?"/zh/readings/choice":"/readings/choice";
    const expectedFree=zh?"/zh/readings/result":"/readings/result";
    const expectedDeep=zh?"/zh/readings/deep":"/readings/deep";
    await p.waitForSelector('[data-result-choice]');
    assert.equal(new URL(p.url()).pathname,expectedChoice,"Confirm & Cast must navigate to the shared Result Choice route");
    assert.equal(await p.$('[data-completed-cast-gate]'),null,"Result Choice must be visible before authentication");
    const after=Date.now();

    const sessionId=new URL(p.url()).searchParams.get("session");
    const completed=await p.evaluate(({prefix,id})=>JSON.parse(localStorage.getItem(prefix+id)||"null"),{prefix:PENDING_PREFIX,id:sessionId});
    const retired=await p.evaluate(k=>sessionStorage.getItem(k),CAST_KEY);
    assert.equal(retired,null,"The Mei Hua method session must be retired after handoff");
    assert.equal(completed.readingId,sessionId);
    assert.equal(completed.method,"mei-hua-yi-shu");
    assert.equal(completed.methodVersion,"mei-hua-number-moment-classical-v1");
    assert.equal(completed.evidence.calculation.methodCalculation.number,29);
    assert(completed.evidence.calculation.methodCalculation.utcMillis>=before&&completed.evidence.calculation.methodCalculation.utcMillis<=after);
    assert.equal(completed.evidence.calculation.methodCalculation.ianaTimeZone.length>0,true);

    const freeChoiceHref=await p.$eval('[data-result-choice-free]',e=>e.getAttribute("href"));
    const deepChoiceHref=await p.$eval('[data-result-choice-deep]',e=>e.getAttribute("href"));
    const freeChoice=new URL(freeChoiceHref,BASE),deepChoice=new URL(deepChoiceHref,BASE);
    assert.equal(freeChoice.pathname,expectedFree);
    assert.equal(freeChoice.searchParams.get("session"),sessionId);
    assert.equal(deepChoice.pathname,expectedDeep);
    assert.equal(deepChoice.searchParams.get("session"),sessionId);

    if(capturePrefix)await capture(p,`${capturePrefix}-result-choice`);
    const beforeReload=await p.evaluate(({prefix,id})=>localStorage.getItem(prefix+id),{prefix:PENDING_PREFIX,id:sessionId});
    await p.$eval('[data-result-choice-free]',element=>element.scrollIntoView({block:"center",inline:"center"}));
    await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const clickProbe=await p.$eval('[data-result-choice-free]',element=>{
      const rect=element.getBoundingClientRect();
      const x=rect.left+rect.width/2;
      const y=rect.top+rect.height/2;
      const hit=document.elementFromPoint(x,y);
      const link=hit?.closest?.('a[href]');
      return {
        href:element.getAttribute('href'),
        hitTag:hit?.tagName??null,
        hitClass:typeof hit?.className==='string'?hit.className:null,
        hitHref:link?.getAttribute('href')??null,
        contained:hit ? element.contains(hit) : false,
        x,y,
      };
    });
    assert.equal(clickProbe.href,freeChoiceHref,"Free Reading DOM href must stay bound to this completed cast");
    assert(clickProbe.contained&&clickProbe.hitHref===freeChoiceHref,`Free Reading center hit-test must target its own link: ${JSON.stringify(clickProbe)}`);
    await p.click('[data-result-choice-free]');
    await p.waitForSelector('[data-completed-cast-gate="auth-required"]');
    assert.equal(new URL(p.url()).pathname,expectedFree,`Free Reading must navigate to the downstream auth-gated route; final=${p.url()} probe=${JSON.stringify(clickProbe)}`);
    const freeHref=await p.$eval('[data-auth-reading-intent="free"]',e=>e.getAttribute("href"));
    const deepHref=await p.$eval('[data-auth-reading-alternate-intent="deep"]',e=>e.getAttribute("href"));
    const free=callbackFromHref(freeHref),deep=callbackFromHref(deepHref);
    assert.equal(free.login.pathname,zh?"/zh/signin":"/signin");
    assert.equal(free.callback.pathname,expectedFree);
    assert.equal(free.callback.searchParams.get("session"),sessionId);
    assert.equal(deep.callback.pathname,expectedDeep);
    assert.equal(deep.callback.searchParams.get("session"),sessionId);

    await p.reload({waitUntil:"networkidle0"});
    await p.waitForSelector('[data-completed-cast-gate="auth-required"]');
    assert.equal(await p.evaluate(({prefix,id})=>localStorage.getItem(prefix+id),{prefix:PENDING_PREFIX,id:sessionId}),beforeReload,"Reload must preserve the exact Pending record");
    assert.equal(new URL(p.url()).searchParams.get("session"),sessionId);
    results.checks.push(`${zh?"ZH":"EN"} ${viewport.width}px: number+moment cast → Result Choice → Free auth handoff + Deep callback → reload same cast PASS`);
    return {id:sessionId,algorithmVersion:completed.methodVersion};
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
