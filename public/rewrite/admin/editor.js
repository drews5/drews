import {initializeContentManager} from './content-manager.js';
import {copyDraft,sameDraft,mergeDraft,draftChanges,resetToLive} from './draft-control.js';
import {adminSourceName,managedKinds} from '../content-collections.js';
import {preparePhoto} from './photo-upload.js';
import {initializeTeamManager} from './team-manager.js';
import {initializeSuggestions} from './suggestions.js?v=suggest2';
import {applyEdits} from '../admin-runtime.js';
import {sharedFields,parseSharedValue,sharedBinding,contentState} from '../shared-content.js';
const $=s=>document.querySelector(s),empty=()=>({pages:{},shared:{},values:{}});
// Some mobile browsers block storage in embedded pages. A session can still work in memory.
const session={read(){try{return sessionStorage.getItem('rewrite-admin-session')||'';}catch{return '';}},write(value){try{value?sessionStorage.setItem('rewrite-admin-session',value):sessionStorage.removeItem('rewrite-admin-session');}catch{}}};
const parameters=new URL(location.href||location.origin+'/' + (location.search||'')).searchParams;
let sitePath='/rewrite';
const siteUrl=path=>siteOrigin+sitePath+path;
const pendingForms=new Set();
const hasUnsaved=()=>dirty||pendingForms.size>0;
function notifyParent(extra={}){if(window.parent&&window.parent!==window)window.parent.postMessage({type:'rewrite-editor',dirty:hasUnsaved(),...extra},parentOrigin);}
function protectForm(name,active){if(active)pendingForms.add(name);else pendingForms.delete(name);notifyParent();}
let parentOrigin='https://drews.click';
let api='',siteOrigin='https://drews.click',token=session.read(),content=empty(),revision=0,route='',selected=null,frame=null,history=[],future=[],dirty=false,loadedHtml='',pendingSelection='',settingsBaseline={},selectedField='',view=matchMedia('(max-width:650px)').matches?'content':'preview';
let baseDraft=empty(),saving=null,pageTitles=new Map(),pageLoad=0,reviewed=null,reviewedLive=null,reviewBusy=false,lastPublished=null;
try{lastPublished=JSON.parse(sessionStorage.getItem('rewrite-previous-live')||'null');}catch{}
const reviewStatus=message=>$('#review-status').textContent=message;
const status=(message,error=false)=>{const el=route?$('#edit-status'):$('#status');el.textContent=message;el.style.color=error?'#a13029':'';};
async function request(path,options={}){
 let r;try{r=await fetch(api+path,{...options,credentials:'omit',signal:options.signal||AbortSignal.timeout(20000),headers:{...(token&&path!=='/login'&&path!=='/published'?{Authorization:'Bearer '+token}:{}),...options.headers}});}catch{throw Error('The editor service could not be reached. Please try again.');}
 let body;try{body=await r.json();}catch{throw Error('The editor service is unavailable. Please try again.');}
 if(!r.ok){
  if(r.status===401&&path!=='/login'){
   token='';session.write('');
   if(route&&loadedHtml){
    const box=$('#reauth-dialog');$('#reauth-status').textContent='';
    if(!box.open)box.showModal();
   }else{show('login');if(hasUnsaved())$('#login-status').textContent='Sign in again to keep working on your unsaved changes.';}
  }
  const error=Error(body.error||'Request failed');error.status=r.status;throw error;
 }return body;
}
function show(id){for(const name of ['login','dashboard','editor'])$('#'+name).hidden=name!==id;$('#logout').hidden=id==='login';$('#suggestion-banner').hidden=id==='login';if(id==='login')for(const name of ['suggestion-dialog','publish-review','team-manager','content-manager','reauth-dialog'])if($('#'+name).open)$('#'+name).close();}
function checkpoint(){history.push(JSON.stringify(content));if(history.length>50)history.shift();future=[];dirty=true;notifyParent();status('Unsaved changes');}
const sharedArea=el=>!!el.closest('header,footer')&&!el.closest('main');
function scope(el){return sharedArea(el)?content.shared:(content.pages[route]||={});}
function operation(){const group=scope(selected),id=selected.dataset.adminId,key=selected.dataset.adminKey;const previous=key&&Object.entries(group).find(([,op])=>op.key===key);if(previous&&previous[0]!==id){group[id]=previous[1];delete group[previous[0]];}const op=group[id]||={tag:selected.tagName};if(key)op.key=key;return op;}
function validUrl(value,image=false){const u=new URL(value,siteOrigin);if(!['https:','mailto:','tel:'].includes(u.protocol)||image&&u.protocol!=='https:')throw Error('Use an HTTPS URL'+(image?'':' or a mailto: / tel: link'));return u.href;}
function select(el){selectedField=sharedBinding(el,frame);const definition=sharedFields.find(f=>f.key===selectedField),urlBinding=definition&&['url','donorbox'].includes(definition.type);if(selected)selected.removeAttribute('contenteditable');selected=el;frame.querySelectorAll('[data-editor-selected]').forEach(x=>x.removeAttribute('data-editor-selected'));el.setAttribute('data-editor-selected','');$('#fields').hidden=false;$('#selection-heading').textContent=el.tagName==='IMG'?'Edit image':el.tagName==='A'?'Edit link':'Edit text';$('#text-wrap').hidden=el.tagName==='IMG';$('#href-wrap').hidden=el.tagName!=='A';$('#image-wrap').hidden=el.tagName!=='IMG';$('#remove-image').hidden=el.tagName!=='IMG';$('#text').value=el.innerText||el.textContent;$('#href').value=el.getAttribute('href')||'';$('#alt').value=el.getAttribute('alt')||'';$('#selection-help').textContent=definition?'Shared across all pages: '+definition.label:sharedArea(el)?'Shared across all pages.':'';if(definition&&!urlBinding){$('#text-wrap').hidden=false;$('#href-wrap').hidden=true;$('#text').value=displayValue(definition,effectiveValues()[selectedField]);}if(urlBinding)$('#href').value=effectiveValues()[selectedField]||'';document.body.classList.add('inspector-open');}
function redraw(){pendingSelection=selected?.dataset.adminId||'';render();}
function parsedPage(){return new DOMParser().parseFromString(loadedHtml,'text/html');}
function render(){const html=parsedPage();html.querySelectorAll('script:not(#site-content-state),base').forEach(x=>x.remove());const base=html.createElement('base');base.setAttribute('href',siteUrl(route==='/'?'/':route+'/')); html.head.prepend(base);applyEdits(html,content,route);const style=html.createElement('style');style.textContent='[data-admin-id]:hover{outline:2px dashed #ff9686;outline-offset:3px;cursor:pointer}[data-editor-selected]{outline:3px solid #ff9686!important;outline-offset:4px}html{scroll-behavior:auto}';html.head.append(style);$('#preview').srcdoc='<!doctype html>'+html.documentElement.outerHTML;}
$('#preview').addEventListener('load',()=>{frame=$('#preview').contentDocument;renderContent();if(pendingSelection){const el=frame.querySelector('[data-admin-id="'+pendingSelection+'"]');pendingSelection='';if(el)select(el);}frame.addEventListener('submit',e=>e.preventDefault());frame.addEventListener('input',e=>{if(selected&&selected.contains(e.target)){checkpoint();operation().text=selected.innerText;$('#text').value=selected.innerText;}});frame.addEventListener('click',e=>{if(e.target.closest('summary'))return;e.preventDefault();e.stopPropagation();const collection=e.target.closest('[data-edit-collection]'),item=e.target.closest('[data-collection-item]');
 if(collection&&item){contentManager.open(collection.dataset.editCollection,item.dataset.collectionItem);return;}
 if(route==='/team'&&e.target.closest('[data-team-member]')){
  const group=e.target.closest('.leadership-grid')?'leadership':e.target.closest('.board-grid')?'board':'full';
  teamManager?.open(group,e.target.closest('[data-team-member]').dataset.teamMember);return;
 }
 const el=e.target.closest('img,h1,h2,h3,h4,p,li,a,button,label,span');if(el?.closest('svg')||!el?.dataset.adminId)return;select(el);});});
async function openPage(page){
 if(dirty&&!await saveDraft())return;
 const load=++pageLoad;route=page.route;loadedHtml='';frame=null;selected=null;pendingSelection='';
 $('#manage-team').hidden=true;$('#manage-page').hidden=true;$('#fields').hidden=true;$('#page-name').textContent=page.title;
 $('#preview').srcdoc='';document.body.classList.remove('inspector-open');show('editor');status('Loading page…');renderContent();
 try{
  const response=await fetch(siteUrl('/admin-source/')+adminSourceName(route)+'.json',{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('This page could not be loaded. Go back to All pages and try again.');
  const {html}=await response.json();if(load!==pageLoad)return;
  if(typeof html!=='string'||!html)throw Error('The page preview is unavailable.');
  loadedHtml=html;render();$('#manage-team').hidden=route!=='/team'||!loadedHtml.includes('data-team-member=');
  $('#manage-page').hidden=!managedKinds(parsedPage()).length;setView(view);status('');
 }catch(error){if(load===pageLoad)status(error.message,true);}
}
async function dashboard(){
 const keepWorking=dirty,previousRevision=revision;
 const [data,pagesResponse]=await Promise.all([request('/draft'),fetch(siteUrl('/admin-pages.json'),{cache:'no-store',signal:AbortSignal.timeout(12000)})]);
 if(!pagesResponse.ok)throw Error('Could not load the page list. Try again.');
 const pages=await pagesResponse.json();
 if(!keepWorking){
  content=data.document;content.values||={};baseDraft=copyDraft(content);revision=data.revision;
  if(previousRevision!==data.revision){history=[];future=[];}
 }
 pageLoad++;frame=null;selected=null;loadedHtml='';pendingSelection='';route='';show('dashboard');notifyParent();
 pageTitles=new Map(pages.map(page=>[page.route,page.title]));$('#pages').replaceChildren();
 for(const page of pages){
  const button=document.createElement('button');button.className='page-card';
  const art=document.createElement('div');art.className='page-art';const thumbnail=document.createElement('iframe');
  thumbnail.src=siteUrl(page.route==='/'?'/':page.route+'/');thumbnail.setAttribute('sandbox','');thumbnail.loading='lazy';thumbnail.tabIndex=-1;thumbnail.title=page.title+' preview';thumbnail.setAttribute('aria-hidden','true');art.append(thumbnail);
  const title=document.createElement('strong');title.textContent=page.title;const path=document.createElement('small');path.textContent=sitePath+(page.route==='/'?'/':page.route+'/');
  button.append(art,title,path);button.onclick=()=>openPage(page);$('#pages').append(button);
 }
 try{const settingsHtml=await (await fetch(siteUrl('/?editor-settings=1'),{cache:'no-store',signal:AbortSignal.timeout(10000)})).text();settingsBaseline=contentState(new DOMParser().parseFromString(settingsHtml,'text/html')).initialValues||{};}catch{}
 renderSettings();status(dirty?'Unsaved changes':'');document.body.classList.remove('inspector-open');
}
$('#login-form').onsubmit=async e=>{e.preventDefault();if(!api)return;const b=e.submitter||$('#login-form button');b.disabled=true;try{const data=await request('/login',{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({password:$('#password').value})});token=data.token;session.write(token);$('#password').value='';await dashboard();}catch(error){$('#login-status').textContent=dirty?'Sign in again. Your unsaved changes are still open. '+error.message:error.message;}finally{b.disabled=false;}};
$('#logout').onclick=async()=>{
 if(saving||reviewBusy)return;
 if(hasUnsaved()&&!confirm('Sign out and discard unsaved changes?'))return;
 try{await request('/logout',{method:'POST'});}catch{}
 token='';session.write('');content=empty();baseDraft=empty();revision=0;history=[];future=[];dirty=false;pendingForms.clear();lastPublished=null;
 try{sessionStorage.removeItem('rewrite-previous-live');}catch{}notifyParent();$('#login-status').textContent='';show('login');
};
$('#back').onclick=async()=>{if(dirty&&!await saveDraft())return;try{await dashboard();}catch(error){status(error.message,true);}};
$('#text').oninput=()=>{if(!selected)return;const field=sharedFields.find(f=>f.key===selectedField);if(field&&!['url','donorbox'].includes(field.type)){try{setShared(field,$('#text').value);status('Unsaved changes');}catch(e){status(e.message,true);}return;}checkpoint();operation().text=$('#text').value;selected.textContent=$('#text').value;selected.style.whiteSpace='pre-line';};
$('#href').onchange=()=>{try{const field=sharedFields.find(f=>f.key===selectedField);if(field&&['url','donorbox'].includes(field.type)){setShared(field,$('#href').value);return;}checkpoint();operation().href=validUrl($('#href').value);selected.href=operation().href;}catch(e){status(e.message,true);}};
$('#alt').oninput=()=>{checkpoint();operation().alt=$('#alt').value;selected.alt=$('#alt').value;};
$('#revert').onclick=()=>{checkpoint();for(const [id,op] of Object.entries(scope(selected)))if(id===selected.dataset.adminId||selected.dataset.adminKey&&op.key===selected.dataset.adminKey)delete scope(selected)[id];if(selectedField)delete content.values[selectedField];renderSettings();redraw();};
$('#remove-image').onclick=()=>{checkpoint();operation().hidden=true;redraw();};
function travel(from,to,message){
 if(!from.length||saving)return;
 to.push(JSON.stringify(content));content=JSON.parse(from.pop());dirty=true;notifyParent();
 if(route&&loadedHtml)redraw();renderSettings();status(message);
}
$('#undo').onclick=$('#undo-dashboard').onclick=()=>travel(history,future,'Undone. Save draft to keep this change.');
$('#redo').onclick=$('#redo-dashboard').onclick=()=>travel(future,history,'Redone. Save draft to keep this change.');
async function upload(file){
 if(!file)return null;
 const blob=await preparePhoto(file);
 return (await request('/upload',{method:'POST',headers:{'Content-Type':blob.type},body:blob})).src;
}
for(const id of ['replace','add'])$('#'+id).onchange=async()=>{const input=$('#'+id),target=selected;input.disabled=true;try{status('Optimizing and uploading photo…');const src=await upload(input.files[0]);if(!src){status('');return;}if(selected!==target)throw Error('Select the original element before adding this photo');checkpoint();if(id==='replace'){operation().src=src;operation().alt=$('#alt').value;}else{(operation().additions||=[]).push({src,alt:prompt('Describe this image for visitors using a screen reader:')||''});}redraw();status('Image added. Unsaved changes.');}catch(e){status(e.message,true);}finally{input.disabled=false;input.value='';}};
function saveDraft(){
 if(saving)return saving;
 saving=writeDraft().finally(()=>{saving=null;});
 return saving;
}
async function writeDraft(){
 const buttons=[$('#save'),$('#save-settings'),$('#save-dashboard'),$('#back')];
 const workspace=document.querySelector('.workspace'),initial=copyDraft(content);
 const put=(document,revision)=>request('/draft',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':String(revision)},body:JSON.stringify(document)});
 buttons.forEach(button=>button.disabled=true);workspace.inert=true;
 try{
  let payload=initial,ack;
  try{ack=await put(payload,revision);}catch(error){
   if(error.status!==409)throw error;
   const remote=await request('/draft'),merged=mergeDraft(baseDraft,initial,remote.document);
   if(merged.conflicts.length)throw Error('Someone edited the same content. Your changes are still here. Use Review changes → Recovery options to load the saved draft when you’re ready.');
   payload=merged.document;
   ack=await put(payload,remote.revision);
   history=[];future=[];
  }
  const saved=ack.document||payload;
  if(sameDraft(content,initial)){content=copyDraft(saved);dirty=false;}
  else{
   const pending=mergeDraft(initial,content,saved);
   if(!pending.conflicts.length)content=pending.document;
   dirty=true;
  }
  baseDraft=copyDraft(saved);revision=ack.revision;notifyParent();
  if(!sameDraft(initial,saved)&&route&&loadedHtml)redraw();
  status(dirty?'Draft saved. Newer changes still need saving.':'Draft saved.');return true;
 }catch(error){status(error.message,true);return false;}
 finally{buttons.forEach(button=>button.disabled=false);workspace.inert=false;}
}
$('#save').onclick=saveDraft;$('#save-settings').onclick=saveDraft;$('#save-dashboard').onclick=saveDraft;

function reviewButtons(disabled){
 for(const name of ['review-close','review-publish','load-server-draft','reset-live-page','reset-live-all','restore-last-publish'])$('#'+name).disabled=disabled;
}
async function loadReview(){
 reviewed=null;reviewedLive=null;$('#review-areas').replaceChildren();
 reviewBusy=true;reviewButtons(true);reviewStatus('Checking what’s live…');
 try{
  const live=await request('/published');
  if(!live.document||!Number.isInteger(live.revision))throw Error('Could not read the live site. Try again.');
  reviewed=copyDraft(content);reviewedLive=live;
  const changes=draftChanges(reviewed,live.document);
  const list=$('#review-areas');
  for(const change of changes){
   const row=document.createElement('li'),label=document.createElement('strong'),detail=document.createElement('small');
   label.textContent=change.route===null?'Whole website':pageTitles.get(change.route)||(change.route==='/'?'Home':change.route);
   detail.textContent=change.details.join(', ');row.append(label,detail);list.append(row);
  }
  $('#reset-live-page').hidden=!route||!changes.some(change=>change.route===route);
  reviewStatus(changes.length?'These changes will appear on the public site.':'The draft matches what’s live. There’s nothing to publish.');
  reviewButtons(false);$('#review-publish').disabled=!changes.length;$('#reset-live-all').disabled=!changes.length;
 }catch(error){reviewButtons(false);$('#review-publish').disabled=true;$('#reset-live-all').disabled=true;$('#reset-live-page').hidden=true;reviewStatus(error.message);}
 finally{reviewBusy=false;}
}
async function openReview(){
 if(saving||reviewBusy)return;
 $('#restore-last-publish').hidden=!lastPublished;
 const dialog=$('#publish-review');if(!dialog.open)dialog.showModal();
 await loadReview();
}
$('#publish').onclick=openReview;$('#publish-page').onclick=openReview;
$('#review-close').onclick=()=>{if(!reviewBusy)$('#publish-review').close();};
$('#publish-review').addEventListener('cancel',event=>{if(reviewBusy)event.preventDefault();});
$('#review-publish').onclick=async()=>{
 if(reviewBusy||!reviewed||!reviewedLive||$('#review-publish').disabled)return;
 if(!sameDraft(reviewed,content)){await loadReview();return;}
 reviewBusy=true;reviewButtons(true);reviewStatus('Publishing…');
 try{
  const live=await request('/published');
  if(live.revision!==reviewedLive.revision){await loadReview();reviewStatus('The live site changed. Review the new list before publishing.');return;}
  if(dirty&&!await saveDraft())throw Error((route?$('#edit-status'):$('#status')).textContent||'Could not save the draft.');
  if(dirty||!sameDraft(reviewed,content)){await loadReview();reviewStatus('The saved draft changed. Review it again before publishing.');return;}
  await request('/publish',{method:'POST',headers:{'If-Match':String(revision)}});
  lastPublished=live.document;
  try{sessionStorage.setItem('rewrite-previous-live',JSON.stringify(lastPublished));}catch{}
  $('#publish-review').close();status('Published. Open the public page to see your changes.');notifyParent({published:true});
 }catch(error){reviewButtons(false);reviewStatus(error.status===409?'The saved draft changed in another editor. Load the saved draft from Recovery options, then review again.':error.message);}
 finally{reviewBusy=false;}
};
function showRecovery(next,message){
 checkpoint();content=copyDraft(next);content.values||={};$('#publish-review').close();
 if(route&&loadedHtml){selected=null;pendingSelection='';$('#fields').hidden=true;document.body.classList.remove('inspector-open');render();}
 renderSettings();status(message);
}
$('#reset-live-page').onclick=()=>{
 if(reviewBusy||!reviewedLive||!route||!confirm('Replace the draft edits for this page with what’s live? Other pages and shared settings will stay as they are.'))return;
 showRecovery(resetToLive(content,reviewedLive.document,route),'This page matches the live site. Save draft to keep the reset.');
};
$('#reset-live-all').onclick=()=>{
 if(reviewBusy||!reviewedLive||!confirm('Replace the whole working draft with what’s live?'))return;
 showRecovery(resetToLive(content,reviewedLive.document),'The working draft matches the live site. Save draft to keep the reset.');
};
$('#restore-last-publish').onclick=()=>{
 if(reviewBusy||!lastPublished||!confirm('Put the previous live version into the draft? The public site won’t change until you publish.'))return;
 showRecovery(lastPublished,'The previous live version is now your draft. Review changes to put it back on the site.');
};
$('#load-server-draft').onclick=async()=>{
 if(reviewBusy||!confirm('Load the saved draft? You can use Undo to recover the working copy you have open.'))return;
 reviewBusy=true;reviewButtons(true);reviewStatus('Loading the saved draft…');
 try{
  const saved=await request('/draft');baseDraft=copyDraft(saved.document);revision=saved.revision;
  showRecovery(saved.document,'Saved draft loaded. Use Undo to recover your previous working copy.');dirty=false;notifyParent();
 }catch(error){reviewButtons(false);$('#review-publish').disabled=true;reviewStatus(error.message);}
 finally{reviewBusy=false;}
};
for(const id of ['desktop','mobile'])$('#'+id).onclick=()=>{$('#canvas').classList.toggle('mobile',id==='mobile');$('#desktop').setAttribute('aria-pressed',String(id==='desktop'));$('#mobile').setAttribute('aria-pressed',String(id==='mobile'));};
window.addEventListener('beforeunload',e=>{if(hasUnsaved()){e.preventDefault();e.returnValue='';}});
try{const config=await (await fetch('/rewrite/admin-config.json',{cache:'no-store'})).json();api=config.apiBase;siteOrigin=config.siteOrigin||siteOrigin;if(parameters.get('site')==='production'){siteOrigin='https://www.therewriteitproject.org';sitePath='';}
 parentOrigin=[siteOrigin,'https://therewriteitproject.org','https://www.drews.click'].includes(parameters.get('parent'))?parameters.get('parent'):siteOrigin;
 const home=document.querySelector('header a');home.href=siteUrl('/');if(parameters.get('embedded')==='1'){document.body.classList.add('embedded-editor');home.removeAttribute('href');}
 notifyParent();if(api&&location.origin!==new URL(api).origin){location.replace(siteUrl('/?edit=1'));}else if(!api){$('#login-form').hidden=true;$('#login-status').textContent='The editor is built, but its private admin service is not connected yet. Site editing will be available after the hosting setup is completed.';}else if(token)await dashboard();}catch(error){$('#login-status').textContent=error.message;}

function setView(next){view=next;$('#content-list').hidden=view!=='content';$('#canvas').hidden=view==='content';$('#content-view').setAttribute('aria-pressed',String(view==='content'));$('#preview-view').setAttribute('aria-pressed',String(view==='preview'));if(view==='content'&&frame)renderContent();}
function renderContent(){
 const target=$('#content-items'),query=$('#content-search').value.toLowerCase();
 const open=new Set([...target.querySelectorAll('details[open]')].map(el=>el.dataset.area));target.replaceChildren();if(!frame)return;
 let count=0;
 for(const [selector,title,area] of [['main','Page content','main'],['body > header','Header','header'],['body > footer','Footer','footer']]){
  const group=document.createElement(selector==='main'?'div':'details');group.className='content-group';group.dataset.area=area;
  if(selector!=='main'){const summary=document.createElement('summary');summary.textContent=title;group.append(summary);group.open=!!query||open.has(area);}
  const list=document.createElement('div');list.className='content-group-items';group.append(list);
  for(const el of frame.querySelectorAll(selector+' [data-admin-id]')){
   const image=el.tagName==='IMG';if(!image&&!['H1','H2','H3','H4','P','LI','A','BUTTON','LABEL','SPAN','STRONG','SMALL'].includes(el.tagName))continue;
   if(el.closest('svg,script,style,[data-edit-collection]')||route==='/team'&&el.closest('[data-team-member]'))continue;const text=(el.innerText||el.textContent||'').trim();
   if(!image&&(!text||el.querySelector('h1,h2,h3,h4,p,li,a,button,label')))continue;
   const label=image?(el.alt||'Image'):text;if(query&&!label.toLowerCase().includes(query))continue;
   const button=document.createElement('button');button.type='button';button.className='content-item';
   if(image){const thumbnail=document.createElement('img');thumbnail.src=el.currentSrc||el.src;thumbnail.alt='';thumbnail.loading='lazy';button.append(thumbnail);}
   const labelElement=document.createElement('span');labelElement.textContent=label;const type=document.createElement('small');type.textContent=image?'Image':el.tagName==='A'?'Link':'Text';button.append(labelElement,type);button.addEventListener('click',()=>select(el));list.append(button);count++;
  }
  if(list.children.length)target.append(group);
 }
 if(!count){const p=document.createElement('p');p.textContent='No matching content';target.append(p);}
}
function effectiveValues(){return {...settingsBaseline,...(frame?contentState(frame).initialValues:{}),...content.values};}
function displayValue(field,value){return field.type==='percent'?Number((Number(value)*100).toFixed(4)):value??'';}
function setShared(field,raw){
 if(field.type==='percent'&&String(raw).trim()==='')throw Error('Enter a percentage');
 const value=parseSharedValue(field.key,field.type==='percent'?Number(raw)/100:raw);
 checkpoint();content.values||={};content.values[field.key]=value;
 if(frame)applyEdits(frame,content,route,{managed:false});renderSettings();
}
function renderSettings(){
 const target=$('#shared-fields'),expanded=new Set([...target.querySelectorAll('details[open]')].map(el=>el.dataset.section));target.replaceChildren();const values=effectiveValues();
 for(const section of [...new Set(sharedFields.map(f=>f.section))]){
  const group=document.createElement('details');group.dataset.section=section;group.open=expanded.has(section);const summary=document.createElement('summary');summary.textContent=section;group.append(summary);
  for(const field of sharedFields.filter(f=>f.section===section)){
   const row=document.createElement('div');row.className='setting-row';const label=document.createElement('label');label.textContent=field.label;
   const input=document.createElement('input');input.dataset.sharedField=field.key;input.value=displayValue(field,values[field.key]);input.type=['integer','number','currency','percent'].includes(field.type)?'number':field.type==='email'?'email':['url','donorbox'].includes(field.type)?'url':'text';
   if(input.type==='number'){input.min=field.type==='currency'?'0.01':'0';input.step=field.type==='integer'?'1':'any';if(field.type==='percent')input.max='100';}
   label.append(input);row.append(label);
   input.onchange=()=>{try{setShared(field,input.value);status('Unsaved changes');}catch(e){input.value=displayValue(field,values[field.key]);status(e.message,true);}};
   if(Object.hasOwn(content.values||{},field.key)){const reset=document.createElement('button');reset.type='button';reset.textContent='Use spreadsheet';reset.onclick=()=>{checkpoint();delete content.values[field.key];if(frame)applyEdits(frame,content,route,{managed:false});renderSettings();};row.append(reset);}
   group.append(row);
  }target.append(group);
 }
}
$('#content-view').onclick=()=>setView('content');$('#preview-view').onclick=()=>setView('preview');$('#content-search').oninput=renderContent;$('#close-inspector').onclick=()=>{document.body.classList.remove('inspector-open');if(frame)renderContent();};

const currentPage=(overrides=content)=>{if(!route||!loadedHtml)return null;const page=parsedPage();applyEdits(page,overrides,route);return page;};
const refreshPage=()=>{selected=null;pendingSelection='';$('#fields').hidden=true;document.body.classList.remove('inspector-open');if(loadedHtml)render();};
const contentManager=initializeContentManager({
 pending:active=>protectForm('content',active),
 getPage:()=>currentPage(),getDefaults:()=>currentPage({...content,collections:{}}),
 getContent:kind=>content.collections?.[route]?.[kind],
 setContent:(kind,value)=>{
  checkpoint();
  if(value===undefined){delete content.collections?.[route]?.[kind];if(content.collections?.[route]&&!Object.keys(content.collections[route]).length)delete content.collections[route];}
  else{content.collections||={};(content.collections[route]||={})[kind]=value;}
 },
 refresh:refreshPage,uploadPhoto:upload,message:status,getTitle:()=>$('#page-name').textContent,
});

const teamManager=initializeTeamManager({pending:active=>protectForm('team',active),getPage:()=>route==='/team'?currentPage():null,
 getRoster:()=>content.teamRoster,setRoster:roster=>{checkpoint();content.teamRoster=roster;},
 refresh:refreshPage,uploadPhoto:upload,message:status});

$('#reauth-close').onclick=()=>$('#reauth-dialog').close();
$('#reauth-form').onsubmit=async event=>{
 event.preventDefault();const button=$('#reauth-form button');button.disabled=true;$('#reauth-status').textContent='';
 try{
  const data=await request('/login',{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({password:$('#reauth-password').value})});
  token=data.token;session.write(token);$('#reauth-password').value='';$('#reauth-dialog').close();status('Signed in. Retry the last action.');
 }catch(error){$('#reauth-status').textContent=error.message;}
 finally{button.disabled=false;}
};
initializeSuggestions({getContext:()=>({route,selection:selected?((selected.closest('section')?.querySelector('h2')?.textContent||'')+' '+(selected.alt||selected.textContent||'')).trim().slice(0,200):''}),uploadPhoto:upload});
