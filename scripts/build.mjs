import {execFileSync} from 'node:child_process';
import {cp,mkdir,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {applySiteContent,defaults,readValues} from '../source/lib/site-content.mjs';
import {rewriteMountText} from '../source/lib/path-mount.mjs';
import {parseHTML} from 'linkedom';
import {applyEdits} from '../public/rewrite/admin-runtime.js';
import {sharedBinding} from '../public/rewrite/shared-content.js';
import {assignAdminIdentity} from '../source/lib/admin-identity.mjs';
const root=resolve(import.meta.dirname,'..'),out=join(root,'_site'),origin='https://drews.click';
execFileSync('python3',[join(root,'source/build.py')],{stdio:'inherit'});
const pages=JSON.parse(await readFile(join(root,'source/pages.json'),'utf8'));
const config=JSON.parse(await readFile(join(root,'source/content/live-sheet.json'),'utf8'));
const fields=JSON.parse(await readFile(join(root,'source/content/editor-fields.json'),'utf8'));
let values={...defaults};
if(!process.env.SKIP_LIVE_CONTENT){
 let lastError;
 for(let attempt=0;attempt<3;attempt++)try{
  const url=new URL(config.csv_url);url.searchParams.set('_refresh',String(Math.floor(Date.now()/30000)));
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  values=readValues(await response.text());lastError=null;console.log('Applied published spreadsheet content.');break;
 }catch(error){lastError=error;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1000));}
 if(lastError)throw new Error('Spreadsheet fetch failed; keeping the previously published site.',{cause:lastError});
}
const adminConfig=JSON.parse(await readFile(join(root,'public/rewrite/admin-config.json'),'utf8'));
let publishedEdits=null;
if(adminConfig.apiBase&&!process.env.SKIP_LIVE_CONTENT){const response=await fetch(adminConfig.apiBase+'/published',{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Admin content feed unavailable; preserving the published site');publishedEdits=(await response.json()).document;}
await rm(out,{recursive:true,force:true});await cp(join(root,'public'),out,{recursive:true});
async function rewriteAssets(dir){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const file=join(dir,entry.name);if(entry.isDirectory()){await rewriteAssets(file);continue;}
  const type=entry.name.endsWith('.css')?'text/css':entry.name.endsWith('.svg')?'image/svg+xml':entry.name.endsWith('.xml')?'text/xml':entry.name==='robots.txt'?'text/plain':null;
  if(type)await writeFile(file,rewriteMountText(await readFile(file,'utf8'),type,origin));
 }
}
await rewriteAssets(join(out,'rewrite'));
const readerCode=(await readFile(join(root,'source/lib/content-values.mjs'),'utf8')).replace(/^export /gm,'');
const clientCode=(await readFile(join(root,'source/client/live-content.mjs'),'utf8')).replace(/^import .*content-values\.mjs';\n/m,'').replace("../../public/rewrite/content-engine.js","./content-engine.js");
const liveCode=readerCode+'\n'+clientCode;
const liveVersion=createHash('sha256').update(liveCode).digest('hex').slice(0,10);
await writeFile(join(out,'rewrite/live-content.js'),liveCode);
const liveConfig={feedUrl:config.csv_url,fields:fields.map(({key,type})=>({key,type,value:values[key]})),initialValues:values,original:{email:defaults.email,chapter_email:defaults.chapter_email,kit_price:defaults.kit_price}};
const liveScripts=`<script type="application/json" id="site-content-state">${JSON.stringify(liveConfig).replace(/</g,'\\u003c')}</script><script type="module" src="/rewrite/live-content.js?v=${liveVersion}"></script>`;
const checkoutScript=`(async()=>{const p=new URLSearchParams(location.search);if(!p.has('amount'))return;const a=Number(p.get('custom')||p.get('amount'));let campaign=${JSON.stringify(publishedEdits?.values?.donation_url||values.donation_url)};try{const response=await fetch(${JSON.stringify(adminConfig.apiBase+'/published')},{cache:'no-store',signal:AbortSignal.timeout(2000)});if(response.ok)campaign=(await response.json()).document?.values?.donation_url||campaign;}catch{}const u=new URL(campaign);if(Number.isFinite(a)&&a>=1&&a<=100000)u.searchParams.set('amount',String(Math.round(a*100)/100));u.searchParams.set('default_interval',p.get('interval')==='m'?'m':'o');location.replace(u.href)})();`;
const pageDirectory=[];
for(const [route,template] of Object.entries(pages)){
 let html=rewriteMountText(applySiteContent(template,values),'text/html',origin);
 html=html.replace('</head>',liveScripts+'</head>');
 if(['/give','/donate','/copy-of-donate'].includes(route))html=html.replace('</head>',`<script>${checkoutScript}</script></head>`);
 const {document}=parseHTML(html),canonical=new URL(document.querySelector('link[rel="canonical"]')?.href||origin+'/rewrite/');
 const adminRoute='/'+canonical.pathname.replace(/^\/rewrite\/?/,'').replace(/\/$/,'');document.body.dataset.adminRoute=adminRoute;
 assignAdminIdentity(document,adminRoute);
 for(const el of document.querySelectorAll('[data-admin-id]')){const key=sharedBinding(el,document);if(key)el.dataset.adminField=key;}
 if(route===adminRoute){await mkdir(join(out,'rewrite/admin-source'),{recursive:true});await writeFile(join(out,'rewrite/admin-source', (adminRoute==='/'?'home':adminRoute.slice(1).replaceAll('/','_'))+'.json'),JSON.stringify({html:'<!doctype html>'+document.documentElement.outerHTML}));}
 if(publishedEdits)applyEdits(document,publishedEdits,adminRoute);
 const runtime=document.createElement('script');runtime.type='module';runtime.src='/rewrite/admin-runtime.js?v='+createHash('sha256').update(await readFile(join(root,'public/rewrite/admin-runtime.js'))).digest('hex').slice(0,10);document.head.append(runtime);
 html='<!doctype html>'+document.documentElement.outerHTML;
 if(route===adminRoute&&!['/404','/home-grid','/home-scrolling','/message-received'].includes(route))pageDirectory.push({route,title:document.querySelector('title').textContent.split(' | ')[0]});
 const file=route==='/404'?join(out,'rewrite/404.html'):join(out,'rewrite',route.slice(1),'index.html');
 await mkdir(resolve(file,'..'),{recursive:true});await writeFile(file,html);
}
await writeFile(join(out,'rewrite/admin-pages.json'),JSON.stringify(pageDirectory));
await cp(join(out,'rewrite/404.html'),join(out,'404.html'));
await cp(join(out,'rewrite/sitemap.xml'),join(out,'sitemap.xml'));
await cp(join(out,'rewrite/robots.txt'),join(out,'robots.txt'));
console.log(`Built ${Object.keys(pages).length} pages and aliases under /rewrite/.`);
