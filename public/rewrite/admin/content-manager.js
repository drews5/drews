import {managedKinds,collectionItems,collectionTypes,collectionLimit,collectionUrl,readCollection} from '../content-collections.js';

const guidance={
 questions:'Add, reorder, or hide questions. Changes also update the search result information for this page.',
 partners:'Manage the organizations listed in the directory. A website link and a logo are optional.',
 milestones:'Add or reorder milestones in the organization’s story.',
 gallery:'Choose the photos shown in the Impact gallery. Use the description to tell visitors what’s pictured.',
 testimonials:'Add or reorder quotes shown in the homepage carousel.',
 layout:'Move these sections up or down. The page opening and any forms stay in place.',
 updates:'Add an announcement or story at the bottom of this page. You can include a photo or a button.',
};
export function initializeContentManager({doc=document,getPage,getDefaults,getContent,setContent,refresh,uploadPhoto,message,getTitle,pending=()=>{}}){
 const $=id=>doc.getElementById(id),dialog=$('content-manager'),launch=$('manage-page'),form=$('manage-content-form');
 const picker=$('manage-content-kind'),rows=$('manage-content-rows'),fields=$('manage-content-fields'),note=$('manage-content-status');
 let kind='',editing='',baseline={},controls={},busy=false,changed=false,formTouched=false;
 const type=()=>collectionTypes[kind],data=()=>readCollection(kind,getContent(kind));
 const list=()=>collectionItems(getPage(),kind);
 const labelOf=item=>item?.values.title||item?.values.alt||'Photo';
 const announce=text=>note.textContent=text;
 function button(text,action,label='',disabled=false){
  const btn=doc.createElement('button');btn.type='button';btn.textContent=text;btn.onclick=action;btn.disabled=disabled;
  if(label)btn.setAttribute('aria-label',label);return btn;
 }
 function save(value,description){
  setContent(kind,value);changed=true;showList();announce(description+' Use Save draft to keep it.');return true;
 }
 function row(container,id,label,actions){
  const li=doc.createElement('li'),heading=doc.createElement('strong'),controls=doc.createElement('div');
  li.dataset.row=id;heading.textContent=label;controls.className='manage-row-actions';controls.append(...actions);li.append(heading,controls);container.append(li);
 }
 function focusRow(index){
  const controls=rows.children[Math.max(0,Math.min(index,rows.children.length-1))];
  (controls?.querySelector('button:not([disabled])')||$('manage-content-add')).focus();
 }
 function showList(){
  form.hidden=true;pending(false);$('manage-content-list').hidden=false;rows.replaceChildren();
  const config=data(),items=list(),defaults=collectionItems(getDefaults(),kind);
  const byId=new Map(defaults.map(item=>[item.id,item]));
  const ids=items.map(item=>item.id);
  $('manage-content-add').textContent='Add '+type().singular;
  $('manage-content-add').hidden=kind==='layout';
  $('manage-content-add').disabled=new Set([...defaults.map(item=>item.id),...Object.keys(config.records)]).size>=collectionLimit;
  $('manage-content-help').textContent=guidance[kind];
  if(!items.length){const node=doc.createElement('li');node.textContent='Nothing is shown here yet.';rows.append(node);}
  items.forEach(({id,values},index)=>{
   const name=labelOf({values}),move=(offset)=>{
    const next=data(),keys=[...ids];[keys[index+offset],keys[index]]=[keys[index],keys[index+offset]];
    next.order=keys;save(next,'Order updated.');focusRow(index+offset);
   };
   const created=config.records[id]?.added;
   const movement=[button('Move up',()=>move(-1),'Move up '+name,index===0),button('Move down',()=>move(1),'Move down '+name,index===ids.length-1)];
   if(kind==='layout'){row(rows,id,name,movement);return;}
   row(rows,id,name,[button('Edit',()=>showForm(id),'Edit '+name),...movement,
    button(created?'Remove':'Hide',()=>{
     const next=data();
     if(created){
      if(!confirm('Remove “'+name+'” from this list? You can undo this change before publishing.'))return;
      delete next.records[id];next.order=next.order.filter(key=>key!==id);next.hidden=next.hidden.filter(key=>key!==id);
     }else if(!next.hidden.includes(id))next.hidden.push(id);
     save(next,created?'Item removed.':'Item hidden.');focusRow(index);
    },(created?'Remove ':'Hide ')+name)]);
  });
  const hidden=$('manage-content-hidden'),hiddenRows=$('manage-content-hidden-list');hiddenRows.replaceChildren();
  const available=config.hidden.filter(id=>byId.has(id));
  hidden.hidden=available.length===0;hidden.querySelector('summary').textContent='Hidden items ('+available.length+')';
  for(const id of available){
   const item=byId.get(id),name=labelOf({values:{...item.values,...config.records[id]}});
   row(hiddenRows,id,name,[button('Show',()=>{const next=data();next.hidden=next.hidden.filter(key=>key!==id);save(next,'Item shown.');focusRow(list().findIndex(entry=>entry.id===id));},'Show '+name)]);
  }
  $('manage-content-reset').hidden=!getContent(kind)||kind==='updates';
  $('manage-content-reset').textContent=kind==='layout'?'Restore original section order':'Restore this list to its defaults';
 }
 function showForm(id=''){
  const item=id?list().find(row=>row.id===id):null;
  if(id&&!item){announce('This item is no longer in the draft. Reopen Manage content.');return;}
  editing=id;baseline=item?.values||{};controls={};formTouched=false;
  fields.replaceChildren();form.hidden=false;$('manage-content-list').hidden=true;announce('');
  $('manage-content-form-title').textContent=(id?'Edit ':'Add ')+type().singular;
  for(const f of type().fields){
   const label=doc.createElement('label');label.textContent=f.label+(f.required?'':' (optional)');
   const input=doc.createElement(f.kind==='long'?'textarea':'input');input.name=f.key;controls[f.key]=input;
   if(f.kind==='photo'){
    input.type='file';input.accept='image/*';input.required=f.required&&!baseline[f.key];label.append(input);fields.append(label);
    if(baseline[f.key]){
     const help=doc.createElement('span');help.className='field-help';help.textContent='Leave blank to keep the current photo.';fields.append(help);
     if(!f.required){
      const remove=doc.createElement('input');remove.type='checkbox';controls.removePhoto=remove;const line=doc.createElement('label');line.className='manage-inline-check';line.append(remove,doc.createTextNode('Remove current photo'));fields.append(line);
     }
    }
    continue;
   }
   if(f.kind==='long')input.rows=5;
   if(f.kind==='url')input.placeholder='https://… or /contact/';
   input.maxLength=f.limit;input.required=f.required;input.value=baseline[f.key]||'';label.append(input);fields.append(label);
  }
  Object.values(controls)[0]?.focus();
 }
 async function submit(event){
  event.preventDefault();if(busy)return;
  const next=data(),isNew=!editing;
  if(isNew&&$('manage-content-add').disabled)return;
  const values={};
  for(const f of type().fields){
   if(f.kind==='photo')continue;
   const value=controls[f.key].value.trim();
   if(f.required&&!value){announce('Enter '+f.label.toLowerCase()+'.');controls[f.key].focus();return;}
   if(value.length>f.limit){announce(f.label+' must be shorter.');controls[f.key].focus();return;}
   if(f.kind==='url'&&value&&!collectionUrl(value)){announce('Enter a full HTTPS link or a path such as /contact/.');controls[f.key].focus();return;}
   values[f.key]=value;
  }
  if(kind==='updates'&&!!values.linkLabel!==!!values.url){announce('Enter both button text and a link, or leave both blank.');return;}
  const photo=controls.image?.files?.[0],removePhoto=controls.removePhoto?.checked&&!photo;
  if(type().fields.some(f=>f.kind==='photo'&&f.required)&&!photo&&!baseline.image){announce('Choose a photo.');return;}
  const apply=$('manage-content-apply');busy=true;apply.disabled=true;
  try{
   if(photo){announce('Uploading photo…');values.image=await uploadPhoto(photo);}
   else if(removePhoto){values.image='';if(Object.hasOwn(values,'alt'))values.alt='';}
   const patch=Object.fromEntries(Object.entries(values).filter(([key,value])=>value!==(baseline[key]||'')));
   let id=editing;
   if(isNew){id=crypto.randomUUID().replaceAll('-','').slice(0,16);next.records[id]={...values,added:true};}
   else if(Object.keys(patch).length)next.records[id]={...next.records[id],...patch};
   else{showList();return;}
   save(next,isNew?'Item added.':'Item updated.');focusRow(list().findIndex(item=>item.id===id));
  }catch(error){announce(error.message||'Could not save this item. Try again.');}
  finally{busy=false;apply.disabled=false;}
 }
 function open(requestedKind,id){
  const page=getPage();if(!page){message('Wait for the page to load.');return;}
  const kinds=managedKinds(page);
  if(!kinds.length)return;
  picker.replaceChildren();
  for(const value of kinds){const option=doc.createElement('option');option.value=value;option.textContent=collectionTypes[value].title;picker.append(option);}
  kind=kinds.includes(requestedKind)?requestedKind:kinds[0];picker.value=kind;changed=false;
  $('manage-content-page').textContent=getTitle();announce('');showList();
  dialog.showModal();if(id&&list().some(item=>item.id===id))showForm(id);
 }
 const canClose=()=>!busy&&(form.hidden||!formTouched||confirm('Close without applying these item changes?'));
 launch.onclick=()=>open();
 picker.onchange=()=>{kind=picker.value;announce('');showList();};
 $('manage-content-add').onclick=()=>showForm();
 $('manage-content-reset').onclick=()=>{if(confirm('Restore the original items and order for this list? You can undo this change before publishing.'))save(undefined,'Default list restored.');};
 $('manage-content-cancel').onclick=()=>{if(canClose()){showList();announce('');$('manage-content-add').focus();}};
 $('manage-content-done').onclick=()=>{if(canClose())dialog.close();};
 form.addEventListener('input',()=>{formTouched=true;pending(true);});form.addEventListener('change',()=>{formTouched=true;pending(true);});form.onsubmit=submit;
 dialog.addEventListener('cancel',event=>{if(!canClose())event.preventDefault();});
 dialog.addEventListener('close',()=>{pending(false);if(changed)refresh();launch.focus();});
 return {open};
}
