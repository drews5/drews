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
// The public editor and its authenticated API share the production hostname.
const config=JSON.parse(await readFile(join(root,'public/rewrite/admin-config.json'),'utf8'));
await writeFile(join(out,'admin-config.json'),JSON.stringify({...config,apiBase:productionOrigin+'/admin/api',siteOrigin:productionOrigin,sitePath:''})+'\n');
await writeFile(join(out,'CNAME'),new URL(productionOrigin).hostname+'\n');
await writeFile(join(out,'.nojekyll'),'');
execFileSync(process.execPath,[join(root,'scripts/check-production.mjs')],{stdio:'inherit'});
console.log('Production export ready in _production; portfolio and demo remain unchanged.');
