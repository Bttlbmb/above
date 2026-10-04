import {position as solarPosition} from './solar.fd1ae2e2f40a.mjs';

const $=selector=>document.querySelector(selector),phone=$('.am-phone'),sky=$('.am-sky');
const canvas=$('.am-dots'),ctx=canvas.getContext('2d'),light=$('.am-earth-light');
const lightCtx=light.getContext('2d'),mask=document.createElement('canvas');
light.width=light.height=mask.width=mask.height=256;
const maskCtx=mask.getContext('2d'),surface=lightCtx.createImageData(256,256),maskPixels=maskCtx.createImageData(256,256);
const motion=matchMedia('(prefers-reduced-motion: reduce)'),rad=Math.PI/180,ns='http://www.w3.org/2000/svg';
const preferenceKey='above:living-earth:v1',pathCache=new Map(),colors=getComputedStyle(phone);
const dotColor=colors.getPropertyValue('--am-dot').trim(),accent=colors.getPropertyValue('--am-accent').trim();
const factsRevision='2024557ce0b4';
const state={selected:null,story:false,discovered:[],library:factsRevision,choice:null,seenStories:[],seenGroups:[]};
let frame,objects=[],byId,ordered,discoveries,baseTime,observer,orbitRows,orbitalLibrary;
let factLibrary=null,factTools=null,factsLoad=null,factsAttempt=0,interactionRevision=0;
let orbitLoad=null,libraryLoad=null,libraryAttempt=0,skyLoad=null,ready=false,intersects=true,raf=null,lastFrame=0,width=0,dpr=0;
let buckets=[],highlight=null,lastSolarMinute=null,maskUrl=null,maskRevision=0,saveTimer=null,lastSaved=null;
const number=n=>Math.round(n).toLocaleString('en-US');
const bearing=n=>['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(n/22.5)%16];
const svgNode=(name,attrs={})=>{const node=document.createElementNS(ns,name);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);return node;};

async function json(url){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw new Error('Data unavailable');return await response.json();}
  finally{clearTimeout(timer);}
}
function validState(value){
  const sameLibrary=value?.library===factsRevision;
  const indexes=(list,limit)=>Array.isArray(list)?[...new Set(list.filter(i=>Number.isInteger(i)&&i>=0&&i<10000))].slice(-limit):[];
  return {selected:byId.has(value?.selected)?value.selected:null,
    story:value?.story===true,library:factsRevision,choice:sameLibrary&&Number.isInteger(value?.choice)?value.choice:null,
    seenStories:sameLibrary?indexes(value?.seenStories,24):[],seenGroups:sameLibrary?indexes(value?.seenGroups,6):[],
    discovered:Array.isArray(value?.discovered)?[...new Set(value.discovered.filter(id=>byId.has(id)))].slice(-64):[]};
}
function restore(){
  try{
    const saved=localStorage.getItem(preferenceKey);
    if(saved&&saved.length<2048){Object.assign(state,validState(JSON.parse(saved)));lastSaved=saved;flushSave();return;}
    // Migrate only this app's prior wrapper state, after successfully saving the replacement.
    const key=`codex:visualization-widget-state-v2:${JSON.stringify([location.pathname,location.search])}`;
    const legacy=localStorage.getItem(key);if(!legacy||legacy.length>16384)return;
    const parsed=JSON.parse(legacy),old=parsed?.privateContent?.aboveCinematic?.[0]||parsed?.widgetState?.privateContent?.aboveCinematic?.[0];
    if(old){Object.assign(state,validState(old));flushSave();if(lastSaved===JSON.stringify(state))localStorage.removeItem(key);}
  }catch{/* Storage can be unavailable; the sky still works in memory. */}
}
function flushSave(){
  clearTimeout(saveTimer);saveTimer=null;if(!ready)return;
  const value=JSON.stringify(state);if(value===lastSaved)return;
  try{localStorage.setItem(preferenceKey,value);lastSaved=value;}catch{}
}
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(flushSave,150);}

function active(){return ready&&intersects&&!document.hidden;}
function animate(){return active()&&!motion.matches;}
function schedule(){if(animate()&&raf===null)raf=requestAnimationFrame(tick);else if(!animate()&&raf!==null){cancelAnimationFrame(raf);raf=null;}}
function tick(time){raf=null;if(time-lastFrame>=50){lastFrame=time;drawDots(time);}schedule();}

function sizeCanvas(){
  const next=sky.clientWidth,nextDpr=Math.min(devicePixelRatio||1,3);if(!next||(next===width&&nextDpr===dpr))return false;
  width=next;dpr=nextDpr;canvas.width=Math.round(width*dpr);canvas.height=Math.round(width*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  buckets=Array.from({length:32},(_,i)=>({path:new Path2D(),phase:i*2.399963229728653,period:8+(i%13)/2}));
  for(const object of objects){const p=buckets[object.id%32].path,x=object.x*width/100,y=object.y*width/100;p.moveTo(x+.85,y);p.arc(x,y,.85,0,Math.PI*2);}
  buildHighlight();return true;
}
function buildHighlight(){
  const object=byId?.get(state.selected);highlight=null;if(!object)return;
  const x=object.x*width/100,y=object.y*width/100,halo=new Path2D(),dot=new Path2D();
  halo.arc(x,y,8,0,Math.PI*2);dot.arc(x,y,4,0,Math.PI*2);highlight={halo,dot};
}
function drawDots(time){
  if(!width)return;ctx.clearRect(0,0,width,width);ctx.fillStyle=dotColor;
  const amplitude=motion.matches?0:.09;
  for(const bucket of buckets){ctx.globalAlpha=.27+amplitude*Math.sin(time/1000/bucket.period*Math.PI*2+bucket.phase);ctx.fill(bucket.path);}
  if(highlight){ctx.fillStyle=accent;ctx.globalAlpha=.08;ctx.fill(highlight.halo);ctx.globalAlpha=1;ctx.fill(highlight.dot);}
  canvas.dataset.drawn=objects.length;canvas.dataset.selected=state.selected||'';canvas.dataset.frame=String(Number(canvas.dataset.frame||0)+1);
}
function labelPosition(){
  const object=byId?.get(state.selected);if(!object||!width)return;
  const label=$('.am-selected-label');label.style.maxWidth='calc(100% - 6px)';
  const w=label.getBoundingClientRect().width,h=label.getBoundingClientRect().height;
  const anchor=object.x*width/100+w+10>width?`calc(${object.x}% - ${w+10}px)`:`calc(${object.x}% + 10px)`;
  const left=`clamp(3px, ${anchor}, calc(100% - ${w+3}px))`;
  label.style.left=left;label.style.maxWidth=`calc(100% - ${left} - 3px)`;label.style.top=`clamp(3px, calc(${object.y}% - ${h/2}px), calc(100% - ${h+3}px))`;
}
function render(){
  const object=byId.get(state.selected),selected=Boolean(object);
  for(const selector of ['.am-detail','.am-selected-label'])$(selector).hidden=!selected;
  $('.am-idle').hidden=selected;
  if(object){
    $('[data-name]').textContent=object.name;$('[data-id]').textContent='Catalog '+object.id;$('[data-elevation]').textContent=Math.round(object.elevation)+'° up';
    $('[data-altitude]').textContent=number(object.altitude)+' km above Earth';$('[data-speed]').textContent=object.speed.toFixed(2)+' km/s';$('[data-bearing]').textContent=bearing(object.azimuth);
    $('.am-selected-label').textContent=object.name.split(' (')[0];labelPosition();
  }
  sky.setAttribute('aria-label',`${number(objects.length)} satellites above the horizon.${object?` Selected ${object.name}, ${Math.round(object.elevation)} degrees up, bearing ${bearing(object.azimuth)}.`:''} Use arrow keys to explore.`);
  renderFact();
  buildHighlight();drawDots(performance.now());drawTrail();schedule();
}
function renderFact(){
  let fact;
  if(factLibrary){const chosen=state.story?factLibrary.facts[state.choice]:null;fact=chosen?.ids.includes(state.selected)?chosen:(state.story?factTools.bestFact:factTools.detailFact)(factLibrary,state.selected);}
  fact||=discoveries.get(state.selected);
  $('[data-story]').hidden=!fact;$('[data-story]').textContent=(fact?.text||'').replace(/\brecorded sky\b/g,'sky snapshot');$('[data-story]').dataset.key=fact?.key||'recorded-'+state.selected;$('[data-story]').dataset.story=fact?.story??'';
}
async function loadFacts(){
  if(factLibrary)return true;
  if(!factsLoad){
    const attempt=factsAttempt++,moduleUrl='./facts.b903b4a56ff8.mjs'+(attempt?`?retry=${attempt}`:'');
    factsLoad=Promise.all([json('./assets/facts.2024557ce0b4.json'),import(moduleUrl)]).then(([data,tools])=>{
      factTools=tools;factLibrary=tools.createLibrary(data,objects);phone.dataset.factCount=factLibrary.facts.length;phone.dataset.factObjects=factLibrary.bySatellite.size;
      state.seenStories=state.seenStories.filter(i=>i<factLibrary.storyCount);state.seenGroups=state.seenGroups.filter(i=>i<factLibrary.groups.length);
      if(!factLibrary.facts[state.choice]?.ids.includes(state.selected))state.choice=null;
      $('[data-fact-status]').textContent='';renderFact();save();return true;
    }).catch(()=>{factsLoad=null;$('[data-fact-status]').textContent='More satellite facts could not load. Snapshot facts remain available.';return false;});
  }
  return factsLoad;
}
function select(id,story=false){interactionRevision++;state.selected=id;state.story=story;state.choice=null;render();save();if(id)loadFacts();}
function discoverFallback(){
  const candidates=[...discoveries.values()].filter(fact=>fact.id!==state.selected);if(!candidates.length)return;
  let fact=candidates.find(f=>!state.discovered.includes(f.id));
  if(!fact){state.discovered=[];fact=candidates[0];}
  state.discovered.push(fact.id);state.selected=fact.id;state.story=true;state.choice=null;render();save();
}
async function discover(){
  const revision=++interactionRevision,button=$('.am-cool');button.disabled=true;button.setAttribute('aria-busy','true');
  try{
    const loaded=await loadFacts();if(revision!==interactionRevision)return;
    const choice=loaded?factTools.chooseFact(factLibrary,state):null;
    if(choice){factTools.rememberFact(state,choice);state.selected=choice.object.id;state.story=true;state.choice=choice.fact.index;render();save();}
    else discoverFallback();
  }finally{button.disabled=false;button.removeAttribute('aria-busy');}
}

async function loadOrbits(){
  if(orbitalLibrary&&orbitRows)return;
  if(!libraryLoad){
    const url='./satellite.65ebf6a76659.mjs'+(libraryAttempt?`?retry=${libraryAttempt}`:'');libraryAttempt++;
    libraryLoad=import(url).then(lib=>{orbitalLibrary=lib;return lib;}).catch(error=>{libraryLoad=null;throw error;});
  }
  if(!orbitLoad)orbitLoad=Promise.all([json('./assets/orbits.7365d90b0f26.json'),libraryLoad]).then(([data,lib])=>{
    if(!Array.isArray(data.fields)||!Array.isArray(data.records))throw new Error('Invalid orbital data');
    const idIndex=data.fields.indexOf('NORAD_CAT_ID');if(idIndex<0)throw new Error('Missing orbital IDs');
    orbitRows={fields:data.fields,records:new Map(data.records.map(row=>[Number(row[idIndex]),row]))};orbitalLibrary=lib;
  }).catch(error=>{orbitLoad=null;throw error;});
  return orbitLoad;
}
function calculateTrail(id){
  if(pathCache.has(id)){const cached=pathCache.get(id);pathCache.delete(id);pathCache.set(id,cached);return cached;}
  const row=orbitRows.records.get(id);if(!row)throw new Error('Missing orbit');
  const omm=Object.fromEntries(orbitRows.fields.map((key,i)=>[key,row[i]])),record=orbitalLibrary.json2satrec(omm);
  const epoch=Date.parse(omm.EPOCH.endsWith('Z')?omm.EPOCH:omm.EPOCH+'Z');
  function point(seconds){
    if(Math.abs(baseTime+seconds*1000-epoch)>72*3600000)return null;
    const date=new Date(baseTime+seconds*1000),pv=orbitalLibrary.propagate(record,date);if(!pv?.position||record.error)return null;
    const look=orbitalLibrary.ecfToLookAngles(observer,orbitalLibrary.eciToEcf(pv.position,orbitalLibrary.gstime(date))),elevation=look.elevation/rad,r=(90-elevation)/95*43;
    return Number.isFinite(elevation)&&Number.isFinite(look.azimuth)?{seconds,elevation,x:50+Math.sin(look.azimuth)*r,y:50-Math.cos(look.azimuth)*r}:null;
  }
  function crossing(a,b){let low=a,high=b;for(let i=0;i<15;i++){const mid=point((low.seconds+high.seconds)/2);if(!mid)break;if((mid.elevation>=0)===(low.elevation>=0))low=mid;else high=mid;}return point((low.seconds+high.seconds)/2);}
  function visible(points){
    const segments=[];let current=[];
    for(let i=0;i<points.length;i++){const p=points[i],previous=points[i-1];
      if(!p){if(current.length)segments.push(current);current=[];continue;}
      if(p.elevation>=0){if(previous&&previous.elevation<0){const edge=crossing(previous,p);if(edge)current.push(edge);}current.push(p);}
      else if(previous&&previous.elevation>=0){const edge=crossing(previous,p);if(edge)current.push(edge);if(current.length)segments.push(current);current=[];}
    }
    if(current.length)segments.push(current);return segments;
  }
  const samples=[];for(let seconds=-300;seconds<=300;seconds+=5)samples.push(point(seconds));
  const trail={samples,past:visible(samples.slice(0,61)),future:visible(samples.slice(60))};
  if(pathCache.size>=8)pathCache.delete(pathCache.keys().next().value);pathCache.set(id,trail);return trail;
}
async function drawTrail(){
  const svg=$('.am-trail'),status=$('[data-path-status]'),id=state.selected;
  svg.replaceChildren();delete svg.dataset.selected;status.textContent='';if(!id)return;
  status.textContent='Calculating path…';
  try{
    await loadOrbits();if(id!==state.selected)return;
    const trail=calculateTrail(id),now=trail.samples.find(p=>p?.seconds===0);if(!now)throw new Error('Unusable position');
    const w=width;svg.setAttribute('viewBox',`0 0 ${w} ${w}`);
    const defs=svgNode('defs'),clip=svgNode('clipPath',{id:'am-path-clip'});clip.append(svgNode('circle',{cx:w/2,cy:w/2,r:w*.407368}));defs.append(clip);
    const arrow=svgNode('marker',{id:'am-direction',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:5,markerHeight:5,orient:'auto'});
    arrow.append(svgNode('path',{d:'M 1 1 L 9 5 L 1 9',fill:'none',stroke:'var(--am-accent)','stroke-width':1.5,'stroke-opacity':.75}));defs.append(arrow);svg.append(defs);
    const group=svgNode('g',{'clip-path':'url(#am-path-clip)'});
    for(const [part,segments]of [['past',trail.past],['future',trail.future]])for(const segment of segments){
      if(segment.length<2)continue;
      const d=segment.map((p,i)=>`${i?'L':'M'}${p.x*w/100},${p.y*w/100}`).join(''),path=svgNode('path',{d,class:'am-trail-path','data-part':part});
      if(part==='future')path.setAttribute('marker-end','url(#am-direction)');group.append(path);
    }
    svg.append(group);svg.dataset.selected=id;svg.dataset.samples=trail.samples.length;svg.dataset.zeroX=now.x;svg.dataset.zeroY=now.y;status.textContent='';
  }catch{if(id===state.selected)status.textContent='Path unavailable right now. Select an object to try again.';}
}

function updateSolar(){
  if(!active())return;const time=Date.now(),minute=Math.floor(time/60000);if(minute===lastSolarMinute)return;lastSolarMinute=minute;
  const sun=solarPosition(time,frame.observer.latitude,frame.observer.longitude);
  const phi=frame.observer.latitude*rad,delta=(sun.longitude-frame.observer.longitude)*rad,declination=sun.latitude*rad;
  const east=Math.cos(declination)*Math.sin(delta),north=Math.cos(phi)*Math.sin(declination)-Math.sin(phi)*Math.cos(declination)*Math.cos(delta),up=Math.sin(phi)*Math.sin(declination)+Math.cos(phi)*Math.cos(declination)*Math.cos(delta);
  const softness=Math.sin(6*rad),smooth=t=>{const v=Math.max(0,Math.min(1,t));return v*v*(3-2*v);};
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const sx=(x+.5-128)/96,sy=(y+.5-128)/96,r=Math.hypot(sx,sy),i=(y*256+x)*4;if(r>1.14)continue;
    if(r<=1){
      const z=Math.sqrt(Math.max(0,1-r*r)),cosine=east*sx-north*sy+up*z,day=smooth((cosine+softness)/(2*softness)),lambert=Math.pow(Math.max(0,cosine),.65),volume=.7+.3*z;
      const rim=Math.exp(-(((r-.985)/.014)**2))*Math.pow(Math.max(0,east*sx-north*sy+.12*up),.7),dusk=Math.exp(-((cosine/(softness*.8))**2))*.7*(1-z*.3),lit=day*(.4+.6*lambert);
      surface.data[i]=Math.min(255,(11+lit*32+dusk*18)*volume+rim*98);surface.data[i+1]=Math.min(255,(18+lit*45+dusk*8)*volume+rim*76);surface.data[i+2]=Math.min(255,(32+lit*66+dusk*4)*volume+rim*57);surface.data[i+3]=Math.round(255*smooth((1.004-r)/.009));
      const brightness=Math.min(255,Math.round(25+day*(95+lambert*130)));maskPixels.data[i]=maskPixels.data[i+1]=maskPixels.data[i+2]=brightness;maskPixels.data[i+3]=255;
    }else{const limb=Math.pow(Math.max(0,(east*sx-north*sy)/r),1.1),bloom=Math.exp(-(((r-1)/.043)**2))*limb*.21;surface.data[i]=245;surface.data[i+1]=189;surface.data[i+2]=142;surface.data[i+3]=Math.round(bloom*255);}
  }
  lightCtx.putImageData(surface,0,0);maskCtx.putImageData(maskPixels,0,0);
  const revision=++maskRevision;mask.toBlob(blob=>{if(!blob||revision!==maskRevision)return;const next=URL.createObjectURL(blob),previous=maskUrl;maskUrl=next;$('[data-land-mask]').setAttribute('href',next);if(previous)URL.revokeObjectURL(previous);},'image/png');
  light.dataset.lightEast=east;light.dataset.lightNorth=north;light.dataset.lightUp=up;light.dataset.solarTime=time;
  phone.dataset.solarTime=time;phone.dataset.sunElevation=sun.elevation;
  const rising=solarPosition(time+60000,frame.observer.latitude,frame.observer.longitude).elevation>sun.elevation;
  phone.dataset.phase=sun.elevation>=4?'Daylight':sun.elevation>=-.833333?(rising?'Sunrise':'Sunset'):sun.elevation>=-18?(rising?'Dawn':'Dusk'):'Night';
}

async function loadSky(){
  if(skyLoad)return skyLoad;
  $('.am-cool').disabled=true;$('.am-idle').textContent='Loading the sky…';
  skyLoad=(async()=>{
    try{
      frame=await json('./assets/sky.98d3686f045e.json');if(!Array.isArray(frame.objects)||!frame.objects.length)throw new Error('Invalid snapshot');
      objects=frame.objects.map(row=>Object.fromEntries(frame.fields.map((key,i)=>[key,row[i]])));byId=new Map(objects.map(o=>[o.id,o]));ordered=[...objects].sort((a,b)=>a.azimuth-b.azimuth||a.id-b.id);
      discoveries=new Map(frame.discoveries.map(f=>[f.id,f]));baseTime=Date.parse(frame.recordedAt);observer={latitude:frame.observer.latitude*rad,longitude:frame.observer.longitude*rad,height:0};
      // Release the duplicated table; only the decoded sky remains in memory.
      delete frame.objects;delete frame.fields;ready=true;restore();
      $('[data-help]').id='am-help';sky.setAttribute('aria-describedby','am-help');
      $('.am-idle').textContent='Tap a satellite to explore.';$('.am-cool').disabled=discoveries.size<2;$('.am-cool').lastChild.textContent='Show me something cool';
      sizeCanvas();updateSolar();render();if(state.selected)loadFacts();
    }catch{
      ready=false;$('.am-idle').textContent='Sky unavailable. Please try again.';$('.am-cool').disabled=false;$('.am-cool').lastChild.textContent='Try again';
    }finally{skyLoad=null;}
  })();return skyLoad;
}
sky.addEventListener('click',event=>{
  if(!ready)return;if(event.detail===0){next(1);return;}
  const rect=sky.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;let nearest=null,distance=22*22;
  for(const object of objects){const d=(object.x*rect.width/100-x)**2+(object.y*rect.width/100-y)**2;if(d<distance){nearest=object;distance=d;}}
  if(nearest)select(nearest.id);else if(state.selected)select(null);
});
function next(delta){const i=ordered.findIndex(o=>o.id===state.selected);select(ordered[(i+delta+ordered.length)%ordered.length].id);}
sky.addEventListener('keydown',event=>{if(!ready)return;if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(event.key)){event.preventDefault();next(event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1);}if(event.key==='Escape')select(null);});
$('.am-cool').addEventListener('click',()=>{if(ready)discover();else loadSky();});
new ResizeObserver(()=>{if(ready&&sizeCanvas()){labelPosition();drawDots(performance.now());if(state.selected)drawTrail();}}).observe(sky);
new IntersectionObserver(entries=>{intersects=entries[0].isIntersecting;if(active())updateSolar();schedule();}).observe(phone);
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushSave();else updateSolar();schedule();});
window.addEventListener('pagehide',flushSave);
motion.addEventListener('change',()=>{if(ready)render();});
setInterval(updateSolar,15000);
loadSky();
