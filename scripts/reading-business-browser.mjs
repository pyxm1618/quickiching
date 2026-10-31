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
execFileSync('bun',['build','scripts/fixtures/reading-business-entry.tsx','--outdir',directory,'--target','browser','--production'],{stdio:'pipe'});
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
 for(const method of ['three_coin','yarrow_stalk','mei_hua_current_time']) {
  console.log('checking',method);
  await page.goto(`${fixtureBase}/?method=${method}`,{waitUntil:'networkidle0'});
  await page.waitForSelector('[data-public-reading-result]');
  const free=await page.evaluate(()=>({ctas:[...document.querySelectorAll('a')].filter(a=>a.textContent==='Get My Deep Reading').length, forms:document.querySelectorAll('textarea').length,overall:!!document.querySelector('[data-overall-reading]')}));
  assert.equal(free.ctas,2); assert.equal(free.forms,0);
  evidence.push({method,free});
  await page.goto(`${fixtureBase}/?method=${method}&page=deep`,{waitUntil:'networkidle0'});
  await page.waitForSelector('[data-start-deep-reading]');
  assert.equal(await page.$('[data-public-reading-result]'),null);
  await page.click('[data-start-deep-reading]');
  await page.waitForSelector('[data-deep-reading-report]',{timeout:10000});
  const deep=await page.evaluate(()=>({text:document.body.innerText, requests:window.__requests,forms:document.querySelectorAll('textarea').length}));
  for (const title of ['Your Question','Cast Basis','Direct Answer','Why','What Matters Most','What To Do Next','View Free Reading']) assert.ok(deep.text.includes(title),title);
  assert.equal(deep.forms,0);
  const post=deep.requests.find(item=>item.method==='POST'); assert.deepEqual(JSON.parse(post.body),{locale:'en'});
  evidence.push({method,deep:{sections:true,postBody:JSON.parse(post.body),report:true}});
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
