'use strict';
function initializeSite(){
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('js');
const menu=$('.menu-toggle'),nav=$('.main-nav'),drop=$('.nav-dropdown'),dropButton=$('.nav-dropdown-toggle');
function setDrop(open){drop?.classList.toggle('open',open);dropButton?.setAttribute('aria-expanded',String(open));}
function closeMenu(){menu?.setAttribute('aria-expanded','false');menu?.setAttribute('aria-label','Open navigation');nav?.classList.remove('open');document.body.classList.remove('menu-open');$('#main')?.removeAttribute('inert');$('.site-footer')?.removeAttribute('inert');setDrop(false);}
menu?.addEventListener('click',()=>{if(menu.getAttribute('aria-expanded')==='true'){closeMenu();return;}menu.setAttribute('aria-expanded','true');menu.setAttribute('aria-label','Close navigation');nav.classList.add('open');document.body.classList.add('menu-open');$('#main')?.setAttribute('inert','');$('.site-footer')?.setAttribute('inert','');setDrop(true);});
dropButton?.addEventListener('click',()=>setDrop(!drop.classList.contains('open')));
drop?.addEventListener('mouseenter',()=>{if(innerWidth>700)setDrop(true);});
drop?.addEventListener('mouseleave',()=>{if(innerWidth>700&&!drop.contains(document.activeElement))setDrop(false);});
drop?.addEventListener('focusout',e=>{if(innerWidth>700&&!drop.contains(e.relatedTarget))setDrop(false);});
document.addEventListener('click',e=>{if(innerWidth>700&&!e.target.closest('.nav-dropdown'))setDrop(false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const open=menu?.getAttribute('aria-expanded')==='true';closeMenu();if(open)menu.focus();}if(e.key==='Tab'&&nav?.classList.contains('open')){const controls=[menu,...$$('a,button',nav)].filter(x=>x.getClientRects().length);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
window.addEventListener('resize',()=>{if(innerWidth>700&&nav?.classList.contains('open'))closeMenu();});
$$('.main-nav a').forEach(a=>a.addEventListener('click',closeMenu));
let kitPrice=Number(document.body.dataset.kitPrice)||5;
document.addEventListener("site-content-updated",()=>{kitPrice=Number(document.body.dataset.kitPrice)||5;});
const params=new URLSearchParams(location.search);const validAmount=n=>Number.isFinite(n)&&n>=1&&n<=100000;
const formatGiftMoney=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2}).format(n);
// The $50 gift shows ten individual kits. Larger gifts reuse bounded artwork.
function deliveryParts(count,giftAmount=count*5,price=5){
 const value=Math.max(1,Math.floor(count));
 if(value<10||(value===10&&giftAmount<=price*10))return {truck:0,box:0,kit:value};
 if(value>=1000)return {truck:9,box:0,kit:0};
 return {truck:Math.floor(value/100),box:Math.floor(value%100/10),kit:value%10};
}
function renderDelivery(stack,count,giftAmount=count*5){if(!stack)return;const groups=$$('[data-delivery-unit]',stack);const value=Math.max(1,count),parts=deliveryParts(value,giftAmount,kitPrice);const groupCount=Object.values(parts).filter(Boolean).length;stack.dataset.groups=String(groupCount);stack.dataset.capped=String(value>=1000);
  groups.forEach(group=>{const unit=group.dataset.deliveryUnit,number=parts[unit],images=$$('.delivery-piece',group);group.hidden=number===0;group.dataset.pieceCount=String(number);group.style.setProperty('--fan-scale',number>1?'.65':'0');images.forEach((image,i)=>{image.classList.toggle('is-shown',i<number);const position=number>1?(i-(number-1)/2)/(number-1):0;image.style.setProperty('--fan-x',(position*54)+'%');image.style.setProperty('--fan-y',(Math.abs(position)*12)+'px');image.style.setProperty('--fan-tilt',(position*10)+'deg');image.style.zIndex=String(i);});});
  stack.setAttribute('aria-label',count>1?count.toLocaleString('en-US')+' complete school supply kits':'One spiral notebook, one folder, twelve colored pencils, five pencils, and five pens');
 }
$$('.donation-picker').forEach(form=>{
 const choices=$$('.amount-choice',form),custom=$('[data-custom]',form),amount=$('[name=amount]',form),error=$('.form-error',form),submit=$('[type=submit]',form),kit=form.closest('.home-kit');
 let selected=null,interacted=false,dwellTimer=null,inView=false;
 const heading=kit?.querySelector('[data-kit-heading]'),total=kit?.querySelector('[data-kit-kits]'),note=kit?.querySelector('[data-kit-note]'),stack=kit?.querySelector('.kit-stack'),groups=stack?$$('[data-delivery-unit]',stack):[];
 function drawKits(count,giftAmount=count*5){renderDelivery(stack,count,giftAmount);}
 function stopDwell(){clearTimeout(dwellTimer);dwellTimer=null;}
 function impact(n){if(!kit)return;const valid=validAmount(n),count=valid?Math.floor(Math.round(n*100)/(kitPrice*100)):0;kit.classList.toggle('kit-impact-active',valid);heading.textContent=valid?'Your gift can provide':'Each student receives:';total.hidden=!valid;total.textContent=count?count.toLocaleString('en-US')+' complete kit'+(count===1?'':'s'):'Part of a kit';
  $$('[data-kit-supply]',kit).forEach(el=>{const quantity=Number(el.dataset.kitSupply)*(count||1);el.textContent=quantity.toLocaleString('en-US')+' '+(count<=1?el.dataset.single:el.dataset.plural.replace('{n}',quantity.toLocaleString('en-US')));});$('.kit-contents',kit).hidden=valid&&count===0;$('.kit-contents',kit).setAttribute('aria-label',valid?'Supplies your gift can provide':'Supplies in each kit');
  const remainder=valid?Math.round(n*100)%Math.round(kitPrice*100):0;note.textContent=valid?(count?(remainder?formatGiftMoney(remainder/100)+' also helps fund supplies.':''):'Every gift helps fund school supplies.'):'';note.hidden=!note.textContent;$('[data-kit-announcement]',kit).textContent=valid?('Your '+formatGiftMoney(n)+' gift can provide ')+total.textContent+'.':'';if(valid)drawKits(count,n);else drawKits(1);submit.textContent=valid?'Donate '+formatGiftMoney(n):'Donate';
 }
 function touch(){interacted=true;stopDwell();}
 function choose(n){touch();selected=n;amount.disabled=false;amount.value=String(n);custom.value='';custom.setCustomValidity('');$('.custom-choice',form).classList.remove('active');choices.forEach(c=>{const on=Number(c.dataset.amount)===n;c.classList.toggle('selected',on);c.setAttribute('aria-pressed',String(on));});error.textContent='';impact(n);}
 choices.forEach(c=>c.addEventListener('click',()=>choose(Number(c.dataset.amount))));
 custom.addEventListener('focus',()=>{touch();selected=null;amount.disabled=true;choices.forEach(c=>{c.classList.remove('selected');c.setAttribute('aria-pressed','false');});$('.custom-choice',form).classList.add('active');if(!custom.value)impact(null);});
 custom.addEventListener('input',()=>{touch();selected=null;const n=Number(custom.value);amount.disabled=!validAmount(n);amount.value=custom.value;error.textContent=custom.value&&!validAmount(n)?'Enter an amount from $1 to $100,000.':'';impact(n);});
 form.addEventListener('submit',e=>{touch();if(selected===null&&!custom.value.trim()){amount.disabled=true;return;}const n=selected??Number(custom.value);if(!validAmount(n)){e.preventDefault();error.textContent='Enter an amount from $1 to $100,000.';custom.focus();return;}amount.disabled=false;amount.value=String(Math.round(n*100)/100);});
 document.addEventListener('site-content-updated',event=>{
  if(!event.detail.changed.includes('kit_price'))return;
  const current=selected??(custom.value.trim()?Number(custom.value):null);
  if(validAmount(current)){
   const matching=choices.find(c=>Number(c.dataset.amount)===current);selected=matching?current:null;
   choices.forEach(c=>{const on=c===matching;c.classList.toggle('selected',on);c.setAttribute('aria-pressed',String(on));});
   custom.value=matching?'':String(current);$('.custom-choice',form).classList.toggle('active',!matching);amount.disabled=false;amount.value=String(current);impact(current);
  }else impact(null);
 });
 if(kit){drawKits(1);function dwell(){stopDwell();if(!interacted&&inView&&!document.hidden)dwellTimer=setTimeout(()=>{dwellTimer=null;if(!interacted&&inView&&!document.hidden){choose(kitPrice);observer?.disconnect();}},7000);}
  const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{inView=entries[0].isIntersecting&&entries[0].intersectionRatio>=.55;dwell();},{threshold:[0,.55]}):null;observer?.observe($('.kit-summary',kit));document.addEventListener('visibilitychange',dwell);
 }
});
$$('.testimonials').forEach(carousel=>{const slides=$$('[data-slide]',carousel),dots=$$('[data-slide-to]',carousel);let current=0;
 function show(i){current=(i+slides.length)%slides.length;slides.forEach((s,j)=>s.hidden=j!==current);dots.forEach((d,j)=>d.setAttribute('aria-pressed',String(j===current)));}
 $('.slides',carousel).setAttribute('aria-live','off');$('.carousel-prev',carousel).addEventListener('click',()=>show(current-1));$('.carousel-next',carousel).addEventListener('click',()=>show(current+1));dots.forEach(b=>b.addEventListener('click',()=>show(Number(b.dataset.slideTo))));carousel.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();show(current+(e.key==='ArrowLeft'?-1:1));}});if(!reducedMotion)setInterval(()=>show(current+1),6500);
});
$$('.process-tabs').forEach(tabs=>{const buttons=$$('[data-step]',tabs);function select(i,focus=false){buttons.forEach((b,j)=>{b.setAttribute('aria-selected',String(j===i));b.tabIndex=j===i?0:-1;$('#'+b.getAttribute('aria-controls')).hidden=j!==i;});if(focus)buttons[i].focus();}buttons.forEach((b,i)=>{b.addEventListener('click',()=>select(i));b.addEventListener('keydown',e=>{let index;if(e.key==='ArrowRight')index=(i+1)%buttons.length;else if(e.key==='ArrowLeft')index=(i-1+buttons.length)%buttons.length;else if(e.key==='Home')index=0;else if(e.key==='End')index=buttons.length-1;else return;e.preventDefault();select(index,true);});});});
const normalizeDirectory=text=>String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/['’]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const matchesDirectory=(text,query)=>normalizeDirectory(query).split(/\s+/).every(word=>normalizeDirectory(text).includes(word));
const teamSearch=$('#team-search'),teamFilter=$('#team-filter');function filterTeam(){if(!teamSearch||!teamFilter)return;const q=teamSearch.value.trim().toLowerCase(),f=teamFilter.value;let count=0;$$('.full-team-grid .person-card').forEach(card=>{const text=card.dataset.name+' '+card.dataset.role;const group=f==='all'||(f==='board'?card.dataset.group.includes('board'):card.dataset.role.includes(f));const show=matchesDirectory(text,q)&&group;card.hidden=!show;if(show)count++;});$('#team-results').textContent=count+' team member'+(count===1?'':'s');$('.no-results').hidden=count>0;}
teamSearch?.addEventListener('input',filterTeam);teamFilter?.addEventListener('change',filterTeam);
if(teamFilter){const f=params.get('team');if([...teamFilter.options].some(o=>o.value===f)){teamFilter.value=f;filterTeam();$('#full-team').open=true;}if(location.hash==='#full-team')$('#full-team').open=true;}
$$('[data-open-dialog]').forEach(button=>button.addEventListener('click',()=>{const dialog=$('#'+button.dataset.openDialog);if(dialog&&!dialog.open)dialog.showModal();}));
$$('dialog [data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
$$('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}}));
const viewer=$('#photo-viewer'),gallery=$$('[data-lightbox]');let photoIndex=0;
function showPhoto(index){if(!viewer||!gallery.length)return;photoIndex=(index+gallery.length)%gallery.length;const link=gallery[photoIndex];$('#viewer-image').src=link.href;$('#viewer-image').alt=$('img',link)?.alt||link.dataset.caption;$('#viewer-caption').textContent=link.dataset.caption+' · '+(photoIndex+1)+' / '+gallery.length;}
gallery.forEach((link,i)=>link.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey)return;e.preventDefault();showPhoto(i);viewer.showModal();}));
$('[data-photo-prev]')?.addEventListener('click',()=>showPhoto(photoIndex-1));$('[data-photo-next]')?.addEventListener('click',()=>showPhoto(photoIndex+1));viewer?.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();showPhoto(photoIndex+(e.key==='ArrowLeft'?-1:1));}});
const partnerSearch=$('#partner-search');
if(partnerSearch){const cards=$$('.partner-cloud [data-partner-name]'),clear=$('[data-clear-partners]'),empty=$('.partner-empty');
 function filterPartners(){const q=partnerSearch.value.trim();let count=0;cards.forEach(card=>{const show=matchesDirectory(card.dataset.partnerSearch,q);card.hidden=!show;if(show)count++;});$('#partner-results').textContent=q?count+' of '+cards.length+' organizations':cards.length+' organizations';clear.hidden=!q;empty.hidden=count!==0;}
 function resetPartners(){partnerSearch.value='';filterPartners();partnerSearch.focus();}partnerSearch.addEventListener('input',filterPartners);partnerSearch.addEventListener('keydown',e=>{if(e.key==='Escape')resetPartners();});clear.addEventListener('click',resetPartners);$('[data-reset-partners]').addEventListener('click',resetPartners);filterPartners();
}
if(!reducedMotion&&'IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting)return;observer.unobserve(entry.target);const el=entry.target,started=performance.now();function tick(now){const target=Number(el.dataset.count),p=Math.min((now-started)/1800,1);el.textContent=Math.round(target*(1-Math.pow(1-p,3))).toLocaleString('en-US');if(p<1)requestAnimationFrame(tick);}requestAnimationFrame(tick);}),{threshold:.4});$$('[data-count]').forEach(el=>observer.observe(el));const reveal=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){reveal.unobserve(entry.target);entry.target.classList.add('section-enter');}}),{threshold:.15});$$('.work-photo-grid,.impact-feature,.chapter-practical,.involved-photo-banner').forEach(el=>reveal.observe(el));}
$$('[data-inquiry]').forEach(form=>{
 const submit=$('[type=submit]',form),error=$('.form-error',form),fields=$('.form-fields',form),success=$('.submission-success',form),interest=$('[name=interest]',form);
 if(interest&&params.get('topic')){const option=[...interest.options].find(o=>o.value.toLowerCase()===params.get('topic').toLowerCase());if(option)interest.value=option.value;}
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(submit.disabled||!form.reportValidity())return;error.textContent='';const data=new FormData(form);
  if(data.get('_honey')||data.get('website')){error.textContent='Your message could not be sent. Please email our team.';error.focus();return;}
  const payload=Object.fromEntries(data.entries());delete payload.website;payload.supplies=data.getAll('supplies').join(', ');payload._replyto=String(data.get('email')||'').trim();
  const label=submit.textContent;submit.disabled=true;submit.textContent='Sending…';const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),30000);
  try{
   const response=await fetch(form.action.replace('https://formsubmit.co/','https://formsubmit.co/ajax/'),{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload),signal:abort.signal});
   const result=await response.json();const accepted=result.success===true||result.success==='true'||/needs activation|activation.*email|activate.*form/i.test(result.message||'');
   if(!response.ok||!accepted)throw new Error('Delivery could not be confirmed. Please try again, or email therewriteitproject@gmail.com.');
   fields.hidden=true;success.hidden=false;const heading=$('h3',success);heading.tabIndex=-1;heading.focus();form.reset();
  }catch(e){error.textContent=e.name==='AbortError'?'Delivery is taking longer than expected. Your form details are still here. Please try again or email our team.':e.name==='SyntaxError'?'Delivery could not be confirmed. Your form details are still here. Please try again or email our team.':e.message==='Failed to fetch'?'Your message could not be sent. Check your connection and try again. Your form details are still here.':e.message;error.focus();}
  finally{clearTimeout(timer);submit.disabled=false;submit.textContent=label;}
 });
 $('.send-another',form)?.addEventListener('click',()=>{success.hidden=true;fields.hidden=false;error.textContent='';$('[name=name]',form).focus();});
});
document.addEventListener('click',async event=>{const button=event.target.closest('[data-copy-email]');if(!button)return;const text=button.dataset.copyEmail,status=$('.copy-status',button.parentElement);try{if(!navigator.clipboard)throw new Error();await navigator.clipboard.writeText(text);status.textContent='Email address copied.';button.dataset.copied='true';button.title='Copied';button.setAttribute('aria-label','Email address copied');clearTimeout(button.copyFeedbackTimer);button.copyFeedbackTimer=setTimeout(()=>{delete button.dataset.copied;button.title='Copy email address';button.setAttribute('aria-label','Copy '+text);},1800);}catch{let input=$('.copy-email-fallback',button.parentElement);if(!input){input=document.createElement('input');input.className='copy-email-fallback';input.readOnly=true;input.setAttribute('aria-label','Email address to copy');button.after(input);}input.value=text;input.focus();input.select();status.textContent='Select and copy the email address above.';}});
// Stagger the figures; let quiet artwork overlap the count after a short lead.
if(!reducedMotion&&'IntersectionObserver' in window){
 const metricObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
  if(!entry.isIntersecting)return;
  const metric=entry.target;metricObserver.unobserve(metric);
  const value=metric.querySelector('[data-metric-count]');
  const prefix=value.dataset.prefix||'',suffix=value.dataset.suffix||'';
  const start=performance.now()+Number(metric.dataset.metricOrder)*180,duration=2200;
  value.textContent=prefix+'0'+suffix;
  function frame(now){if(now<start){requestAnimationFrame(frame);return;}
   const elapsed=now-start,p=Math.min(elapsed/duration,1);
   metric.classList.add('metric-playing');if(elapsed>=260)metric.classList.add('metric-art-enter');
   value.textContent=prefix+(p===1?Number(value.dataset.metricCount):Math.round(Number(value.dataset.metricCount)*(1-Math.pow(1-p,2)))).toLocaleString('en-US',{maximumFractionDigits:2})+suffix;
   if(p<1)requestAnimationFrame(frame);else metric.classList.add('metric-complete');
  }
  requestAnimationFrame(frame);
 }),{threshold:.55});
 document.querySelectorAll('.metric').forEach((metric,index)=>{metric.dataset.metricOrder=String(index);const value=metric.querySelector('[data-metric-count]');value.textContent=(value.dataset.prefix||'')+'0'+(value.dataset.suffix||'');metric.classList.add('metric-ready');metricObserver.observe(metric);});
}

// Show the contents of a gift, then keep checkout on the nonprofit's Donorbox.
$$('.gift-builder').forEach(builder=>{
 const input=$('#gift-custom',builder),choices=$$('[data-gift-amount]',builder),checkout=$('[data-gift-checkout]',builder),error=$('#gift-amount-error',builder),kits=$('[data-gift-kits]',builder),note=$('[data-gift-note]',builder),supplies=$('.gift-preview-supplies',builder);
 function update(){const amount=Number(input.value),valid=input.value.trim()!==''&&validAmount(amount);checkout.setAttribute('aria-disabled',String(!valid));input.setAttribute('aria-invalid',String(!valid));error.textContent=valid?'':'Enter an amount from $1 to $100,000.';choices.forEach(b=>b.setAttribute('aria-pressed',String(valid&&Number(b.dataset.giftAmount)===amount)));if(!valid)return;
  const count=Math.floor((Math.round(amount*100))/(kitPrice*100));kits.textContent=count?count.toLocaleString('en-US')+' kit'+(count===1?'':'s'):'Part of a kit';renderDelivery($('.kit-delivery-visual',builder),count,amount);$('[data-gift-announcement]',builder).textContent='Your gift can provide '+kits.textContent+'.';supplies.hidden=count===0;
  $$('[data-gift-supply]',builder).forEach(el=>{const n=Number(el.dataset.giftSupply)*count;el.textContent=n.toLocaleString('en-US')+' '+(count===1?el.dataset.single:el.dataset.plural.replace('{n}',n.toLocaleString('en-US')));});
  const remainder=Math.round(amount*100)%Math.round(kitPrice*100);note.textContent=count?(remainder?formatGiftMoney(remainder/100)+' also helps fund supplies.':''):formatGiftMoney(amount)+' helps fund school supplies.';note.hidden=!note.textContent;
  const url=new URL(builder.dataset.donationUrl);url.searchParams.set('amount',String(Math.round(amount*100)/100));url.searchParams.set('default_interval','o');checkout.href=url.href;checkout.textContent='Donate '+formatGiftMoney(amount);
 }
 document.addEventListener('site-content-updated',event=>{if(event.detail.changed.some(key=>key==='kit_price'||key==='donation_url'))update();});
 choices.forEach(b=>b.addEventListener('click',()=>{input.value=b.dataset.giftAmount;update();}));input.addEventListener('input',update);checkout.addEventListener('click',e=>{if(checkout.getAttribute('aria-disabled')==='true'){e.preventDefault();input.focus();}});update();
});

// Make a supply request easier to assemble without changing its delivery.
$$('[data-inquiry="supplies"]').forEach(form=>{
 const choices=$$('[name=supplies]',form),students=$('[name=students]',form),date=$('[name=needed]',form),summary=$('[data-request-preview]',form);
 function update(){const selected=choices.filter(c=>c.checked).map(c=>c.value),parts=[];const n=Number(students.value);if(students.value&&n>=1&&n<=100000)parts.push(n.toLocaleString('en-US')+' student'+(n===1?'':'s'));if(selected.length)parts.push(new Intl.ListFormat('en-US',{style:'long',type:'conjunction'}).format(selected));if(date.value){const d=new Date(date.value+'T12:00:00');if(!Number.isNaN(d.getTime()))parts.push('Needed '+d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}));}summary.textContent=parts.length?parts.join(' · '):'Choose the supplies your students need.';}
 $('[data-select-kit]',form).addEventListener('click',()=>{choices.forEach(c=>{if(c.value!=='Other materials')c.checked=true;});update();});$('[data-clear-supplies]',form).addEventListener('click',()=>{choices.forEach(c=>c.checked=false);update();});choices.forEach(c=>c.addEventListener('change',update));students.addEventListener('input',update);date.addEventListener('change',update);form.addEventListener('reset',()=>queueMicrotask(update));update();
});

// Department choices keep the native application field and team context in sync.
$$('.volunteer-choice-controls').forEach(controls=>{
 const form=controls.closest('form'),select=$('[name=interest]',form),buttons=$$('[data-volunteer-team]',controls),panels=$$('[data-volunteer-panel]',form);
 function update(){buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.volunteerTeam===select.value)));panels.forEach(p=>p.hidden=p.dataset.volunteerPanel!==select.value);}
 buttons.forEach(b=>b.addEventListener('click',()=>{select.value=b.dataset.volunteerTeam;update();}));select.addEventListener('change',update);form.addEventListener('reset',()=>queueMicrotask(update));update();
});
// Topic-specific guidance points visitors to the appropriate next step.
$$('.contact-topic-guidance').forEach(guide=>{
 const select=$('[name=interest]',guide.closest('form')),panels=$$('[data-contact-guide]',guide);
 function update(){panels.forEach(p=>p.hidden=p.dataset.contactGuide!==select.value);}
 select.addEventListener('change',update);guide.closest('form').addEventListener('reset',()=>queueMicrotask(update));update();
});

}
initializeSite();
