import {readFile,writeFile,mkdir,readdir,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync,brotliCompressSync} from 'node:zlib';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url),source=new URL('source/',root),dist=new URL('dist/',root);
const read=name=>readFile(new URL(name,source),'utf8'),hash=value=>createHash('sha256').update(value).digest('hex').slice(0,12);
const [skyText,orbitText,globeText]=await Promise.all(['data/sky.json','data/orbits.json','data/globe.json'].map(read));
const sky=JSON.parse(skyText),orbits=JSON.parse(orbitText),globe=JSON.parse(globeText);
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
await mkdir(new URL('assets/',dist),{recursive:true});
const assets=[];
async function asset(name,extension,value){const file=`${name}.${hash(value)}.${extension}`;await writeFile(new URL(`assets/${file}`,dist),value);assets.push({file,bytes:Buffer.byteLength(value),gzipBytes:gzipSync(value).length,brotliBytes:brotliCompressSync(value).length});return `./assets/${file}`;}
const skyUrl=await asset('sky','json',JSON.stringify(sky)),orbitUrl=await asset('orbits','json',JSON.stringify(orbits));
const satelliteUrl=await asset('satellite','mjs',await read('vendor/satellite.js'));
const solarUrl=await asset('solar','mjs',await read('solar.mjs'));
const styleUrl=await asset('style','css',(await read('style.css')).replace(/\s+/g,' ').trim());
const app=(await read('app.mjs')).replaceAll('__SKY__',skyUrl).replaceAll('__ORBITS__',orbitUrl).replaceAll('__SATELLITE__','./'+satelliteUrl.split('/').pop()).replaceAll('__SOLAR__','./'+solarUrl.split('/').pop());
// JSON URLs resolve against the document; module imports resolve against the app module.
const appUrl=await asset('app','mjs',app);
const earth=`<defs><path id="am-land-shape" d="${globe.land}"/><mask id="am-light-mask-0" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256"><image data-land-mask x="0" y="0" width="256" height="256"/></mask></defs><path class="am-earth-edge" d="${globe.sphere}"/><path class="am-graticule" d="${globe.graticule}"/><use href="#am-land-shape" class="am-land"/><use href="#am-land-shape" class="am-lit-land" mask="url(#am-light-mask-0)"/><circle class="am-observer" cx="128" cy="128" r="1.8"/>`;
const html=(await read('index.html')).replace('__EARTH__',earth).replace('__STYLE__',styleUrl).replace('__APP__',appUrl);
assert.ok(!/__\w+__/.test(html+app));await writeFile(new URL('index.html',dist),html);
await writeFile(new URL('third-party-notices.txt',dist),await readFile(new URL('THIRD_PARTY_NOTICES.md',root)));
// Prune only generated, content-hashed assets from previous builds.
const keep=new Set(assets.map(a=>a.file));for(const file of await readdir(new URL('assets/',dist)))if(/^[a-z]+\.[0-9a-f]{12}\.(json|mjs|css)$/.test(file)&&!keep.has(file))await unlink(new URL(`assets/${file}`,dist));
console.log(JSON.stringify({objects:ids.size,discoveries:sky.discoveries.length,htmlBytes:Buffer.byteLength(html),assets,totalAssetBytes:assets.reduce((s,a)=>s+a.bytes,0)+Buffer.byteLength(html)},null,2));
