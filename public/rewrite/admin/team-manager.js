import {readRoster,readProfile,rosterSections,rosterLimit} from '../team-roster.js';

export function initializeTeamManager({doc=document,getPage,getRoster,setRoster,refresh,uploadPhoto,message}){
 const $=id=>doc.getElementById(id);
 const dialog=$('team-manager'),open=$('manage-team'),form=$('team-person-form'),list=$('team-list-view'),section=$('team-section'),out=$('team-person-list'),status=$('team-manager-status');
 let editing='',baseline=null,changed=false,busy=false;
 const note=text=>status.textContent=text;
 function button(label,action,disabled=false,accessibleLabel=''){
  const b=doc.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;
  if(accessibleLabel)b.setAttribute('aria-label',accessibleLabel);
  b.onclick=action;return b;
 }
 function update(roster,text){setRoster(roster);changed=true;renderList();note(text+' Save or publish from the page toolbar.');}
 function renderList(){
  form.hidden=true;list.hidden=false;out.replaceChildren();
  const page=getPage(),grid=page?.querySelector(rosterSections.find(([key])=>key===section.value)?.[1]||'.full-team-grid');
  const cards=[...(grid?.querySelectorAll('[data-team-member]')||[])],ids=cards.map(card=>card.dataset.teamMember);
  if(!cards.length){const li=doc.createElement('li');li.textContent='No one in this section yet.';out.append(li);}
  cards.forEach((card,index)=>{
   const id=ids[index],name=card.querySelector('h3').textContent,li=doc.createElement('li'),label=doc.createElement('div'),title=doc.createElement('strong'),role=doc.createElement('small'),actions=doc.createElement('div');
   title.textContent=name;role.textContent=card.querySelector('.person-role').textContent;label.append(title,role);actions.className='team-row-actions';
   const move=direction=>{
    const roster=readRoster(getRoster()),next=[...ids];[next[index],next[index+direction]]=[next[index+direction],next[index]];roster.order[section.value]=next;
    update(roster,'Order updated.');const controls=out.children[index+direction]?.querySelectorAll('button'),target=controls?.[direction<0?1:2];(target&&!target.disabled?target:controls?.[0])?.focus();
   };
   actions.append(button('Edit',()=>showForm(id),false,'Edit '+name),button('Move up',()=>move(-1),index===0,'Move up '+name),button('Move down',()=>move(1),index===ids.length-1,'Move down '+name),button('Remove',()=>{
    if(!confirm('Remove '+name+' from the Team page? This removes the profile from every section.'))return;
    const roster=readRoster(getRoster());if(!roster.records[id]?.added&&!roster.removed.includes(id))roster.removed.push(id);delete roster.records[id];
    for(const key of Object.keys(roster.order))roster.order[key]=roster.order[key].filter(entry=>entry!==id);
    update(roster,name+' removed.');(out.children[index]?.querySelector('button')||$('team-add')).focus();
   },false,'Remove '+name));
   li.append(label,actions);out.append(li);
  });
 }
 function showForm(id=''){
  editing=id;baseline=id?readProfile(getPage(),id):null;
  if(id&&!baseline){note('This profile could not be opened. Reopen the Team page and try again.');return;}
  form.reset();list.hidden=true;form.hidden=false;note('');
  $('team-form-title').textContent=id?'Edit person':'Add person';
  $('team-apply').textContent=id?'Apply changes':'Add person';
  $('team-placement').hidden=!!id;$('team-person-section').value=section.value;
  $('team-photo-help').textContent=baseline?.photo?'Leave blank to keep the current headshot.':'Optional. The site logo is shown if there’s no headshot.';
  for(const field of ['name','role','bio','pronouns'])$('team-person-'+field).value=baseline?.[field]||'';
  $('team-person-name').focus();
 }
 form.onsubmit=async event=>{
  event.preventDefault();if(busy)return;
  const roster=readRoster(getRoster());
  if(!editing&&(Object.keys(roster.records).length>=rosterLimit||getPage().querySelectorAll('.full-team-grid [data-team-member]').length>=rosterLimit)){note('The team has reached its profile limit.');return;}
  const fields=Object.fromEntries(['name','role','bio','pronouns'].map(field=>[field,$('team-person-'+field).value.trim()]));
  if(!fields.name||!fields.role){note('Enter a name and role.');return;}
  const submit=$('team-apply');busy=true;submit.disabled=true;
  try{
   const photo=$('team-person-photo').files[0];if(photo){note('Uploading headshot…');fields.photo=await uploadPhoto(photo);}
   if(editing){
    const patch=Object.fromEntries(Object.entries(fields).filter(([key,value])=>value!==baseline[key]));
    if(!Object.keys(patch).length){renderList();return;}
    roster.records[editing]={...roster.records[editing],...patch};
   }else{
    const id=crypto.randomUUID().replaceAll('-','').slice(0,16);
    roster.records[id]={...fields,added:true,section:$('team-person-section').value};
   }
   update(roster,editing?'Profile updated.':'Person added.');$('team-add').focus();
  }catch(error){note(error.message);}finally{busy=false;submit.disabled=false;}
 };
 open.onclick=()=>{if(!getPage()){message('Wait for the Team page to load.');return;}changed=false;section.value='full';note('');renderList();dialog.showModal();};
 $('team-add').onclick=()=>showForm();
 $('team-cancel').onclick=()=>{if(!busy){renderList();note('');$('team-add').focus();}};
 section.onchange=()=>{renderList();note('');};
 const canClose=()=>!busy&&(form.hidden||confirm('Close without applying these profile changes?'));
 $('team-done').onclick=()=>{if(canClose())dialog.close();};
 dialog.addEventListener('cancel',event=>{if(!canClose())event.preventDefault();});
 dialog.addEventListener('close',()=>{if(changed)refresh();open.focus();});
}
