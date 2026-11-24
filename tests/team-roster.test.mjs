import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {applyEdits} from '../public/rewrite/admin-runtime.js';
import {readProfile} from '../public/rewrite/team-roster.js';
import {initializeTeamManager} from '../public/rewrite/admin/team-manager.js';
import {siteFixture} from './site-fixtures.mjs';

const source=async()=>JSON.parse(await readFile(siteFixture('admin-source/team.json'),'utf8')).html;
const cards=(doc,selector='.full-team-grid')=>[...doc.querySelectorAll(selector+' .person-card')];
const ids=(doc,selector)=>cards(doc,selector).map(card=>card.dataset.teamMember);

test('a published roster keeps existing edits, orders each section, and removes profiles and bios',async()=>{
 const doc=parseHTML(await source()).document;
 const original=ids(doc),leaders=ids(doc,'.leadership-grid'),removed=leaders[0],edited=original.find(id=>id!==removed),addedId='12345678abcdef00';
 const existing=cards(doc).find(c=>c.dataset.teamMember===edited).querySelector('h3');
 const legacy={pages:{'/team':{[existing.dataset.adminId]:{tag:'H3',key:existing.dataset.adminKey,text:'Existing draft name'}}},shared:{},values:{}};
 const teamRoster={records:{[addedId]:{added:true,name:'Jo García',role:'Finance Chair',bio:'A new bio <with plain text>',section:'board',photo:'https://images.example/jo.webp'}},removed:[removed],order:{full:[addedId,edited],board:[addedId]}};
 const content={...legacy,teamRoster};applyEdits(doc,content,'/team');applyEdits(doc,content,'/team');
 assert.deepEqual(ids(doc).slice(0,2),[addedId,edited]);
 assert.equal(ids(doc,'.board-grid')[0],addedId);
 assert.equal(cards(doc).length,original.length);
 assert.equal(doc.querySelector('[data-team-member="'+removed+'"]'),null);
 assert.equal(readProfile(doc,edited).name,'Existing draft name');
 assert.equal(readProfile(doc,addedId).bio,'A new bio <with plain text>');
 assert.equal(readProfile(doc,addedId).photo,'https://images.example/jo.webp');
 assert.equal(doc.querySelectorAll('#person-added-'+addedId).length,1);
 const reloaded=parseHTML(doc.documentElement.outerHTML).document;
 applyEdits(reloaded,content,'/team');
 assert.deepEqual(ids(reloaded),ids(doc));
 assert.equal(reloaded.querySelectorAll('#person-added-'+addedId).length,1);
});

test('Manage team adds an uploaded photo, moves the new profile, edits it, and removes an existing profile',async()=>{
 const pageHtml=await source(),editorHtml=await readFile(new URL('../public/rewrite/admin/index.html',import.meta.url),'utf8');
 const {document,window}=parseHTML(editorHtml);const $=id=>document.getElementById(id);
 let teamRoster,refreshed=false;
 for(const id of ['team-section','team-person-section'])Object.defineProperty($(id),'value',{value:'full',writable:true});
 const getPage=()=>{const doc=parseHTML(pageHtml).document;applyEdits(doc,{pages:{},shared:{},teamRoster},'/team');return doc;};
 const dialog=$('team-manager');dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;dialog.dispatchEvent(new window.Event('close'));};
 $('team-person-form').reset=()=>{$('team-person-photo').files=[];};
 initializeTeamManager({doc:document,getPage,getRoster:()=>teamRoster,setRoster:next=>teamRoster=next,refresh:()=>{refreshed=true;},uploadPhoto:async file=>{assert.equal(file.name,'headshot.webp');return 'https://images.example/headshot.webp';},message:assert.fail});
 $('manage-team').onclick();const first=ids(getPage())[0];
 $('team-add').onclick();$('team-person-name').value='New volunteer';$('team-person-role').value='Chapter Liaison';$('team-person-bio').value='A bio';$('team-person-photo').files=[{name:'headshot.webp'}];
 await $('team-person-form').onsubmit({preventDefault(){}});
 const id=Object.keys(teamRoster.records)[0];const added=readProfile(getPage(),id);
 assert.equal(added.name,'New volunteer');assert.equal(added.photo,'https://images.example/headshot.webp');
 document.querySelector('[aria-label="Move up New volunteer"]').onclick();
 assert.equal(ids(getPage()).at(-2),id);
 document.querySelector('[aria-label="Edit New volunteer"]').onclick();$('team-person-role').value='Finance volunteer';
 await $('team-person-form').onsubmit({preventDefault(){}});
 assert.equal(readProfile(getPage(),id).role,'Finance volunteer');
 assert.equal(readProfile(getPage(),id).photo,added.photo);
 const name=readProfile(getPage(),first).name;
 const originalConfirm=globalThis.confirm;globalThis.confirm=()=>true;
 try{[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Remove '+name).onclick();}finally{globalThis.confirm=originalConfirm;}
 assert.equal(readProfile(getPage(),first),null);
 $('team-done').onclick();assert.equal(refreshed,true);
});

test('a reused leadership card opens its own name and photo without borrowing the old biography',async()=>{
 const raw=await source(),doc=parseHTML(raw).document;
 const featured=cards(doc,'.leadership-grid')[0],id=featured.dataset.teamMember;
 const original=readProfile(doc,id);
 const [heading,photo]=[featured.querySelector('h3'),featured.querySelector('img')];
 const edits={pages:{'/team':{
  [heading.dataset.adminId]:{key:heading.dataset.adminKey,text:'New executive director'},
  [photo.dataset.adminId]:{key:photo.dataset.adminKey,src:'https://images.example/director.webp'}
 }},shared:{}};
 applyEdits(doc,edits,'/team');applyEdits(doc,edits,'/team');
 const featuredId=featured.dataset.teamMember;
 assert.notEqual(featuredId,id);
 assert.equal(readProfile(doc,featuredId).name,'New executive director');
 assert.equal(readProfile(doc,featuredId).photo,'https://images.example/director.webp');
 assert.equal(readProfile(doc,featuredId).bio,'');
 assert.deepEqual(readProfile(doc,id),original);
 assert.equal(doc.querySelectorAll('dialog[data-team-member="'+featuredId+'"]').length,1);
 const reloaded=parseHTML(doc.documentElement.outerHTML).document;
 applyEdits(reloaded,{...edits,teamRoster:{records:{[featuredId]:{name:'Updated director',bio:'Director bio'}}}},'/team');
 assert.equal(readProfile(reloaded,featuredId).name,'Updated director');
 assert.equal(readProfile(reloaded,featuredId).bio,'Director bio');
 assert.deepEqual(readProfile(reloaded,id),original);
});

test('the Board appears before Executive Leadership without changing saved editor identities',async()=>{
 const doc=parseHTML(await source()).document;
 const groups=[...doc.querySelectorAll('.team-accordions > details')];
 assert.ok(groups[0].querySelector('.board-grid'));
 assert.ok(groups[1].querySelector('.leadership-grid'));
 const card=groups[1].querySelector('.person-card');
 const identity=[card.dataset.adminId,card.dataset.adminKey];
 groups[0].before(groups[1]); // Reconstruct the pre-change order.
 const {assignAdminIdentity}=await import('../source/lib/admin-identity.mjs');
 assignAdminIdentity(doc,'/team');
 assert.deepEqual([card.dataset.adminId,card.dataset.adminKey],identity);
});
