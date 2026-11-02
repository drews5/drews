'use strict';
// Keep delivery independent of the site's animations and other interactions.
function initializeInquiryForms(doc=document,fetcher=fetch,deadline=15000){
 for(const form of doc.querySelectorAll('[data-inquiry]')){
  const find=s=>form.querySelector(s),send=find('[type=submit]'),error=find('.form-error'),fields=find('.form-fields'),success=find('.submission-success'),fallback=find('[data-email-fallback]'),interest=find('[name=interest]');
  const topic=new URLSearchParams(location.search).get('topic');
  if(interest&&topic){const option=[...interest.options].find(o=>o.value.toLowerCase()===topic.toLowerCase());if(option)interest.value=option.value;}
  let busy=false,lastBody=null,submissionId=null;
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(busy||!form.reportValidity())return;
   error.textContent='';fallback.hidden=true;
   const data=new FormData(form);
   if(data.get('_honey')||data.get('website')){error.textContent='Your message could not be sent.';error.focus();return;}
   const payload=Object.fromEntries([...data].filter(([key])=>!key.startsWith('_')&&key!=='website'&&key!=='supplies'));
   if(data.has('supplies'))payload.supplies=data.getAll('supplies').join(', ');
   const body=JSON.stringify(payload);
   if(body!==lastBody){lastBody=body;submissionId=crypto.randomUUID();}
   payload.id=submissionId;
   const email=form.action.slice('https://formsubmit.co/'.length);
   fallback.href='mailto:'+email+'?subject='+encodeURIComponent(data.get('_subject')||'The Re-Write It Project')+'&body='+encodeURIComponent(Object.entries(payload).filter(([key])=>key!=='id').map(([key,value])=>key+': '+value).join('\n\n'));
   const label=send.textContent,controller=new AbortController();let timer;
   busy=true;send.disabled=true;send.textContent='Sending…';form.setAttribute('aria-busy','true');
   try{
    const delivery=(async()=>{
     const response=await fetcher(form.dataset.deliveryEndpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8',Accept:'application/json'},body:JSON.stringify(payload),signal:controller.signal});
     const result=await response.json();
     if(!response.ok||result?.success!==true||result?.id!==submissionId)throw Error('rejected');
     return 'received';
    })();
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(Error('timeout'));controller.abort();},deadline);});
    await Promise.race([delivery,timeout]);
    fields.hidden=true;success.hidden=false;const heading=find('.submission-success h3');heading.tabIndex=-1;heading.focus();form.reset();
   }catch(e){
    error.textContent=e.message==='timeout'||e.name==='AbortError'
     ?'Sending timed out. Delivery could not be confirmed. Your details are still here. You can retry or email your message below.'
     :'Delivery could not be confirmed. Your details are still here. You can retry or email your message below.';
    fallback.hidden=false;error.focus();
   }finally{clearTimeout(timer);busy=false;send.disabled=false;send.textContent=label;form.removeAttribute('aria-busy');}
  });
  find('.send-another')?.addEventListener('click',()=>{success.hidden=true;fields.hidden=false;error.textContent='';fallback.hidden=true;find('[name=name]').focus();});
 }
}
initializeInquiryForms();
