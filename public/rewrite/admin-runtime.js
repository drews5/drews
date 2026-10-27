export function applyEdits(doc,document,route){
 const groups=[document.shared||{},document.pages?.[route]||{}];
 for(const group of groups)for(const [id,op] of Object.entries(group)){
  const el=doc.querySelector('[data-admin-id="'+id+'"]');if(!el||op.tag&&op.tag!==el.tagName)continue;
  if(op.text!==undefined){el.textContent=op.text;el.style.whiteSpace='pre-line';}
  if(op.href&&el.tagName==='A')el.setAttribute('href',op.href);
  if(op.src&&el.tagName==='IMG'){el.setAttribute('src',op.src);el.removeAttribute('srcset');el.removeAttribute('sizes');el.style.objectFit='contain';}
  if(op.alt!==undefined&&el.tagName==='IMG')el.alt=op.alt;
  if(op.hidden)el.hidden=true;
  for(const old of doc.querySelectorAll('[data-admin-added="'+id+'"]'))old.remove();
  let after=el;for(const image of op.additions||[]){const img=doc.createElement('img');img.src=image.src;img.alt=image.alt;img.setAttribute('data-admin-added',id);img.style.cssText='display:block;max-width:100%;height:auto;margin:20px auto';after.after(img);after=img;}
 }
}
if(typeof location!=='undefined'&&!location.pathname.startsWith('/rewrite/admin/')){
 let count=0,last=0;
 document.addEventListener('click',event=>{if(!event.target.matches('.footer-city img'))return;const now=Date.now();count=now-last<2000?count+1:1;last=now;if(count===5)location.href='/rewrite/admin/';});
 fetch('/rewrite/admin-config.json',{cache:'no-store'}).then(r=>r.json()).then(async config=>{
  if(!config.apiBase)return;let content;
  const apply=()=>{if(content)applyEdits(document,content,document.body.dataset.adminRoute||'/');};
  const refresh=async()=>{if(document.hidden)return;try{const response=await fetch(config.apiBase+'/published',{cache:'no-store'});if(response.ok){content=(await response.json()).document;apply();}}catch{/* Keep the existing site available when the editor service is offline. */}};
  document.addEventListener('site-content-updated',apply);document.addEventListener('visibilitychange',refresh);await refresh();setInterval(refresh,30000);
 }).catch(()=>{});
}
