import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url),inputUrl=process.argv[2]?new URL(process.argv[2],'file://'+process.cwd()+'/'):new URL('research/fact-library/facts.json',root);
const inputText=await readFile(inputUrl,'utf8'),input=JSON.parse(inputText),sky=JSON.parse(await readFile(new URL('source/data/sky.json',root),'utf8'));
assert.equal(input.schemaVersion,1);assert.equal(input.status,'verified','Only the final independently verified handoff may be imported');
const gpText=await readFile(new URL('../experiments/object-counts/active.json',root),'utf8'),gp=new Map(JSON.parse(gpText).map(record=>[Number(record.NORAD_CAT_ID),record]));
const visible=new Map(sky.objects.map(row=>[row[0],row[1]])),satellites=new Map();
for(const satellite of input.satellites){
  assert.ok(visible.has(satellite.noradId));assert.ok(!satellites.has(satellite.noradId));
  assert.equal(satellite.cosparId,gp.get(satellite.noradId)?.OBJECT_ID,'NORAD/COSPAR identity mismatch');
  assert.equal(satellite.name,visible.get(satellite.noradId),'Recorded catalog name mismatch');satellites.set(satellite.noradId,satellite);
}
assert.equal(input.snapshot.recordedSkyAt,sky.recordedAt);
const sources=[],sourceIndex=new Map(),groups=[],groupIndex=new Map(),storyIndex=new Map(),facts=[],keys=new Set(),audit=[];
const indexGroup=key=>{if(!groupIndex.has(key)){groupIndex.set(key,groups.length);groups.push(key);}return groupIndex.get(key);};
function indexSource(source){
  assert.ok(source.url&&source.title);const url=new URL(source.url);assert.equal(url.protocol,'https:');
  const gcat=url.hostname==='planet4589.org';
  const entry={url:source.url,title:source.title,publisher:source.publisher||'',label:gcat?(source.title.includes('definitions')?'GCAT definitions':'GCAT · J. McDowell'):(source.publisher||source.title)};
  const key=JSON.stringify(entry);if(!sourceIndex.has(key)){sourceIndex.set(key,sources.length);sources.push(entry);}return sourceIndex.get(key);
}
function add(record,ids,group,key,storyId=key){
  assert.equal(record.verification?.status,'verified','Unreviewed wording: '+key);
  assert.ok(record.verification.reviewer&&record.verification.reviewer!==record.verification.researcher,'Independent review required: '+key);
  assert.ok(typeof record.text==='string'&&record.text.length>20);assert.ok(!keys.has(key),'Duplicate fact key');keys.add(key);
  assert.ok(ids.length>0&&new Set(ids).size===ids.length);for(const id of ids)assert.ok(satellites.has(id),'Missing exact identity: '+id);
  const tier={context:0,cool:1,exceptional:2}[record.interest.tier];assert.ok(Number.isInteger(tier));
  const score=record.interest.total;assert.ok(Number.isFinite(score)&&score>=0&&score<=6);
  assert.ok(record.sources?.length>0);const references=record.sources.map(indexSource);
  if(!storyIndex.has(storyId))storyIndex.set(storyId,storyIndex.size);
  facts.push([key,ids,indexGroup(group),tier,score,record.text,[...new Set(references)],storyIndex.get(storyId)]);
  audit.push({key,storyId,ids,scope:record.scope,interest:record.interest,verification:record.verification,annotations:record.annotations,sources:record.sources});
}
for(const fact of input.facts){const satellite=satellites.get(fact.noradId);assert.ok(satellite);assert.ok(satellite.factIds.includes(fact.factId));add(fact,[fact.noradId],fact.familyId||satellite.familyId||'catalog-context',fact.factId);}
for(const profile of input.profiles){
  if(!profile.applicableNoradIds.length)continue;
  for(const id of profile.applicableNoradIds)assert.ok(satellites.get(id)?.profileIds.includes(profile.profileId),'Unverified profile mapping');
  add(profile,profile.applicableNoradIds,profile.familyId||'mission:'+profile.mission,profile.profileId,profile.storyId||profile.profileId);
}
const covered=new Set(facts.flatMap(row=>row[1]));assert.ok(covered.size>=500,'At least 500 distinct verified satellites are required');
const counts={facts:facts.length,individualFacts:input.facts.length,sharedProfiles:facts.length-input.facts.length,sharedStories:new Set(input.profiles.filter(p=>p.applicableNoradIds.length).map(p=>p.storyId)).size,discoveryStories:new Set(facts.filter(row=>row[3]>0).map(row=>row[7])).size,distinctSatellites:covered.size,sources:sources.length,tiers:facts.reduce((r,row)=>(r[['context','cool','exceptional'][row[3]]]++,r),{context:0,cool:0,exceptional:0})};
const runtime={schemaVersion:1,status:'verified',recordedAt:sky.recordedAt,counts,storyCount:storyIndex.size,sources,groups,fields:['key','ids','group','tier','score','text','sources','story'],facts};
const digest=text=>createHash('sha256').update(text).digest('hex');
const provenance={schemaVersion:1,importedAt:new Date().toISOString(),recordedAt:sky.recordedAt,inputSha256:digest(inputText),orbitalIdentitySourceSha256:digest(gpText),counts,licenseNotices:input.licenseNotices,interestPolicy:input.interestPolicy,sourceSnapshots:input.sourceSnapshots,verification:input.verification,identities:input.satellites,reviews:audit,profilesOutsideSnapshot:input.profiles.filter(p=>!p.applicableNoradIds.length)};
await mkdir(new URL('evidence/',root),{recursive:true});
await writeFile(new URL('source/data/facts.json',root),JSON.stringify(runtime));
await writeFile(new URL('evidence/fact-review.json',root),JSON.stringify(provenance));
console.log(JSON.stringify({...counts,inputSha256:provenance.inputSha256,runtimeBytes:Buffer.byteLength(JSON.stringify(runtime))},null,2));
