export const suggestionRecipient='drewscheid05@gmail.com';
const text=(node,selector)=>node.querySelector(selector).value.trim();
export function buildSuggestionPayload(form,context,images=[]){
 const name=text(form,'#suggest-name'),email=text(form,'#suggest-email'),message=text(form,'#suggest-message'),page=form.querySelector('#suggest-page');
 if(!name||!/^\S+@\S+\.\S+$/.test(email))throw Error('Enter your name and email.');
 if(!message)throw Error('Describe the change you want.');
 const title=[...page.options].find(option=>option.value===page.value)?.textContent||'Whole website';
 return {
  _subject:'Re-Write It website edit: '+title,_replyto:email,_template:'table',_captcha:'false',_honey:text(form,'[name=_honey]'),_url:'https://drews.click/rewrite/admin/',
  name,email,Page:page.value==='site-wide'?title:title+' — https://drews.click/rewrite'+(page.value==='/'?'/':page.value+'/'),Message:message,
  ...(images.length?{'Images':images.join('\n')}:{}),
  ...(context.selection?{'Selected item':context.selection}:{}),
  'Sent from':context.route?'https://drews.click/rewrite'+(context.route==='/'?'/':context.route+'/'):'Editor dashboard'
 };
}
export function suggestionResult(response,result){
 if(/activat|confirm.*email|email.*confirm/i.test(result.message||''))return 'activation';
 if(!response.ok||!(result.success===true||result.success==='true'))throw Error('Couldn’t send. Please try again.');
 return 'sent';
}
export function initializeSuggestions({doc=document,fetcher=fetch,getContext,uploadPhoto}){
 const dialog=doc.querySelector('#suggestion-dialog'),form=doc.querySelector('#suggestion-form'),fields=doc.querySelector('#suggestion-fields'),success=doc.querySelector('#suggestion-success'),status=doc.querySelector('#suggestion-status'),send=doc.querySelector('#suggest-send'),files=doc.querySelector('#suggest-images'),page=doc.querySelector('#suggest-page');
 let pagesLoaded=false,busy=false,started=false,opener=null;const uploadedImages=new WeakMap();
 function selectCurrentPage(){const current=getContext().route||'site-wide';page.value=[...page.options].some(option=>option.value===current)?current:'site-wide';}
 async function loadPages(){
  if(pagesLoaded)return;
  try{const response=await fetcher('/rewrite/admin-pages.json',{cache:'no-store'});if(!response.ok)throw Error();const pages=await response.json();page.replaceChildren();for(const item of [{route:'site-wide',title:'Whole website'},...pages]){const option=doc.createElement('option');option.value=item.route;option.textContent=item.title;page.append(option);}pagesLoaded=true;}
  catch{/* Whole website remains available if the page list cannot load. */}
 }
 doc.querySelector('#suggest-open').addEventListener('click',async event=>{opener=event.currentTarget;dialog.showModal();doc.body.classList.add('suggestion-open');await loadPages();if(!started)selectCurrentPage();});
 form.addEventListener('input',()=>{started=true;});form.addEventListener('change',()=>{started=true;});
 doc.querySelector('#suggest-close').addEventListener('click',()=>{if(!busy)dialog.close();});
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 dialog.addEventListener('close',()=>{doc.body.classList.remove('suggestion-open');opener?.focus();});
 dialog.addEventListener('click',event=>{if(event.target!==dialog||busy)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
 files.addEventListener('change',()=>{doc.querySelector('#suggest-file-status').textContent=files.files.length?files.files.length+' image'+(files.files.length===1?'':'s')+' selected':'';});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!form.reportValidity())return;status.textContent='';
  let payload;try{payload=buildSuggestionPayload(form,getContext());if(payload._honey)throw Error('Couldn’t send. Please try again.');if(files.files.length>3)throw Error('Choose up to 3 images.');for(const file of files.files)if(file.size>20000000)throw Error('Each image needs to be under 20 MB.');}catch(error){status.textContent=error.message;status.focus();return;}
  busy=true;send.disabled=true;doc.querySelector('#suggest-close').disabled=true;
  try{
   const images=[];for(const file of files.files){send.textContent='Uploading…';if(!uploadedImages.has(file))uploadedImages.set(file,await uploadPhoto(file));images.push(uploadedImages.get(file));}if(images.length)payload.Images=images.join('\n');send.textContent='Sending…';
   const response=await fetcher('https://formsubmit.co/ajax/'+suggestionRecipient,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
   if(suggestionResult(response,await response.json())==='activation'){status.textContent='Drew needs to confirm the FormSubmit email first.';status.focus();return;}
   fields.hidden=true;success.hidden=false;doc.querySelector('#suggest-success-heading').focus();form.reset();started=false;
  }catch(error){status.textContent=error.name==='TimeoutError'||error.name==='AbortError'?'Sending timed out. Please try again.':error.message==='Failed to fetch'?'Check your connection and try again.':'Couldn’t send. Please try again.';status.focus();}
  finally{busy=false;send.disabled=false;send.textContent='Send to Drew';doc.querySelector('#suggest-close').disabled=false;}
 });
 doc.querySelector('#suggest-another').addEventListener('click',()=>{fields.hidden=false;success.hidden=true;status.textContent='';doc.querySelector('#suggest-file-status').textContent='';selectCurrentPage();doc.querySelector('#suggest-name').focus();});
}
