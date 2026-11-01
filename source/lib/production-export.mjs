export const productionOrigin='https://therewriteitproject.org';
const demoOrigin='https://drews.click';

// Run after assigning editor identities so saved edits retain their original keys.
export function productionText(text){
 return text.replaceAll(demoOrigin+'/rewrite',productionOrigin)
  .replaceAll('https://rewrite-it-project.drew5.chatgpt.site',productionOrigin)
  .replaceAll('/rewrite/','/')
  .replaceAll('"/rewrite"','"/"');
}

export function productionHtml(html){
 return productionText(html).replace(/<html\b/,'<html data-public-site-origin="'+productionOrigin+'"');
}
