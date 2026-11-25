import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {siteFixture} from './site-fixtures.mjs';
import {applyEdits} from '../public/rewrite/admin-runtime.js';
import {collectionItems,mountManagedRegions,managedVersion,legacyReferences,restoreLegacyFields} from '../public/rewrite/content-collections.js';
import {applySheetImages} from '../public/rewrite/sheet-images.js';
import {productionHtml} from '../source/lib/production-export.mjs';
import {initializeContentManager} from '../public/rewrite/admin/content-manager.js';

const source=async route=>JSON.parse(await readFile(siteFixture('admin-source/'+route+'.json'),'utf8')).html;
const page=html=>parseHTML(html).document;
const empty={pages:{},shared:{},values:{}};
const keys=(doc,kind)=>collectionItems(doc,kind).map(item=>item.id);

test('FAQ changes preserve inherited answers, follow saved order, and publish matching structured data',async()=>{
 const doc=page(await source('home')),original=collectionItems(doc,'questions');
 const [first,second,third]=original,added='4cfe55dfaa002e06';
 const edits={...empty,collections:{'/':{questions:{records:{
  [second.id]:{title:'New question'},
  [added]:{added:true,title:'How can I help?',body:'<script>plain text</script>'}
 },hidden:[first.id],order:[added,second.id,third.id]}}}};
 applyEdits(doc,edits,'/');
 assert.deepEqual(keys(doc,'questions').slice(0,3),[added,second.id,third.id]);
 assert.equal(collectionItems(doc,'questions')[1].values.body,second.values.body);
 assert.equal(doc.querySelector('.faq-list script'),null);
 const qa=JSON.parse(doc.querySelector('script[data-faq-schema]').textContent).mainEntity;
 assert.equal(qa.length,original.length);assert.equal(qa[0].acceptedAnswer.text,'<script>plain text</script>');
 assert.equal(qa[1].name,'New question');
});

test('public updates from an older page drop stale entries, restore defaults and preserve active form controls',async()=>{
 const html=await source('home'),old=page(html),original=collectionItems(old,'questions'),first=original[0],id='15e87703e4325b38',removed='9f0755a372d68733';
 const prior={...empty,collections:{'/':{questions:{hidden:[first.id]},updates:{records:{[removed]:{added:true,title:'Old update',body:'Past notice'}}}}}};
 const later={...empty,collections:{'/':{updates:{records:{[id]:{added:true,title:'New update',body:'Latest news',url:'/contact/',linkLabel:'Contact us'}}}}}};
 applyEdits(old,prior,'/');
 const live=page(old.documentElement.outerHTML),clean=page(html),input=live.querySelector('[data-custom]'),form=input.closest('form');
 input.value='42';applyEdits(clean,later,'/');
 mountManagedRegions(live,clean,'/');
 mountManagedRegions(live,clean,'/');
 assert.equal(live.querySelector('[data-custom]'),input);assert.equal(input.closest('form'),form);assert.equal(input.value,'42');
 assert.deepEqual(keys(live,'questions'),original.map(item=>item.id));
 assert.deepEqual(keys(live,'updates'),[id]);assert.equal(live.querySelector('.site-update a').getAttribute('href'),'/rewrite/contact/');
 assert.notEqual(managedVersion(prior,'/'),managedVersion(later,'/'));
 const production=page(productionHtml(html));applyEdits(production,later,'/');
 assert.equal(production.querySelector('.site-update a').getAttribute('href'),'/contact/');
});

test('reordering established sections keeps stable keys and leaves the donation form and first section pinned',async()=>{
 const html=await source('home'),old=page(html),fresh=page(html);
 const original=keys(old,'layout'),hero=old.querySelector('main').firstElementChild,form=old.querySelector('.donation-picker');
 const edits={...empty,collections:{'/':{layout:{order:[...original].reverse()}}}};
 applyEdits(fresh,edits,'/');mountManagedRegions(old,fresh,'/');
 assert.deepEqual(keys(old,'layout'),[...original].reverse());
 assert.equal(old.querySelector('main').firstElementChild,hero);
 assert.equal(old.querySelector('.donation-picker'),form);
 mountManagedRegions(old,page(html),'/');assert.deepEqual(keys(old,'layout'),original);
});

test('latest portal can clear old text, images and additions without rewriting neighboring content',async()=>{
 const html=await source('about'),original=page(html),baked=page(html);
 const h=baked.querySelector('h1'),img=baked.querySelector('.about-opening img'),title=h.textContent,src=img.getAttribute('src');
 const ops={
  [h.dataset.adminId]:{key:h.dataset.adminKey,tag:'H1',text:'Temporary heading'},
  [img.dataset.adminId]:{key:img.dataset.adminKey,tag:'IMG',src:'https://images.example/head.webp',alt:'Temp',hidden:true,additions:[{src:'https://images.example/extra.webp',alt:''}]}
 };
 const prior={...empty,pages:{'/about':ops}};applyEdits(baked,prior,'/about');
 const visitor=page(baked.documentElement.outerHTML),savedImage=visitor.querySelector('.about-opening img');
 restoreLegacyFields(visitor,original,legacyReferences(prior,'/about'),legacyReferences(empty,'/about'));
 assert.equal(visitor.querySelector('h1').textContent,title);
 assert.equal(savedImage.getAttribute('src'),src);assert.equal(savedImage.hidden,false);
 assert.equal(visitor.querySelectorAll('[data-admin-added]').length,0);
});

test('partner directory, gallery and testimonials use the saved records without unsafe links or spreadsheet overriding a managed photo',async()=>{
 const impact=page(await source('impact')),home=page(await source('home'));
 const id='d5a258ffbec706c8',photo=collectionItems(impact,'gallery')[0],quote='20a8a17accd296af';
 const edits={...empty,collections:{'/impact':{
  partners:{records:{[id]:{added:true,title:'Sample Library',aliases:'SPL',url:'javascript:alert(1)'}}},
  gallery:{records:{[photo.id]:{image:'https://images.example/new.webp',alt:'Students sorting books'}}},
 },'/':{testimonials:{records:{[quote]:{added:true,title:'Sample Library',body:'Thank you!',image:'https://images.example/quote.webp'}},order:[quote]}}}};
 applyEdits(impact,edits,'/impact');applyEdits(home,edits,'/');
 const partner=impact.querySelector('[data-collection-item="'+id+'"]');assert.equal(partner.tagName,'DIV');
 assert.match(partner.dataset.partnerSearch,/SPL/);
 const figure=impact.querySelector('[data-collection-item="'+photo.id+'"]'),img=figure.querySelector('img');
 applySheetImages(impact,{[img.dataset.sheetImage]:'https://images.example/sheet.webp',[img.dataset.sheetImage+'_alt']:'Spreadsheet description'});
 assert.equal(img.getAttribute('src'),'https://images.example/new.webp');
 assert.equal(figure.querySelector('a').getAttribute('href'),'https://images.example/new.webp');
 assert.equal(img.alt,'Students sorting books');
 assert.equal(keys(home,'testimonials')[0],quote);
 assert.equal(home.querySelectorAll('[data-slide-to]').length,keys(home,'testimonials').length);
});

test('Manage content lets an editor add, hide and restore an FAQ without doing a server write',async()=>{
 const html=await source('home'),editor=page(await readFile(new URL('../public/rewrite/admin/index.html',import.meta.url),'utf8'));
 const $=id=>editor.getElementById(id),dialog=$('content-manager');
 dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;dialog.dispatchEvent(new editor.defaultView.Event('close'));};
 Object.defineProperty($('manage-content-kind'),'value',{value:'',writable:true});
 let lists={},refreshed=false;
 const getPage=()=>{const doc=page(html);applyEdits(doc,{...empty,collections:{'/':lists}},'/');return doc;};
 initializeContentManager({doc:editor,getPage,getDefaults:()=>page(html),getContent:kind=>lists[kind],setContent:(kind,list)=>{lists[kind]=list;},refresh:()=>{refreshed=true;},uploadPhoto:assert.fail,message:assert.fail,getTitle:()=>'Home'});
 $('manage-page').onclick();assert.equal(dialog.open,true);
 $('manage-content-kind').value='questions';$('manage-content-kind').onchange();
 $('manage-content-add').onclick();
 $('manage-content-fields').querySelector('[name=title]').value='A new FAQ';
 $('manage-content-fields').querySelector('[name=body]').value='A helpful answer';
 await $('manage-content-form').onsubmit({preventDefault(){}});
 assert.ok(collectionItems(getPage(),'questions').some(item=>item.values.title==='A new FAQ'));
 const first=$('manage-content-rows').querySelector('button[aria-label^="Hide "]');first.onclick();
 assert.equal(lists.questions.hidden.length,1);
 $('manage-content-hidden-list').querySelector('button').onclick();assert.equal(lists.questions.hidden.length,0);
 $('manage-content-done').onclick();assert.equal(refreshed,true);
});
