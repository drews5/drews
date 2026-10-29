import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const load=async path=>parseHTML(await readFile(new URL('../_site/rewrite/'+path,import.meta.url),'utf8')).document;

test('homepage FAQ follows the three calls to action and its schema remains readable',async()=>{
 const doc=await load('index.html'),sections=[...doc.querySelector('main').children];
 assert.ok(sections.indexOf(doc.querySelector('.home-faq'))>sections.indexOf(doc.querySelector('.home-involved')));
 assert.equal(doc.querySelectorAll('.home-involved .involvement-card').length,3);
 assert.equal(doc.querySelector('.hero-ticker [data-site-number=kits]').hasAttribute('data-count'),false);
 const schema=JSON.parse(doc.querySelector('[data-faq-schema=home_faq]').textContent);assert.equal(schema.mainEntity.length,5);assert.ok(schema.mainEntity.every(q=>q.acceptedAnswer.text));
 const rows=doc.querySelectorAll('.hero-mobile-film-row');assert.equal(rows.length,2);
 for(const row of rows){const groups=row.querySelectorAll('.hero-mobile-film-group');assert.equal(groups.length,2);assert.deepEqual([...groups[0].querySelectorAll('img')].map(img=>img.src),[...groups[1].querySelectorAll('img')].map(img=>img.src));}
});

test('the founding timeline follows the introduction, team sections start closed, and chapter tasks retain their illustrations',async()=>{
 const about=await load('about/index.html'),main=about.querySelector('main');
 assert.equal(main.children[0].className,'about-opening wrap');assert.equal(main.children[1].id,'our-story');
 assert.equal(about.querySelector('#our-story time').getAttribute('datetime'),'2020');assert.equal(about.querySelectorAll('#our-story .story-date')[1].textContent,'Present');
 const team=await load('team/index.html');assert.equal(team.querySelectorAll('.team-group').length,3);assert.ok([...team.querySelectorAll('.team-group')].every(group=>!group.hasAttribute('open')));
 const chapters=await load('chapters/index.html');assert.equal(chapters.querySelectorAll('.chapter-day-grid h3 .chapter-task-icon').length,3);assert.equal(about.querySelectorAll('.process-tabs button .process-step-icon').length,4);
});

test('values support previous, next, direct selection, keyboard navigation, and touch scroll state',async()=>{
 const doc=await load('about/index.html'),window=doc.defaultView,track=doc.querySelector('.values-track'),frames=[];
 Object.defineProperty(track,'clientWidth',{value:500});track.scrollLeft=0;track.scrollTo=options=>{track.scrollLeft=options.left;};
 const app=await readFile(new URL('../public/rewrite/app.js',import.meta.url),'utf8');
 vm.runInNewContext(app,{document:doc,window,location:{search:'',hash:''},matchMedia:()=>({matches:true}),innerWidth:1200,innerHeight:900,navigator:{},URL,URLSearchParams,Intl,FormData,AbortController,setTimeout,clearTimeout,setInterval:()=>0,queueMicrotask,performance:{now:()=>0},requestAnimationFrame:callback=>{frames.push(callback);return frames.length;}});
 const selected=()=>[...doc.querySelectorAll('[data-value-to]')].findIndex(dot=>dot.getAttribute('aria-pressed')==='true');
 doc.querySelector('[data-value-next]').click();assert.equal(selected(),1);assert.equal(track.scrollLeft,500);
 doc.querySelector('[data-value-prev]').click();assert.equal(selected(),0);
 doc.querySelector('[data-value-prev]').click();assert.equal(selected(),3);assert.equal(track.scrollLeft,1500);
 doc.querySelector('[data-value-to="1"]').click();assert.equal(selected(),1);
 const key=new window.Event('keydown',{cancelable:true});key.key='ArrowRight';track.dispatchEvent(key);assert.equal(selected(),2);
 track.scrollLeft=0;track.dispatchEvent(new window.Event('scroll'));while(frames.length)frames.shift()(0);assert.equal(selected(),0);
 doc.querySelector('[data-step="2"]').click();assert.equal(doc.querySelector('#step-panel-2').hidden,false);assert.equal(doc.querySelector('#step-panel-0').hidden,true);
});
