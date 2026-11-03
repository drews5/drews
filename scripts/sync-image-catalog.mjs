import {readFile,writeFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const pages=await read('source/pages.json'),responsive=await read('source/content/responsive-images.json'),reverse=new Map();
for(const [src,variants] of Object.entries(responsive)){reverse.set(src,src);for(const variant of variants)reverse.set(variant.src,src);}
const labels=await read('source/content/image-labels.json');
const previous=await read('source/content/editor-fields.json'),catalog=new Map();
for(const [route,html] of Object.entries(pages)){
 const doc=parseHTML(html).document,canonical=new URL(doc.querySelector('link[rel=canonical]')?.href||'https://example.org/').pathname.replace(/\/$/,'')||'/';if(route!==canonical)continue;
 for(const image of doc.querySelectorAll('img[src]')){
  if(image.id==='viewer-image')continue;
  const source=image.getAttribute('src');if(!/^\/assets\/.+\.(webp|png|jpe?g)(\?|$)/i.test(source))continue;
  const original=reverse.get(source)||source,key='image_'+createHash('sha256').update(original).digest('hex').slice(0,12);
  if(!labels[original])continue;
  const alt=image.alt||'',person=image.closest('.person-card')?.querySelector('h3')?.textContent,partner=image.closest('[data-partner-name]')?.dataset.partnerName;
  const item=catalog.get(key)||{key,original,source,aliases:[...new Set([original,source,...(responsive[original]||[]).map(x=>x.src)])],label:person||partner||alt||original.split('/').at(-1).replace(/\.webp$/,'').replaceAll('-',' '),alt,pages:[]};
  if(!item.alt&&alt){item.alt=alt;if(!person&&!partner)item.label=alt;}
  if(!item.pages.includes(canonical))item.pages.push(canonical);catalog.set(key,item);
 }
}
const images=[...catalog.values()].map(item=>({...item,label:labels[item.original][0],alt:labels[item.original][1]}));await writeFile(new URL('source/content/site-images.json',root),JSON.stringify(images,null,2)+'\n');
const fields=previous.filter(f=>!f.key.startsWith('image_'));
for(const image of images)fields.push({section:'Photos',key:image.key,label:image.label,value:'https://www.therewriteitproject.org'+image.source,type:'image',notes:'Public image link; clear to use the original.'},{section:'Photos',key:image.key+'_alt',label:image.label+' description',value:image.alt,type:'image_alt',notes:'Description in column G of the same image row.'});
await writeFile(new URL('source/content/editor-fields.json',root),JSON.stringify(fields,null,2)+'\n');console.log('Catalogued '+images.length+' unique site images.');
