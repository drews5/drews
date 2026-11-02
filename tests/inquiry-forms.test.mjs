import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
const script=await readFile(new URL('../public/rewrite/inquiry-forms.js',import.meta.url),'utf8');
function fixture(fetcher,deadline=50,kind='contact'){
 const {document,window}=parseHTML(`<form action="https://formsubmit.co/therewriteitproject@gmail.com" data-inquiry="${kind}"><div class="form-fields"><input name="name" value="Test"><input name="email" value="test@example.org"><textarea name="message">Keep this draft</textarea><input name="supplies" value="Pens"><input name="supplies" value="Pencils"><input name="website"><input name="_honey"><p class="form-error"></p><button type="submit">Send message</button><a data-email-fallback hidden>Email this message instead</a></div><div class="submission-success" hidden><h3>Sent</h3><button class="send-another" type="button">Another</button></div></form>`);
 const form=document.querySelector('form');form.action=form.getAttribute('action');form.reportValidity=()=>true;let resets=0;form.reset=()=>resets++;
 class Data{constructor(f){this.entries=[...f.querySelectorAll('[name]')].map(x=>[x.name,x.value]);}*[Symbol.iterator](){yield* this.entries;}get(k){return this.entries.find(x=>x[0]===k)?.[1]??null;}getAll(k){return this.entries.filter(x=>x[0]===k).map(x=>x[1]);}has(k){return this.entries.some(x=>x[0]===k);}}
 const context={document,location:{search:''},fetch:fetcher,FormData:Data,URLSearchParams,AbortController,setTimeout,clearTimeout};vm.createContext(context);vm.runInContext(script.replace('initializeInquiryForms();',`initializeInquiryForms(document,fetch,${deadline});`),context);
 const submit=()=>{const event=new window.Event('submit',{cancelable:true});event.submitter=form.querySelector('[type=submit]');form.dispatchEvent(event);return event;};
 return {document,form,submit,resets:()=>resets,button:form.querySelector('[type=submit]'),error:form.querySelector('.form-error'),fallback:form.querySelector('[data-email-fallback]')};
}
const flush=async()=>{for(let i=0;i<25;i++)await Promise.resolve();};
for(const kind of ['contact','supplies','volunteer'])test(`${kind} delivery uses a simple request and confirms success before clearing the form`,async()=>{
 let request;const f=fixture(async(url,options)=>{request={url,options};return {ok:true,json:async()=>({success:'true'})};},50,kind);
 f.submit();assert.equal(f.button.disabled,true);await flush();
 assert.equal(request.url,'https://formsubmit.co/ajax/therewriteitproject@gmail.com');assert.equal(request.options.headers['Content-Type'],undefined);assert.equal(request.options.body.get('supplies'),'Pens, Pencils');assert.equal(request.options.body.get('_replyto'),'test@example.org');assert.equal(request.options.body.has('website'),false);
 assert.equal(f.form.querySelector('.submission-success').hidden,false);assert.equal(f.resets(),1);assert.equal(f.button.disabled,false);
});
test('activation does not claim success or erase the visitor draft',async()=>{
 const f=fixture(async()=>({ok:true,json:async()=>({success:'true',message:'Form needs activation. Activation email sent.'})}));f.submit();await flush();assert.match(f.error.textContent,/activation email/);assert.equal(f.resets(),0);assert.equal(f.form.querySelector('.submission-success').hidden,true);assert.equal(f.button.disabled,false);
});
for(const mode of ['network','rejected','invalid-json','fetch-hangs','body-hangs'])test(`${mode} restores controls, retains input, and offers an email fallback`,async()=>{
 let calls=0;const f=fixture(async()=>{calls++;if(mode==='network')throw Error('Failed to fetch');if(mode==='fetch-hangs')return new Promise(()=>{});return {ok:mode!=='rejected',json:async()=>{if(mode==='invalid-json')throw SyntaxError();if(mode==='body-hangs')return new Promise(()=>{});return {success:'false'};}};},5);
 f.submit();f.submit();await new Promise(r=>setTimeout(r,15));assert.equal(calls,1);assert.equal(f.resets(),0);assert.equal(f.button.disabled,false);assert.equal(f.fallback.hidden,false);assert.equal(f.form.hasAttribute('aria-busy'),false);assert.equal(f.form.querySelector('textarea').value,'Keep this draft');assert.match(f.error.textContent,/could not be confirmed/);assert.match(f.fallback.getAttribute('href'),/^mailto:therewriteitproject@gmail.com/);assert.ok(decodeURIComponent(f.fallback.getAttribute('href')).includes('Keep this draft'));assert.equal(calls,1);
});
