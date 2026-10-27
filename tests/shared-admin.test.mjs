import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {readFile} from 'node:fs/promises';
import {applyEdits} from '../public/rewrite/admin-runtime.js';
import {parseSharedValue} from '../public/rewrite/shared-content.js';
import {assignAdminIdentity} from '../source/lib/admin-identity.mjs';
import {startLiveContent} from '../source/client/live-content.mjs';
import fields from '../source/content/editor-fields.json' with {type:'json'};
import {createContentReader} from '../source/lib/content-values.mjs';
const {defaults}=createContentReader(fields);
const page=async name=>parseHTML(await readFile(new URL('../_site/rewrite/'+name,import.meta.url),'utf8')).document;
const edits={pages:{},shared:{},values:{kits:23456,kit_price:7,underfunded_percent:.81,budget_gap_millions:412,email:'team@example.org',address:'New mailing address',donation_url:'https://donorbox.org/new-campaign'}};

test('one shared edit updates homepage, impact, founding, giving and footer values with working donation links',async()=>{
 for(const [name,route] of [['index.html','/'],['impact/index.html','/impact'],['about/index.html','/about'],['give/index.html','/give']]){
  const doc=await page(name);applyEdits(doc,edits,route);
  for(const element of doc.querySelectorAll('[data-site-number=kits]'))assert.equal(element.textContent,'23,456');
  assert.equal(doc.querySelector('.footer-email').getAttribute('href'),'mailto:team@example.org');
  assert.ok([...doc.querySelectorAll('.footer-legal p')].some(p=>p.textContent==='New mailing address'));
  for(const element of doc.querySelectorAll('[data-site-price]'))assert.equal(element.textContent,'$7');
  assert.ok([...doc.querySelectorAll('a[href]')].some(a=>a.getAttribute('href').startsWith(edits.values.donation_url)));
  assert.equal(JSON.parse(doc.querySelector('#site-content-state').textContent).adminValues.kits,23456);
 }
 const home=await page('index.html');applyEdits(home,edits,'/');
 assert.equal(home.querySelector('[data-content=metric_districts_label]').closest('.metric').querySelector('[data-metric-count]').textContent,'81%');
 assert.equal(home.querySelector('[data-content=metric_budget_label]').closest('.metric').querySelector('[data-metric-count]').textContent,'$412M');
});

test('spreadsheet refreshes respect admin values and clearing an override restores the latest sheet',async()=>{
 const doc=await page('index.html'),state=JSON.parse(doc.querySelector('#site-content-state').textContent);
 applyEdits(doc,edits,'/');
 const next={...defaults,kits:30000,kit_price:8,hero_intro:'Team-written introduction'};
 const csv='Section,Field,Value,Notes,Key\n'+Object.entries(next).map(([key,value])=>['Test',key,String(value),'',key].map(v=>'"'+v.replaceAll('"','""')+'"').join(',')).join('\n');
 const sync=startLiveContent(doc,{...state,fields,feedUrl:'https://example.org/sheet'},async()=>({ok:true,text:async()=>csv}));
 for(let i=0;i<25&&doc.documentElement.dataset.contentSync!=='live';i++)await Promise.resolve();
 assert.equal(doc.querySelector('[data-site-number=kits]').textContent,'23,456');
 assert.equal(doc.querySelector('[data-content=hero_intro]').textContent,'Team-written introduction');
 applyEdits(doc,{...edits,values:{}},'/');
 assert.equal(doc.querySelector('[data-site-number=kits]').textContent,'30,000');
 assert.equal(doc.querySelector('[data-site-price]').textContent,'$8');sync.stop();
});

test('saved edits follow stable keys through page updates, shared headers reach new pages, and missing elements are not mis-targeted',()=>{
 const make=extra=>parseHTML('<html><body><header class="site-header"><a href="/rewrite/">Project</a></header><main><section class="intro">'+extra+'<h1>Heading</h1><p>Original copy</p></section></main><footer class="site-footer"><p>Footer</p></footer></body></html>').document;
 const before=make('');assignAdminIdentity(before,'/about');
 const para=before.querySelector('main p'),brand=before.querySelector('header a');
 const saved={pages:{'/about':{[para.dataset.adminId]:{tag:'P',key:para.dataset.adminKey,text:'Team edit'}}},shared:{[brand.dataset.adminId]:{tag:'A',key:brand.dataset.adminKey,text:'Shared brand'}},values:{kits:23456}};
 const updated=make('<aside>New page content</aside>');assignAdminIdentity(updated,'/about');applyEdits(updated,saved,'/about');
 assert.equal(updated.querySelector('main p').textContent,'Team edit');
 const newPage=make('');assignAdminIdentity(newPage,'/new-page');applyEdits(newPage,saved,'/new-page');assert.equal(newPage.querySelector('header a').textContent,'Shared brand');assert.equal(newPage.querySelector('main p').textContent,'Original copy');
 const missing=make('');assignAdminIdentity(missing,'/about');missing.querySelector('main p').dataset.adminKey='9999999999999999';applyEdits(missing,saved,'/about');assert.equal(missing.querySelector('main p').textContent,'Original copy');
});

test('shared settings reject invalid values and unsafe links',()=>{
 for(const [key,value] of [['kits',1.5],['underfunded_percent',1.1],['kit_price',0],['donation_url','https://example.org/donate'],['email','invalid'],['facebook','javascript:alert(1)'],['unknown','anything']])assert.throws(()=>parseSharedValue(key,value));
 assert.equal(parseSharedValue('kits','23456'),23456);assert.equal(parseSharedValue('underfunded_percent',.83),.83);
});

test('adding a navigation item keeps an existing shared link edit attached to its destination',()=>{
 const make=extra=>parseHTML('<html><body><header class="site-header"><nav><ul>'+extra+'<li><a class="nav-link" href="/rewrite/about/">About</a></li></ul></nav></header><main></main></body></html>').document;
 const original=make('');assignAdminIdentity(original,'/');const link=original.querySelector('a');
 const edits={pages:{},shared:{[link.dataset.adminId]:{tag:'A',key:link.dataset.adminKey,text:'About the project'}}};
 const updated=make('<li><a class="nav-link" href="/rewrite/new/">New page</a></li>');assignAdminIdentity(updated,'/new-page');applyEdits(updated,edits,'/new-page');
 assert.equal(updated.querySelector('a[href="/rewrite/about/"]').textContent,'About the project');assert.equal(updated.querySelector('a[href="/rewrite/new/"]').textContent,'New page');
});
