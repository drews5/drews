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
 return {document,window,dialog,form};
}
function fill(document){
 const set=(selector,value)=>{const element=document.querySelector(selector);if(element.tagName==='SELECT')Object.defineProperty(element,'value',{value,writable:true,configurable:true});else element.value=value;};
 set('#suggest-name','Team member');set('#suggest-email','member@example.org');set('#suggest-summary','Replace partner photo');set('#suggest-role','Operations');set('#suggest-device','Mobile and desktop');set('#suggest-timing','No deadline');set('[data-change-location]','Partner quote');set('[data-change-type]','Photo / artwork');set('[data-change-details]','Replace the Erie photo and keep the full group visible.');set('[data-change-replacement]','https://example.org/new-photo');
 document.querySelector('[data-suggest-page][data-route="/"]').setAttribute('checked','');
}
const flush=async()=>{for(let i=0;i<25;i++)await Promise.resolve();};
test('suggestion popup loads current pages, collects multiple changes and image links, and sends only to Drew without navigating',async()=>{
 const {document,window,dialog,form}=fixture(),calls=[];
 initializeSuggestions({doc:document,getContext:()=>({route:'/',selection:'Partner quote'}),uploadPhoto:async file=>'https://images.example/'+file.name,fetcher:async(url,options={})=>{calls.push({url,options});if(url.endsWith('admin-pages.json'))return {ok:true,json:async()=>[{route:'/',title:'Home'},{route:'/impact',title:'Impact'}]};return {ok:true,json:async()=>({success:'true'})};}});
 document.querySelector('#suggest-open').click();await flush();assert.equal(dialog.open,true);assert.equal(document.querySelector('[data-change-location]').value,'Partner quote');
 assert.equal(document.querySelector('[data-route="/"]').checked,true);fill(document);
 document.querySelector('#suggest-add-change').click();assert.equal(form.querySelectorAll('[data-suggest-change]').length,2);
 const second=form.querySelectorAll('[data-suggest-change]')[1];second.querySelector('[data-change-location]').value='Footer';second.querySelector('[data-change-details]').value='Adjust mobile spacing';Object.defineProperty(second.querySelector('[data-change-type]'),'value',{value:'Layout / styling'});
 document.querySelector('#suggest-images').files=[{name:'screenshot.webp',size:1000}];
 form.dispatchEvent(new window.Event('submit',{cancelable:true}));await flush();
 const submission=calls.find(c=>c.options.method==='POST');assert.equal(submission.url,'https://formsubmit.co/ajax/drewscheid05@gmail.com');const payload=JSON.parse(submission.options.body);
 assert.equal(payload._replyto,'member@example.org');assert.ok(payload['Requested changes'].includes('Change 2'));assert.ok(payload['Requested changes'].includes('Adjust mobile spacing'));assert.equal(payload['Reference images'],'https://images.example/screenshot.webp');assert.equal(payload['Sent from'],'https://drews.click/rewrite/');
 assert.equal(document.querySelector('#suggestion-fields').hidden,true);assert.equal(document.querySelector('#suggestion-success').hidden,false);assert.equal(dialog.open,true);
 document.querySelector('#suggest-another').click();assert.equal(form.querySelectorAll('[data-suggest-change]').length,1);assert.equal(document.querySelector('#suggestion-fields').hidden,false);
 assert.equal(suggestionRecipient,'drewscheid05@gmail.com');
});

test('activation and failed delivery retain the request; retries preserve content and never claim success',async()=>{
 const {document,window,form}=fixture();let mode='activation',posts=0;
 initializeSuggestions({doc:document,getContext:()=>({route:'/impact'}),uploadPhoto:async()=>'',fetcher:async(url)=>{if(url.endsWith('admin-pages.json'))return {ok:true,json:async()=>[{route:'/',title:'Home'}]};posts++;if(mode==='network')throw Error('Failed to fetch');return {ok:true,json:async()=>({success:'false',message:'This form needs activation. Check your email.'})};}});
 document.querySelector('#suggest-open').click();await flush();fill(document);
 form.dispatchEvent(new window.Event('submit',{cancelable:true}));await flush();assert.match(document.querySelector('#suggestion-status').textContent,/confirm the FormSubmit activation email/);assert.notEqual(document.querySelector('#suggestion-fields').hidden,true);assert.notEqual(document.querySelector('#suggestion-success').hidden,false);
 mode='network';form.dispatchEvent(new window.Event('submit',{cancelable:true}));await flush();assert.equal(document.querySelector('#suggest-summary').value,'Replace partner photo');assert.match(document.querySelector('#suggestion-status').textContent,/connection/);assert.equal(posts,2);assert.equal(document.querySelector('#suggest-send').disabled,false);
});

test('page selection, deadlines, reference URLs and service responses are validated',async()=>{
 const {document,form}=fixture();initializeSuggestions({doc:document,getContext:()=>({}),uploadPhoto:async()=>'',fetcher:async()=>({ok:true,json:async()=>[{route:'/',title:'Home'}]})});document.querySelector('#suggest-open').click();await flush();fill(document);
 document.querySelector('[data-suggest-page][data-route="/"]').removeAttribute('checked');assert.throws(()=>buildSuggestionPayload(form,{}),/Choose at least one/);document.querySelector('[data-route="/"]').setAttribute('checked','');
 document.querySelector('#suggest-links').value='javascript:alert(1)';assert.throws(()=>buildSuggestionPayload(form,{}),/HTTPS/);document.querySelector('#suggest-links').value='https://example.org/reference';
 Object.defineProperty(document.querySelector('#suggest-timing'),'value',{value:'Before a date',configurable:true});assert.throws(()=>buildSuggestionPayload(form,{}),/Choose the date/);document.querySelector('#suggest-date').value='2026-11-01';assert.equal(buildSuggestionPayload(form,{})['Needed by'],'2026-11-01');
 assert.throws(()=>suggestionResult({ok:true},{success:'false',message:'Invalid request'}));assert.equal(suggestionResult({ok:true},{success:'true'}),'sent');assert.equal(suggestionResult({ok:true},{success:'false',message:'Needs activation'}),'activation');
});
