import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {AdminService} from '../admin-worker/worker.mjs';
import {productionHtml,productionText} from '../source/lib/production-export.mjs';
import {applyEdits} from '../public/rewrite/admin-runtime.js';
import {sharedFields,parseSharedValue,sharedBinding,contentState} from '../public/rewrite/shared-content.js';

const origin='https://www.therewriteitproject.org';
function service(){
 const records=new Map(),ctx={storage:{get:async key=>records.get(key),put:async(key,value)=>records.set(key,value),delete:async key=>records.delete(key)},blockConcurrencyWhile:callback=>callback()};
 const password=crypto.randomUUID();return {password,backend:new AdminService(ctx,{ADMIN_PASSWORD:password,SITE_ORIGIN:'https://drews.click'})};
}

test('same-domain API preserves authentication, revisions, uploaded image URLs and published edits',async()=>{
 const {backend,password}=service();
 const call=(path,method='GET',body,token='',revision)=>backend.fetch(new Request(origin+'/admin/api'+path,{method,headers:{Origin:origin,'Content-Type':'text/plain;charset=UTF-8',...(token?{Authorization:'Bearer '+token}:{}),...(revision===undefined?{}:{'If-Match':String(revision)})},body:body===undefined?undefined:JSON.stringify(body)}));
 assert.equal((await call('/draft')).status,401);
 assert.equal((await call('/login','POST',{password:'incorrect'})).status,401);
 const login=await call('/login','POST',{password});assert.equal(login.status,200);const {token}=await login.json();
 const draft=await (await call('/draft','GET',undefined,token)).json();assert.equal(draft.revision,0);
 const document={pages:{'/about':{'1234567890abcdef':{tag:'H1',text:'Updated by the team'}}},shared:{},values:{kits:20000}};
 assert.equal((await call('/draft','PUT',document,token,0)).status,200);
 assert.equal((await call('/draft','PUT',document,token,0)).status,409);
 assert.deepEqual((await (await call('/published')).json()).document.pages,{});
 const bytes=new Uint8Array(5000).fill(23);
 const uploaded=await backend.fetch(new Request(origin+'/admin/api/upload',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+token,'Content-Type':'image/webp'},body:bytes}));
 assert.equal(uploaded.status,200);const {src}=await uploaded.json();assert.ok(src.startsWith(origin+'/admin/api/images/'));
 const image=await backend.fetch(new Request(src));assert.deepEqual(new Uint8Array(await image.arrayBuffer()),bytes);
 assert.equal((await call('/publish','POST',undefined,token,1)).status,200);
 assert.equal((await (await call('/published')).json()).document.values.kits,20000);
 const foreign=await backend.fetch(new Request(origin+'/admin/api/draft',{headers:{Origin:'https://unrelated.example',Authorization:'Bearer '+token}}));assert.equal(foreign.status,403);
 assert.equal((await call('/logout','POST',undefined,token)).status,200);
 assert.equal((await call('/draft','GET',undefined,token)).status,401);
});

test('production editor logs in, previews and publishes without leaving the nonprofit origin',async()=>{
 const html=productionHtml(await readFile(new URL('../public/rewrite/admin/index.html',import.meta.url),'utf8'));
 const script=productionText(await readFile(new URL('../public/rewrite/admin/editor.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
 const {document,window}=parseHTML(html),preview=document.querySelector('#preview'),{backend,password}=service(),calls=[],redirects=[];
 const frame=parseHTML('<html><head><script id="site-content-state" type="application/json">{"initialValues":{"kits":18576},"original":{}}</script></head><body><main><h1 data-admin-id="1234567890abcdef">Original heading</h1></main></body></html>').document;
 Object.defineProperty(preview,'contentDocument',{get:()=>frame});
 const fetcher=async(path,options={})=>{
  const url=new URL(path,origin);calls.push(url.href);assert.equal(url.origin,origin);assert.ok(!url.pathname.startsWith('/rewrite/'));
  if(url.pathname.startsWith('/admin/api/'))return backend.fetch(new Request(url,{...options,headers:{...options.headers,Origin:origin}}));
  if(url.pathname==='/admin-config.json')return Response.json({apiBase:origin+'/admin/api',siteOrigin:origin,sitePath:''});
  if(url.pathname==='/admin-pages.json')return Response.json([{route:'/',title:'Home'}]);
  if(url.pathname==='/admin-source/home.json')return Response.json({html:frame.documentElement.outerHTML});
  if(url.pathname==='/')return new Response(frame.documentElement.outerHTML);
  throw Error('Unexpected editor URL: '+url.href);
 };
 const context=vm.createContext({document,window,location:{origin,search:'',replace:url=>redirects.push(url)},sessionStorage:{getItem:()=>'',setItem(){},removeItem(){}},matchMedia:()=>({matches:true}),fetch:fetcher,initializeSuggestions:()=>{},applyEdits,sharedFields,parseSharedValue,sharedBinding,contentState,URL,AbortSignal,DOMParser:window.DOMParser,confirm:()=>true,console});
 const editor=await new vm.Script('(async()=>{'+script+';return {openPage};})()').runInContext(context);
 document.querySelector('#password').value=password;await document.querySelector('#login-form').onsubmit({preventDefault(){}});
 assert.equal(document.querySelector('#dashboard').hidden,false);assert.equal(document.querySelector('.page-art iframe').src,origin+'/');assert.equal(redirects.length,0);
 await editor.openPage({route:'/',title:'Home'});preview.dispatchEvent(new window.Event('load'));
 assert.ok(preview.srcdoc.includes('<base href="'+origin+'/">'));
 document.querySelector('.content-item').click();const field=document.querySelector('#text');field.value='Updated on the nonprofit site';field.dispatchEvent(new window.Event('input'));
 await document.querySelector('#save').onclick();await document.querySelector('#publish-page').onclick();
 assert.equal(document.querySelector('#edit-status').textContent,'Published');
 const result=await (await backend.fetch(new Request(origin+'/admin/api/published'))).json();assert.equal(result.document.pages['/']['1234567890abcdef'].text,'Updated on the nonprofit site');
 assert.ok(calls.includes(origin+'/admin/api/login'));assert.ok(calls.includes(origin+'/admin-source/home.json'));
});
