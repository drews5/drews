(() => {
 const script=document.currentScript;
 if(!script)return;
 const base=new URL('./',script.src);
 let app=script.dataset.app,css=script.dataset.css,latest=null,busy=false,lastInteraction=Date.now();
 const note=()=>{lastInteraction=Date.now()};
 ['pointerdown','touchstart','keydown','input'].forEach(type=>document.addEventListener(type,note,{passive:true,capture:true}));
 const versionUrl=new URL('version.json',base);
 const blocked=()=>document.hidden||Date.now()-lastInteraction<15000||
  !!document.querySelector('#player video:not([src=""])[src]')&&!!document.getElementById('player')?.getClientRects().length||
  [...document.querySelectorAll('video')].some(v=>!v.paused&&!v.ended)||
  document.activeElement?.matches('input,textarea,select,[contenteditable=true]')||
  [...document.querySelectorAll('input[type=password],input[type=email],textarea')].some(e=>e.value&&e.getClientRects().length);
 async function check(){
  if(busy||document.hidden)return;busy=true;
  try{
   const url=new URL(versionUrl);url.searchParams.set('_',Date.now());
   const response=await fetch(url,{cache:'no-store'});if(!response.ok)return;
   const next=await response.json();if(!/^[a-f0-9]{16}$/.test(next.app)||!/^[a-f0-9]{16}$/.test(next.css))return;
   latest=next;
   if(next.css!==css){
    const old=document.querySelector('link[href*="assets/cinema.css"]');
    if(old){
     const link=document.createElement('link');link.rel='stylesheet';
     link.href=new URL('assets/cinema.css?v='+next.css,base);
     await new Promise((resolve,reject)=>{link.onload=()=>{old.remove();css=next.css;resolve()};link.onerror=()=>{link.remove();reject(Error('CSS update failed'))};old.after(link)});
    }
   }
   if(latest.app!==app&&!blocked()){
    const page=new URL(location.href);page.searchParams.set('cv',latest.app);location.replace(page.href);
   }
  }catch{}finally{busy=false}
 }
 // Local previews poll quickly; production polls every 10s.
 setInterval(check,/^(localhost|127\.0\.0\.1)$/.test(location.hostname)?1000:10000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check()});
})();
