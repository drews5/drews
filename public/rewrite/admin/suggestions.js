export const suggestionRecipient='drewscheid05@gmail.com';
const text=(node,selector)=>node.querySelector(selector).value.trim();
export function buildSuggestionPayload(form,context,images=[]){
 const pages=[...form.querySelectorAll('[data-suggest-page]:checked')].map(input=>input.value);
 if(!pages.length)throw Error('Choose at least one page, or select the whole website.');
 const changes=[...form.querySelectorAll('[data-suggest-change]')].map((row,index)=>{
  const location=text(row,'[data-change-location]'),details=text(row,'[data-change-details]');
  if(!location||!details)throw Error('Add a location and requested change for each item.');
  const replacement=text(row,'[data-change-replacement]');
  return 'Change '+(index+1)+'\nLocation: '+location+'\nType: '+text(row,'[data-change-type]')+'\nRequested change: '+details+(replacement?'\nReplacement wording / links: '+replacement:'');
 });
 if(!changes.length||changes.length>8)throw Error('Include between one and eight changes.');
 const links=text(form,'#suggest-links').split('\n').map(s=>s.trim()).filter(Boolean);
 for(const link of links){let url;try{url=new URL(link);}catch{throw Error('Use full HTTPS links for reference materials.');}if(url.protocol!=='https:'||url.username||url.password)throw Error('Use full HTTPS links for reference materials.');}
 const email=text(form,'#suggest-email'),name=text(form,'#suggest-name'),summary=text(form,'#suggest-summary');
 if(!name||!summary||!/^\S+@\S+\.\S+$/.test(email))throw Error('Enter your name, email, and a short summary.');
 const timing=text(form,'#suggest-timing'),deadline=text(form,'#suggest-date');
 if(timing==='Before a date'&&!deadline)throw Error('Choose the date this change is needed.');
 return {
  _subject:'Re-Write It website edit: '+summary.replace(/[\r\n]/g,' ').slice(0,120),
  _replyto:email,_template:'table',_captcha:'false',_honey:text(form,'[name=_honey]'),_url:'https://drews.click/rewrite/admin/',
  name,email,'Team / role':text(form,'#suggest-role')||'Not specified',Summary:summary,Pages:pages.join('\n'),
  'Requested changes':changes.join('\n\n'),Devices:text(form,'#suggest-device'),Timing:timing,
  'Needed by':timing==='Before a date'?deadline:'Not specified',
  'Reference links':links.join('\n')||'None','Reference images':images.join('\n')||'None',
  'Additional context':text(form,'#suggest-context')||'None',
  'Sent from':context.route?'https://drews.click/rewrite'+(context.route==='/'?'/':context.route+'/'):'Editor dashboard'
 };
}
export function suggestionResult(response,result){
 if(/activat|confirm.*email|email.*confirm/i.test(result.message||''))return 'activation';
 if(!response.ok||!(result.success===true||result.success==='true'))throw Error('Your request could not be confirmed. Your details are still here; please try again.');
 return 'sent';
}
export function initializeSuggestions({doc=document,fetcher=fetch,getContext,uploadPhoto}){
 const dialog=doc.querySelector('#suggestion-dialog'),form=doc.querySelector('#suggestion-form'),fields=doc.querySelector('#suggestion-fields'),success=doc.querySelector('#suggestion-success'),status=doc.querySelector('#suggestion-status'),send=doc.querySelector('#suggest-send'),changes=doc.querySelector('#suggestion-changes'),add=doc.querySelector('#suggest-add-change'),files=doc.querySelector('#suggest-images');
 let pagesLoaded=false,busy=false,started=false,opener=null;const uploadedImages=new WeakMap();
 const message=value=>{status.textContent=value;};
 function addChange(){
  if(changes.children.length>=8)return;
  const row=doc.querySelector('#suggest-change-template').content.cloneNode(true);changes.append(row);numberChanges();
 }
 function numberChanges(){
  [...changes.children].forEach((row,index)=>{row.querySelector('legend').textContent='Change '+(index+1);row.querySelector('[data-remove-change]').hidden=changes.children.length===1;row.querySelector('[data-remove-change]').setAttribute('aria-label','Remove change '+(index+1));});add.disabled=changes.children.length>=8;
 }
 function populatePages(pages){
  const target=doc.querySelector('#suggest-pages');target.replaceChildren();
  for(const page of [{route:'site-wide',title:'Whole website / shared content'},...pages]){
   const label=doc.createElement('label'),input=doc.createElement('input'),span=doc.createElement('span');input.type='checkbox';input.dataset.suggestPage='';input.value=page.route==='site-wide'?page.title:page.title+' — /rewrite'+(page.route==='/'?'/':page.route+'/');input.dataset.route=page.route;span.textContent=page.title;label.append(input,span);target.append(label);
  }pagesLoaded=true;
 }
 async function loadPages(){
  if(pagesLoaded)return;
  try{const response=await fetcher('/rewrite/admin-pages.json',{cache:'no-store'});if(!response.ok)throw Error();populatePages(await response.json());}
  catch{populatePages([{route:'/',title:'Home'},{route:'/about',title:'About'},{route:'/impact',title:'Impact'},{route:'/give',title:'Ways to give'},{route:'/chapters',title:'Chapters'},{route:'/team',title:'Team'},{route:'/contact',title:'Contact'}]);pagesLoaded=false;}
 }
 doc.querySelector('#suggest-open').addEventListener('click',async event=>{
  opener=event.currentTarget;dialog.showModal();doc.body.classList.add('suggestion-open');
  await loadPages();
  if(!started){const context=getContext();if(context.route){const current=[...form.querySelectorAll('[data-suggest-page]')].find(input=>input.dataset.route===context.route);if(current)current.checked=true;}if(context.selection)changes.querySelector('[data-change-location]').value=context.selection;}
 });
 form.addEventListener('input',()=>{started=true;});form.addEventListener('change',()=>{started=true;});
 doc.querySelector('#suggest-close').addEventListener('click',()=>{if(!busy)dialog.close();});
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 dialog.addEventListener('close',()=>{doc.body.classList.remove('suggestion-open');opener?.focus();});
 dialog.addEventListener('click',event=>{if(event.target!==dialog||busy)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
 add.addEventListener('click',()=>{addChange();started=true;changes.lastElementChild.querySelector('[data-change-location]').focus();});
 changes.addEventListener('click',event=>{const remove=event.target.closest('[data-remove-change]');if(!remove||changes.children.length===1)return;remove.closest('[data-suggest-change]').remove();numberChanges();started=true;});
 doc.querySelector('#suggest-timing').addEventListener('change',()=>{const needed=doc.querySelector('#suggest-timing').value==='Before a date';doc.querySelector('#suggest-date-wrap').hidden=!needed;doc.querySelector('#suggest-date').required=needed;});
 files.addEventListener('change',()=>{doc.querySelector('#suggest-file-status').textContent=files.files.length?files.files.length+' image'+(files.files.length===1?'':'s')+' selected':'';});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!form.reportValidity())return;message('');
  let payload;try{payload=buildSuggestionPayload(form,getContext());if(payload._honey)throw Error('Your request could not be sent.');if(files.files.length>3)throw Error('Choose up to three reference images.');for(const file of files.files)if(file.size>20000000)throw Error('Choose reference images smaller than 20 MB each.');}catch(error){message(error.message);status.focus();return;}
  busy=true;send.disabled=true;doc.querySelector('#suggest-close').disabled=true;
  try{
   const images=[];for(const file of files.files){send.textContent='Uploading images…';if(!uploadedImages.has(file))uploadedImages.set(file,await uploadPhoto(file));images.push(uploadedImages.get(file));}
   payload['Reference images']=images.join('\n')||'None';send.textContent='Sending…';
   const response=await fetcher('https://formsubmit.co/ajax/'+suggestionRecipient,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
   const result=suggestionResult(response,await response.json());
   if(result==='activation'){message('Drew needs to confirm the FormSubmit activation email before delivery is enabled. Your details are still here.');status.focus();return;}
   fields.hidden=true;success.hidden=false;doc.querySelector('#suggest-success-heading').focus();form.reset();started=false;
  }catch(error){message(error.name==='TimeoutError'||error.name==='AbortError'?'Sending timed out. Your details are still here; please try again.':error.message==='Failed to fetch'?'Check your connection and try again. Your details are still here.':error.message);status.focus();}
  finally{busy=false;send.disabled=false;send.textContent='Send request';doc.querySelector('#suggest-close').disabled=false;}
 });
 doc.querySelector('#suggest-another').addEventListener('click',()=>{fields.hidden=false;success.hidden=true;message('');changes.replaceChildren();addChange();doc.querySelector('#suggest-file-status').textContent='';doc.querySelector('#suggest-date-wrap').hidden=true;doc.querySelector('#suggest-date').required=false;doc.querySelector('#suggest-name').focus();});
 addChange();
}
