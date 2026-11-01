import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import chromium from '@sparticuz/chromium';
import { resolveChromeExecutable } from './browser-runtime.mjs';
// Exercise the real components with explicit simulated network responses.
const directory = await mkdtemp(join(tmpdir(),'qic-reading-browser-'));
execFileSync('bun',['build','scripts/fixtures/reading-business-entry.tsx','--outdir',directory,'--target','browser','--production','--external','/ai-deep-reading/*'],{stdio:'pipe'});
const server = createServer(async (request,response) => {
  const path = new URL(request.url,'http://localhost').pathname;
  const asset = path === '/reading-business-entry.js' || path === '/reading-business-entry.css' ? path.slice(1) : null;
  try {
    response.setHeader('Content-Type',asset?.endsWith('.js') ? 'text/javascript' : asset ? 'text/css' : 'text/html');
    response.end(asset ? await readFile(join(directory,asset)) : '<!doctype html><meta charset="utf-8"><title>Reading business test fixture</title><link rel="stylesheet" href="/reading-business-entry.css"><script>window.process={env:{NODE_ENV:"production"}}</script><div id="root"></div><script type="module" src="/reading-business-entry.js"></script>');
  } catch {response.statusCode=500;response.end('Fixture asset unavailable');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const fixtureBase = `http://127.0.0.1:${server.address().port}`;
const {executablePath} = await resolveChromeExecutable(chromium);
const browser=await puppeteer.launch({executablePath,headless:true});
const page=await browser.newPage();
const evidence=[];
page.on("pageerror", error=>console.log("PAGE_ERROR",error.message));
try {
 for(const locale of ['en','zh']) {
  for(const method of ['three_coin','yarrow_stalk','mei_hua_current_time']) {
   console.log('checking',locale,method);
   await page.goto(`${fixtureBase}/?method=${method}&locale=${locale}`,{waitUntil:'networkidle0'});
   await page.waitForSelector('[data-public-reading-result] [data-free-reading-ritual]');
   const free=await page.evaluate(()=>({
    ctas:document.querySelectorAll('[data-deep-reading-cta]').length,
    forms:document.querySelectorAll('textarea').length,
    overall:!!document.querySelector('[data-overall-reading]'),
    method:document.querySelector('[data-free-reading-ritual]')?.getAttribute('data-reading-method'),
    text:document.body.innerText,
   }));
   assert.equal(free.ctas,2); assert.equal(free.forms,0); assert.equal(free.overall,true);
   assert.equal(free.method,method==='three_coin'?'three-coin':method==='yarrow_stalk'?'yarrow-stalks':'mei-hua-yi-shu');
   assert.ok(free.text.includes(locale==='zh'?'整体解读':'Overall Reading'));
   evidence.push({locale,method,free:{ctas:free.ctas,forms:free.forms,overall:free.overall,method:free.method}});
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
   evidence.push({locale,method,deep:{sections:true,postBody:JSON.parse(post.body),report:true}});
  }
 }
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
