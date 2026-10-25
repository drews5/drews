import {createContentReader} from '../lib/content-values.mjs';

const numberText=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
const dollarText=n=>'$'+numberText(n);
const emailPattern=/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const copyIcon='<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="14" y="13" width="19" height="23" rx="3"/><path d="M25 13V7a3 3 0 0 0-3-3H8a3 3 0 0 0-3 3v19a3 3 0 0 0 3 3h6"/></svg>';

function setCopy(doc,element,text){
 const fragment=doc.createDocumentFragment();let last=0;
 for(const match of text.matchAll(emailPattern)){
  fragment.append(doc.createTextNode(text.slice(last,match.index)));
  const wrap=doc.createElement('span');wrap.className='email-copy-link';
  const link=doc.createElement('a');link.href='mailto:'+match[0];link.textContent=match[0];
  const copy=doc.createElement('button');copy.type='button';copy.className='email-copy-button';copy.dataset.copyEmail=match[0];copy.title='Copy email address';copy.setAttribute('aria-label','Copy '+match[0]);copy.innerHTML=copyIcon;
  const status=doc.createElement('span');status.className='copy-status sr-only';status.setAttribute('role','status');
  wrap.append(link,copy,status);fragment.append(wrap);last=match.index+match[0].length;
 }
 fragment.append(doc.createTextNode(text.slice(last)));element.replaceChildren(fragment);
}

function changedUrl(raw,oldValue,newValue){
 if(raw===oldValue)return newValue;
 try{
  const candidate=new URL(raw),previous=new URL(oldValue);
  if(candidate.origin!==previous.origin||candidate.pathname!==previous.pathname)return raw;
  const next=new URL(newValue);
  for(const [key,value] of candidate.searchParams)if(previous.searchParams.get(key)!==value)next.searchParams.set(key,value);
  return next.href;
 }catch{return raw;}
}

export function applyLiveContent(doc,previous,next,original={kit_price:5}){
 const changed=Object.keys(next).filter(key=>next[key]!==previous[key]);
 // Keep the original artwork, with its dot proportions matching the editable figure.
 const dots=[...doc.querySelectorAll('.metric-districts-piece')],gray=Math.round(Number(next.underfunded_percent)*dots.length);
 dots.forEach(dot=>{if(!dot.dataset.baseFill)dot.dataset.baseFill=dot.getAttribute('fill');});
 const ordered=[...dots].sort((a,b)=>(a.dataset.baseFill==='#ff9686')-(b.dataset.baseFill==='#ff9686')||Number(a.getAttribute('cx'))-Number(b.getAttribute('cx'))||Number(a.getAttribute('cy'))-Number(b.getAttribute('cy')));
 ordered.forEach((dot,i)=>dot.setAttribute('fill',i<gray?'#d9d9d9':'#ff9686'));
 if(!changed.length)return changed;
 const priceChanged=changed.includes('kit_price'),emailChanged=changed.some(k=>k==='email'||k==='chapter_email');
 const copyText=value=>{
  let text=String(value);
  for(const key of ['email','chapter_email'])for(const before of new Set([original[key],previous[key]]))if(before&&before!==next[key])text=text.split(before).join(next[key]);
  return text.replace(/\$5(?![\d,.])/g,dollarText(next.kit_price));
 };
 doc.querySelectorAll('[data-content]').forEach(element=>{
  const key=element.dataset.content;if(!(key in next))return;
  const raw=String(next[key]),usesPrice=priceChanged&&/\$5(?![\d,.])/.test(raw),usesEmail=emailChanged&&['email','chapter_email'].some(k=>[previous[k],original[k]].some(address=>address&&raw.includes(address)));
  if(!changed.includes(key)&&!usesPrice&&!usesEmail)return;
  const text=copyText(next[key]);
  if(/^quote_\d+_text$/.test(key))element.textContent='“'+text+'”';else setCopy(doc,element,text);
 });
 for(const key of ['email','chapter_email'])if(changed.includes(key)){
  doc.querySelectorAll('a[href]').forEach(link=>{if(link.getAttribute('href')==='mailto:'+previous[key]){link.href='mailto:'+next[key];if(link.textContent.trim()===previous[key])link.textContent=next[key];}});
  doc.querySelectorAll('[data-copy-email]').forEach(button=>{if(button.dataset.copyEmail===previous[key]){button.dataset.copyEmail=next[key];button.setAttribute('aria-label','Copy '+next[key]);delete button.dataset.copied;}});
 }
 if(changed.includes('address'))doc.querySelectorAll('.footer-legal p').forEach(p=>{if(p.textContent.trim()===previous.address)p.textContent=next.address;});
 for(const key of ['donation_url','chapter_application','facebook','instagram','linkedin','budget_source_url'])if(changed.includes(key)){
  doc.querySelectorAll('a[href],form[action],[data-donation-url]').forEach(element=>{
   for(const attr of ['href','action','data-donation-url'])if(element.hasAttribute(attr)){const value=element.getAttribute(attr),updated=changedUrl(value,previous[key],next[key]);if(updated!==value)element.setAttribute(attr,updated);}
  });
 }
 if(changed.includes('kits')){
  doc.querySelectorAll('[data-site-number="kits"]').forEach(element=>{element.textContent=numberText(next.kits);if(element.hasAttribute('data-count'))element.dataset.count=String(next.kits);});
  doc.querySelector('.hero-ticker')?.setAttribute('aria-label',numberText(next.kits)+' school supply kits distributed');
 }
 for(const [art,key,prefix,suffix] of [['people','kits','',''],['districts','underfunded_percent','','%'],['budget','budget_gap_millions','$','M']]){
  const label=doc.querySelector('[data-content="metric_'+art+'_label"]'),card=label?.closest('.metric'),value=card?.querySelector('[data-metric-count]');if(!value)continue;
  const target=art==='districts'?Number((Number(next[key])*100).toFixed(2)):Number(next[key]);
  if(changed.includes(key)){value.dataset.metricCount=String(target);value.textContent=prefix+numberText(target)+suffix;}
  card.setAttribute('aria-label',prefix+numberText(target)+suffix+' '+label.textContent+'. Read about our reporting.');
 }
 if(priceChanged){
  doc.body.dataset.kitPrice=String(next.kit_price);
  doc.querySelectorAll('[data-site-price]').forEach(element=>element.textContent=dollarText(next.kit_price));
  doc.querySelectorAll('.donation-picker,.gift-builder').forEach(container=>{
   const buttons=[...container.querySelectorAll('.amount-choice,[data-gift-amount]')];
   buttons.forEach((button,i)=>{
    const attr=button.hasAttribute('data-amount')?'data-amount':'data-gift-amount',amount=i===0?Number(next.kit_price):Number(button.getAttribute(attr)),count=Math.floor(Math.round(amount*100)/(Number(next.kit_price)*100));
    button.setAttribute(attr,String(amount));button.querySelector('strong').textContent=dollarText(amount);
    const label=button.querySelector('small,span');if(label)label.textContent=count?(count===1?'One kit':numberText(count)+' kits'):'Part of a kit';
   });
   container.querySelectorAll('.gift-link').forEach((link,i)=>{
    const url=new URL(link.href),amount=i===0?Number(next.kit_price):Number(url.searchParams.get('amount')),count=Math.floor(amount/Number(next.kit_price));url.searchParams.set('amount',String(amount));link.href=url.href;
    link.querySelector('strong').textContent=dollarText(amount);link.querySelector('span').textContent=count?(count===1?'One kit':numberText(count)+' kits'):'Part of a kit';
   });
  });
 }
 doc.querySelectorAll('script[data-faq-schema]').forEach(script=>{
  const prefix=script.dataset.faqSchema,mainEntity=[];
  for(let i=1;next[prefix+'_'+i+'_question'];i++)mainEntity.push({'@type':'Question',name:copyText(next[prefix+'_'+i+'_question']),acceptedAnswer:{'@type':'Answer',text:copyText(next[prefix+'_'+i+'_answer'])}});
  script.textContent=JSON.stringify({'@context':'https://schema.org','@type':'FAQPage',mainEntity});
 });
 doc.querySelectorAll('script[type="application/ld+json"]:not([data-faq-schema])').forEach(script=>{
  try{const schema=JSON.parse(script.textContent);if(schema['@type']==='NGO'){schema.email=next.email;schema.sameAs=[next.facebook,next.instagram,next.linkedin];script.textContent=JSON.stringify(schema);}}catch{/* Leave unrelated schemas alone. */}
 });
 doc.dispatchEvent(new doc.defaultView.CustomEvent('site-content-updated',{detail:{changed,values:next}}));
 return changed;
}

export function startLiveContent(doc,config,fetcher=fetch){
 const {readValues}=createContentReader(config.fields);let current={...config.initialValues},pending=false,timer,stopped=false;
 const schedule=()=>{clearTimeout(timer);if(!stopped&&!doc.hidden)timer=setTimeout(refresh,30000);};
 async function refresh(){
  if(stopped||pending||doc.hidden)return;
  pending=true;clearTimeout(timer);
  try{
   const url=new URL(config.feedUrl);url.searchParams.set('_refresh',String(Math.floor(Date.now()/30000)));
   const response=await fetcher(url.href,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('Spreadsheet unavailable');
   const next=readValues(await response.text(),current);
   applyLiveContent(doc,current,next,config.original);current=next;
   doc.documentElement.dataset.contentSync='live';doc.documentElement.dataset.contentUpdatedAt=new Date().toISOString();
  }catch{doc.documentElement.dataset.contentSync='unavailable';/* Keep the existing page and retry; never replace it with defaults. */}
  finally{pending=false;schedule();}
 }
 const visibility=()=>{if(doc.hidden)clearTimeout(timer);else refresh();};
 doc.addEventListener('visibilitychange',visibility);
 const pageshow=event=>{if(event.persisted)refresh();};doc.defaultView.addEventListener('pageshow',pageshow);
 applyLiveContent(doc,current,current,config.original);refresh();
 return {refresh,stop(){stopped=true;clearTimeout(timer);doc.removeEventListener('visibilitychange',visibility);doc.defaultView.removeEventListener('pageshow',pageshow);}};
}

if(typeof document!=='undefined'){
 const boot=()=>{const state=document.querySelector('#site-content-state');if(state)startLiveContent(document,JSON.parse(state.textContent));};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
}
