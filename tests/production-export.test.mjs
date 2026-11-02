import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {productionHtml,productionText} from '../source/lib/production-export.mjs';
import {applyEdits} from '../public/rewrite/admin-runtime.js';
import {AdminService} from '../admin-worker/worker.mjs';

test('production export rebases canonical URLs, assets and form returns without changing saved editor identities',()=>{
 const html='<html><head><link rel="canonical" href="https://drews.click/rewrite/about/"></head><body><a data-admin-key="1234567890abcdef" href="/rewrite/chapters/">Chapters</a><img src="/rewrite/assets/team.webp"><input name="_next" value="https://drews.click/rewrite/message-received/"><a href="https://donorbox.org/campaign">Donate</a></body></html>';
 const {document}=parseHTML(productionHtml(html));
 assert.equal(document.querySelector('link').href,'https://www.therewriteitproject.org/about/');
 assert.equal(document.querySelector('a').getAttribute('href'),'/chapters/');
 assert.equal(document.querySelector('a').dataset.adminKey,'1234567890abcdef');
 assert.equal(document.querySelector('img').getAttribute('src'),'/assets/team.webp');
 assert.equal(document.querySelector('input').value,'https://www.therewriteitproject.org/message-received/');
 assert.equal(document.querySelectorAll('a')[1].href,'https://donorbox.org/campaign');
 assert.equal(productionText('fetch("/rewrite/admin-config.json")'),'fetch("/admin-config.json")');
});

test('future published link and image edits use the production domain while the demo stays unchanged',()=>{
 const html='<html><body><a data-admin-id="1234567890abcdef" href="/rewrite/about/">About</a><img data-admin-id="abcdef1234567890" src="/rewrite/assets/photo.webp"></body></html>';
 const production=parseHTML(productionHtml(html)).document,demo=parseHTML(html).document;
 const edits={pages:{'/about':{'1234567890abcdef':{tag:'A',href:'https://drews.click/rewrite/chapters/#start'},'abcdef1234567890':{tag:'IMG',src:'https://drews.click/rewrite/assets/new.webp',additions:[{src:'https://uploads.example/photo.webp',alt:'Volunteer'}]}}},shared:{}};
 applyEdits(production,edits,'/about');applyEdits(demo,edits,'/about');
 assert.equal(production.querySelector('a').href,'https://www.therewriteitproject.org/chapters/#start');
 assert.equal(production.querySelector('img').src,'https://www.therewriteitproject.org/assets/new.webp');
 assert.equal(production.querySelectorAll('img')[1].src,'https://uploads.example/photo.webp');
 assert.equal(demo.querySelector('a').href,'https://drews.click/rewrite/chapters/#start');
});

test('production origins can read published edits but cannot use the authenticated API cross-origin',async()=>{
 const records=new Map(),ctx={storage:{get:async key=>records.get(key),put:async(key,value)=>records.set(key,value),delete:async key=>records.delete(key)},blockConcurrencyWhile:callback=>callback()};
 const service=new AdminService(ctx,{ADMIN_PASSWORD:crypto.randomUUID(),SITE_ORIGIN:'https://drews.click'});
 for(const origin of ['https://therewriteitproject.org','https://www.therewriteitproject.org']){
  const response=await service.fetch(new Request('https://admin.example/published',{headers:{Origin:origin}}));
  assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
  assert.equal((await service.fetch(new Request('https://admin.example/draft',{headers:{Origin:origin}}))).status,403);
  assert.equal((await service.fetch(new Request('https://admin.example/login',{method:'POST',headers:{Origin:origin}}))).status,403);
 }
 assert.equal((await service.fetch(new Request('https://admin.example/published',{headers:{Origin:'https://unrelated.example'}}))).status,403);
});
