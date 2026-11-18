// Regression gate for the already approved scene navigation; no casts or business writes.
// Supply PUPPETEER_MODULE / CHROME_PATH when the QA driver is installed outside the project.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'puppeteer-core');
const {default:chromium}=await import('@sparticuz/chromium');
const {resolveChromeExecutable}=await import('./browser-runtime.mjs');
const base=process.env.PUBLIC_V1_TEST_BASE_URL||'http://127.0.0.1:3056';
const output=resolve(process.env.NAV_QA_OUTPUT||'docs/design/scene-navigation/evidence/2026-11-01');
await mkdir(output,{recursive:true});
const authClosed=(await fetch(base+'/account',{redirect:'manual'})).status===410;
const report={base,authClosed,states:[],checks:[],errors:[],status:'RUNNING'};
function check(name,value){assert(value,name);report.checks.push({name,status:'PASS'});}
async function readPartnerSnapshot(page){
 return page.$eval('.scene-partnership',root=>{
  const viewport=root.querySelector('.scene-partner-viewport');
  const viewportStyle=viewport?getComputedStyle(viewport):null;
  return {
   tag:root.tagName,
   label:root.querySelector('.scene-partnership-label')?.textContent,
   labelInsideLink:Boolean(root.querySelector('a .scene-partnership-label')),
   viewport:viewport?{
    clientHeight:viewport.clientHeight,scrollHeight:viewport.scrollHeight,
    clientWidth:viewport.clientWidth,scrollWidth:viewport.scrollWidth,
    overflowX:viewportStyle?.overflowX,overflowY:viewportStyle?.overflowY,
   }:null,
   links:[...root.querySelectorAll('.scene-partner-link')].map(link=>{
    const image=link.querySelector('img');
    const style=getComputedStyle(link);
    return {
     id:link.getAttribute('data-partner-id'),
     state:link.getAttribute('data-partner-state'),
     href:link.getAttribute('href'),
     target:link.getAttribute('target'),
     rel:link.getAttribute('rel'),
     tabIndex:link.getAttribute('tabindex'),
     opacity:Number(style.opacity),
     pointerEvents:style.pointerEvents,
     src:image?.getAttribute('src'),
     complete:image?.complete,
     naturalWidth:image?.naturalWidth,
     naturalHeight:image?.naturalHeight,
    };
   }),
  };
 });
}
async function waitForPartnerRest(page,id){
 await page.waitForFunction(expected=>{
  const root=document.querySelector('.scene-partnership');
  if(!root)return false;
  const moving=root.querySelector('[data-partner-state="entering"],[data-partner-state="exiting"]');
  return !moving&&root.querySelector('[data-partner-state="active"]')?.getAttribute('data-partner-id')===expected;
 },{timeout:12000},id);
}
async function openSceneHome(page,locale){
 const home=locale==='en'?'/':'/zh';
 await page.goto(base+home+'?ritualTime=700',{waitUntil:'networkidle0'});
 await page.waitForSelector('.scene-navigation');
 await page.waitForFunction(()=>!document.querySelector('.scene-partnership [data-partner-state="entering"],.scene-partnership [data-partner-state="exiting"]'),{timeout:3000});
 const partnership=await readPartnerSnapshot(page);
 check('Partnership label is static and outside links',partnership.tag==='DIV'&&Boolean(partnership.label)&&!partnership.labelInsideLink);
 check('Single partner viewport retained',Boolean(partnership.viewport));
 check('Three partner links retained',partnership.links.length===3);
 check('Startup Fame partnership retained',partnership.links.some(link=>link.id==='startup-fame'&&link.href==='https://startupfa.me/s/quick-i-ching?utm_source=www.quickiching.com'&&link.src==='https://startupfa.me/badges/featured-badge.webp'));
 check('Better Launch partnership retained',partnership.links.some(link=>link.id==='better-launch'&&link.href==='https://www.betterlaunch.co/product/quick-i-ching'&&link.src==='https://www.betterlaunch.co/badge-launching-gradient.svg'));
 check('Shipstry partnership retained',partnership.links.some(link=>link.id==='shipstry'&&link.href==='https://shipstry.com/'&&link.src==='https://shipstry.com/badges/featured.svg'));
 check('Partner links open safely',partnership.links.every(link=>link.target==='_blank'&&link.rel?.split(/\s+/).includes('noopener')&&link.rel?.split(/\s+/).includes('noreferrer')));
 check('Only one partner badge visible at rest',partnership.links.filter(link=>link.state==='active'&&link.opacity>.9&&link.pointerEvents==='auto').length===1&&partnership.links.filter(link=>link.opacity>.01).length===1);
 check('Partner viewport clips instead of scrolling',partnership.viewport?.overflowX==='hidden'&&partnership.viewport?.overflowY==='hidden');
 check('Partner viewport has no scrollable overflow',partnership.viewport?.scrollHeight===partnership.viewport?.clientHeight&&partnership.viewport?.scrollWidth===partnership.viewport?.clientWidth);
 const scrollLocked=await page.$eval('.scene-partner-viewport',viewport=>{viewport.scrollTop=20;viewport.scrollLeft=20;return viewport.scrollTop===0&&viewport.scrollLeft===0;});
 check('Manual partner scrolling is disabled',scrollLocked);
 check('All partner badge images are ready',partnership.links.every(link=>link.complete===true&&Number(link.naturalWidth)>0&&Number(link.naturalHeight)>0));
 return partnership;
}
async function verifyPartnerRotation(page){
 await waitForPartnerRest(page,'startup-fame');
 check('Rotation starts at Startup Fame',true);
 await waitForPartnerRest(page,'better-launch');
 check('Automatic rotation reaches Better Launch',true);
 await waitForPartnerRest(page,'shipstry');
 check('Automatic rotation reaches Shipstry',true);
 await waitForPartnerRest(page,'startup-fame');
 check('Partner rotation loops to Startup Fame',true);
}

async function clickSceneDestination(page,locale,path){
 const prefix=locale==='en'?'':'/zh';
 const target=prefix+path;
 await openSceneHome(page,locale);
 if(path==='/hexagrams'){
  await page.click('.scene-scroll-hexagrams');
 } else if(path.startsWith('/methods/')){
  await page.click('.scene-scroll-methods');
  await page.waitForFunction(()=>document.querySelector('.scene-navigation')?.dataset.scenePanel==='methods');
  await page.click(`.scene-methods-panel a[href="${target}"]`);
 } else {
  await page.click('.scene-scroll-info');
  await page.waitForFunction(()=>document.querySelector('.scene-navigation')?.dataset.scenePanel==='info');
  await page.click(`.scene-info-panel a[href="${target}"]`);
 }
 try {
  await page.waitForFunction(expected=>location.pathname===expected,{timeout:20000},target);
 } catch(error) {
  await page.screenshot({path:`${output}/navigation-failure.png`});
  console.error(JSON.stringify({expected:target,actual:page.url(),navigation:await page.$eval('.scene-navigation',node=>node.dataset.scenePanel)}));
  throw error;
 }
 check(`${locale}: click reaches ${target}`,true);
}
const {executablePath,usingSystemChrome}=await resolveChromeExecutable(chromium);
const browser=await puppeteer.launch({
  executablePath,
  headless:true,
  args:usingSystemChrome
    ? ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--force-device-scale-factor=1']
    : [...chromium.args,'--disable-dev-shm-usage','--force-device-scale-factor=1'],
});
try {
 const page=await browser.newPage();page.on('pageerror',error=>report.errors.push(String(error)));
 await page.setViewport({width:1671,height:941,deviceScaleFactor:1});
 await page.goto(base+'/?ritualTime=700',{waitUntil:'networkidle0'});
 for(const button of await page.$$('button'))if(await button.evaluate(node=>node.textContent==='Decline'))await button.click();
 await page.waitForSelector('.scene-navigation');
 await openSceneHome(page,'en');
 await verifyPartnerRotation(page);
 for(const locale of ['en','zh']){
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  const mobilePartner=await openSceneHome(page,locale);
  check(`${locale}: mobile partner viewport remains single-slot`,mobilePartner.links.filter(link=>link.opacity>.01).length===1&&mobilePartner.viewport?.overflowY==='hidden');
 }
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.setViewport({width:1671,height:941,deviceScaleFactor:1});
 await openSceneHome(page,'en');
 await waitForPartnerRest(page,'better-launch');
 check('Reduced motion preserves automatic partner rotation',true);
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
 await page.goto(base+'/?ritualTime=700',{waitUntil:'networkidle0'});
 await page.waitForSelector('.scene-navigation');
 // Image readiness is global: partner badges are intentionally included so a broken remote badge fails this gate.
 await page.evaluate(async()=>{
  const controlledImages=[...document.images];
  for(const image of controlledImages)image.loading='eager';
  await Promise.all(controlledImages.map(async image=>{
   if(!image.complete)await new Promise((resolve,reject)=>{
    image.addEventListener('load',resolve,{once:true});
    image.addEventListener('error',()=>reject(new Error(`IMAGE_LOAD_FAILED:${image.currentSrc||image.src}`)),{once:true});
   });
   if(image.naturalWidth<=0||image.naturalHeight<=0)throw new Error(`IMAGE_NOT_READY:${image.currentSrc||image.src}`);
   try{await image.decode();}catch(error){if(image.naturalWidth<=0||image.naturalHeight<=0)throw error;}
  }));
  await document.fonts.ready;
 });
 for(const state of ['default','methods','info']) {
  const width=state==='default'?1671:1670,height=state==='default'?941:942;
  await page.setViewport({width,height,deviceScaleFactor:1});
  if(state!=='default')await page.click(`.scene-scroll-${state}`);
  await page.waitForFunction(value=>document.querySelector('.scene-navigation').dataset.scenePanel===(value==='default'?'closed':value),{},state);
  await page.mouse.move(1000,100);await new Promise(resolve=>setTimeout(resolve,800));
  const metadata=await page.evaluate(()=>({url:location.href,title:document.title,viewport:{width:innerWidth,height:innerHeight},dpr:devicePixelRatio,fontsReady:document.fonts.status==='loaded',imagesReady:[...document.images].every(image=>image.complete&&image.naturalWidth>0&&image.naturalHeight>0),overflow:document.documentElement.scrollWidth>innerWidth,fullPage:false,screenshotScale:'css',panel:document.querySelector('.scene-navigation').dataset.scenePanel,elements:[...document.querySelectorAll('.scene-brand,.scene-utility,.scene-scroll,.scene-scroll-holder,.scene-panel:not([hidden]),.scene-panel:not([hidden]) h2,.scene-panel:not([hidden]) h3,.scene-panel:not([hidden]) a,.scene-panel:not([hidden]) p')].map(node=>({className:node.className,text:node.textContent,rect:node.getBoundingClientRect().toJSON(),font:getComputedStyle(node).font}))}));
  check(`${state}: exact viewport and DPR`,metadata.viewport.width===width&&metadata.viewport.height===height&&metadata.dpr===1);
  check(`${state}: images and fonts ready`,metadata.imagesReady&&metadata.fontsReady);
  check(`${state}: no horizontal overflow`,!metadata.overflow);
  const previous=JSON.parse(await readFile(`docs/design/scene-navigation/evidence/2026-10-30/${state}/facts.json`,'utf8'));
  let maximumDelta=0;
  for(const original of previous.elements){const current=metadata.elements.find(element=>element.className===original.className&&element.text===(authClosed&&original.className==='scene-utility'?original.text.replace('Sign In',''):original.text)&&element.font===original.font);check(`${state}: approved element present (${original.className})`,!!current);for(const property of ['x','y','width','height'])maximumDelta=Math.max(maximumDelta,Math.abs(current.rect[property]-original.rect[property]));}
  metadata.maximumApprovedGeometryDelta=maximumDelta;
  check(`${state}: approved navigation geometry retained`,maximumDelta<=1);
  await writeFile(`${output}/${state}.json`,JSON.stringify(metadata,null,2)+'\n');await page.screenshot({path:`${output}/${state}.png`,fullPage:false});report.states.push({state,viewport:metadata.viewport,dpr:metadata.dpr,maximumApprovedGeometryDelta:maximumDelta});
 }
 await page.keyboard.press('Escape');
 await page.focus('.scene-scroll-methods');await page.keyboard.press('ArrowDown');
 await page.waitForFunction(()=>document.activeElement?.getAttribute('href')==='/methods/yarrow-stalks');check('Methods keyboard enters existing Yarrow link',true);
 await page.keyboard.press('Escape');check('Escape returns Methods focus',await page.evaluate(()=>document.activeElement?.classList.contains('scene-scroll-methods')));
 await page.focus('.scene-scroll-info');await page.keyboard.press('ArrowDown');
 await page.waitForFunction(()=>document.activeElement?.getAttribute('href')==='/guides/how-to-ask-the-i-ching');check('Info keyboard enters existing guide',true);
 await page.keyboard.press('End');check('Info End reaches reused Privacy Settings',await page.evaluate(()=>document.activeElement?.classList.contains('scene-privacy-button')));
 await page.keyboard.press('Enter');await page.waitForSelector('[aria-label="Analytics Consent"]');check('Existing privacy consent control opens',true);
 for(const button of await page.$$('[aria-label="Analytics Consent"] button'))if(await button.evaluate(node=>node.textContent==='Decline'))await button.click();
 await page.keyboard.press('Escape');
 const paths=['/hexagrams','/methods/yarrow-stalks','/methods/mei-hua-yi-shu','/methods/manual-cast','/guides/how-to-ask-the-i-ching','/guides/changing-lines','/guides/primary-relating-hexagrams','/help','/privacy','/terms','/acceptable-use'];
 for(const locale of ['en','zh']) {
  await openSceneHome(page,locale);
  const links=await page.$$eval('.scene-navigation a',nodes=>nodes.map(node=>node.getAttribute('href')));
  for(const path of paths)check(`${locale}: existing destination ${path}`,links.includes((locale==='en'?'':'/zh')+path));
  check(`${locale}: support email`,links.includes('mailto:support@quickiching.com'));
  check(`${locale}: no Methods index`,!links.includes((locale==='en'?'':'/zh')+'/methods'));
  for(const path of paths)await clickSceneDestination(page,locale,path);
  await openSceneHome(page,locale);
  if(authClosed){
   check(`${locale}: closed Auth hides Sign In entry`,await page.$('.scene-account-trigger')===null);
   check(`${locale}: Account guard stays closed`,(await fetch(base+(locale==='en'?'':'/zh')+'/account',{redirect:'manual'})).status===410);
  }else{
   await page.click('.scene-account-trigger');
   await page.waitForFunction(expected=>location.pathname===expected,{timeout:10000},locale==='en'?'/signin':'/zh/signin');
   check(`${locale}: Sign In entry click works`,true);
  }
 }
 await openSceneHome(page,'zh');
 await page.click('.scene-languages a[lang="en"]');await page.waitForFunction(()=>location.pathname==='/');check('Existing English language route works',true);
 await page.click('.scene-languages a[lang="zh-Hans"]');await page.waitForFunction(()=>location.pathname==='/zh');check('Existing Chinese language route works',true);
 // The only merge conflict was the shared header. Verify the latest dedicated Info header survives.
 for(const prefix of ['', '/zh']) {
  await page.goto(base+prefix+'/guides/how-to-ask-the-i-ching',{waitUntil:'networkidle0'});
  check(`Latest ${prefix||'English'} Info page header preserved`,await page.$eval('body > header',node=>node.className.includes('infoHeader')&&!node.classList.contains('scene-navigation')));
 }
 check('No browser page errors',report.errors.length===0);report.status='PASS';
} catch(error){report.status='FAIL';report.failure=String(error);process.exitCode=1;console.error(error);}
finally{report.browser=await browser.version();await writeFile(`${output}/browser-verification.json`,JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length,states:report.states,failure:report.failure}));}
