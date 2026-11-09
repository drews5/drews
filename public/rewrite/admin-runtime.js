import {applyLiveContent} from './content-engine.js';
import {contentState,sharedBinding} from './shared-content.js';
export function projectPublishedUrls(doc){
 const origin=doc.documentElement?.dataset.publicSiteOrigin;if(!origin)return;
 const project=value=>{
  try{
   const url=new URL(value,origin);
   if(['https://drews.click','https://www.drews.click'].includes(url.origin)&&(url.pathname==='/rewrite'||url.pathname.startsWith('/rewrite/'))){url.pathname=url.pathname.slice(8)||'/';return origin+url.pathname+url.search+url.hash;}
   if(value.startsWith('/rewrite/'))return value.slice(8);
  }catch{}
  return value;
 };
 for(const el of doc.querySelectorAll('[href],[src],[action],[poster],[srcset]')){
  for(const key of ['href','src','action','poster'])if(el.hasAttribute(key))el.setAttribute(key,project(el.getAttribute(key)));
  if(el.hasAttribute('srcset'))el.setAttribute('srcset',el.getAttribute('srcset').split(',').map(part=>part.replace(/^(\s*)(\S+)/,(all,space,value)=>space+project(value))).join(','));
 }
}
export function applyEdits(doc,document,route){
 const groupsForImages=[document.shared||{},document.pages?.[route]||{}];doc.adminImageOverrides=new Map();
 for(const group of groupsForImages)for(const [id,op] of Object.entries(group)){
  if(op.src===undefined&&op.alt===undefined)continue;
  const image=op.key?doc.querySelector('[data-admin-key="'+op.key+'"]'):doc.querySelector('[data-admin-id="'+id+'"]');
  if(image?.tagName==='IMG')doc.adminImageOverrides.set(image,{src:op.src!==undefined,alt:op.alt!==undefined});
 }
 const state=contentState(doc),base=doc.adminSheetValues||state.initialValues;
 doc.adminSharedValues=document.values||{};
 if(base){const next={...base,...doc.adminSharedValues};const previous=doc.adminEffectiveValues||state.initialValues;doc.adminEffectiveValues=next;applyLiveContent(doc,previous,next,state.original);const script=doc.querySelector('#site-content-state');if(script){state.adminValues=doc.adminSharedValues;script.textContent=JSON.stringify(state).replace(/</g,'\\u003c');}}
 const groups=[document.shared||{},document.pages?.[route]||{}];
 for(const group of groups)for(const [id,op] of Object.entries(group)){
  const stable=/^[a-f0-9]{16}$/.test(op.key||'')?doc.querySelector('[data-admin-key="'+op.key+'"]'):null;
  const el=op.key?stable:doc.querySelector('[data-admin-id="'+id+'"]');if(!el||op.tag&&op.tag!==el.tagName)continue;
  const binding=sharedBinding(el,doc),shared=binding&&Object.hasOwn(doc.adminSharedValues,binding);
  if(op.text!==undefined&&!(shared&&!['donation_url','chapter_application','facebook','instagram','linkedin','budget_source_url'].includes(binding))){el.textContent=op.text;el.style.whiteSpace='pre-line';}
  if(op.href&&el.tagName==='A'&&!shared)el.setAttribute('href',op.href);
  if(op.src&&el.tagName==='IMG'){el.setAttribute('src',op.src);el.removeAttribute('srcset');el.removeAttribute('sizes');el.style.objectFit='contain';}
  if(op.alt!==undefined&&el.tagName==='IMG')el.alt=op.alt;
  if(op.hidden)el.hidden=true;
  for(const old of doc.querySelectorAll('[data-admin-added="'+id+'"]'))old.remove();
  let after=el;for(const image of op.additions||[]){const img=doc.createElement('img');img.src=image.src;img.alt=image.alt;img.setAttribute('data-admin-added',id);img.style.cssText='display:block;max-width:100%;height:auto;margin:20px auto';after.after(img);after=img;}
 }
 projectPublishedUrls(doc);
}
// The editor stays inside the public site; private requests stay on its existing service.
export function openSiteEditor(config,{doc=document,win=window,production=!!doc.documentElement?.dataset.publicSiteOrigin,onPublished=()=>{}}={}){
 const existing=doc.querySelector('#site-editor-dialog');if(existing){existing.querySelector('iframe').focus();return existing;}
 const origin=new URL(config.apiBase).origin,src=new URL('/rewrite/admin/',origin);
 src.searchParams.set('embedded','1');src.searchParams.set('site',production?'production':'demo');src.searchParams.set('parent',win.location.origin);
 const previousFocus=doc.activeElement,dialog=doc.createElement('dialog');dialog.id='site-editor-dialog';dialog.setAttribute('aria-labelledby','site-editor-title');
 const style=doc.createElement('style');style.textContent=`
 #site-editor-dialog{box-sizing:border-box;width:min(1500px,96vw);max-width:none;height:94dvh;max-height:none;margin:auto;padding:0;border:0;border-radius:16px;background:#fffaf5;color:#103a71;box-shadow:0 16px 64px #0004;overflow:hidden}
 #site-editor-dialog::backdrop{background:rgb(10 31 58 / 65%)}
 #site-editor-dialog[open]{display:flex;flex-direction:column}
 #site-editor-dialog .site-editor-top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 20px;background:#103a71;color:white;flex:none}
 #site-editor-dialog h2{margin:0;font:20px Alice,Georgia,serif;color:inherit}
 #site-editor-dialog button{font:16px Alice,Georgia,serif;background:transparent;color:inherit;border:1px solid #ffffff80;border-radius:8px;padding:8px 14px;cursor:pointer}
 #site-editor-dialog button:focus-visible{outline:3px solid #ff9686;outline-offset:2px}
 #site-editor-dialog iframe{width:100%;min-height:0;flex:1;border:0;background:#fffaf5}
 @media(max-width:650px){#site-editor-dialog{width:100%;height:100dvh;border-radius:0}#site-editor-dialog .site-editor-top{padding:8px 14px}}
 `;
 const top=doc.createElement('div');top.className='site-editor-top';const title=doc.createElement('h2');title.id='site-editor-title';title.textContent='Website editor';
 const close=doc.createElement('button');close.type='button';close.textContent='Close editor';
 const frame=doc.createElement('iframe');frame.title='Re-Write It website editor';frame.src=src.href;
 let dirty=false;const overflow=doc.documentElement.style.overflow;
 const beforeUnload=event=>{if(dirty){event.preventDefault();event.returnValue='';}};
 const receive=event=>{if(event.origin!==origin||event.source!==frame.contentWindow||event.data?.type!=='rewrite-editor')return;if(typeof event.data.dirty==='boolean')dirty=event.data.dirty;if(event.data.published===true)onPublished();};
 const dismiss=()=>{if(dirty&&!win.confirm('Close the editor without saving your changes?'))return;dialog.close();};
 close.addEventListener('click',dismiss);dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
 dialog.addEventListener('close',()=>{win.removeEventListener('message',receive);win.removeEventListener('beforeunload',beforeUnload);doc.documentElement.style.overflow=overflow;dialog.remove();previousFocus?.focus();const url=new URL(win.location.href);if(url.searchParams.has('edit')){url.searchParams.delete('edit');win.history.replaceState(null,'',url.href);}});
 top.append(title,close);dialog.append(style,top,frame);doc.body.append(dialog);win.addEventListener('message',receive);win.addEventListener('beforeunload',beforeUnload);doc.documentElement.style.overflow='hidden';dialog.showModal();close.focus();return dialog;
}
const publicBase=typeof document!=='undefined'&&document.documentElement?.dataset.publicSiteOrigin?'':'/rewrite';
if(typeof location!=='undefined'&&!location.pathname.startsWith(publicBase+'/admin/')){
 let count=0,last=0,refresh=()=>{};
 const configPromise=fetch(publicBase+'/admin-config.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Editor configuration unavailable');return r.json();});
 const open=async()=>{try{const config=await configPromise;if(config.apiBase)openSiteEditor(config,{onPublished:()=>refresh()});}catch{window.alert('The editor could not be opened. Reload the page and try again.');}};
 document.addEventListener('click',event=>{if(!event.target.matches('.footer-city img'))return;const now=Date.now();count=now-last<2000?count+1:1;last=now;if(count===5){count=0;open();}});
 if(new URLSearchParams(location.search).get('edit')==='1')open();
 configPromise.then(async config=>{
  if(!config.apiBase)return;let content;
  const apply=()=>{if(content)applyEdits(document,content,document.body.dataset.adminRoute||'/');};
  refresh=async()=>{if(document.hidden)return;try{const response=await fetch(config.apiBase+'/published',{cache:'no-store'});if(response.ok){content=(await response.json()).document;apply();}}catch{/* Keep the existing site available when the editor service is offline. */}};
  document.addEventListener('site-content-updated',apply);document.addEventListener('visibilitychange',refresh);await refresh();setInterval(refresh,30000);
 }).catch(()=>{});
}
