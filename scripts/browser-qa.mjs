import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {position as solarPosition} from '../source/solar.mjs';

const require=createRequire(process.env.PLAYWRIGHT_PACKAGE||'/Users/maxnurnus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const executablePath=process.env.CHROMIUM_PATH||'/Users/maxnurnus/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const output=new URL('../qa/',import.meta.url);await mkdir(output,{recursive:true});
const packed=JSON.parse(await readFile(new URL('../source/data/sky.json',import.meta.url),'utf8'));
const data={...packed,objects:packed.objects.map(row=>Object.fromEntries(packed.fields.map((key,i)=>[key,row[i]])))};
const d3Context={};vm.runInNewContext(await readFile(new URL('../../experiments/map-directions/assets/d3.min.js',import.meta.url),'utf8'),d3Context);
const projection=d3Context.d3.geoOrthographic().rotate([-data.observer.longitude,-data.observer.latitude]).translate([128,128]).scale(96).clipAngle(90);
const browser=await chromium.launch({headless:true,executablePath}),errors=[],report=[];
const url=process.env.QA_URL||'http://127.0.0.1:4174/',key='above:living-earth:v1';
const ready=page=>page.waitForSelector('.am-dots[data-drawn="1127"]');
try{
  const context=await browser.newContext({viewport:{width:390,height:1100},colorScheme:'dark',reducedMotion:'reduce',deviceScaleFactor:2});
  const page=await context.newPage(),requests=[],cspErrors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  page.on('console',m=>{if(m.type()==='error'&&/Content Security Policy|Refused to/.test(m.text()))cspErrors.push(m.text());});
  const noon=Date.parse('2026-10-04T03:00:00Z');await page.clock.install({time:new Date(noon)});await page.goto(url);await ready(page);
  const phone=page.locator('.am-phone'),light=page.locator('.am-earth-light'),sky=page.locator('.am-sky');
  assert.equal(requests.some(u=>/orbits\.|satellite\./.test(u)),false,'Orbit data and SGP4 should be lazy');
  assert.equal(requests.filter(u=>/^https?:/.test(u)).every(u=>new URL(u).origin===new URL(url).origin),true);
  assert.ok(Math.abs(Number(await phone.getAttribute('data-solar-time'))-noon)<1000);assert.equal(await phone.getAttribute('data-phase'),'Daylight');
  assert.ok(Number(await phone.getAttribute('data-sun-elevation'))>45);assert.equal(await page.locator('[data-replay],[data-now],iframe').count(),0);
  assert.equal(await phone.locator('[data-study-note]').textContent(),'Earth now · recorded satellites');
  await page.clock.fastForward(120000);assert.ok(Math.abs(Number(await phone.getAttribute('data-solar-time'))-(noon+120000))<16000);
  report.push({sameOriginAssetsOnly:true,initialOrbitRequests:0,currentClock:true,updatesWithReducedMotion:true});

  await page.waitForFunction(()=>document.querySelector('[data-land-mask]').getAttribute('href')?.startsWith('blob:'));
  const time=Number(await light.getAttribute('data-solar-time')),sun=solarPosition(time,data.observer.latitude,data.observer.longitude),rad=Math.PI/180,reference=[];
  for(let y=32;y<224;y+=4)for(let x=32;x<224;x+=4){
    const sx=(x+.5-128)/96,sy=(y+.5-128)/96;if(sx*sx+sy*sy>.96**2)continue;
    const [longitude,latitude]=projection.invert([x+.5,y+.5]);
    const cosine=Math.sin(latitude*rad)*Math.sin(sun.latitude*rad)+Math.cos(latitude*rad)*Math.cos(sun.latitude*rad)*Math.cos((longitude-sun.longitude)*rad);
    reference.push({x,y,cosine});
  }
  const alignment=await light.evaluate(async(canvas,reference)=>{
    const image=new Image();image.src=document.querySelector('[data-land-mask]').getAttribute('href');await image.decode();
    const copy=document.createElement('canvas');copy.width=copy.height=256;const ctx=copy.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,256,256).data;
    let maximum=0,day=0,night=0,bad=0;
    for(const {x,y,cosine}of reference){const sx=(x+.5-128)/96,sy=(y+.5-128)/96,shader=Number(canvas.dataset.lightEast)*sx-Number(canvas.dataset.lightNorth)*sy+Number(canvas.dataset.lightUp)*Math.sqrt(1-sx*sx-sy*sy);maximum=Math.max(maximum,Math.abs(shader-cosine));const brightness=pixels[(y*256+x)*4];if(cosine>.15){day++;if(brightness<120)bad++;}if(cosine<-.15){night++;if(brightness!==25)bad++;}}
    return {samples:reference.length,maxCosineError:maximum,dayPixels:day,nightPixels:night,badPixels:bad};
  },reference);
  assert.ok(alignment.maxCosineError<1e-12);assert.equal(alignment.badPixels,0);assert.ok(alignment.dayPixels>0&&alignment.nightPixels>0);report.push({projectionAlignment:alignment});
  for(const width of [320,390,736]){await page.setViewportSize({width,height:1100});await page.clock.runFor(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await phone.screenshot({path:new URL(`now-${width}.png`,output).pathname});report.push({width,noOverflow:true});}
  const oldSun=Number(await phone.getAttribute('data-solar-time'));await page.clock.fastForward(24*3600000);assert.ok(Number(await phone.getAttribute('data-solar-time'))-oldSun>=24*3600000-16000);report.push({clockDayRollover:true});

  await page.setViewportSize({width:390,height:1100});await page.clock.runFor(100);
  const star=data.objects.find(o=>o.id===57774),w=await sky.evaluate(e=>e.clientWidth);
  await sky.click({position:{x:star.x*w/100,y:star.y*w/100}});await page.waitForSelector('.am-trail[data-selected="57774"]');
  const zero=await page.locator('.am-trail').evaluate(e=>({x:+e.dataset.zeroX,y:+e.dataset.zeroY}));assert.ok(Math.hypot(zero.x-star.x,zero.y-star.y)<.0001,'SGP4 path must agree with the unchanged snapshot');
  assert.equal(await page.locator('.am-trail').getAttribute('data-samples'),'121');await sky.press('Escape');
  const discoveries=[];
  for(let i=0;i<12;i++){
    await phone.locator('.am-cool').click();const id=Number(await page.locator('.am-dots').getAttribute('data-selected')),story=await phone.locator('[data-story]').textContent();
    assert.ok(data.objects.some(o=>o.id===id&&o.elevation>=0));assert.ok(story.length>30);assert.doesNotMatch(story,/NaN|undefined/);if(i)assert.notEqual(id,discoveries[i-1].id);
    await page.waitForSelector(`.am-trail[data-selected="${id}"]`);assert.equal(await page.locator('.am-trail').getAttribute('data-samples'),'121');discoveries.push({id,story});
  }
  assert.equal(new Set(discoveries.slice(0,9).map(f=>f.id)).size,9);assert.equal(new Set(discoveries.slice(0,9).map(f=>f.story)).size,9);
  assert.equal(requests.filter(u=>/\/orbits\./.test(u)).length,1);assert.equal(requests.filter(u=>/\/satellite\./.test(u)).length,1);
  await page.clock.runFor(200);const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  await page.reload();await ready(page);assert.equal(Number(await page.locator('.am-dots').getAttribute('data-selected')),saved.selected);
  await phone.locator('.am-cool').click();assert.notEqual(Number(await page.locator('.am-dots').getAttribute('data-selected')),saved.selected);
  await page.setViewportSize({width:320,height:1100});await page.clock.runFor(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await phone.screenshot({path:new URL('discovery-320.png',output).pathname});await page.setViewportSize({width:390,height:1100});await page.clock.runFor(100);
  report.push({discoveryClicks:12,distinctObjectsBeforeRepeat:9,distinctFactsBeforeRepeat:9,noAdjacentRepeats:true,restoredDiscoveryHistory:true,pathSamples:121,sgp4Alignment:true,oneLazyOrbitDownload:true});
  await page.evaluate(await readFile(process.env.AXE_PATH||'/private/tmp/above-axe/package/axe.min.js','utf8'));
  const violations=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}));});assert.deepEqual(violations,[]);assert.deepEqual(cspErrors,[]);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForSelector('.am-pause:not(:disabled)');const first=Number(await page.locator('.am-dots').getAttribute('data-frame'));await page.clock.runFor(400);assert.ok(Number(await page.locator('.am-dots').getAttribute('data-frame'))>first+2);
  await phone.locator('.am-pause').click();const stopped=await page.locator('.am-dots').getAttribute('data-frame');await page.clock.runFor(250);assert.equal(await page.locator('.am-dots').getAttribute('data-frame'),stopped);
  const before=Number(await phone.getAttribute('data-solar-time'));await page.clock.fastForward(120000);assert.ok(Number(await phone.getAttribute('data-solar-time'))>before+60000);
  report.push({axeViolations:0,cspViolations:0,shimmerAndPauseWork:true,lightingUpdatesWhilePaused:true});
  await context.close();

  // Legacy migration must preserve progress, trim stale IDs and discard old solar previews.
  const migration=await browser.newContext({viewport:{width:390,height:1100},reducedMotion:'reduce'}),migrated=await migration.newPage();
  await migrated.addInitScript(()=>{
    const key=`codex:visualization-widget-state-v2:${JSON.stringify([location.pathname,location.search])}`;
    localStorage.setItem(key,JSON.stringify({privateContent:{aboveCinematic:[{selected:30580,story:true,paused:true,discovered:[49336,62258,30580,999999],solarTime:Date.parse('2026-10-04T09:00:00Z')}]}}));
    localStorage.setItem('unrelated:key','keep');
  });await migrated.goto(url);await ready(migrated);
  assert.equal(await migrated.locator('.am-dots').getAttribute('data-selected'),'30580');assert.ok((await migrated.locator('[data-story]').textContent()).includes('NASA'));
  const migratedState=await migrated.evaluate(key=>({state:JSON.parse(localStorage.getItem(key)),keys:Object.keys(localStorage),other:localStorage.getItem('unrelated:key')}),key);
  assert.deepEqual(migratedState.state.discovered,[49336,62258,30580]);assert.equal(migratedState.state.solarTime,undefined);assert.equal(migratedState.keys.some(k=>k.startsWith('codex:visualization-widget-state-v2:')),false);assert.equal(migratedState.other,'keep');
  assert.ok(Math.abs(Number(await migrated.locator('.am-phone').getAttribute('data-solar-time'))-Date.now())<60000);
  await migrated.locator('.am-cool').click();assert.ok(![49336,62258,30580].includes(Number(await migrated.locator('.am-dots').getAttribute('data-selected'))));await migration.close();report.push({legacyStateMigration:true,unrelatedStoragePreserved:true,staleSolarTimeIgnored:true});

  // A failed snapshot is recoverable without navigation; a path failure doesn't hide facts.
  const failures=await browser.newContext({viewport:{width:390,height:1100},reducedMotion:'reduce'}),failed=await failures.newPage();let skyAttempts=0,orbitAttempts=0,moduleAttempts=0;
  await failed.route('**/sky.*.json',r=>++skyAttempts===1?r.fulfill({status:503,body:'unavailable'}):r.continue());
  await failed.route('**/orbits.*.json',r=>++orbitAttempts===1?r.fulfill({status:503,body:'unavailable'}):r.continue());
  await failed.route('**/satellite.*',r=>++moduleAttempts===1?r.abort('failed'):r.continue());
  await failed.goto(url);await failed.getByRole('button',{name:'Try again'}).click();await ready(failed);await failed.locator('.am-cool').click();
  await failed.waitForFunction(()=>document.querySelector('[data-path-status]').textContent.startsWith('Path unavailable'));assert.ok((await failed.locator('[data-story]').textContent()).length>30);
  await failed.locator('.am-cool').click();await failed.waitForSelector('.am-trail[data-selected]');assert.ok(orbitAttempts>=2&&moduleAttempts>=2);await failures.close();report.push({snapshotRetry:true,pathRetry:true,factsSurvivePathFailure:true});

  const blocked=await browser.newContext({viewport:{width:390,height:1100},reducedMotion:'reduce'}),noStorage=await blocked.newPage();
  await noStorage.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});});await noStorage.goto(url);await ready(noStorage);await noStorage.locator('.am-cool').click();await noStorage.waitForSelector('.am-trail[data-selected]');await blocked.close();report.push({blockedStorageWorks:true});
  assert.deepEqual(errors,[]);await writeFile(new URL('report.json',output),JSON.stringify({report,errors},null,2));console.log(JSON.stringify({report,errors},null,2));
}finally{await browser.close();}
