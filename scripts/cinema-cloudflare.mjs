import {readFile,writeFile,stat,readdir,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const root=resolve(process.env.CINEMA_OUTPUT||'cinema-dist');
const max=25*1024*1024;
const archive=join(root,'source.zip');
if((await stat(archive)).size>max){
 const data=await readFile(archive),links=[];
 for(let offset=0,i=1;offset<data.length;offset+=20*1024*1024,i++){
  const name='source.zip.part'+String(i).padStart(3,'0');
  await writeFile(join(root,name),data.subarray(offset,offset+20*1024*1024));links.push('<a href="'+name+'">'+name+'</a>');
 }
 const about=await readFile(join(root,'about.html'),'utf8');
 await writeFile(join(root,'about.html'),about.replace('<a href="source.zip">Corresponding source archive</a>','Corresponding source archive (download all parts, concatenate in order using cat source.zip.part* > source.zip): '+links.join(' · ')));
 await unlink(archive);
}
await writeFile(join(root,'_headers'),`/*
  X-Robots-Tag: noindex, nofollow
/
  Cache-Control: no-cache, must-revalidate
/index.html
  Cache-Control: no-cache, must-revalidate
/version.json
  Cache-Control: no-store
/app.bundle.js
  Cache-Control: no-cache, must-revalidate
/cinema-live.js
  Cache-Control: no-cache, must-revalidate
/assets/cinema.css
  Cache-Control: no-cache, must-revalidate
`);
async function verify(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await verify(path);else if((await stat(path)).size>max)throw Error('Cloudflare asset exceeds 25 MiB: '+path)}}
await verify(root);
console.log('Cinema assets ready for independent Cloudflare Pages deployment.');
