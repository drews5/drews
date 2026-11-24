// Changes are stored alongside the existing draft edits; original profiles stay in the site source.
export const rosterSections=[['full','.full-team-grid','The full team'],['leadership','.leadership-grid','Executive leadership'],['board','.board-grid','Board of directors']];
export const rosterLimit=100;
const keyPattern=/^[a-f0-9]{16}$/;
const profileLimits={name:120,role:160,bio:8000,pronouns:60};
const blankNames=new Set(['name','role']);
const cached=new WeakMap();
const element=(doc,tag,cls,text)=>{const node=doc.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};

export function readRoster(raw){
 const records=Object.create(null),removed=[],order=Object.create(null);
 for(const [id,entry] of Object.entries(raw?.records||{}).slice(0,rosterLimit)){
  if(!keyPattern.test(id)||!entry||typeof entry!=='object')continue;
  const profile={};
  for(const [field,max] of Object.entries(profileLimits)){
   if(typeof entry[field]==='string'&&entry[field].length<=max&&(!blankNames.has(field)||entry[field].trim()))profile[field]=entry[field].trim();
  }
  if(typeof entry.photo==='string'&&entry.photo.length<=2048)try{const url=new URL(entry.photo);if(url.protocol==='https:'&&!url.username&&!url.password)profile.photo=url.href;}catch{}
  if(entry.added===true&&profile.name&&profile.role){profile.added=true;profile.section=['leadership','board'].includes(entry.section)?entry.section:'full';}
  if(Object.keys(profile).length)records[id]=profile;
 }
 if(Array.isArray(raw?.removed))for(const id of raw.removed.slice(0,rosterLimit))if(typeof id==='string'&&keyPattern.test(id))removed.push(id);
 for(const [section] of rosterSections)if(Array.isArray(raw?.order?.[section]))order[section]=[...new Set(raw.order[section].slice(0,rosterLimit).filter(id=>typeof id==='string'&&keyPattern.test(id)))];
 return {records,removed,order};
}

export function readProfile(doc,id){
 const card=doc.querySelector('.full-team-grid [data-team-member="'+id+'"]'),dialog=doc.querySelector('dialog[data-team-member="'+id+'"]');
 if(!card||!dialog)return null;
 const read=(node,selector)=>node.querySelector(selector)?.textContent.trim()||'';
 const role=read(card,'.person-role'),bioRole=read(dialog,'.person-role');
 return {name:read(card,'h3'),role,pronouns:bioRole.includes(' · ')?bioRole.split(' · ').slice(1).join(' · '):'',bio:read(dialog,'[data-team-bio]'),photo:card.querySelector('img')?.getAttribute('src')||''};
}

function makeProfile(doc,id,profile,grids){
 const dialogId='person-added-'+id,bio=element(doc,'dialog','bio-dialog');
 bio.id=dialogId;bio.dataset.teamMember=id;bio.setAttribute('aria-labelledby',dialogId+'-title');
 const dismiss=element(doc,'button','dialog-close','×');dismiss.type='button';dismiss.dataset.close='';dismiss.setAttribute('aria-label','Close biography');
 const copy=element(doc,'div'),title=element(doc,'h2');title.id=dialogId+'-title';
 const paragraph=element(doc,'p');paragraph.dataset.teamBio='';
 copy.append(title,element(doc,'p','person-role'),paragraph);bio.append(dismiss,element(doc,'img'),copy);
 doc.querySelector('main').append(bio);
 for(const section of new Set(['full',profile.section])){
  const grid=grids.get(section);if(!grid)continue;
  const card=element(doc,'article','person-card');card.dataset.teamMember=id;card.dataset.group=profile.section==='board'?'board of directors':'';
  const photo=element(doc,'button','person-photo'),pic=element(doc,'img');pic.loading='lazy';pic.decoding='async';photo.append(pic);
  const button=element(doc,'button','bio-button','Read bio →');
  for(const trigger of [photo,button]){trigger.type='button';trigger.dataset.openDialog=dialogId;}
  card.append(photo,element(doc,'h3'),element(doc,'p','person-role'),button);grid.append(card);
 }
}

function updatePhoto(node,src,name){
 if(!node)return;
 if(src&&node.getAttribute('src')!==src){node.setAttribute('src',src);node.removeAttribute('srcset');node.removeAttribute('sizes');node.removeAttribute('width');node.removeAttribute('height');}
 if(name!==undefined)node.alt=name;
}

export function applyTeamRoster(doc,raw){
 const grids=new Map(rosterSections.map(([key,selector])=>[key,doc.querySelector(selector)]).filter(([,grid])=>grid));
 if(!grids.get('full')||!doc.querySelector('[data-team-member]')&&!raw)return;
 let state=cached.get(doc);
 if(!state){state={members:new Map(),last:''};cached.set(doc,state);}
 const roster=readRoster(raw),signature=JSON.stringify(roster);
 if(signature!==state.last){
  const active=doc.activeElement;
  for(const [id,parts] of state.members){
   if(roster.removed.includes(id)||parts.added&&!roster.records[id]?.added){
    for(const [container,node] of parts.nodes){
     if(node.parentNode!==container)continue;
     if(node.open)node.close?.();
     node.remove();
    }
   }else for(const [container,node] of parts.nodes)if(!node.parentNode)container.append(node);
  }
  for(const [id,profile] of Object.entries(roster.records))if(profile.added&&!roster.removed.includes(id)&&!doc.querySelector('.full-team-grid [data-team-member="'+id+'"]'))makeProfile(doc,id,profile,grids);
  for(const node of doc.querySelectorAll('.person-card[data-team-member],dialog.bio-dialog[data-team-member]')){
   const id=node.dataset.teamMember,parts=state.members.get(id)||{added:!!roster.records[id]?.added,nodes:[]};
   if(!parts.nodes.some(([,known])=>known===node))parts.nodes.push([node.parentNode,node]);state.members.set(id,parts);
   if(roster.removed.includes(id)){if(node.open)node.close?.();node.remove();}
  }
  for(const [section,grid] of grids){
   const current=[...grid.children],order=roster.order[section]||[],ranks=new Map(order.map((id,index)=>[id,index]));
   const sorted=[...current].sort((a,b)=>(ranks.get(a.dataset.teamMember)??Infinity)-(ranks.get(b.dataset.teamMember)??Infinity));
   if(sorted.some((card,i)=>card!==current[i]))grid.append(...sorted);
  }
  if(active?.isConnected&&doc.activeElement!==active)active.focus({preventScroll:true});
  state.last=signature;
 }
 for(const [id,parts] of state.members){
  const profile=roster.records[id]||{};
  const card=parts.nodes.find(([container,node])=>container===grids.get('full')&&node.matches('.person-card'))?.[1];
  const dialog=parts.nodes.find(([,node])=>node.matches('dialog'))?.[1];
  const existingPronouns=dialog?.querySelector('.person-role')?.textContent.split(' · ').slice(1).join(' · ')||'';
  const role=profile.role??card?.querySelector('.person-role')?.textContent??'';
  const name=profile.name??card?.querySelector('h3')?.textContent??'';
  for(const [container,node] of parts.nodes){
   if(node.parentNode!==container)continue;
   if(node.matches('.person-card')){
    if(profile.name!==undefined)node.querySelector('h3').textContent=name;
    if(profile.role!==undefined)node.querySelector('.person-role').textContent=role;
    node.dataset.name=node.querySelector('h3').textContent.toLowerCase();node.dataset.role=node.querySelector('.person-role').textContent.toLowerCase();
    node.querySelector('.person-photo')?.setAttribute('aria-label','Read about '+node.querySelector('h3').textContent);
   }else{
    if(profile.name!==undefined)node.querySelector('h2').textContent=name;
    if(profile.role!==undefined||profile.pronouns!==undefined){const pronouns=profile.pronouns??existingPronouns;node.querySelector('.person-role').textContent=role+(pronouns?' · '+pronouns:'');}
    if(profile.bio!==undefined)node.querySelector('[data-team-bio]').textContent=profile.bio;
   }
   updatePhoto(node.querySelector('img'),profile.photo||(profile.added?(doc.documentElement.dataset.publicSiteOrigin?'':'/rewrite')+'/assets/logo.webp':''),profile.name);
  }
 }
 const results=doc.querySelector('#team-results'),count=grids.get('full').children.length;
 // The mounted page re-applies the active search and department filter.
 if(results&&!doc.documentElement.classList.contains('js'))results.textContent=count+' team member'+(count===1?'':'s');
}
