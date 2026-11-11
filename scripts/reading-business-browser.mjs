import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { createServer } from 'node:http';
import { resolveChromeExecutable } from './browser-runtime.mjs';
// Exercise the real components with explicit simulated network responses.
const directory = await mkdtemp(join(tmpdir(),'qic-reading-browser-'));
execFileSync('bun',['scripts/fixtures/build-reading-business-fixture.mjs',directory],{stdio:'pipe'});
const server = createServer(async (request,response) => {
  const path = new URL(request.url,'http://localhost').pathname;
  const asset = path === '/reading-business-entry.js' || path === '/reading-business-entry.css' ? path.slice(1) : null;
  const publicAsset = ['/free-reading/','/ai-deep-reading/','/ritual/','/performance/','/account/'].some(prefix=>path.startsWith(prefix))
    ? join(process.cwd(),'public',path.slice(1))
    : null;
  try {
    const type = extname(path);
    response.setHeader('Content-Type',
      asset?.endsWith('.js') ? 'text/javascript'
      : asset ? 'text/css'
      : type === '.png' ? 'image/png'
      : type === '.jpg' || type === '.jpeg' ? 'image/jpeg'
      : type === '.webp' ? 'image/webp'
      : type === '.avif' ? 'image/avif'
      : 'text/html');
    response.end(asset
      ? await readFile(join(directory,asset))
      : publicAsset
        ? await readFile(publicAsset)
        : '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reading business test fixture</title><link rel="stylesheet" href="/reading-business-entry.css"><script>window.process={env:{NODE_ENV:"production"}}</script><div id="root"></div><script type="module" src="/reading-business-entry.js"></script>');
  } catch {response.statusCode=404;response.end('Fixture asset unavailable');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const fixtureBase = `http://127.0.0.1:${server.address().port}`;
const serverlessChromium = {
  executablePath: async () => {
    const { default: chromium } = await import('@sparticuz/chromium');
    return chromium.executablePath();
  },
};
const { executablePath, usingSystemChrome } = await resolveChromeExecutable(serverlessChromium);
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: usingSystemChrome
    ? ["--no-sandbox", "--disable-dev-shm-usage"]
    : ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page=await browser.newPage();
const evidence=[];
const visualOutput=process.env.READING_VISUAL_OUTPUT?.trim() || null;
async function captureVisual(label) {
  if (!visualOutput) return;
  await mkdir(visualOutput,{recursive:true});
  for (const [suffix,viewport] of [
    ['desktop',{width:1440,height:1000,deviceScaleFactor:1}],
    ['mobile',{width:390,height:844,deviceScaleFactor:1}],
  ]) {
    await page.setViewport(viewport);
    await page.evaluate(()=>document.fonts.ready);
    await new Promise(resolve=>setTimeout(resolve,80));
    await page.screenshot({path:join(visualOutput,`${label}-${suffix}.png`),fullPage:true});
  }
  await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});
}
page.on("pageerror", error=>console.log("PAGE_ERROR",error.message));
try {
 for(const locale of ['en','zh']) {
  for(const method of ['three_coin','yarrow_stalk','mei_hua_number_time','manual']) {
   console.log('checking',locale,method);
   await page.goto(`${fixtureBase}/?method=${method}&locale=${locale}`,{waitUntil:'networkidle0'});
   await page.waitForSelector('[data-public-reading-result] [data-free-reading-ritual]');
   const free=await page.evaluate(()=>({
    ctas:document.querySelectorAll('[data-deep-reading-cta] a[href]').length,
    forms:document.querySelectorAll('textarea').length,
    overall:!!document.querySelector('[data-overall-reading]'),
    method:document.querySelector('[data-free-reading-ritual]')?.getAttribute('data-reading-method'),
    text:document.body.innerText,
   }));
   assert.equal(free.ctas,2); assert.equal(free.forms,0); assert.equal(free.overall,true);
   assert.equal(free.method,method==='three_coin'?'three-coin':method==='yarrow_stalk'?'yarrow-stalks':method==='mei_hua_number_time'?'mei-hua-yi-shu':'manual');
   assert.ok(free.text.includes(locale==='zh'?'整体解读':'Overall Reading'));
   const deepLinks=await page.evaluate(()=>[...document.querySelectorAll('[data-deep-reading-cta] a[href]')].map(node=>node.getAttribute('href')));
   assert.ok(deepLinks.length>=1);
   for(const href of deepLinks) {
    const url=new URL(href,fixtureBase);
    assert.equal(url.pathname,locale==='zh'?'/zh/readings/deep':'/readings/deep');
    assert.equal(url.searchParams.get('session'),'browser-fixture-cast');
   }
   evidence.push({locale,method,free:{ctas:free.ctas,forms:free.forms,overall:free.overall,method:free.method},freeToDeepSameCast:true});
   const freeUrl=page.url();
   await page.reload({waitUntil:'networkidle0'});
   await page.waitForSelector('[data-public-reading-result] [data-free-reading-ritual]');
   const deepAfterReload=await page.$eval('[data-deep-reading-cta] a[href]',node=>node.getAttribute('href'));
   assert.equal(new URL(deepAfterReload,fixtureBase).searchParams.get('session'),'browser-fixture-cast');
   assert.equal(page.url(),freeUrl);
   if(method==='three_coin') await captureVisual(`free-${locale}`);
   await page.goto(`${fixtureBase}/?method=${method}&locale=${locale}&anon=1`,{waitUntil:'networkidle0'});
   await page.waitForSelector('[data-completed-cast-gate="auth-required"]');
   const callbacks=await page.evaluate(()=>[...document.querySelectorAll('[data-auth-reading-intent],[data-auth-reading-alternate-intent]')].map(node=>({intent:node.getAttribute('data-auth-reading-intent')??node.getAttribute('data-auth-reading-alternate-intent'),href:node.getAttribute('href')})));
   assert.equal(callbacks.length,2);
   for(const item of callbacks) {
    const login=new URL(item.href,fixtureBase);
    const callback=new URL(login.searchParams.get('callbackURL'),fixtureBase);
    assert.equal(login.pathname,locale==='zh'?'/zh/signin':'/signin');
    assert.equal(callback.searchParams.get('session'),'browser-fixture-cast');
    assert.equal(callback.pathname,item.intent==='deep'?(locale==='zh'?'/zh/readings/deep':'/readings/deep'):(locale==='zh'?'/zh/readings/result':'/readings/result'));
   }
   evidence.push({locale,method,authCallbacks:'shared-free-deep-same-cast'});
   const anonUrl=page.url();
   await page.goto(`${fixtureBase}/?method=${method}&locale=${locale}&page=deep`,{waitUntil:'networkidle0'});
   await page.waitForSelector('[data-start-deep-reading]');
   assert.equal(await page.$('[data-public-reading-result]'),null);
   await page.click('[data-start-deep-reading]');
   await page.waitForSelector('[data-ai-deep-reading-report]',{timeout:10000});
   const deep=await page.evaluate(()=>({text:document.body.innerText, requests:window.__requests,forms:document.querySelectorAll('textarea').length}));
   const titles=locale==='zh'
    ? ['你的问题','核心回答','为什么会得出这个判断','这件事可能带来什么变化','什么情况下值得行动','你现在应该做什么','查看完整卦象解读']
    : ['Your Question','Core Answer','Why This Is the Case','What This Change Can Bring','When It’s Worth Taking Action','What You Should Do Now','View the Full Hexagram Interpretation'];
   for (const title of titles) assert.ok(deep.text.includes(title),title);
   assert.equal(deep.forms,0);
   const post=deep.requests.find(item=>item.method==='POST');
   assert.deepEqual(JSON.parse(post.body),{locale:locale==='zh'?'zh-Hans':'en'});
   const freeLink=await page.$eval('[data-ai-deep-section="full-hexagram"] a',node=>node.getAttribute('href'));
   const freeUrlFromDeep=new URL(freeLink,fixtureBase);
   assert.equal(freeUrlFromDeep.pathname,locale==='zh'?'/zh/readings/result':'/readings/result');
   assert.equal(freeUrlFromDeep.searchParams.get('session'),'browser-fixture-cast');
   evidence.push({locale,method,deep:{sections:true,postBody:JSON.parse(post.body),report:true},deepToFreeSameCast:true});
   if(method==='three_coin') await captureVisual(`deep-${locale}`);
   await page.goBack({waitUntil:'networkidle0'});
   await page.waitForSelector('[data-completed-cast-gate="auth-required"]');
   assert.equal(page.url(),anonUrl);
   const backCallback=await page.$eval('[data-auth-reading-intent]',node=>node.getAttribute('href'));
   assert.equal(new URL(new URL(backCallback,fixtureBase).searchParams.get('callbackURL'),fixtureBase).searchParams.get('session'),'browser-fixture-cast');
   await page.goForward({waitUntil:'networkidle0'});
   await page.waitForFunction(()=>[...document.querySelectorAll('a[href]')].some(node=>node.getAttribute('href')?.includes('/readings/result?session=browser-fixture-cast')));
   const forwardFreeHref=await page.evaluate(()=>[...document.querySelectorAll('a[href]')].map(node=>node.getAttribute('href')).find(href=>href?.includes('/readings/result?session=browser-fixture-cast'))??null);
   const forwardFree=new URL(forwardFreeHref,fixtureBase);
   assert.equal(forwardFree.pathname,locale==='zh'?'/zh/readings/result':'/readings/result');
   assert.equal(forwardFree.searchParams.get('session'),'browser-fixture-cast');
   evidence.push({locale,method,refreshBackForwardSameCast:true});
  }
 }
 // Pricing / Purchase formal UI: real Chromium verification of the three formal design states.
 const commercialViewports=[
  ['1440',{width:1440,height:1000,deviceScaleFactor:1}],
  ['1024',{width:1024,height:900,deviceScaleFactor:1}],
  ['390',{width:390,height:844,deviceScaleFactor:1}],
  ['375',{width:375,height:812,deviceScaleFactor:1}],
  ['320',{width:320,height:760,deviceScaleFactor:1}],
 ];
 async function verifyCommercialResponsive(label, actionSelector=null, capture=false) {
  for (const [width,viewport] of commercialViewports) {
   await page.setViewport(viewport);
   await page.evaluate(()=>document.fonts.ready);
   await new Promise(resolve=>setTimeout(resolve,50));
   const metrics=await page.evaluate((selector)=>({
    viewport:window.innerWidth,
    scrollWidth:document.documentElement.scrollWidth,
    action:selector?document.querySelector(selector)?.getBoundingClientRect().toJSON():null,
   }),actionSelector);
   assert.ok(metrics.scrollWidth<=metrics.viewport+1,`${label} ${width}px horizontal overflow: ${metrics.scrollWidth} > ${metrics.viewport}`);
   if(actionSelector){
    assert.ok(metrics.action,`${label} ${width}px missing action ${actionSelector}`);
    assert.ok(metrics.action.height>=40,`${label} ${width}px action is too short`);
    assert.ok(metrics.action.width<=metrics.viewport,`${label} ${width}px action exceeds viewport`);
   }
   if(visualOutput && capture){
    await mkdir(visualOutput,{recursive:true});
    await page.screenshot({path:join(visualOutput,`${label}-${width}.png`),fullPage:true});
   }
  }
 }

 async function verifyPaymentReturnContainment(label, expectedActionCount, capture=false) {
  for (const [width,viewport] of commercialViewports) {
   await page.setViewport(viewport);
   await page.evaluate(()=>document.fonts.ready);
   await new Promise(resolve=>setTimeout(resolve,50));
   const metrics=await page.evaluate(()=>{
    const card=document.querySelector('[data-payment-return-state]');
    if(!card) return null;
    const cardRect=card.getBoundingClientRect();
    const actions=[...card.querySelectorAll('button,a')]
     .filter(node=>{
      const style=getComputedStyle(node);
      const rect=node.getBoundingClientRect();
      return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0;
     })
     .map(node=>({text:node.textContent?.trim()??'',rect:node.getBoundingClientRect().toJSON()}));
    return {
     viewport:window.innerWidth,
     scrollWidth:document.documentElement.scrollWidth,
     card:cardRect.toJSON(),
     actions,
    };
   });
   assert.ok(metrics,`${label} ${width}px missing payment status card`);
   assert.ok(metrics.scrollWidth<=metrics.viewport+1,`${label} ${width}px horizontal overflow: ${metrics.scrollWidth} > ${metrics.viewport}`);
   assert.equal(metrics.actions.length,expectedActionCount,`${label} ${width}px visible action count`);
   for(const action of metrics.actions){
    assert.ok(action.rect.height>=40,`${label} ${width}px action "${action.text}" is too short`);
    assert.ok(action.rect.left>=metrics.card.left-1,`${label} ${width}px action "${action.text}" left ${action.rect.left} < card left ${metrics.card.left}`);
    assert.ok(action.rect.right<=metrics.card.right+1,`${label} ${width}px action "${action.text}" right ${action.rect.right} > card right ${metrics.card.right}`);
   }
   if(visualOutput && capture){
    await mkdir(visualOutput,{recursive:true});
    await page.screenshot({path:join(visualOutput,`${label}-${width}.png`),fullPage:true});
   }
  }
 }

 for(const locale of ['en','zh']){
  await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});
  await page.goto(`${fixtureBase}/?surface=pricing&locale=${locale}&balance=4`,{waitUntil:'networkidle0'});
  await page.waitForSelector('[data-pricing-formal-ui="true"]');
  const pricingUi=await page.evaluate(()=>({
   packs:[...document.querySelectorAll('[data-pack]')].map(node=>node.getAttribute('data-pack')),
   checkoutButtons:document.querySelectorAll('[data-checkout-button="true"]').length,
   balance:document.querySelector('[data-balance-credits]')?.getAttribute('data-balance-credits'),
   text:document.body.innerText,
   tops:[...document.querySelectorAll('[data-pack]')].map(node=>Math.round(node.getBoundingClientRect().top)),
  }));
  assert.deepEqual(pricingUi.packs,['one','three','five']);
  assert.equal(pricingUi.checkoutButtons,3);
  assert.equal(pricingUi.balance,'4');
  for(const price of ['$2.99','$6.99','$9.99','$2.33','$2.00'])assert.ok(pricingUi.text.includes(price),price);
  assert.ok(pricingUi.text.includes(locale==='zh'?'一次性购买':'One-time purchase'));
  assert.ok(pricingUi.text.includes(locale==='zh'?'12 个月':'12 months'));
  assert.ok(Math.max(...pricingUi.tops)-Math.min(...pricingUi.tops)<20,'desktop packs must share one row');
  await verifyCommercialResponsive(`pricing-${locale}`,'[data-checkout-button="true"]',locale==='en');
  const mobileTops=await page.$$eval('[data-pack]',nodes=>nodes.map(node=>Math.round(node.getBoundingClientRect().top)));
  assert.ok(mobileTops[0]<mobileTops[1]&&mobileTops[1]<mobileTops[2],'mobile packs must stack vertically');

  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  await page.goto(`${fixtureBase}/?surface=pricing&locale=${locale}&signedout=1`,{waitUntil:'networkidle0'});
  const signedOut=await page.evaluate(()=>({
   state:document.querySelector('[data-balance-state]')?.getAttribute('data-balance-state'),
   zero:!!document.querySelector('[data-balance-credits="0"]'),
   text:document.body.innerText,
  }));
  assert.equal(signedOut.state,'signed-out');
  assert.equal(signedOut.zero,false);
  assert.ok(signedOut.text.includes(locale==='zh'?'登录后查看当前余额':'Sign in to view your balance'));
  await page.click('[data-checkout-button="true"]');
  await page.waitForFunction(()=>location.pathname.includes('/signin'));
  const signInUrl=new URL(page.url());
  assert.equal(signInUrl.pathname,locale==='zh'?'/zh/signin':'/signin');
  assert.ok(signInUrl.searchParams.get('callbackURL')?.includes(locale==='zh'?'/zh/pricing':'/pricing'));
  evidence.push({locale,pricing:{packs:3,signedInBalance:true,signedOutNotZero:true,authRequired:true,responsive:[1440,1024,390,375,320]}});
 }

 for(const locale of ['en','zh']){
  for(const method of ['three_coin','yarrow_stalk','mei_hua_number_time','manual']){
   const deepPath=locale==='zh'?'/zh/readings/deep':'/readings/deep';
   await page.setViewport({width:390,height:844,deviceScaleFactor:1});
   await page.goto(`${fixtureBase}${deepPath}?surface=reading&page=deep&credits=0&locale=${locale}&method=${method}`,{waitUntil:'networkidle0'});
   await page.waitForSelector('[data-deep-reading-state="need-credits"]');
   const need=await page.evaluate(()=>({
    method:document.querySelector('[data-deep-reading-state="need-credits"]')?.getAttribute('data-casting-method'),
    balance:document.querySelector('[data-deep-reading-state="need-credits"]')?.getAttribute('data-current-balance'),
    question:document.querySelector('[data-core-question-at-cast]')?.textContent??'',
    freeHref:[...document.querySelectorAll('a[href]')].map(node=>node.getAttribute('href')).find(href=>href?.includes('/readings/result?session='))??null,
    text:document.body.innerText,
   }));
   const publicMethod=method==='three_coin'?'three-coin':method==='yarrow_stalk'?'yarrow-stalks':method==='mei_hua_number_time'?'mei-hua-yi-shu':'manual';
   assert.equal(need.method,publicMethod);
   assert.equal(need.balance,'0');
   assert.ok(need.question.includes(locale==='zh'?'我现在是否适合换一份工作？':'Should I change to a new job?'));
   assert.ok(need.freeHref?.includes('session=browser-fixture-cast'));
   assert.ok(need.text.includes(locale==='zh'?'继续需要 1 次深度解读额度':'1 credit is needed to continue'));
   assert.equal(await page.$('[data-start-deep-reading]'),null);
   if(method==='three_coin') await verifyCommercialResponsive(`need-credits-${locale}`,'[data-deep-reading-state="need-credits"] button',locale==='en');
   await page.setViewport({width:390,height:844,deviceScaleFactor:1});
   await page.click('[data-deep-reading-state="need-credits"] button');
   await page.waitForFunction(()=>location.pathname.endsWith('/pricing'));
   const pricingUrl=new URL(page.url());
   assert.equal(pricingUrl.pathname,locale==='zh'?'/zh/pricing':'/pricing');
   const returnUrl=pricingUrl.searchParams.get('returnUrl');
   assert.ok(returnUrl);
   const restored=new URL(returnUrl,fixtureBase);
   assert.equal(restored.pathname,deepPath);
   assert.equal(restored.searchParams.get('session'),'browser-fixture-cast');
   assert.equal(restored.searchParams.get('method'),method);
   evidence.push({locale,method,needCredits:{balance:0,sessionPreserved:true,returnUrlPreserved:true,freeExit:true}});
  }
 }

 for(const locale of ['en','zh']){
  for(const phase of ['checking','confirmed','delayed']){
   const reading=phase==='confirmed'?'&reading=1':'';
   await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});
   await page.goto(`${fixtureBase}/?surface=payment&locale=${locale}&phase=${phase}&balance=3${reading}`,{waitUntil:'networkidle0'});
   await page.waitForSelector(`[data-payment-return-state="${phase}"]`);
   const state=await page.evaluate(()=>({
    live:document.querySelector('[role="status"]')?.getAttribute('aria-live'),
    busy:document.querySelector('[role="status"]')?.getAttribute('aria-busy'),
    text:document.body.innerText,
    actions:[...document.querySelectorAll('button,a')].map(node=>node.textContent?.trim()).filter(Boolean),
   }));
   assert.equal(state.live,'polite');
   if(phase==='checking'){
    assert.equal(state.busy,'true');
    assert.ok(state.text.includes(locale==='zh'?'确认期间无需再次购买':'do not need to purchase again'));
    assert.ok(!state.actions.some(text=>text.includes(locale==='zh'?'购买深度解读次数':'Buy Deep Reading credits')));
   }else if(phase==='confirmed'){
    assert.ok(state.text.includes(locale==='zh'?'当前余额: 3 次':'Current Balance: 3 credits'));
    assert.ok(state.actions.includes(locale==='zh'?'返回原来的解读':'Return to your Reading'));
   }else{
    assert.ok(state.actions.includes(locale==='zh'?'再次检查':'Check Again'));
    assert.ok(state.actions.includes(locale==='zh'?'查看账户 / 购买记录':'View Account / Purchase History'));
   }
   await verifyPaymentReturnContainment(
    `payment-${phase}-${locale}`,
    phase==='checking'?0:2,
    locale==='en'&&phase==='confirmed',
   );
   evidence.push({locale,paymentReturn:phase,responsive:[1440,1024,390,375,320],ariaLive:'polite'});
  }
  await page.goto(`${fixtureBase}/?surface=payment&locale=${locale}&phase=confirmed&balance=5`,{waitUntil:'networkidle0'});
  const direct=await page.evaluate(()=>document.body.innerText);
  assert.ok(direct.includes(locale==='zh'?'本次购买直接从次数包页面发起，因此没有需要返回的原解卦。':'started directly from Pricing'));
  assert.ok(!direct.includes(locale==='zh'?'返回原来的解读':'Return to your Reading'));
  if(locale==='zh'){
   await verifyPaymentReturnContainment('payment-confirmed-direct-zh',2,true);
  }
  evidence.push({locale,directPricingConfirmed:true});
 }
 await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});

 await page.goto(`${fixtureBase}/?page=deep&invalid=1`,{waitUntil:'networkidle0'});
 await page.waitForSelector('[data-start-deep-reading]'); await page.click('[data-start-deep-reading]');
 await page.waitForFunction(()=>document.querySelector('[role="alert"]')?.textContent.includes('invalid'),{timeout:10000});
 assert.equal(await page.$('[data-deep-reading-state="generating"]'),null);
 evidence.push({invalidCompletedOutput:'explicit-error-no-stuck-spinner'});
 if (process.env.READING_TEST_BASE_URL) {
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  for (const path of ['/readings/three-coin/result','/readings/deep','/zh/readings/result','/zh/readings/deep']) {
    await page.goto(process.env.READING_TEST_BASE_URL+path,{waitUntil:'networkidle0'});
    await page.waitForFunction(()=>document.body.innerText.includes('No completed reading found') || document.body.innerText.includes('没有找到已完成的起卦'));
    assert.equal(errors.length,0);
    assert.equal(await page.$$eval('textarea',nodes=>nodes.length),0);
    if(path==='/readings/three-coin/result') assert.equal(new URL(page.url()).pathname,'/readings/result');
    evidence.push({actualNextRoute:path,emptyState:true,pageErrors:0});
  }
 }
 console.log(JSON.stringify(evidence,null,2));
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
