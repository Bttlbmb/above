import {readFile,writeFile,mkdir,readdir,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync,brotliCompressSync} from 'node:zlib';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url),source=new URL('source/',root),dist=new URL('dist/',root);
const read=name=>readFile(new URL(name,source),'utf8'),hash=value=>createHash('sha256').update(value).digest('hex').slice(0,12);
const [skyText,orbitText,globeText,factsText]=await Promise.all(['data/sky.json','data/orbits.json','data/globe.json','data/facts.json'].map(read));
const sky=JSON.parse(skyText),orbits=JSON.parse(orbitText),globe=JSON.parse(globeText),facts=JSON.parse(factsText);
assert.deepEqual(globe.observer,sky.observer,'Preprojected Earth must use the snapshot observer');
assert.ok(Number.isFinite(Date.parse(sky.recordedAt)));
assert.deepEqual(sky.fields,['id','name','azimuth','elevation','x','y','altitude','speed','range']);
const ids=new Set();
for(const row of sky.objects){
  assert.equal(row.length,sky.fields.length);assert.ok(Number.isInteger(row[0])&&typeof row[1]==='string'&&row[1].length>0);
  assert.ok(row.slice(2).every(Number.isFinite));assert.ok(row[3]>=0&&row[3]<=90);assert.ok(!ids.has(row[0]));ids.add(row[0]);
}
const idIndex=orbits.fields.indexOf('NORAD_CAT_ID');assert.ok(idIndex>=0);
assert.equal(orbits.records.length,ids.size);
const orbitIds=new Set();for(const row of orbits.records){assert.equal(row.length,orbits.fields.length);assert.ok(ids.has(Number(row[idIndex])));orbitIds.add(Number(row[idIndex]));}
assert.equal(orbitIds.size,ids.size);
assert.equal(new Set(sky.discoveries.map(f=>f.id)).size,sky.discoveries.length);
for(const fact of sky.discoveries){assert.ok(ids.has(fact.id));assert.ok(typeof fact.text==='string'&&fact.text.length>20);}
assert.equal(facts.status,'verified');assert.equal(facts.schemaVersion,1);assert.equal(facts.recordedAt,sky.recordedAt);
assert.deepEqual(facts.fields,['key','ids','group','tier','score','text','sources','story']);
const factIds=new Set(),factKeys=new Set();
for(const [key,applicable,group,tier,score,text,references,story]of facts.facts){
  assert.ok(!factKeys.has(key));factKeys.add(key);assert.ok(applicable.length>0);for(const id of applicable){assert.ok(ids.has(id));factIds.add(id);}
  assert.ok(Number.isInteger(group)&&group>=0&&group<facts.groups.length);assert.ok([0,1,2].includes(tier));assert.ok(Number.isFinite(score)&&score>=0&&score<=6);
  assert.ok(typeof text==='string'&&text.length>20);assert.ok(references.length>0);for(const i of references){assert.ok(facts.sources[i]);assert.equal(new URL(facts.sources[i].url).protocol,'https:');}
  assert.ok(Number.isInteger(story)&&story>=0&&story<facts.storyCount);
}
assert.ok(factIds.size>=500);assert.equal(factIds.size,facts.counts.distinctSatellites);assert.equal(facts.facts.length,facts.counts.facts);
await mkdir(new URL('assets/',dist),{recursive:true});
const assets=[];
async function asset(name,extension,value){const file=`${name}.${hash(value)}.${extension}`;await writeFile(new URL(`assets/${file}`,dist),value);assets.push({file,bytes:Buffer.byteLength(value),gzipBytes:gzipSync(value).length,brotliBytes:brotliCompressSync(value).length});return `./assets/${file}`;}
const skyUrl=await asset('sky','json',JSON.stringify(sky)),orbitUrl=await asset('orbits','json',JSON.stringify(orbits));
const factsUrl=await asset('facts','json',JSON.stringify(facts)),factsModule=await asset('facts','mjs',await read('facts.mjs'));
const satelliteUrl=await asset('satellite','mjs',await read('vendor/satellite.js'));
const solarUrl=await asset('solar','mjs',await read('solar.mjs'));
const starsUrl=await asset('stars','webp',await readFile(new URL('assets/stars.webp',source)));
const styleUrl=await asset('style','css',(await read('style.css')).replaceAll('__STARS__','./'+starsUrl.split('/').pop()).replace(/\s+/g,' ').trim());
const app=(await read('app.mjs')).replaceAll('__SKY__',skyUrl).replaceAll('__ORBITS__',orbitUrl).replaceAll('__SATELLITE__','./'+satelliteUrl.split('/').pop()).replaceAll('__SOLAR__','./'+solarUrl.split('/').pop()).replaceAll('__FACTS__',factsUrl).replaceAll('__FACTS_MODULE__','./'+factsModule.split('/').pop()).replaceAll('__FACTS_REVISION__',hash(factsText));
// JSON URLs resolve against the document; module imports resolve against the app module.
const appUrl=await asset('app','mjs',app);
const earth=`<defs><path id="am-land-shape" d="${globe.land}"/><mask id="am-light-mask-0" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256"><image data-land-mask x="0" y="0" width="256" height="256"/></mask></defs><path class="am-earth-edge" d="${globe.sphere}"/><path class="am-graticule" d="${globe.graticule}"/><use href="#am-land-shape" class="am-land"/><use href="#am-land-shape" class="am-lit-land" mask="url(#am-light-mask-0)"/><circle class="am-observer" cx="128" cy="128" r="1.8"/>`;
const html=(await read('index.html')).replace('__EARTH__',earth).replace('__STYLE__',styleUrl).replace('__APP__',appUrl);
assert.ok(!/__\w+__/.test(html+app));await writeFile(new URL('index.html',dist),html);
await writeFile(new URL('third-party-notices.txt',dist),await readFile(new URL('THIRD_PARTY_NOTICES.md',root)));
// Prune only generated, content-hashed assets from previous builds.
const keep=new Set(assets.map(a=>a.file));for(const file of await readdir(new URL('assets/',dist)))if(/^[a-z]+\.[0-9a-f]{12}\.(json|mjs|css|webp)$/.test(file)&&!keep.has(file))await unlink(new URL(`assets/${file}`,dist));
console.log(JSON.stringify({objects:ids.size,fallbackDiscoveries:sky.discoveries.length,verifiedFacts:facts.counts.facts,verifiedSatellites:factIds.size,discoveryStories:facts.counts.discoveryStories,htmlBytes:Buffer.byteLength(html),assets,totalAssetBytes:assets.reduce((s,a)=>s+a.bytes,0)+Buffer.byteLength(html)},null,2));
