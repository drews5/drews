import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {initializeSuggestions,buildSuggestionPayload,suggestionRecipient,suggestionResult} from '../public/rewrite/admin/suggestions.js';
const html=await readFile(new URL('../public/rewrite/admin/index.html',import.meta.url),'utf8');
function fixture(){
 const {document,window}=parseHTML(html),dialog=document.querySelector('#suggestion-dialog'),form=document.querySelector('#suggestion-form');
 dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;dialog.dispatchEvent(new window.Event('close'));};form.reportValidity=()=>true;form.reset=()=>{};
 Object.defineProperty(document.querySelector('#suggest-images'),'files',{value:[],writable:true});
 const select=document.querySelector('#suggest-page');Object.defineProperty(select,'value',{get:()=>[...select.options].find(option=>option.hasAttribute('selected'))?.value||select.options[0]?.value,set:value=>{for(const option of select.options)if(option.value===value)option.setAttribute('selected','');else option.removeAttribute('selected');}});
 return {document,window,dialog,form};
}
function fill(document){document.querySelector('#suggest-name').value='Team member';document.querySelector('#suggest-email').value='member@example.org';document.querySelector('#suggest-message').value='Replace the Erie photo. Here is the new image: https://example.org/photo';}
const flush=async()=>{for(let i=0;i<25;i++)await Promise.resolve();};
test('simple popup selects the current page and sends the message and optional images directly to Drew',async()=>{
 const {document,window,dialog,form}=fixture(),calls=[];
 initializeSuggestions({doc:document,getContext:()=>({route:'/',selection:'Partner quote'}),uploadPhoto:async file=>'https://images.example/'+file.name,fetcher:async(url,options={})=>{calls.push({url,options});if(url.endsWith('admin-pages.json'))return {ok:true,json:async()=>[{route:'/',title:'Home'},{route:'/impact',title:'Impact'}]};return {ok:true,json:async()=>({success:'true'})};}});
 document.querySelector('#suggest-open').click();await flush();assert.equal(dialog.open,true);assert.equal(document.querySelector('#suggest-page').value,'/');fill(document);
 document.querySelector('#suggest-images').files=[{name:'screenshot.webp',size:1000}];form.dispatchEvent(new window.Event('submit',{cancelable:true}));await flush();
 const submission=calls.find(c=>c.options.method==='POST');assert.equal(submission.url,'https://formsubmit.co/ajax/drewscheid05@gmail.com');const payload=JSON.parse(submission.options.body);
 assert.equal(payload._replyto,'member@example.org');assert.ok(payload.Message.includes('Replace the Erie photo'));assert.equal(payload.Images,'https://images.example/screenshot.webp');assert.equal(payload.Page,'Home — https://drews.click/rewrite/');
 assert.equal(document.querySelector('#suggestion-fields').hidden,true);assert.equal(document.querySelector('#suggestion-success').hidden,false);assert.equal(dialog.open,true);assert.equal(document.querySelector('#suggest-send').textContent,'Send to Drew');
 document.querySelector('#suggest-another').click();assert.equal(document.querySelector('#suggestion-fields').hidden,false);assert.equal(suggestionRecipient,'drewscheid05@gmail.com');
});
test('activation and connection failures keep the message for a retry',async()=>{
 const {document,window,form}=fixture();let mode='activation',posts=0;
 initializeSuggestions({doc:document,getContext:()=>({route:'/impact'}),uploadPhoto:async()=>'',fetcher:async(url)=>{if(url.endsWith('admin-pages.json'))return {ok:true,json:async()=>[{route:'/',title:'Home'},{route:'/impact',title:'Impact'}]};posts++;if(mode==='network')throw Error('Failed to fetch');return {ok:true,json:async()=>({success:'false',message:'Needs activation'})};}});
 document.querySelector('#suggest-open').click();await flush();fill(document);form.dispatchEvent(new window.Event('submit',{cancelable:true}));await flush();assert.match(document.querySelector('#suggestion-status').textContent,/Drew needs to confirm/);assert.notEqual(document.querySelector('#suggestion-fields').hidden,true);
 mode='network';form.dispatchEvent(new window.Event('submit',{cancelable:true}));await flush();assert.ok(document.querySelector('#suggest-message').value.includes('Replace the Erie photo'));assert.match(document.querySelector('#suggestion-status').textContent,/connection/);assert.equal(posts,2);assert.equal(document.querySelector('#suggest-send').disabled,false);
});
test('the short form validates the required fields and keeps freeform requests intact',async()=>{
 const {document,form}=fixture();initializeSuggestions({doc:document,getContext:()=>({}),uploadPhoto:async()=>'',fetcher:async()=>({ok:true,json:async()=>[{route:'/',title:'Home'}]})});document.querySelector('#suggest-open').click();await flush();fill(document);
 document.querySelector('#suggest-message').value='';assert.throws(()=>buildSuggestionPayload(form,{}),/Describe the change/);document.querySelector('#suggest-message').value='Two changes:\nUpdate the homepage copy and adjust the team photos.';assert.ok(buildSuggestionPayload(form,{}).Message.includes('\n'));
 document.querySelector('#suggest-email').value='invalid';assert.throws(()=>buildSuggestionPayload(form,{}),/name and email/);
 assert.throws(()=>suggestionResult({ok:true},{success:'false',message:'Invalid request'}));assert.equal(suggestionResult({ok:true},{success:'true'}),'sent');assert.equal(suggestionResult({ok:true},{success:'false',message:'Needs activation'}),'activation');
});
