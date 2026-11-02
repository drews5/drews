import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {parseHTML} from 'linkedom';
import {productionOrigin} from '../source/lib/production-export.mjs';
const root=resolve(import.meta.dirname,'../_production');let pages=0,links=0;
async function visit(dir){
 for(const item of await readdir(dir,{withFileTypes:true})){
  const file=join(dir,item.name);if(item.isDirectory()){await visit(file);continue;}
  if(!item.name.endsWith('.html'))continue;
  const html=await readFile(file,'utf8');pages++;
  assert(!html.includes('https://drews.click/rewrite'),'Demo URL in production HTML: '+file);
  assert(!html.includes('portfolio.css'),'Portfolio leaked into nonprofit export');
  const {document}=parseHTML(html),canonical=document.querySelector('link[rel=canonical]');
  if(canonical)assert.equal(new URL(canonical.href).origin,productionOrigin);
  for(const el of document.querySelectorAll('[href],[src],[action],[poster],[srcset]')){
   const values=['href','src','action','poster'].map(key=>el.getAttribute(key)).filter(Boolean);
   if(el.hasAttribute('srcset'))values.push(...el.getAttribute('srcset').split(',').map(x=>x.trim().split(/\s+/)[0]));
   for(const value of values){
    const url=new URL(value,productionOrigin);
    if(url.origin!==productionOrigin)continue;
    assert(!url.pathname.startsWith('/rewrite/'),'Demo prefix in production link: '+value);
    let target=join(root,decodeURIComponent(url.pathname));
    if(url.pathname.endsWith('/'))target=join(target,'index.html');
    try{await access(target);}catch{await access(join(target,'index.html'));}links++;
   }
  }
 }
}
await visit(root);
assert(pages>=30);
assert.equal((await readFile(join(root,'CNAME'),'utf8')).trim(),new URL(productionOrigin).hostname);
const home=await readFile(join(root,'index.html'),'utf8');
assert(home.includes('data-public-site-origin="'+productionOrigin+'"'));
assert(home.includes('https://donorbox.org/'));
assert(!home.includes('Hello!'));
const contact=await readFile(join(root,'contact/index.html'),'utf8');
assert(contact.includes('https://formsubmit.co/therewriteitproject@gmail.com'));
assert(contact.includes(productionOrigin+'/message-received/'));
assert((await readFile(join(root,'admin/index.html'),'utf8')).includes('https://rewrite-admin.drewscheid05.workers.dev/rewrite/admin/'));
const original=parseHTML(await readFile(resolve(root,'../_site/rewrite/index.html'),'utf8')).document;
const projected=parseHTML(home).document;
assert.deepEqual([...projected.querySelectorAll('[data-admin-key]')].map(x=>x.dataset.adminKey),[...original.querySelectorAll('[data-admin-key]')].map(x=>x.dataset.adminKey));
console.log(`PASS: production ${pages} pages, ${links} local references, canonical URLs, form return, editor entry, and stable edit identities.`);
