import {collectionTypes} from '../content-collections.js';
export const copyDraft=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const isMap=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const keys=(...values)=>[...new Set(values.flatMap(value=>Object.keys(value||{})))];
const own=(map,key)=>Object.hasOwn(map||{},key)?map[key]:undefined;
export function sameDraft(a,b){
 if(a===b)return true;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,i)=>sameDraft(value,b[i]));
 return isMap(a)&&isMap(b)&&keys(a,b).every(key=>sameDraft(own(a,key),own(b,key)));
}

// The server still controls concurrency. Only automatically merge edits to
// different fields; competing changes to the same field need a person.
export function mergeDraft(base,local,remote){
 const conflicts=[];
 function merge(a,b,c,path=[]){
  if(sameDraft(b,c)||sameDraft(a,c))return copyDraft(b);
  if(sameDraft(a,b))return copyDraft(c);
  if((a===undefined||isMap(a))&&isMap(b)&&isMap(c)){
   const pairs=keys(a,b,c).map(key=>[key,merge(own(a,key),own(b,key),own(c,key),[...path,key])]).filter(([,value])=>value!==undefined);
   return Object.fromEntries(pairs);
  }
  conflicts.push(path);return copyDraft(b);
 }
 return {document:merge(base,local,remote),conflicts};
}

const byRoute=(draft,route)=>({text:draft?.pages?.[route]||{},lists:draft?.collections?.[route]||{},team:route==='/team'?draft?.teamRoster||{}:null});
const supported=['pages','collections','teamRoster','shared','values'];
export function draftChanges(draft,live){
 const routes=keys(draft?.pages,live?.pages,draft?.collections,live?.collections);
 if((draft?.teamRoster||live?.teamRoster)&&!routes.includes('/team'))routes.push('/team');
 const areas=[];
 for(const route of routes.sort()){
  const a=byRoute(draft,route),b=byRoute(live,route),details=[];
  if(!sameDraft(a.text,b.text))details.push('Text, links or photos');
  for(const kind of keys(a.lists,b.lists))if(!sameDraft(own(a.lists,kind),own(b.lists,kind)))details.push(Object.hasOwn(collectionTypes,kind)?collectionTypes[kind].title:'Content lists');
  if(!sameDraft(a.team,b.team))details.push('Team roster');
  if(details.length)areas.push({route,details});
 }
 const shared=[];
 if(!sameDraft(draft?.shared||{},live?.shared||{}))shared.push('Header or footer');
 if(!sameDraft(draft?.values||{},live?.values||{}))shared.push('Shared site settings');
 if(keys(draft,live).some(key=>!supported.includes(key)&&!sameDraft(own(draft,key),own(live,key))))shared.push('Other site settings');
 if(shared.length)areas.push({route:null,details:shared});
 return areas;
}

export function resetToLive(draft,live,route){
 if(!route)return copyDraft(live);
 const next=copyDraft(draft);
 for(const key of ['pages','collections']){
  const baseline=own(live?.[key],route);
  if(baseline!==undefined){next[key]||={};next[key][route]=copyDraft(baseline);}
  else if(next[key])delete next[key][route];
 }
 if(route==='/team'){
  if(live.teamRoster===undefined)delete next.teamRoster;
  else next.teamRoster=copyDraft(live.teamRoster);
 }
 return next;
}
