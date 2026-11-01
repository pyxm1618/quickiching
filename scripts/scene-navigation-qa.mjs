// Regression gate for the already approved scene navigation; no casts or business writes.
// Supply PUPPETEER_MODULE / CHROME_PATH when the QA driver is installed outside the project.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'puppeteer-core');
const base=process.env.PUBLIC_V1_TEST_BASE_URL||'http://127.0.0.1:3056';
const output=resolve(process.env.NAV_QA_OUTPUT||'docs/design/scene-navigation/evidence/2026-11-01');
await mkdir(output,{recursive:true});
const report={base,states:[],checks:[],errors:[],status:'RUNNING'};
function check(name,value){assert(value,name);report.checks.push({name,status:'PASS'});}
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-device-scale-factor=1']});
try {
 const page=await browser.newPage();page.on('pageerror',error=>report.errors.push(String(error)));
 await page.setViewport({width:1671,height:941,deviceScaleFactor:1});
 await page.goto(base+'/?ritualTime=700',{waitUntil:'networkidle0'});
 for(const button of await page.$$('button'))if(await button.evaluate(node=>node.textContent==='Decline'))await button.click();
 await page.waitForSelector('.scene-navigation');
 await page.evaluate(async()=>{for(const image of document.images)image.loading='eager';await Promise.all([...document.images].map(image=>image.decode()));await document.fonts.ready;});
 for(const state of ['default','methods','info']) {
  const width=state==='default'?1671:1670,height=state==='default'?941:942;
  await page.setViewport({width,height,deviceScaleFactor:1});
  if(state!=='default')await page.click(`.scene-scroll-${state}`);
  await page.waitForFunction(value=>document.querySelector('.scene-navigation').dataset.scenePanel===(value==='default'?'closed':value),{},state);
  await page.mouse.move(1000,100);await new Promise(resolve=>setTimeout(resolve,800));
  const metadata=await page.evaluate(()=>({url:location.href,title:document.title,viewport:{width:innerWidth,height:innerHeight},dpr:devicePixelRatio,fontsReady:document.fonts.status==='loaded',imagesReady:[...document.images].every(image=>image.complete&&image.naturalWidth>0),overflow:document.documentElement.scrollWidth>innerWidth,fullPage:false,screenshotScale:'css',panel:document.querySelector('.scene-navigation').dataset.scenePanel,elements:[...document.querySelectorAll('.scene-brand,.scene-utility,.scene-scroll,.scene-scroll-holder,.scene-panel:not([hidden]),.scene-panel:not([hidden]) h2,.scene-panel:not([hidden]) h3,.scene-panel:not([hidden]) a,.scene-panel:not([hidden]) p')].map(node=>({className:node.className,text:node.textContent,rect:node.getBoundingClientRect().toJSON(),font:getComputedStyle(node).font}))}));
  check(`${state}: exact viewport and DPR`,metadata.viewport.width===width&&metadata.viewport.height===height&&metadata.dpr===1);
  check(`${state}: images and fonts ready`,metadata.imagesReady&&metadata.fontsReady);
  check(`${state}: no horizontal overflow`,!metadata.overflow);
  const previous=JSON.parse(await readFile(`docs/design/scene-navigation/evidence/2026-10-30/${state}/facts.json`,'utf8'));
  let maximumDelta=0;
  for(const original of previous.elements){const current=metadata.elements.find(element=>element.className===original.className&&element.text===original.text&&element.font===original.font);check(`${state}: approved element present (${original.className})`,!!current);for(const property of ['x','y','width','height'])maximumDelta=Math.max(maximumDelta,Math.abs(current.rect[property]-original.rect[property]));}
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
  await page.goto(base+(locale==='en'?'/':'/zh')+'?ritualTime=700',{waitUntil:'networkidle0'});
  const links=await page.$$eval('.scene-navigation a',nodes=>nodes.map(node=>node.getAttribute('href')));
  for(const path of paths)check(`${locale}: existing destination ${path}`,links.includes((locale==='en'?'':'/zh')+path));
  check(`${locale}: support email`,links.includes('mailto:support@quickiching.com'));
  check(`${locale}: no Methods index`,!links.includes((locale==='en'?'':'/zh')+'/methods'));
 }
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
