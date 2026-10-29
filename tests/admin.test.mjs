import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{AdminService,serveEditor} from '../admin-worker/worker.mjs';
import {parseHTML} from 'linkedom';
import {applyEdits} from '../public/rewrite/admin-runtime.js';
test('admin authenticates on the server, keeps drafts private, publishes explicitly, and rejects conflicting saves',async()=>{
 const records=new Map();let queue=Promise.resolve();const ctx={storage:{get:async key=>records.get(key),put:async(key,value)=>records.set(key,value),delete:async key=>records.delete(key)},blockConcurrencyWhile:callback=>{const work=queue.then(callback);queue=work.catch(()=>{});return work;}};
 const password=crypto.randomUUID();const service=new AdminService(ctx,{ADMIN_PASSWORD:password,SITE_ORIGIN:'https://drews.click'});
 const call=(path,method='GET',body,token='',revision)=>service.fetch(new Request('https://admin.example'+path,{method,headers:{Origin:'https://drews.click','Content-Type':'application/json',Authorization:'Bearer '+token,...(revision===undefined?{}:{'If-Match':String(revision)})},body:body===undefined?undefined:JSON.stringify(body)}));
 assert.equal((await call('/draft')).status,401);assert.equal((await call('/login','POST',{password:'wrong'})).status,401);
 const {token}=await (await call('/login','POST',{password})).json();assert.equal(token.length,72);
 const document={pages:{'/':{'1234567890abcdef':{tag:'H1',key:'1111111111111111',text:'A team edit'}}},shared:{},values:{kits:23456,kit_price:7}};
 assert.equal((await call('/draft','PUT',document,token,0)).status,200);
 assert.deepEqual((await (await call('/published')).json()).document.pages,{});
 assert.equal((await call('/draft','PUT',document,token,0)).status,409);
 const invalid={pages:{'/':{'1234567890abcdef':{href:'javascript:alert(1)'}}},shared:{}};assert.equal((await call('/draft','PUT',invalid,token,1)).status,400);
 assert.equal((await call('/draft','PUT',{pages:{},shared:{},values:{kits:-1}},token,1)).status,400);
 assert.equal((await call('/draft','PUT',{pages:{},shared:{},values:{donation_url:'https://example.org'}},token,1)).status,400);
 assert.equal((await call('/publish','POST',undefined,token,1)).status,200);
 assert.equal((await (await call('/published')).json()).document.pages['/']['1234567890abcdef'].text,'A team edit');
 assert.equal((await (await call('/published')).json()).document.values.kits,23456);
 const image=new Uint8Array(150000).fill(42);const uploaded=await service.fetch(new Request('https://admin.example/upload',{method:'POST',headers:{Origin:'https://drews.click',Authorization:'Bearer '+token,'Content-Type':'image/webp'},body:image}));assert.equal(uploaded.status,200);const imageUrl=(await uploaded.json()).src;const restored=await service.fetch(new Request(imageUrl));assert.deepEqual(new Uint8Array(await restored.arrayBuffer()),image);
 await call('/logout','POST',undefined,token);assert.equal((await call('/draft','GET',undefined,token)).status,401);
});
test('page edits preserve unrelated pages, apply shared footer edits, and do not duplicate added images',()=>{
 const doc=parseHTML('<html><body><h1 data-admin-id="1234567890abcdef">Original</h1><footer><p data-admin-id="abcdef1234567890">Footer</p></footer></body></html>').document;
 const content={pages:{'/about':{'1234567890abcdef':{tag:'H1',text:'About',additions:[{src:'https://images.example/photo.webp',alt:'Students packing supplies'}]}}},shared:{'abcdef1234567890':{tag:'P',text:'Shared footer'}}};
 applyEdits(doc,content,'/');assert.equal(doc.querySelector('h1').textContent,'Original');assert.equal(doc.querySelector('footer p').textContent,'Shared footer');
 applyEdits(doc,content,'/about');applyEdits(doc,content,'/about');assert.equal(doc.querySelector('h1').textContent,'About');assert.equal(doc.querySelectorAll('img').length,1);
});

test('same-origin and www logins work while unrelated origins remain blocked',async()=>{
 const records=new Map(),ctx={storage:{get:async key=>records.get(key),put:async(key,value)=>records.set(key,value),delete:async key=>records.delete(key)},blockConcurrencyWhile:callback=>callback()};
 const password=crypto.randomUUID(),service=new AdminService(ctx,{ADMIN_PASSWORD:password,SITE_ORIGIN:'https://drews.click'});
 for(const origin of ['https://drews.click','https://www.drews.click','https://admin.example']){
  const preflight=await service.fetch(new Request('https://admin.example/login',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}}));assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
  const response=await service.fetch(new Request('https://admin.example/login',{method:'POST',headers:{Origin:origin,'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({password})}));assert.equal(response.status,200);const {token}=await response.json();
  const draft=await service.fetch(new Request('https://admin.example/draft',{headers:{Origin:origin,Authorization:'Bearer '+token}}));assert.equal(draft.status,200);assert.equal(draft.headers.get('Access-Control-Allow-Origin'),origin);
 }
 const rejected=await service.fetch(new Request('https://admin.example/login',{method:'OPTIONS',headers:{Origin:'https://unrelated.example'}}));assert.equal(rejected.status,403);assert.notEqual(rejected.headers.get('Access-Control-Allow-Origin'),'https://unrelated.example');
});

test('the direct editor serves its assets and local API configuration without proxying arbitrary destinations',async()=>{
 const env={SITE_ORIGIN:'https://drews.click'},calls=[];
 const fetcher=async(url,options)=>{calls.push({url:url.href,options});return new Response('Editor source',{headers:{'Content-Type':'text/html'}});};
 const config=await serveEditor(new Request('https://admin.example/rewrite/admin-config.json'),env,fetcher);assert.deepEqual(await config.json(),{apiBase:'https://admin.example',siteOrigin:'https://drews.click'});assert.equal(calls.length,0);
 const page=await serveEditor(new Request('https://admin.example/rewrite/admin/?v=login3'),env,fetcher);assert.equal(await page.text(),'Editor source');assert.equal(calls[0].url,'https://drews.click/rewrite/admin/?v=login3');assert.equal(page.headers.get('Cache-Control'),'no-store');assert.equal(calls[0].options.redirect,'manual');
 assert.equal((await serveEditor(new Request('https://admin.example/rewrite/admin/'),env,async()=>new Response(null,{status:302,headers:{Location:'https://unrelated.example'}}))).status,502);
 assert.equal(await serveEditor(new Request('https://admin.example/login'),env,fetcher),null);
 assert.equal(await serveEditor(new Request('https://admin.example/https://unrelated.example'),env,fetcher),null);
 assert.equal((await serveEditor(new Request('https://admin.example/rewrite/admin/editor.js',{method:'POST'}),env,fetcher)).status,405);
});

test('editor responses clear cached QUIC advertisements while preserving the API response',async()=>{
 const env={ADMIN_SERVICE:{idFromName:()=> 'test',get:()=>({fetch:async()=>Response.json({ok:true},{headers:{'Alt-Svc':'h3=":443"; ma=86400','Access-Control-Allow-Origin':'https://drews.click'}})})}};
 const response=await worker.fetch(new Request('https://admin.example/published'),env);
 assert.equal(response.headers.get('Alt-Svc'),'clear');assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://drews.click');assert.deepEqual(await response.json(),{ok:true});
});
