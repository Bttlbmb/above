import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createLibrary,bestFact,detailFact,chooseFact,rememberFact} from '../source/facts.mjs';

// Synthetic selection fixtures, not satellite claims or production content.
const objects=Array.from({length:90},(_,i)=>({id:100+i,elevation:20+i%60}));
const rows=[['shared-mission',[100,101,102],0,2,6,'A shared mission story',[0]],['other-mission',[103],1,2,5,'A different mission story',[0]],...objects.slice(4).map((o,i)=>['individual-'+o.id,[o.id],2+i%9,i<10?1:0,1,'A fixture about one object',[0]])];
const library=createLibrary({sources:[{url:'https://example.com/source',title:'Test source'}],groups:['one','two',...Array.from({length:9},(_,i)=>'group'+i)],facts:rows},objects);
const state={selected:null,discovered:[],seenStories:[],seenGroups:[]};
const first=chooseFact(library,state);assert.equal(first.fact.key,'shared-mission');rememberFact(state,first);state.selected=first.object.id;
const second=chooseFact(library,state);assert.equal(second.fact.key,'other-mission');rememberFact(state,second);state.selected=second.object.id;
const third=chooseFact(library,state);assert.notEqual(third.fact.key,'shared-mission');assert.notEqual(third.object.id,second.object.id);
assert.equal(bestFact(library,100).text,'A shared mission story');assert.equal(bestFact(library,999),null);
let last=state.selected;for(let i=0;i<100;i++){const choice=chooseFact(library,state);assert.ok(choice);assert.notEqual(choice.object.id,last);rememberFact(state,choice);state.selected=choice.object.id;last=choice.object.id;}
assert.ok(state.discovered.length<=64&&state.seenStories.length<=24&&state.seenGroups.length<=6);
assert.ok(JSON.stringify(state).length<1024);
assert.equal(chooseFact(createLibrary({sources:[],groups:[],facts:[]},objects),state),null);

// Audit the shipped library separately from the synthetic ranking fixtures.
const root=new URL('../',import.meta.url);
const [data,sky,evidence]=await Promise.all(['source/data/facts.json','source/data/sky.json','evidence/fact-review.json'].map(async path=>JSON.parse(await readFile(new URL(path,root),'utf8'))));
const actualObjects=sky.objects.map(row=>Object.fromEntries(sky.fields.map((key,i)=>[key,row[i]]))),actual=createLibrary(data,actualObjects);
const reviews=new Map(evidence.reviews.map(review=>[review.key,review])),identities=new Map(evidence.identities.map(identity=>[identity.noradId,identity]));
assert.equal(actual.bySatellite.size,data.counts.distinctSatellites);assert.ok(actual.bySatellite.size>=500);
for(const fact of actual.facts){
  const review=reviews.get(fact.key);assert.ok(review);assert.equal(review.verification.status,'verified');assert.notEqual(review.verification.researcher,review.verification.reviewer);
  assert.deepEqual(fact.ids,review.ids);assert.deepEqual(fact.sources.map(source=>source.url),[...new Set(review.sources.map(source=>source.url))]);
  if(fact.individual){assert.equal(fact.ids.length,1);assert.equal(fact.tier,0);assert.ok(identities.get(fact.ids[0]).factIds.includes(fact.key));assert.equal(detailFact(actual,fact.ids[0]).key,fact.key);}
}
assert.equal(actual.facts.filter(fact=>fact.individual).length,data.counts.individualFacts);
assert.equal(new Set(actual.facts.filter(fact=>fact.tier>0).map(fact=>fact.story)).size,data.counts.discoveryStories);
const actualState={selected:null,discovered:[],seenStories:[],seenGroups:[]},stories=new Set();
for(let i=0;i<80;i++){const choice=chooseFact(actual,actualState);assert.ok(choice&&choice.fact.tier>0);assert.ok(!actualState.seenStories.includes(choice.fact.story));stories.add(choice.fact.story);rememberFact(actualState,choice);actualState.selected=choice.object.id;}
console.log(JSON.stringify({interestPriority:true,sharedStoryDeduplication:true,noAdjacentObjectRepeats:true,boundedHistory:true,verifiedSatelliteCoverage:actual.bySatellite.size,individualFactsAccessible:data.counts.individualFacts,eligibleDiscoveryStories:data.counts.discoveryStories,recentStoryAvoidanceClicks:80,independentReviewAndSources:true}));
