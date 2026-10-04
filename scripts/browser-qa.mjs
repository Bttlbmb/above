import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const require=createRequire(process.env.PLAYWRIGHT_PACKAGE||'/Users/maxnurnus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const executablePath=process.env.CHROMIUM_PATH||'/Users/maxnurnus/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const output=new URL('../qa/',import.meta.url);await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath});
const errors=[],report=[];
try{
  const page=await browser.newPage({viewport:{width:390,height:1100},colorScheme:'dark',reducedMotion:'reduce',deviceScaleFactor:2});
  page.on('pageerror',e=>errors.push(e.message));
  // Use the pinned assets from the original experiment for deterministic local QA.
  const assets={
    'https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js':'../../experiments/map-directions/assets/d3.min.js',
    'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js':'../../experiments/map-directions/assets/topojson.min.js',
    'https://cdn.jsdelivr.net/npm/satellite.js@7.0.1/+esm':'../../experiments/sky-path/assets/satellite.esm.js'
  };
  for(const [url,path]of Object.entries(assets))await page.route(url,async r=>r.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:await readFile(new URL(path,import.meta.url),'utf8')}));
  const noon=Date.parse('2026-10-04T03:00:00Z');
  await page.clock.install({time:new Date(noon)});
  await page.goto(process.env.QA_URL||'http://127.0.0.1:4174/');
  const frame=page.frames().find(f=>f.parentFrame());await frame.waitForSelector('.am-dots[data-drawn="1127"]');
  const phone=frame.locator('.am-phone'),light=frame.locator('.am-earth-light'),sky=frame.locator('.am-sky');
  assert.equal(await phone.getAttribute('data-solar-mode'),'now');
  assert.ok(Math.abs(Number(await phone.getAttribute('data-solar-time'))-noon)<1000);
  assert.equal(await phone.getAttribute('data-phase'),'Daylight');
  assert.ok(Number(await phone.getAttribute('data-sun-elevation'))>45);
  assert.equal(await frame.locator('[data-now]').isVisible(),false);
  assert.equal(await phone.locator('[data-study-note]').textContent(),'Earth now · recorded satellites');
  // Old persisted sunset values must not replace the clock.
  await frame.evaluate(()=>window.dispatchEvent(new CustomEvent('openai:set_globals',{detail:{globals:{widgetState:{privateContent:{aboveCinematic:[{selected:null,paused:false,story:false,solarTime:Date.parse('2026-10-04T09:00:00Z')}]}}}}})));
  assert.ok(Math.abs(Number(await phone.getAttribute('data-solar-time'))-noon)<1000);
  await page.clock.fastForward(120000);
  assert.ok(Math.abs(Number(await phone.getAttribute('data-solar-time'))-(noon+120000))<16000);
  assert.equal(await phone.getAttribute('data-solar-mode'),'now');
  report.push({currentClock:true,stalePreviewIgnored:true,updatesWithReducedMotion:true});

  const alignment=await light.evaluate(async canvas=>{
    const r=Math.PI/180,observer={latitude:37.5665,longitude:126.978};
    const sun=aboveCinematicSolar.position(Number(canvas.dataset.solarTime),observer.latitude,observer.longitude);
    const projection=d3.geoOrthographic().rotate([-observer.longitude,-observer.latitude]).translate([128,128]).scale(96).clipAngle(90);
    const maskImage=document.querySelector('.am-earth mask image'),image=new Image();
    image.src=maskImage.getAttribute('href');await image.decode();
    const copy=document.createElement('canvas');copy.width=copy.height=256;const ctx=copy.getContext('2d');ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,256,256).data;
    let samples=0,maximum=0,day=0,night=0,badPixels=0;
    for(let y=32;y<224;y+=4)for(let x=32;x<224;x+=4){
      const sx=(x+.5-128)/96,sy=(y+.5-128)/96;if(sx*sx+sy*sy>.96**2)continue;
      const [longitude,latitude]=projection.invert([x+.5,y+.5]);
      const geographic=Math.sin(latitude*r)*Math.sin(sun.latitude*r)+Math.cos(latitude*r)*Math.cos(sun.latitude*r)*Math.cos((longitude-sun.longitude)*r);
      const shader=Number(canvas.dataset.lightEast)*sx-Number(canvas.dataset.lightNorth)*sy+Number(canvas.dataset.lightUp)*Math.sqrt(1-sx*sx-sy*sy);
      maximum=Math.max(maximum,Math.abs(shader-geographic));samples++;
      const brightness=pixels[(y*256+x)*4];
      if(geographic>.15){day++;if(brightness<120)badPixels++;}
      if(geographic<-.15){night++;if(brightness!==25)badPixels++;}
    }
    return {samples,maxCosineError:maximum,dayPixels:day,nightPixels:night,badPixels};
  });
  assert.ok(alignment.maxCosineError<1e-12);assert.equal(alignment.badPixels,0);assert.ok(alignment.dayPixels>0&&alignment.nightPixels>0);report.push({projectionAlignment:alignment});

  for(const width of [320,390,736]){
    await page.setViewportSize({width,height:1100});await page.clock.runFor(100);
    assert.equal(await frame.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await phone.screenshot({path:new URL(`now-${width}.png`,output).pathname});
    for(const kind of ['sunrise','sunset']){
      await frame.locator(`[data-replay=${kind}]`).click();
      assert.equal(await phone.getAttribute('data-solar-mode'),'preview');
      assert.ok((await phone.locator('[data-phase]').textContent()).startsWith('Preview · '));
      assert.ok(Math.abs(Number(await phone.getAttribute('data-sun-elevation'))+.8333333333)<.0001);
      const east=Number(await light.getAttribute('data-light-east'));assert.equal(east>0,kind==='sunrise');
      await phone.screenshot({path:new URL(`${kind}-${width}.png`,output).pathname});
      await frame.locator('[data-now]').click();
      assert.equal(await phone.getAttribute('data-solar-mode'),'now');
      assert.ok(Math.abs(Number(await phone.getAttribute('data-solar-time'))-(noon+120000))<10000);
    }
    report.push({width,noOverflow:true,explicitPreviews:true,returnToNow:true});
  }
  // Local-day rollover refreshes the event cache, independent of the snapshot date.
  const oldSunrise=Number(await phone.getAttribute('data-sunrise'));
  await page.clock.fastForward(24*3600000);
  const newSunrise=Number(await phone.getAttribute('data-sunrise'));
  assert.ok(newSunrise-oldSunrise>23.9*3600000&&newSunrise-oldSunrise<24.1*3600000);
  report.push({seoulDayRollover:true});

  await page.setViewportSize({width:390,height:1100});await page.clock.runFor(100);
  const data=JSON.parse(await frame.locator('#am-frame').textContent()),star=data.objects.find(o=>o.id===57774),w=await sky.evaluate(e=>e.clientWidth);
  await sky.click({position:{x:star.x*w/100,y:star.y*w/100}});await frame.waitForSelector('.am-trail[data-selected="57774"]');
  assert.equal(await frame.locator('.am-trail').getAttribute('data-samples'),'121');await sky.press('Escape');
  await frame.evaluate(await readFile(process.env.AXE_PATH||'/private/tmp/above-axe/package/axe.min.js','utf8'));
  const violations=await frame.evaluate(async()=>{const r=await axe.run(document.getElementById('above-cinematic'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}));});assert.deepEqual(violations,[]);
  await page.emulateMedia({reducedMotion:'no-preference'});await frame.locator('[data-replay=sunset]').click();
  assert.equal(await frame.locator('[data-replay=sunset]').isDisabled(),true);
  await page.clock.runFor(17000);assert.equal(await frame.locator('[data-replay=sunset]').isDisabled(),false);
  assert.equal(await phone.getAttribute('data-solar-mode'),'preview');await frame.locator('[data-now]').click();
  const first=Number(await frame.locator('.am-dots').getAttribute('data-frame'));await page.clock.runFor(400);
  assert.ok(Number(await frame.locator('.am-dots').getAttribute('data-frame'))>first+2);
  await phone.locator('.am-pause').click();const stopped=await frame.locator('.am-dots').getAttribute('data-frame');
  await page.clock.runFor(250);assert.equal(await frame.locator('.am-dots').getAttribute('data-frame'),stopped);
  const before=Number(await phone.getAttribute('data-solar-time'));await page.clock.fastForward(120000);
  assert.ok(Number(await phone.getAttribute('data-solar-time'))>before+60000);
  report.push({pathSamples:121,axeViolations:0,replayCompletes:true,shimmerAndPauseWork:true,lightingUpdatesWhilePaused:true});
  assert.deepEqual(errors,[]);
  await writeFile(new URL('report.json',output),JSON.stringify({report,errors},null,2));console.log(JSON.stringify({report,errors},null,2));
}finally{await browser.close();}
