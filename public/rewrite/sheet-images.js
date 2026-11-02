const normalized=src=>src.replace(/^https:\/\/www\.therewriteitproject\.org/,'').replace(/^https:\/\/drews\.click\/rewrite/,'').replace(/^\/rewrite\//,'/');
export function bindSheetImages(doc,catalog){
 const bySource=new Map(catalog.flatMap(item=>item.aliases.map(src=>[src,item])));
 for(const image of doc.querySelectorAll('img[src]')){
  if(image.id==='viewer-image')continue;
  const item=bySource.get(normalized(image.getAttribute('src')));if(!item)continue;
  image.dataset.sheetImage=item.key;image.dataset.sheetImageDefault='https://www.therewriteitproject.org'+item.source;
  image.dataset.sheetOriginalSrc=image.getAttribute('src');image.dataset.sheetOriginalAlt=image.getAttribute('alt')||'';
  for(const attr of ['srcset','sizes'])if(image.hasAttribute(attr))image.setAttribute('data-sheet-original-'+attr,image.getAttribute(attr));
 }
}
export function applySheetImages(doc,values){
 for(const image of doc.querySelectorAll('[data-sheet-image]')){
  if(!image.sheetImageErrorHandler){image.sheetImageErrorHandler=true;image.addEventListener('error',()=>{const failed=image.getAttribute('src');if(failed===image.dataset.sheetOriginalSrc)return;image.dataset.sheetImageFailed=failed;image.setAttribute('src',image.dataset.sheetOriginalSrc);for(const attr of ['srcset','sizes']){const saved=image.getAttribute('data-sheet-original-'+attr);if(saved!==null)image.setAttribute(attr,saved);}const gallery=image.closest('a[data-lightbox]');if(gallery)gallery.setAttribute('href',image.dataset.sheetOriginalSrc);});}
  const key=image.dataset.sheetImage,overrides=doc.adminImageOverrides?.get(image)||{},raw=values[key],original=image.dataset.sheetOriginalSrc;
  let replacement=null;try{const url=new URL(raw);if(url.protocol==='https:'&&!url.username&&!url.password)replacement=url.href;}catch{}
  if(!overrides.src){
   const custom=replacement&&replacement!==image.dataset.sheetImageDefault,target=custom?replacement:original;
   if(image.dataset.sheetImageFailed===target)continue;
   if(image.getAttribute('src')!==target)image.setAttribute('src',target);
   for(const attr of ['srcset','sizes']){const saved=image.getAttribute('data-sheet-original-'+attr);if(custom)image.removeAttribute(attr);else if(saved!==null)image.setAttribute(attr,saved);}
   const gallery=image.closest('a[data-lightbox]');if(gallery)gallery.setAttribute('href',target);
  }
  if(!overrides.alt){const alt=image.dataset.sheetOriginalAlt?String(values[key+'_alt']??image.dataset.sheetOriginalAlt):'';if(image.getAttribute('alt')!==alt)image.setAttribute('alt',alt);}
 }
}
