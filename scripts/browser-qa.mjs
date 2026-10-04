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
const facts=JSON.parse(await readFile(new URL('../source/data/facts.json',import.meta.url),'utf8'));
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
  assert.equal(requests.some(u=>/orbits\.|satellite\.|facts\./.test(u)),false,'Facts, orbit data and SGP4 should be lazy');
  assert.equal(requests.filter(u=>/^https?:/.test(u)).every(u=>new URL(u).origin===new URL(url).origin),true);
  assert.ok(Math.abs(Number(await phone.getAttribute('data-solar-time'))-noon)<1000);assert.equal(await phone.getAttribute('data-phase'),'Daylight');
  assert.ok(Number(await phone.getAttribute('data-sun-elevation'))>45);assert.equal(await page.locator('[data-replay],[data-now],iframe').count(),0);
  assert.equal(await phone.locator('[data-study-note]').textContent(),'Earth now · recorded satellites');
  assert.equal(await phone.locator('a,[data-sources],.am-pause,[data-motion-icon]').count(),0);
  await page.clock.fastForward(120000);assert.ok(Math.abs(Number(await phone.getAttribute('data-solar-time'))-(noon+120000))<16000);
  report.push({sameOriginAssetsOnly:true,initialOrbitRequests:0,initialFactRequests:0,currentClock:true,updatesWithReducedMotion:true});

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
  assert.equal(await page.locator('.am-trail').getAttribute('data-samples'),'121');await page.waitForSelector('.am-phone[data-fact-objects="1115"]');assert.equal(Number(await phone.getAttribute('data-fact-count')),facts.counts.facts);assert.equal(await phone.locator('[data-story]').getAttribute('data-key'),'gcat-physical-57774');await sky.press('Escape');
  const discoveries=[];
  for(let i=0;i<12;i++){
    await phone.locator('.am-cool').click();const id=Number(await page.locator('.am-dots').getAttribute('data-selected')),story=await phone.locator('[data-story]').textContent();
    assert.ok(data.objects.some(o=>o.id===id&&o.elevation>=0));assert.ok(story.length>30);assert.doesNotMatch(story,/NaN|undefined/);if(i)assert.notEqual(id,discoveries[i-1].id);
    await page.waitForSelector(`.am-trail[data-selected="${id}"]`);assert.equal(await page.locator('.am-trail').getAttribute('data-samples'),'121');const storyId=await phone.locator('[data-story]').getAttribute('data-story');const factKey=await phone.locator('[data-story]').getAttribute('data-key');const record=facts.facts.find(row=>row[0]===factKey);assert.ok(record&&record[1].includes(id)&&record[3]>0);discoveries.push({id,story,storyId,factKey,tier:record[3]});
  }
  assert.equal(new Set(discoveries.map(f=>f.id)).size,12);assert.equal(new Set(discoveries.map(f=>f.storyId)).size,12);
  assert.equal(requests.filter(u=>/\/orbits\./.test(u)).length,1);assert.equal(requests.filter(u=>/\/satellite\./.test(u)).length,1);assert.equal(requests.filter(u=>/\/facts\..*\.json/.test(u)).length,1);assert.ok(discoveries[0].tier===2&&discoveries[1].tier===2);
  await page.clock.runFor(200);const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  await page.evaluate(key=>{const value=JSON.parse(localStorage.getItem(key));value.paused=true;localStorage.setItem(key,JSON.stringify(value));},key);
  await page.reload();await ready(page);assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).paused,key),undefined);await page.waitForSelector('.am-phone[data-fact-objects="1115"]');assert.equal(Number(await page.locator('.am-dots').getAttribute('data-selected')),saved.selected);assert.equal(Number(await phone.locator('[data-story]').getAttribute('data-story')),facts.facts[saved.choice][7]);
  await phone.locator('.am-cool').click();assert.notEqual(Number(await page.locator('.am-dots').getAttribute('data-selected')),saved.selected);
  await page.setViewportSize({width:320,height:1100});await page.clock.runFor(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await phone.screenshot({path:new URL('discovery-320.png',output).pathname});await page.setViewportSize({width:390,height:1100});await page.clock.runFor(100);
  report.push({discoveryClicks:12,distinctObjectsBeforeRepeat:12,distinctStoriesBeforeRepeat:12,verifiedSatellites:facts.counts.distinctSatellites,prioritizesExceptional:true,contextExcludedFromDiscovery:true,visibleLinksRemoved:true,pauseControlRemoved:true,noAdjacentRepeats:true,restoredDiscoveryHistory:true,pathSamples:121,sgp4Alignment:true,oneLazyOrbitDownload:true});
  await page.evaluate(await readFile(process.env.AXE_PATH||'/private/tmp/above-axe/package/axe.min.js','utf8'));
  const violations=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}));});assert.deepEqual(violations,[]);assert.deepEqual(cspErrors,[]);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(50);await page.clock.runFor(100);const first=Number(await page.locator('.am-dots').getAttribute('data-frame'));await page.clock.runFor(400);assert.ok(Number(await page.locator('.am-dots').getAttribute('data-frame'))>first+2);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(50);await page.clock.runFor(100);const stopped=await page.locator('.am-dots').getAttribute('data-frame');await page.clock.runFor(250);assert.equal(await page.locator('.am-dots').getAttribute('data-frame'),stopped);
  const before=Number(await phone.getAttribute('data-solar-time'));await page.clock.fastForward(120000);assert.ok(Number(await phone.getAttribute('data-solar-time'))>before+60000);
  report.push({axeViolations:0,cspViolations:0,automaticShimmer:true,systemReducedMotionStopsShimmer:true,lightingUpdatesWithReducedMotion:true,savedPauseIgnored:true});
  await context.close();

  // Legacy migration must preserve progress, trim stale IDs and discard old solar previews.
  const migration=await browser.newContext({viewport:{width:390,height:1100},reducedMotion:'reduce'}),migrated=await migration.newPage();
  await migrated.addInitScript(()=>{
    const key=`codex:visualization-widget-state-v2:${JSON.stringify([location.pathname,location.search])}`;
    localStorage.setItem(key,JSON.stringify({privateContent:{aboveCinematic:[{selected:30580,story:true,paused:true,discovered:[49336,62258,30580,999999],solarTime:Date.parse('2026-10-04T09:00:00Z')}]}}));
    localStorage.setItem('unrelated:key','keep');
  });await migrated.goto(url);await ready(migrated);
  assert.equal(await migrated.locator('.am-dots').getAttribute('data-selected'),'30580');assert.ok((await migrated.locator('[data-story]').textContent()).length>30);
  const migratedState=await migrated.evaluate(key=>({state:JSON.parse(localStorage.getItem(key)),keys:Object.keys(localStorage),other:localStorage.getItem('unrelated:key')}),key);
  assert.deepEqual(migratedState.state.discovered,[49336,62258,30580]);assert.equal(migratedState.state.solarTime,undefined);assert.equal(migratedState.state.paused,undefined);assert.equal(migratedState.keys.some(k=>k.startsWith('codex:visualization-widget-state-v2:')),false);assert.equal(migratedState.other,'keep');
  assert.ok(Math.abs(Number(await migrated.locator('.am-phone').getAttribute('data-solar-time'))-Date.now())<60000);
  await migrated.locator('.am-cool').click();assert.ok(![49336,62258,30580].includes(Number(await migrated.locator('.am-dots').getAttribute('data-selected'))));await migrated.emulateMedia({reducedMotion:'no-preference'});await migrated.waitForTimeout(100);const resumed=Number(await migrated.locator('.am-dots').getAttribute('data-frame'));await migrated.waitForTimeout(400);assert.ok(Number(await migrated.locator('.am-dots').getAttribute('data-frame'))>resumed+2);await migration.close();report.push({legacyStateMigration:true,legacyPauseIgnored:true,unrelatedStoragePreserved:true,staleSolarTimeIgnored:true});

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
  const factFailure=await browser.newContext({viewport:{width:390,height:1100},reducedMotion:'reduce'}),factRetry=await factFailure.newPage();let factAttempts=0;
  await factRetry.route('**/facts.*.json',route=>++factAttempts===1?route.fulfill({status:503,body:'unavailable'}):route.continue());
  await factRetry.goto(url);await ready(factRetry);await factRetry.locator('.am-cool').click();await factRetry.waitForSelector('.am-cool:not(:disabled)');
  assert.equal(factAttempts,1);assert.ok((await factRetry.locator('[data-story]').textContent()).length>30);assert.equal(await factRetry.locator('.am-phone').getAttribute('data-fact-count'),null);
  const fallbackId=await factRetry.locator('.am-dots').getAttribute('data-selected');await factRetry.locator('.am-cool').click();await factRetry.waitForSelector('.am-phone[data-fact-objects="1115"]');
  assert.notEqual(await factRetry.locator('.am-dots').getAttribute('data-selected'),fallbackId);assert.equal(factAttempts,2);await factFailure.close();report.push({factLibraryFailureFallback:true,explicitFactLibraryRetry:true});
  // Long discovery sessions must keep history small and avoid adjacent repeats.
  const stress=await browser.newPage({viewport:{width:390,height:1100},reducedMotion:'reduce'});await stress.goto(url);await ready(stress);let previous=null;
  for(let i=0;i<80;i++){await stress.locator('.am-cool').click();const selected=Number(await stress.locator('.am-dots').getAttribute('data-selected'));assert.notEqual(selected,previous);previous=selected;}
  await stress.waitForTimeout(200);const history=await stress.evaluate(key=>localStorage.getItem(key),key);assert.ok(history.length<1024);const historyState=JSON.parse(history);assert.ok(historyState.discovered.length<=64&&historyState.seenStories.length<=24&&historyState.seenGroups.length<=6);await stress.close();report.push({discoveryClicksStress:80,noAdjacentRepeatsStress:true,preferenceCharacters:history.length,boundedHistory:true});
  // A context-only object must expose its reviewed fact and retain source provenance.
  const contextId=data.objects.find(o=>facts.facts.filter(r=>r[1].includes(o.id)).length===1)?.id;assert.ok(contextId);const contextPage=await browser.newPage({viewport:{width:390,height:1100},reducedMotion:'reduce'});await contextPage.goto(url);await ready(contextPage);const target=data.objects.find(o=>o.id===contextId),contextSky=contextPage.locator('.am-sky'),contextWidth=await contextSky.evaluate(e=>e.clientWidth);await contextSky.click({position:{x:target.x*contextWidth/100,y:target.y*contextWidth/100}});await contextPage.waitForSelector('.am-phone[data-fact-objects="1115"]');const contextKey=await contextPage.locator('[data-story]').getAttribute('data-key');const contextRecord=facts.facts.find(r=>r[0]===contextKey&&r[3]===0);assert.ok(contextRecord);assert.ok(contextRecord[6].some(i=>facts.sources[i].url.startsWith('https://planet4589.org/')));assert.equal(await contextPage.locator('a,[data-sources],.am-pause').count(),0);await contextPage.close();report.push({contextFactOnTap:true,gcatProvenanceRetained:true});
  assert.deepEqual(errors,[]);await writeFile(new URL('report.json',output),JSON.stringify({report,errors},null,2));console.log(JSON.stringify({report,errors},null,2));
}finally{await browser.close();}
