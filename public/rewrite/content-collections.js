// A collection owns its repeated items, not the surrounding page, forms, or navigation.
// Base item keys are assigned by the build before any saved changes are applied.
const field=(key,label,limit,kind='text',required=false)=>({key,label,limit,kind,required});
const title=field('title','Heading',160,'text',true),body=field('body','Text',5000,'long',true);
const image=(label,required=false)=>field('image',label,2048,'photo',required);
const alt=field('alt','Image description',300),link=field('url','Link URL',2048,'url');
export const collectionTypes={
 questions:{title:'Questions and answers',singular:'question',fields:[field('title','Question',240,'text',true),field('body','Answer',5000,'long',true)]},
 partners:{title:'Partner directory',singular:'partner',fields:[field('title','Organization name',160,'text',true),link,image('Logo'),field('aliases','Alternate names for search',220)]},
 milestones:{title:'Founding timeline',singular:'milestone',fields:[field('date','Year or date label',60,'text',true),title,body]},
 gallery:{title:'Photo gallery',singular:'photo',fields:[image('Photo',true),alt,field('title','Caption',240)]},
 testimonials:{title:'Partner testimonials',singular:'testimonial',fields:[field('title','Partner name',160,'text',true),field('body','Quote',3000,'long',true),image('Photo',true),alt]},
 layout:{title:'Section order',singular:'section',fields:[]},
 updates:{title:'Page updates',singular:'update',fields:[title,body,image('Photo'),alt,field('linkLabel','Button text',80),link]},
};
export const collectionLimit=60;
const validId=id=>typeof id==='string'&&/^[a-f0-9]{16}$/.test(id);
const editableLayout={
 '/':[['.home-partners','Local partners'],['.home-involved','Get involved'],['.home-faq','Questions and answers']],
 '/about':[['.history-section','Founding timeline'],['.work-photo-grid','Volunteer photos'],['.values-editorial','Core values']],
 '/impact':[['.impact-feature','Impact story'],['.all-partners','Partner directory'],['.impact-gallery','Photo gallery']],
 '/chapters':[['.chapter-day','What chapters do'],['.chapter-support','Chapter support and FAQs']],
 '/team':[['.board-grid','Board of directors'],['.leadership-grid','Executive leadership'],['.full-team-grid','The full team']],
};
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const el=(doc,tag,cls,text)=>{const node=doc.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
const read=(node,selector)=>node.querySelector(selector)?.textContent.trim()||'';
const attr=(node,selector,name)=>node.querySelector(selector)?.getAttribute(name)||'';
const signature=values=>JSON.stringify(values);

export function collectionUrl(value){
 if(typeof value!=='string'||!value.trim())return '';
 const cleaned=value.trim();
 if(/^\/(?![\/\\])/.test(cleaned)&&!/[\\\s]/.test(cleaned))return cleaned;
 try{const url=new URL(cleaned);if(url.protocol==='https:'&&!url.username&&!url.password)return url.href;}catch{}
 return '';
}

export function readCollection(kind,raw){
 const type=collectionTypes[kind],records=Object.create(null);
 if(!type)return {records,hidden:[],order:[]};
 for(const [id,source] of Object.entries(object(raw?.records)?raw.records:{}).slice(0,collectionLimit)){
  if(!validId(id)||!object(source))continue;
  const record={};
  for(const f of type.fields){
   const rawValue=source[f.key];if(typeof rawValue!=='string'||rawValue.length>f.limit)continue;
   const value=rawValue.trim();
   if((f.kind==='url'||f.kind==='photo')&&value&&!collectionUrl(value,f.kind))continue;
   if(!f.required||value)record[f.key]=value;
  }
  if(source.added===true){
   if(type.fields.some(f=>f.required&&!record[f.key]))continue;
   record.added=true;
  }
  if(Object.keys(record).length)records[id]=record;
 }
 const ids=value=>Array.isArray(value)?[...new Set(value.filter(validId))].slice(0,collectionLimit):[];
 return {records,hidden:ids(raw?.hidden),order:ids(raw?.order)};
}

export function identifyCollections(doc,route){
 const definitions=[
  ['questions','.faq-list'],['partners','#partner-directory .partner-cloud'],
  ['milestones','.story-timeline'],['gallery','.impact-gallery .photo-filmstrip'],['testimonials','.testimonials .slides']
 ];
 for(const [kind,selector] of definitions){
  const container=doc.querySelector(selector);if(!container)continue;
  container.dataset.editCollection=kind;
  for(const item of container.children)if(validId(item.dataset.adminKey))item.dataset.collectionItem=item.dataset.adminKey;
 }
 const main=doc.querySelector('main');
 if(main&&!['/privacy','/404','/message-received'].includes(route)){
  const updates=el(doc,'div','site-updates wrap');updates.dataset.editCollection='updates';main.append(updates);
 }
 const parent=route==='/team'?doc.querySelector('.team-accordions'):main;
 const movable=editableLayout[route];
 if(movable&&parent){
  parent.dataset.editLayout='';
  for(const [selector,label] of movable){
   const section=route==='/team'?parent.querySelector(selector)?.closest('details'):parent.querySelector(selector);
   if(section?.parentElement===parent&&validId(section.dataset.adminKey)){section.dataset.layoutItem=section.dataset.adminKey;section.dataset.layoutLabel=label;}
  }
 }
}

export function collectionContainers(doc){
 return [...doc.querySelectorAll('[data-edit-collection]')].filter(node=>Object.hasOwn(collectionTypes,node.dataset.editCollection));
}
const layoutParent=doc=>doc.querySelector('[data-edit-layout]');
function layoutNodes(doc){
 return [...(layoutParent(doc)?.children||[])].filter(node=>validId(node.dataset.layoutItem));
}
export function managedKinds(doc){
 const kinds=collectionContainers(doc).map(node=>node.dataset.editCollection);
 if(layoutNodes(doc).length>1)kinds.push('layout');
 return kinds;
}
function applyLayout(doc,order){
 const nodes=layoutNodes(doc),ranks=new Map(order.map((id,index)=>[id,index]));
 const next=[...nodes].sort((a,b)=>(ranks.get(a.dataset.layoutItem)??Infinity)-(ranks.get(b.dataset.layoutItem)??Infinity));
 if(nodes.every((node,index)=>node===next[index]))return;
 const focused=doc.activeElement;
 const markers=nodes.map(node=>{const marker=doc.createComment('layout slot');node.before(marker);return marker;});
 for(let index=0;index<markers.length;index++)markers[index].replaceWith(next[index]);
 if(focused?.isConnected&&doc.activeElement!==focused)focused.focus({preventScroll:true});
}
export function collectionValues(kind,node){
 const imageFields={image:attr(node,'img','src'),alt:attr(node,'img','alt')};
 switch(kind){
  case 'questions': return {title:read(node,'.faq-question'),body:read(node,'.faq-answer p')};
  case 'partners': {
   const title=node.dataset.partnerName||read(node,'.partner-name'),search=node.dataset.partnerSearch||'';
   return {title,url:node.getAttribute('href')||'',image:imageFields.image,aliases:search===title?'':search.startsWith(title+' ')?search.slice(title.length+1):search};
  }
  case 'milestones': return {date:read(node,'.story-date'),title:read(node,'h3'),body:read(node,'.story-copy > p:not(.story-date)')};
  case 'gallery': return {...imageFields,title:read(node,'figcaption')};
  case 'testimonials': return {...imageFields,title:read(node,'.quote-copy p'),body:read(node,'blockquote').replace(/^“|”$/g,'')};
  case 'updates': return {...imageFields,title:read(node,'h2'),body:read(node,'.site-update-copy'),linkLabel:read(node,'a'),url:attr(node,'a','href')};
  default: return {};
 }
}
export function collectionItems(doc,kind){
 if(kind==='layout')return layoutNodes(doc).map(node=>({id:node.dataset.layoutItem,values:{title:node.dataset.layoutLabel}}));
 const container=collectionContainers(doc).find(node=>node.dataset.editCollection===kind);
 if(!container)return [];
 return [...container.children].filter(node=>validId(node.dataset.collectionItem)).map(node=>({id:node.dataset.collectionItem,values:collectionValues(kind,node)}));
}

function setCopy(node,value){
 if(value===undefined||!node)return;
 node.textContent=value;node.style.whiteSpace='pre-line';
 // A manually edited field should stop listening to that spreadsheet cell.
 node.removeAttribute('data-content');
}
function sitePath(doc,value){
 if(!value?.startsWith('/'))return value;
 const demo='/rewrite',prefix=demo+'/';
 const path=value===demo?'/':value.startsWith(prefix)?value.slice(demo.length):value;
 return doc.documentElement.dataset.publicSiteOrigin?path:demo+path;
}
function setImage(node,src,alt){
 if(!node)return;
 if(src!==undefined){node.setAttribute('src',sitePath(node.ownerDocument,src));node.dataset.collectionImageSrc='';for(const attr of ['srcset','sizes','width','height'])node.removeAttribute(attr);}
 if(alt!==undefined){node.setAttribute('alt',alt);node.dataset.collectionImageAlt='';}
}
function copyIdentity(from,to){
 for(const key of ['adminId','adminKey','collectionItem'])if(from?.dataset[key])to.dataset[key]=from.dataset[key];
}
function renderItem(doc,kind,original,overrides){
 const value={...(original?collectionValues(kind,original):{}),...overrides};
 if(kind==='questions'){
  const node=original||el(doc,'details','faq-item');
  if(!original){
   const summary=el(doc,'summary');summary.append(el(doc,'span','faq-question'));
   const hint=el(doc,'span','faq-chevron','⌄');hint.setAttribute('aria-hidden','true');summary.append(hint);
   const answer=el(doc,'div','faq-answer');answer.append(el(doc,'p'));node.append(summary,answer);
  }
  setCopy(node.querySelector('.faq-question'),overrides.title);setCopy(node.querySelector('.faq-answer p'),overrides.body);return node;
 }
 if(kind==='partners'){
  const node=el(doc,value.url?'a':'div','partner-logo');
  if(value.url){node.setAttribute('href',sitePath(doc,value.url));node.target='_blank';node.rel='noopener noreferrer';}
  node.dataset.partnerName=value.title;node.dataset.partnerSearch=value.title+' '+(value.aliases||'');
  if(value.image){
   const art=el(doc,'span','partner-logo-art'),picture=overrides.image===undefined&&original?.querySelector('img')?original.querySelector('img').cloneNode(false):el(doc,'img');
   if(overrides.image!==undefined||!picture.getAttribute('src'))picture.setAttribute('src',sitePath(doc,value.image));
   picture.alt='';picture.loading='lazy';art.append(picture);node.append(art);
  }
  node.append(el(doc,'span','partner-name'+(value.image?'':' partner-text-only'),value.title));
  copyIdentity(original,node);return node;
 }
 if(kind==='milestones'){
  const node=original||el(doc,'li');
  if(!original){const wrapper=el(doc,'div','story-copy');wrapper.append(el(doc,'p','story-date'),el(doc,'h3'),el(doc,'p'));node.append(wrapper);}
  setCopy(node.querySelector('.story-date'),overrides.date);setCopy(node.querySelector('h3'),overrides.title);setCopy(node.querySelector('.story-copy > p:not(.story-date)'),overrides.body);return node;
 }
 if(kind==='gallery'){
  const node=original||el(doc,'figure','photograph');
  if(!original){
   const anchor=el(doc,'a');anchor.dataset.lightbox='';const picture=el(doc,'img');picture.loading='lazy';
   const icon=el(doc,'span','photo-zoom','+');icon.setAttribute('aria-hidden','true');anchor.append(picture,icon);node.append(anchor);
  }
  setImage(node.querySelector('img'),overrides.image,overrides.alt);
  const anchor=node.querySelector('[data-lightbox]');if(anchor){
   if(overrides.image!==undefined)anchor.setAttribute('href',sitePath(doc,overrides.image));
   if(!original||overrides.title!==undefined||overrides.alt!==undefined){
    anchor.dataset.caption=value.title||value.alt||'Gallery photo';anchor.setAttribute('aria-label','View photograph: '+anchor.dataset.caption);
   }
  }
  if(overrides.title!==undefined){
   const caption=node.querySelector('figcaption');if(value.title){if(caption)setCopy(caption,value.title);else node.append(el(doc,'figcaption','',value.title));}else caption?.remove();
  }
  return node;
 }
 if(kind==='testimonials'){
  const node=original||el(doc,'div','quote-slide');
  if(!original){
   const art=el(doc,'div','quote-image'),copy=el(doc,'div','quote-copy'),picture=el(doc,'img');picture.loading='lazy';
   art.append(picture);copy.append(el(doc,'blockquote'),el(doc,'p'));node.append(art,copy);
  }
  setImage(node.querySelector('img'),overrides.image,overrides.alt);
  setCopy(node.querySelector('.quote-copy p'),overrides.title);
  if(overrides.body!==undefined)setCopy(node.querySelector('blockquote'),'“'+overrides.body+'”');
  return node;
 }
 const node=el(doc,'section','site-update'+(value.image?' has-image':''));
 if(value.image){const picture=el(doc,'img');picture.loading='lazy';picture.src=sitePath(doc,value.image);picture.alt=value.alt||'';node.append(picture);}
 const text=el(doc,'div','site-update-body');text.append(el(doc,'h2','',value.title),el(doc,'p','site-update-copy',value.body));
 if(value.url&&value.linkLabel){const action=el(doc,'a','button navy',value.linkLabel);action.setAttribute('href',sitePath(doc,value.url));text.append(action);}
 node.append(text);return node;
}

function syncTestimonials(list){
 const carousel=list.closest('.testimonials');if(!carousel)return;
 const dots=carousel.querySelector('.carousel-dots'),slides=[...list.children];
 carousel.hidden=slides.length===0;
 if(dots){
  const buttons=slides.map((slide,index)=>{slide.dataset.slide=String(index);slide.hidden=index!==0;
   const button=el(list.ownerDocument,'button');button.type='button';button.dataset.slideTo=String(index);
   button.setAttribute('aria-label','Show testimonial '+(index+1));button.setAttribute('aria-pressed',String(index===0));return button;});
  dots.replaceChildren(...buttons);
 }
 for(const button of carousel.querySelectorAll('.carousel-prev,.carousel-next,.carousel-dots'))button.hidden=slides.length<2;
}

function syncCollectionUI(container){
 const kind=container.dataset.editCollection;
 if(kind==='testimonials')syncTestimonials(container);
 const grouped=container.closest('.home-faq,.impact-gallery,.history-section');
 if(grouped&&['questions','gallery','milestones'].includes(kind))grouped.hidden=container.children.length===0;
}
export function applyCollections(doc,raw){
 if(raw?.layout)applyLayout(doc,readCollection('layout',raw.layout).order);
 for(const container of collectionContainers(doc)){
  const kind=container.dataset.editCollection;
  if(!Object.hasOwn(raw||{},kind))continue;
  const {records,hidden,order}=readCollection(kind,raw[kind]);
  const existing=new Map([...container.children].map(node=>[node.dataset.collectionItem,node]).filter(([key])=>validId(key)));
  const rank=new Map(order.map((id,index)=>[id,index]));
  const ids=[...new Set([...existing.keys(),...Object.keys(records).filter(id=>records[id].added)])];
  ids.sort((a,b)=>(rank.get(a)??Infinity)-(rank.get(b)??Infinity));
  const rendered=[];
  for(const id of ids){
   if(hidden.includes(id))continue;
   const original=existing.get(id),overrides=records[id];
   const node=overrides&&(original||overrides.added)?renderItem(doc,kind,original,overrides):original;
   if(node){node.dataset.collectionItem=id;rendered.push(node);}
  }
  container.replaceChildren(...rendered);
  syncCollectionUI(container);
 }
}

export function syncFAQData(doc){
 for(const script of doc.querySelectorAll('script[data-faq-schema]')){
  const list=script.previousElementSibling;if(!list?.matches('.faq-list'))continue;
  const mainEntity=[...list.querySelectorAll('.faq-item')].map(item=>({'@type':'Question',name:read(item,'.faq-question'),acceptedAnswer:{'@type':'Answer',text:read(item,'.faq-answer p')}})).filter(question=>question.name&&question.acceptedAnswer.text);
  const json=JSON.stringify({'@context':'https://schema.org','@type':'FAQPage',mainEntity}).replace(/</g,'\\u003c');if(script.textContent!==json)script.textContent=json;
 }
}

// Module-local tracking is insufficient when the page came from an older static build.
export function managedVersion(content,route){
 const data=signature({page:content?.pages?.[route]||{},shared:content?.shared||{},collections:content?.collections?.[route]||{},team:route==='/team'?content?.teamRoster||{}:null});
 let first=2166136261,second=2246822519;
 for(let i=0;i<data.length;i++){const code=data.charCodeAt(i);first=Math.imul(first^code,16777619);second=Math.imul(second^code,3266489917);}
 return (first>>>0).toString(36)+'-'+(second>>>0).toString(36);
}
export const managedNodeSelector='[data-edit-collection],.leadership-grid,.board-grid,.full-team-grid,.bio-dialog';
export const adminSourceName=route=>route==='/'?'home':route.slice(1).replaceAll('/','_');

const legacyFields=['text','href','src','alt','hidden','additions'];
export function legacyReferences(content,route){
 const result=[];
 for(const group of [content?.shared,content?.pages?.[route]])for(const [id,op] of Object.entries(group||{})){
  if(!validId(id)||!object(op)||op.key&&!validId(op.key))continue;
  const fields=legacyFields.filter(field=>Object.hasOwn(op,field));
  if(fields.length)result.push({id,key:op.key||'',fields});
 }
 return result;
}
export function restoreLegacyFields(doc,source,previous,next){
 const byKey=new Map(next.map(ref=>[ref.key||ref.id,ref]));
 for(const ref of previous){
  if(!validId(ref.id)||ref.key&&!validId(ref.key)||!Array.isArray(ref.fields))continue;
  const selector=ref.key?'[data-admin-key="'+ref.key+'"]':'[data-admin-id="'+ref.id+'"]';
  const target=doc.querySelector(selector),baseline=source.querySelector(selector);
  if(!target||!baseline||target.tagName!==baseline.tagName||target.closest(managedNodeSelector))continue;
  const current=byKey.get(ref.key||ref.id);
  if(ref.fields.includes('additions')&&(!current?.fields.includes('additions')||current.id!==ref.id))for(const added of doc.querySelectorAll('[data-admin-added="'+ref.id+'"]'))added.remove();
  const cleared=ref.fields.filter(field=>legacyFields.includes(field)&&!current?.fields.includes(field));
  const resetAttribute=name=>{const value=baseline.getAttribute(name);if(value===null)target.removeAttribute(name);else target.setAttribute(name,value);};
  for(const field of cleared){
   if(field==='text'){target.replaceChildren(...baseline.cloneNode(true).childNodes);target.style.whiteSpace=baseline.style.whiteSpace||'';}
   else if(field==='src'){for(const name of ['src','srcset','sizes'])resetAttribute(name);target.style.objectFit=baseline.style.objectFit||'';}
   else if(field!=='additions')resetAttribute(field);
  }
 }
}

export function mountManagedRegions(doc,source,route){
 const focused=doc.activeElement,focusKey=focused?.dataset?.adminKey;
 const regions=collectionContainers(doc).map(target=>[target,collectionContainers(source).find(region=>region.dataset.editCollection===target.dataset.editCollection)]);
 if(route==='/team')for(const selector of ['.leadership-grid','.board-grid','.full-team-grid'])regions.push([doc.querySelector(selector),source.querySelector(selector)]);
 if(regions.some(([target,next])=>target&&!next))throw Error('The latest page layout is unavailable.');
 for(const [target,next] of regions){
  if(!target||!next)continue;
  const currentOpen=new Set([...target.querySelectorAll('details[open]')].map(item=>item.dataset.collectionItem));
  for(const detail of next.querySelectorAll('details'))if(currentOpen.has(detail.dataset.collectionItem))detail.open=true;
  if(target.innerHTML!==next.innerHTML){target.replaceChildren(...[...next.childNodes].map(node=>doc.importNode(node,true)));syncCollectionUI(target);}
 }
 if(route==='/team'){
  const main=doc.querySelector('main'),next=[...source.querySelectorAll('.bio-dialog')],before=[...doc.querySelectorAll('.bio-dialog')];
  const identity=items=>items.map(node=>node.outerHTML).join('');
  if(identity(before)!==identity(next)){for(const node of before){if(node.open)node.close?.();node.remove();}main?.append(...next.map(node=>doc.importNode(node,true)));}
 }
 applyLayout(doc,layoutNodes(source).map(node=>node.dataset.layoutItem));
 if(focusKey&&validId(focusKey)&&focused&&!focused.isConnected)doc.querySelector('[data-admin-key="'+focusKey+'"]')?.focus({preventScroll:true});
 syncFAQData(doc);
}
