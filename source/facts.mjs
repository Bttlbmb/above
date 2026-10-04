// Fact rows are independently reviewed content; these rules rank interest and variety only.
export function createLibrary(data,objects){
  const byId=new Map(objects.map(object=>[object.id,object])),bySatellite=new Map();
  const facts=data.facts.map(([key,ids,group,tier,score,text,sources,story],index)=>({key,ids:ids.filter(id=>byId.has(id)),group,tier,score,text,sources:sources.map(i=>data.sources[i]),story:story??index,index,individual:index<(data.counts?.individualFacts||0)}));
  for(const fact of facts)for(const id of fact.ids){if(!bySatellite.has(id))bySatellite.set(id,[]);bySatellite.get(id).push(fact);}
  for(const list of bySatellite.values())list.sort((a,b)=>b.tier-a.tier||b.score-a.score||a.index-b.index);
  return {facts,bySatellite,byId,groups:data.groups,storyCount:data.storyCount??facts.length};
}

export function bestFact(library,id){return library.bySatellite.get(id)?.[0]||null;}
export function detailFact(library,id){return library.bySatellite.get(id)?.find(fact=>fact.individual)||bestFact(library,id);}

export function chooseFact(library,state){
  const recentObjects=new Set(state.discovered),recentStories=new Set(state.seenStories);
  let choices=[];
  for(const fact of library.facts){
    if(fact.tier===0)continue; // Routine context is available on taps, not promoted as a discovery.
    const available=fact.ids.map(id=>library.byId.get(id)).filter(object=>object.id!==state.selected&&object.elevation>=0);
    if(!available.length)continue;
    const high=available.filter(object=>object.elevation>=10),relevant=high.length?high:available;
    const fresh=relevant.filter(object=>!recentObjects.has(object.id));
    const object=(fresh.length?fresh:relevant).reduce((a,b)=>a.elevation>b.elevation?a:b);
    const recentGroup=state.seenGroups.lastIndexOf(fact.group),age=state.seenGroups.length-1-recentGroup;
    const familyPenalty=recentGroup>=0?2200/(age+1):0;
    choices.push({fact,object,score:fact.tier*1000+fact.score*30+object.elevation/90*20-familyPenalty});
  }
  // Share a mission story once, rather than repeating it for each constellation member.
  const freshStories=choices.filter(choice=>!recentStories.has(choice.fact.story));if(freshStories.length)choices=freshStories;
  const freshObjects=choices.filter(choice=>!recentObjects.has(choice.object.id));if(freshObjects.length)choices=freshObjects;
  const high=choices.filter(choice=>choice.object.elevation>=10);if(high.length)choices=high;
  choices.sort((a,b)=>b.score-a.score||b.object.elevation-a.object.elevation||a.object.id-b.object.id||a.fact.index-b.fact.index);
  return choices[0]||null;
}

export function rememberFact(state,choice){
  state.discovered=[...state.discovered.filter(id=>id!==choice.object.id),choice.object.id].slice(-64);
  state.seenStories=[...state.seenStories.filter(i=>i!==choice.fact.story),choice.fact.story].slice(-24);
  state.seenGroups=[...state.seenGroups.filter(i=>i!==choice.fact.group),choice.fact.group].slice(-6);
}
