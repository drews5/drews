'use strict';
// Keep delivery independent of the site's animations and other interactions.
function initializeInquiryForms(doc=document,fetcher=fetch,deadline=15000){
 for(const form of doc.querySelectorAll('[data-inquiry]')){
  const find=s=>form.querySelector(s),send=find('[type=submit]'),error=find('.form-error'),fields=find('.form-fields'),success=find('.submission-success'),direct=find('[data-direct-submit]'),interest=find('[name=interest]');
  const topic=new URLSearchParams(location.search).get('topic');
  if(interest&&topic){const option=[...interest.options].find(o=>o.value.toLowerCase()===topic.toLowerCase());if(option)interest.value=option.value;}
  let busy=false;
  form.addEventListener('submit',async event=>{
   if(event.submitter===direct)return; // Browser POST fallback; never retry automatically.
   event.preventDefault();if(busy||!form.reportValidity())return;
   error.textContent='';direct.hidden=true;
   const data=new FormData(form);
   if(data.get('_honey')||data.get('website')){error.textContent='Your message could not be sent.';error.focus();return;}
   const payload=new URLSearchParams();
   for(const [key,value] of data)if(key!=='website'&&key!=='supplies')payload.append(key,String(value));
   if(data.has('supplies'))payload.set('supplies',data.getAll('supplies').join(', '));
   payload.set('_replyto',String(data.get('email')||'').trim());
   const label=send.textContent,controller=new AbortController();let timer;
   busy=true;send.disabled=true;send.textContent='Sending…';form.setAttribute('aria-busy','true');
   try{
    // A simple form-encoded request avoids an extra cross-origin preflight.
    // The deadline also covers reading the response, even if abort is ignored.
    const delivery=(async()=>{
     const response=await fetcher(form.action.replace('https://formsubmit.co/','https://formsubmit.co/ajax/'),{method:'POST',headers:{Accept:'application/json'},body:payload,signal:controller.signal});
     const result=await response.json();
     if(/activat|confirm.*email|email.*confirm/i.test(result?.message||''))return 'activation';
     if(!response.ok||!(result?.success===true||result?.success==='true'))throw Error('rejected');
     return 'sent';
    })();
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(Error('timeout'));controller.abort();},deadline);});
    const result=await Promise.race([delivery,timeout]);
    if(result==='activation'){
     error.textContent='The team needs to confirm the FormSubmit activation email before this form can receive messages. Your details are still here.';error.focus();return;
    }
    fields.hidden=true;success.hidden=false;const heading=find('.submission-success h3');heading.tabIndex=-1;heading.focus();form.reset();
   }catch(e){
    error.textContent=e.message==='timeout'||e.name==='AbortError'
     ?'Sending timed out. Delivery could not be confirmed. Your details are still here. You can try sending directly through FormSubmit below.'
     :'Delivery could not be confirmed. Your details are still here. Try sending directly through FormSubmit below.';
    direct.hidden=false;error.focus();
   }finally{clearTimeout(timer);busy=false;send.disabled=false;send.textContent=label;form.removeAttribute('aria-busy');}
  });
  find('.send-another')?.addEventListener('click',()=>{success.hidden=true;fields.hidden=false;error.textContent='';direct.hidden=true;find('[name=name]').focus();});
 }
}
initializeInquiryForms();
