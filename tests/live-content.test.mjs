import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseHTML} from 'linkedom';
import {parseCsv,createContentReader} from '../source/lib/content-values.mjs';
import {applyLiveContent,startLiveContent} from '../source/client/live-content.mjs';
import fields from '../source/content/editor-fields.json' with {type:'json'};
const {defaults,readValues}=createContentReader(fields);
const home=await readFile(new URL('../_site/rewrite/index.html',import.meta.url),'utf8');
const give=await readFile(new URL('../_site/rewrite/give/index.html',import.meta.url),'utf8');
const impact=await readFile(new URL('../_site/rewrite/impact/index.html',import.meta.url),'utf8');
const contact=await readFile(new URL('../_site/rewrite/contact/index.html',import.meta.url),'utf8');
const app=await readFile(new URL('../public/rewrite/app.js',import.meta.url),'utf8');
const csv=values=>'Title,,,,\r\nSection,Field,Value,Notes,Key\r\n'+Object.entries({...defaults,...values}).map(([key,value])=>['Test',key,String(value),'',key].map(v=>'"'+v.replaceAll('"','""')+'"').join(',')).join('\r\n');
function page(html){return parseHTML(html).document;}
function initialize(doc,{motion=false}={}){
 // Linkedom provides the DOM; constraint validation is a browser-only API.
 doc.querySelectorAll('input').forEach(input=>{input.setCustomValidity=()=>{};});
 const observers=[],frames=[];
 class Observer{constructor(callback){this.callback=callback;this.elements=[];observers.push(this);}observe(el){this.elements.push(el);}unobserve(){}disconnect(){}}
 const window=doc.defaultView;window.IntersectionObserver=Observer;
 vm.runInNewContext(app,{document:doc,window,location:{search:'',hash:''},matchMedia:()=>({matches:!motion}),innerWidth:1200,navigator:{},URL,URLSearchParams,Intl,FormData,AbortController,setTimeout,clearTimeout,setInterval:()=>0,queueMicrotask,IntersectionObserver:Observer,performance:{now:()=>0},requestAnimationFrame:callback=>frames.push(callback)});
 return {observers,frames};
}
function runFrames(frames){while(frames.length)frames.shift()(5000);}
const config={fields,initialValues:defaults,original:{email:defaults.email,chapter_email:defaults.chapter_email,kit_price:5},feedUrl:'https://docs.google.com/spreadsheets/d/e/example/pub?output=csv'};

test('reads the real five-column sheet, multiline quotes, formatted numbers, and percents',()=>{
 const values=readValues(csv({kits:'19,123',underfunded_percent:'82%',hero_intro:'A line, with "quotes"\nand another line.'}));
 assert.equal(values.kits,19123);assert.equal(values.underfunded_percent,.82);assert.equal(values.hero_intro,'A line, with "quotes"\nand another line.');
 assert.deepEqual(parseCsv('a,"b""c",d\r\n'),[['a','b"c','d']]);
});

test('rejects invalid feeds and unsafe links while preserving last valid fields',()=>{
 const last={...defaults,kits:19000,donation_url:'https://donorbox.org/approved'};
 const values=readValues(csv({kits:'not a count',donation_url:'javascript:alert(1)',chapter_application:'https://user:pass@example.com/',hero_heading:'<img src=x onerror=alert(1)>'}),last);
 assert.equal(values.kits,19000);assert.equal(values.donation_url,last.donation_url);assert.equal(values.chapter_application,defaults.chapter_application);
 assert.equal(values.hero_heading,'<img src=x onerror=alert(1)>');
 assert.throws(()=>readValues('<html>hero_heading</html>'));assert.throws(()=>readValues('"unfinished'));assert.throws(()=>readValues('x'.repeat(150001)));
});

test('normal refreshes preserve the approved dot pattern and percentage edits are reversible',()=>{
 const doc=page(home),dots=[...doc.querySelectorAll('.metric-districts-piece')],original=dots.map(dot=>dot.getAttribute('fill'));
 applyLiveContent(doc,defaults,defaults,config.original);assert.deepEqual(dots.map(dot=>dot.getAttribute('fill')),original);
 const edited={...defaults,underfunded_percent:.8};applyLiveContent(doc,defaults,edited,config.original);
 assert.equal(dots.filter(dot=>dot.getAttribute('fill')==='#d9d9d9').length,80);
 applyLiveContent(doc,edited,defaults,config.original);assert.deepEqual(dots.map(dot=>dot.getAttribute('fill')),original);
});

test('refreshes metrics, safe copy, pricing, links, FAQ schema and email copy controls',()=>{
 const doc=page(home);initialize(doc);
 const intro=doc.querySelector('[data-content=hero_intro]'),originalIntro=intro.innerHTML;
 const next={...defaults,kits:19123,underfunded_percent:.8,budget_gap_millions:402.5,kit_price:6,hero_heading:'For <students> & schools',email:'new-team@example.org',donation_url:'https://donorbox.org/new-campaign',home_faq_1_answer:'Write to new-team@example.org for <details>.'};
 applyLiveContent(doc,defaults,next,config.original);
 assert.equal(doc.querySelector('[data-content=hero_heading]').textContent,next.hero_heading);assert.equal(doc.querySelector('[data-content=hero_heading] students'),null);
 assert.equal(intro.innerHTML,originalIntro,'unchanged hero line breaks survive');
 assert.equal(doc.querySelector('.hero-ticker [data-count]'),null,'the homepage ticker is static');assert.equal(doc.querySelector('[data-site-number=kits]').textContent,'19,123');
 assert.equal(doc.querySelector('[data-content=metric_budget_label]').closest('.metric').querySelector('[data-metric-count]').textContent,'$402.5M');
 assert.equal([...doc.querySelectorAll('.metric-districts-piece')].filter(d=>d.getAttribute('fill')==='#d9d9d9').length,80);
 assert.equal(doc.querySelector('.donation-picker').getAttribute('action'),next.donation_url);
 assert.equal(doc.querySelector('.amount-choice').dataset.amount,'6');assert.equal(doc.querySelector('.amount-choice[data-amount="50"] small').textContent,'8 kits');
 assert.equal(doc.querySelector('.footer-email').textContent,next.email);assert.equal(doc.querySelector('[data-copy-email]').dataset.copyEmail,next.email);
 assert.equal(doc.querySelector('[data-content=home_faq_1_answer] details'),null);
 assert.equal(JSON.parse(doc.querySelector('[data-faq-schema]').textContent).mainEntity[0].acceptedAnswer.text,next.home_faq_1_answer);
 assert.equal(doc.querySelector('[data-content=home_faq_1_answer] [data-copy-email]').dataset.copyEmail,next.email);
});

test('preserves a donor-entered amount while recalculating kits with a changed price',()=>{
 const doc=page(home);initialize(doc);const custom=doc.querySelector('[data-custom]');custom.value='27';custom.dispatchEvent(new doc.defaultView.Event('input'));
 applyLiveContent(doc,defaults,{...defaults,kit_price:6},config.original);
 assert.equal(custom.value,'27');assert.equal(doc.querySelector('[name=amount]').value,'27');assert.equal(doc.querySelector('[data-kit-kits]').textContent,'4 complete kits');
 assert.equal(doc.querySelector('.donation-picker>.button').textContent,'Donate $27');
});

test('keeps the original amount as custom if a one-kit preset changes',()=>{
 const doc=page(home);initialize(doc);doc.querySelector('.amount-choice').click();
 applyLiveContent(doc,defaults,{...defaults,kit_price:6},config.original);
 assert.equal(doc.querySelector('[data-custom]').value,'5');assert.equal(doc.querySelector('[name=amount]').value,'5');assert.equal(doc.querySelector('.amount-choice.selected'),null);
 assert.equal(doc.querySelector('[data-kit-kits]').textContent,'Part of a kit');
});

test('updates the giving-page preview and campaign without changing an entered amount',()=>{
 const doc=page(give);initialize(doc);const input=doc.querySelector('#gift-custom');input.value='50';input.dispatchEvent(new doc.defaultView.Event('input'));
 applyLiveContent(doc,defaults,{...defaults,kit_price:6,donation_url:'https://donorbox.org/new-campaign'},config.original);
 assert.equal(input.value,'50');assert.equal(doc.querySelector('[data-gift-kits]').textContent,'8 kits');
 const url=new URL(doc.querySelector('[data-gift-checkout]').href);assert.equal(url.pathname,'/new-campaign');assert.equal(url.searchParams.get('amount'),'50');
 assert.equal(doc.querySelector('[data-gift-amount="6"] strong').textContent,'$6');assert.equal(doc.querySelector('[data-site-price]').textContent,'$6');
});

test('public contact edits preserve the verified form recipient and an unsent message',()=>{
 const doc=page(contact);initialize(doc);const field=doc.querySelector('textarea');field.value='Please preserve this draft.';
 const action=doc.querySelector('form').getAttribute('action');
 applyLiveContent(doc,defaults,{...defaults,email:'new-team@example.org',chapter_email:'chapters@example.org',address:'A new public mailing address'},config.original);
 assert.equal(field.value,'Please preserve this draft.');assert.equal(doc.querySelector('form').getAttribute('action'),action);assert.ok(action.includes('formsubmit.co/therewriteitproject@gmail.com'));
 assert.equal(doc.querySelector('.footer-email').textContent,'new-team@example.org');assert.ok([...doc.querySelectorAll('.footer-legal p')].some(p=>p.textContent==='A new public mailing address'));
});

test('an in-progress impact counter finishes at the refreshed kit total',()=>{
 const doc=page(impact),{observers,frames}=initialize(doc,{motion:true});
 for(const observer of observers)for(const target of [...observer.elements])if(target.matches('.metric,[data-count]'))observer.callback([{target,isIntersecting:true,intersectionRatio:1}]);
 applyLiveContent(doc,defaults,{...defaults,kits:19123},config.original);runFrames(frames);
 assert.equal(doc.querySelector('.impact-count [data-count]').textContent,'19,123');
});

test('direct refreshes bypass browser cache and retain current content on network or feed failure',async()=>{
 const doc=page(home);let failure=false,lastRequest;
 const sync=startLiveContent(doc,config,async(url,options)=>{lastRequest={url,options};if(failure)throw Error('offline');return {ok:true,text:async()=>csv({kits:19123})};});
 for(let i=0;i<20&&doc.documentElement.dataset.contentSync!=='live';i++)await Promise.resolve();
 assert.equal(doc.querySelector('.hero-ticker [data-count]'),null);assert.equal(doc.querySelector('[data-site-number=kits]').textContent,'19,123');assert.equal(doc.documentElement.dataset.contentSync,'live');
 assert.equal(lastRequest.options.cache,'no-store');assert.equal(lastRequest.options.credentials,'omit');assert.ok(new URL(lastRequest.url).searchParams.has('_refresh'));
 failure=true;await sync.refresh();assert.equal(doc.documentElement.dataset.contentSync,'unavailable');assert.equal(doc.querySelector('[data-site-number=kits]').textContent,'19,123');sync.stop();
 const invalid=startLiveContent(doc,{...config,initialValues:{...defaults,kits:19123}},async()=>({ok:true,text:async()=>'<html>not a sheet</html>'}));
 for(let i=0;i<20&&doc.documentElement.dataset.contentSync!=='unavailable';i++)await Promise.resolve();
 await invalid.refresh();assert.equal(doc.querySelector('[data-site-number=kits]').textContent,'19,123');invalid.stop();
});

test('an unavailable sheet fails the build without replacing the published snapshot',async()=>{
 const file=new URL('../_site/rewrite/index.html',import.meta.url),before=await readFile(file);
 const result=spawnSync(process.execPath,['--import',fileURLToPath(new URL('./offline-fetch.mjs',import.meta.url)),'scripts/build.mjs'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,SKIP_LIVE_CONTENT:''},encoding:'utf8',timeout:15000});
 assert.notEqual(result.status,0);assert.match(result.stderr,/keeping the previously published site/);assert.deepEqual(await readFile(file),before);
});
