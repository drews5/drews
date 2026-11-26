// Builds Cinema (downstream Nuvio Web) into CINEMA_OUTPUT. See cinema/README.md.
import {execFileSync} from 'node:child_process';
import {mkdtemp,cp,rm,readFile,writeFile,rename,access,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {patchUpstream} from '../cinema/patches.mjs';

const repo='https://github.com/gablilli/NuvioWeb.git';
const revision='5dbf74a5b510dfb160817d209a3869b27e97dd51';
const sourceUrl='https://github.com/gablilli/NuvioWeb/tree/'+revision;
const root=resolve(import.meta.dirname,'..');
const cinemaDir=join(root,'cinema');
const target=resolve(process.env.CINEMA_OUTPUT||join(root,'_site','cinema'));
const staging=target+'.staging';
const cache=process.env.CINEMA_CORE_CACHE?resolve(process.env.CINEMA_CORE_CACHE):null;
const sha=data=>createHash('sha256').update(data).digest('hex').slice(0,16);
const run=(cmd,args,cwd)=>execFileSync(cmd,args,{cwd,stdio:'inherit',timeout:240000,env:{...process.env,HUSKY:'0'}});

// The design layer is plain CSS split by area and concatenated in filename order.
export async function bundleStyles(){
 const dir=join(cinemaDir,'styles');
 const names=(await readdir(dir)).filter(n=>n.endsWith('.css')).sort();
 const parts=await Promise.all(names.map(async n=>`/* ${n} */\n`+await readFile(join(dir,n),'utf8')));
 return parts.join('\n');
}

// Compiled Nuvio output depends only on upstream, patches and toolchain; styles are overlaid.
async function coreKey(){
 const h=createHash('sha256').update(revision).update(process.version);
 for(const f of ['scripts/build-cinema.mjs','cinema/patches.mjs'])h.update(await readFile(join(root,f)));
 return h.digest('hex');
}

async function main(){
 const work=await mkdtemp(join(tmpdir(),'cinema-'));
 const source=join(work,'source');
 try{
  run('git',['init','-q',source],work);
  run('git',['fetch','-q','--depth=1',repo,revision],source);
  run('git',['checkout','-q','--detach','FETCH_HEAD'],source);
  if(execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim()!==revision)throw Error('Upstream revision mismatch');
  const patched=await patchUpstream(source);
  const dist=join(source,'dist');
  const cached=cache&&join(cache,await coreKey());
  let restored=false;
  if(cached)try{await access(join(cached,'app.bundle.js'));await cp(cached,dist,{recursive:true});restored=true;}catch{}
  if(!restored){
   run('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],source);
   run('npm',['run','build'],source);
   if(cached){await mkdir(cache,{recursive:true});await rm(cached,{recursive:true,force:true});await cp(dist,cached,{recursive:true});}
  }
  console.log(restored?'Restored compiled Nuvio core from cache':'Compiled Nuvio core');
  for(const path of ['index.html','app.bundle.js','core-js.bundle.js','nuvio.env.js','css/bundle.css'])await access(join(dist,path));
  await mkdir(resolve(target,'..'),{recursive:true});
  await rm(staging,{recursive:true,force:true});
  await cp(dist,staging,{recursive:true});
  await cp(join(source,'LICENSE'),join(staging,'LICENSE'));
  const css=await bundleStyles();
  await writeFile(join(staging,'assets','cinema.css'),css);
  await cp(join(root,'scripts','cinema-live.js'),join(staging,'cinema-live.js'));
  // Corresponding source: pinned upstream plus every downstream file (GPL-3.0).
  await cp(cinemaDir,join(source,'cinema-downstream','cinema'),{recursive:true});
  for(const name of ['build-cinema.mjs','cinema-live.js','cinema-cloudflare.mjs','cinema-dev.mjs'])await cp(join(root,'scripts',name),join(source,'cinema-downstream',name));
  run('git',['add','-f',...patched,'cinema-downstream'],source);
  const tree=execFileSync('git',['write-tree'],{cwd:source,encoding:'utf8'}).trim();
  run('git',['archive','--format=zip','--output='+join(staging,'source.zip'),tree],source);
  const cssHash=sha(css);
  const appHash=sha(Buffer.concat([await readFile(join(staging,'app.bundle.js')),await readFile(join(staging,'nuvio.env.js')),await readFile(join(staging,'cinema-live.js'))]));
  await writeFile(join(staging,'version.json'),JSON.stringify({app:appHash,css:cssHash}));
  const html=await readFile(join(staging,'index.html'),'utf8');
  const stamped=html
   .replace('src="nuvio.env.js"','src="nuvio.env.js?v='+appHash+'"')
   .replace(/app\.bundle\.js(\?v=[^"']*)?"/g,'app.bundle.js?v='+appHash+'"')
   .replace('assets/cinema.css?v=dev','assets/cinema.css?v='+cssHash)
   .replace('</head>','<script defer src="cinema-live.js?v='+appHash+'" data-app="'+appHash+'" data-css="'+cssHash+'"></script><meta name="robots" content="noindex,nofollow"><link rel="license" href="LICENSE"><link rel="author" href="about.html"></head>');
  if(!stamped.includes('cinema.css?v='+cssHash)||!stamped.includes('app.bundle.js?v='+appHash))throw Error('Failed to stamp asset versions');
  await writeFile(join(staging,'index.html'),stamped);
  await writeFile(join(staging,'about.html'),'<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>About Cinema</title><h1>Cinema — Nuvio Web</h1><p>Unofficial downstream build of Nuvio Web, based on NuvioMedia/NuvioTVSmart. Nuvio and its contributors retain their copyrights. GPL v3.</p><p><a href="'+sourceUrl+'">Pinned upstream source</a> · <a href="source.zip">Corresponding source archive</a> · <a href="LICENSE">License</a> · <a href="./">Open Cinema</a></p><p>Browser playback only; use media you are authorized to access.</p>');
  await rm(target,{recursive:true,force:true});
  await rename(staging,target);
  console.log('Cinema built from Nuvio revision '+revision+' (app '+appHash+', css '+cssHash+')');
 }catch(error){
  await rm(staging,{recursive:true,force:true});
  console.error('Cinema build failed; leaving the existing Cinema output intact.',error);
  process.exitCode=1;
 }finally{await rm(work,{recursive:true,force:true});}
}

if(import.meta.url===`file://${process.argv[1]}`)await main();
