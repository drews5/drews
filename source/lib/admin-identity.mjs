import {createHash} from 'node:crypto';
const hash=text=>createHash('sha256').update(text).digest('hex').slice(0,16);
function token(el){
 if(el.id)return el.tagName+'#'+el.id;
 for(const attr of ['data-content','data-site-number','data-site-price'])if(el.hasAttribute(attr))return el.tagName+'['+attr+'='+el.getAttribute(attr)+']';
 if(el.tagName==='A')return 'A:'+el.getAttribute('href')?.split('?')[0];
 if(el.tagName==='IMG')return 'IMG:'+el.getAttribute('src');
 if(el.tagName==='LI'&&el.querySelector(':scope > a[href]'))return 'LI:'+el.querySelector(':scope > a[href]').getAttribute('href')?.split('?')[0];
 const classes=[...el.classList].filter(c=>!['active','current','is-open','selected'].includes(c));
 if(classes.length)return el.tagName+'.'+classes.sort().join('.');
 return el.tagName;
}
export function assignAdminIdentity(document,route){
 for(const container of document.querySelectorAll('main,header.site-header,footer.site-footer')){
  const prefix=container.tagName==='MAIN'?route:'shared';
  const assign=(el,legacy,semantic)=>{
   el.dataset.adminId=hash(prefix+':'+legacy);el.dataset.adminKey=hash(prefix+':'+semantic);
   const seen=new Map();[...el.children].forEach((child,index)=>{const name=token(child),ordinal=seen.get(name)||0;seen.set(name,ordinal+1);assign(child,legacy+'/'+child.tagName+':'+index,semantic+'/'+name+':'+ordinal);});
  };assign(container,container.tagName,token(container));
 }
}
