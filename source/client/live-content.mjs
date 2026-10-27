import {createContentReader} from '../lib/content-values.mjs';

import {applyLiveContent} from '../../public/rewrite/content-engine.js';
export {applyLiveContent};

export function startLiveContent(doc,config,fetcher=fetch){
 const {readValues}=createContentReader(config.fields);let current={...config.initialValues},pending=false,timer,stopped=false;
 doc.adminSharedValues ||= config.adminValues||{};doc.adminSheetValues={...current};
 const apply=next=>{doc.adminSheetValues={...next};const effective={...next,...doc.adminSharedValues};const previous=doc.adminEffectiveValues||current;doc.adminEffectiveValues=effective;applyLiveContent(doc,previous,effective,config.original);};
 const schedule=()=>{clearTimeout(timer);if(!stopped&&!doc.hidden)timer=setTimeout(refresh,30000);};
 async function refresh(){
  if(stopped||pending||doc.hidden)return;
  pending=true;clearTimeout(timer);
  try{
   const url=new URL(config.feedUrl);url.searchParams.set('_refresh',String(Math.floor(Date.now()/30000)));
   const response=await fetcher(url.href,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('Spreadsheet unavailable');
   const next=readValues(await response.text(),current);
   apply(next);current=next;
   doc.documentElement.dataset.contentSync='live';doc.documentElement.dataset.contentUpdatedAt=new Date().toISOString();
  }catch{doc.documentElement.dataset.contentSync='unavailable';/* Keep the existing page and retry; never replace it with defaults. */}
  finally{pending=false;schedule();}
 }
 const visibility=()=>{if(doc.hidden)clearTimeout(timer);else refresh();};
 doc.addEventListener('visibilitychange',visibility);
 const pageshow=event=>{if(event.persisted)refresh();};doc.defaultView.addEventListener('pageshow',pageshow);
 apply(current);refresh();
 return {refresh,stop(){stopped=true;clearTimeout(timer);doc.removeEventListener('visibilitychange',visibility);doc.defaultView.removeEventListener('pageshow',pageshow);}};
}

if(typeof document!=='undefined'){
 const boot=()=>{const state=document.querySelector('#site-content-state');if(state)startLiveContent(document,JSON.parse(state.textContent));};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
}
