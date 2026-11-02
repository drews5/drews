import {readFile,writeFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const pages=await read('source/pages.json'),responsive=await read('source/content/responsive-images.json'),reverse=new Map();
for(const [src,variants] of Object.entries(responsive)){reverse.set(src,src);for(const variant of variants)reverse.set(variant.src,src);}
const previous=await read('source/content/editor-fields.json'),catalog=new Map();
for(const [route,html] of Object.entries(pages)){
 const doc=parseHTML(html).document,canonical=new URL(doc.querySelector('link[rel=canonical]')?.href||'https://example.org/').pathname.replace(/\/$/,'')||'/';if(route!==canonical)continue;
 for(const image of doc.querySelectorAll('img[src]')){
  if(image.id==='viewer-image')continue;
  const source=image.getAttribute('src');if(!/^\/assets\/.+\.(webp|png|jpe?g)(\?|$)/i.test(source))continue;
  const original=reverse.get(source)||source,key='image_'+createHash('sha256').update(original).digest('hex').slice(0,12);
  const alt=image.alt||'',person=image.closest('.person-card')?.querySelector('h3')?.textContent,partner=image.closest('[data-partner-name]')?.dataset.partnerName;
  const item=catalog.get(key)||{key,original,source,aliases:[...new Set([original,source,...(responsive[original]||[]).map(x=>x.src)])],label:person||partner||alt||original.split('/').at(-1).replace(/\.webp$/,'').replaceAll('-',' '),alt,pages:[]};
  if(!item.alt&&alt){item.alt=alt;if(!person&&!partner)item.label=alt;}
  if(!item.pages.includes(canonical))item.pages.push(canonical);catalog.set(key,item);
 }
}
const images=[...catalog.values()];await writeFile(new URL('source/content/site-images.json',root),JSON.stringify(images,null,2)+'\n');
const fields=previous.filter(f=>!f.key.startsWith('image_'));
for(const image of images)fields.push({section:'Site images',key:image.key,label:image.label+' — image URL',value:'https://www.therewriteitproject.org'+image.source,type:'image',notes:'Used on '+image.pages.join(', ')+'. Public HTTPS image URL; blank restores the original.'},{section:'Image descriptions',key:image.key+'_alt',label:image.label+' — description',value:image.alt,type:'image_alt',notes:'Describe the photo for screen readers. Decorative images stay decorative.'});
await writeFile(new URL('source/content/editor-fields.json',root),JSON.stringify(fields,null,2)+'\n');console.log('Catalogued '+images.length+' unique site images.');
