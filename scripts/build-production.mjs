import {execFileSync} from 'node:child_process';
import {cp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {productionOrigin,productionText,productionHtml} from '../source/lib/production-export.mjs';

const root=resolve(import.meta.dirname,'..'),out=join(root,'_production');
if(!process.argv.includes('--from-build'))execFileSync(process.execPath,[join(root,'scripts/build.mjs')],{stdio:'inherit'});
await rm(out,{recursive:true,force:true});
await cp(join(root,'_site/rewrite'),out,{recursive:true});
async function convert(dir){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const file=join(dir,entry.name);
  if(entry.isDirectory()){await convert(file);continue;}
  if(!/\.(?:html|css|js|json|xml|svg|txt)$/.test(entry.name))continue;
  if(file===join(out,'admin-runtime.js'))continue;
  const original=await readFile(file,'utf8');
  let text=entry.name.endsWith('.html')?productionHtml(original):productionText(original);
  if(dir===join(out,'admin-source')&&entry.name.endsWith('.json')){
   const source=JSON.parse(original);source.html=productionHtml(source.html);text=JSON.stringify(source);
  }
  await writeFile(file,text);
 }
}
await convert(out);
// Keep bookmarked editor entries on the main site; the editor opens over the homepage.
const editorUrl='/?edit=1';
await writeFile(join(out,'admin/index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Website editor</title><meta http-equiv="refresh" content="0;url=${editorUrl}"></head><body><a href="${editorUrl}">Open website editor</a><script>location.replace(${JSON.stringify(editorUrl)}+location.hash)</script></body></html>`);
await writeFile(join(out,'CNAME'),new URL(productionOrigin).hostname+'\n');
await writeFile(join(out,'.nojekyll'),'');
execFileSync(process.execPath,[join(root,'scripts/check-production.mjs')],{stdio:'inherit'});
console.log('Production export ready in _production; portfolio and demo remain unchanged.');
