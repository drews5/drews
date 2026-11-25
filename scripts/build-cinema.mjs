import {execFileSync} from 'node:child_process';
import {mkdtemp,cp,rm,readFile,writeFile,rename,access,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const repo='https://github.com/gablilli/NuvioWeb.git';
const revision='5dbf74a5b510dfb160817d209a3869b27e97dd51';
const sourceUrl='https://github.com/gablilli/NuvioWeb/tree/'+revision;
const root=resolve(import.meta.dirname,'..');
const target=resolve(process.env.CINEMA_OUTPUT||join(root,'_site','cinema'));
const work=await mkdtemp(join(tmpdir(),'cinema-'));
const source=join(work,'source');
const staging=target+'.staging';
const cache=process.env.CINEMA_CORE_CACHE?resolve(process.env.CINEMA_CORE_CACHE):null;
const run=(cmd,args,cwd)=>execFileSync(cmd,args,{cwd,stdio:'inherit',timeout:240000,env:{...process.env,HUSKY:'0'}});
try{
 run('git',['init',source],work);
 run('git',['fetch','--depth=1',repo,revision],source);
 run('git',['checkout','--detach','FETCH_HEAD'],source);
 const checked=execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim();
 if(checked!==revision)throw Error('Upstream revision mismatch');
 // Patch the upstream source, not the generated files, so updates are reproducible.
 const indexFile=join(source,'index.html');
 const index=await readFile(indexFile,'utf8');
 const viewport='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
 if(!index.includes(viewport))throw Error('Upstream viewport changed');
 await cp(join(root,'scripts','cinema-mobile.css'),join(source,'assets','cinema-mobile.css'));
 await writeFile(indexFile,index.replace(viewport,'width=device-width, initial-scale=1.0').replace('</head>','<link rel="stylesheet" href="assets/cinema-mobile.css?v=2"></head>'));
 const appFile=join(source,'js','app.js');
 const app=await readFile(appFile,'utf8');
 const updateStart='async function checkForAppUpdateOnStartup() {';
 if(!app.includes(updateStart))throw Error('Upstream update hook changed');
 await writeFile(appFile,app.replace(updateStart,updateStart+'\n  // Hosted browser builds update on deployment; a TV installer is not applicable.\n  if (!Platform.isTizen() && !Platform.isWebOS()) return;'));
 const dist=join(source,'dist');
 // Core cache excludes CSS-only changes. Its key covers the exact upstream and build script.
 const coreKey=createHash('sha256').update(revision).update(await readFile(join(root,'scripts','build-cinema.mjs'))).update(process.version).digest('hex');
 const cached=cache&&join(cache,coreKey);
 let restored=false;
 if(cached)try{await access(join(cached,'app.bundle.js'));await cp(cached,dist,{recursive:true});restored=true;}catch{}
 if(!restored){
  run('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],source);
  run('npm',['run','build'],source);
  if(cached){await mkdir(cache,{recursive:true});await rm(cached,{recursive:true,force:true});await cp(dist,cached,{recursive:true});}
 }
 // Always overlay the newest stylesheet, even when restoring the compiled core.
 await cp(join(source,'assets','cinema-mobile.css'),join(dist,'assets','cinema-mobile.css'));
 for(const path of ['index.html','app.bundle.js','core-js.bundle.js','nuvio.env.js','css/bundle.css'])await access(join(dist,path));
 await mkdir(resolve(target,'..'),{recursive:true});
 await rm(staging,{recursive:true,force:true});
 await cp(dist,staging,{recursive:true});
 await cp(join(source,'LICENSE'),join(staging,'LICENSE'));
 // Distribute the complete corresponding upstream source alongside the application.
 await mkdir(join(source,'cinema-downstream'),{recursive:true});
 for(const name of ['build-cinema.mjs','cinema-live.js'])await cp(join(root,'scripts',name),join(source,'cinema-downstream',name));
 run('git',['add','-f','index.html','js/app.js','assets/cinema-mobile.css','cinema-downstream'],source);
 const sourceTree=execFileSync('git',['write-tree'],{cwd:source,encoding:'utf8'}).trim();
 run('git',['archive','--format=zip','--output='+join(staging,'source.zip'),sourceTree],source);
 const cssHash=createHash('sha256').update(await readFile(join(staging,'assets','cinema-mobile.css'))).digest('hex').slice(0,16);
 const appHash=createHash('sha256').update(await readFile(join(staging,'app.bundle.js'))).update(await readFile(join(root,'scripts','cinema-live.js'))).digest('hex').slice(0,16);
 await cp(join(root,'scripts','cinema-live.js'),join(staging,'cinema-live.js'));
 await writeFile(join(staging,'version.json'),JSON.stringify({app:appHash,css:cssHash}));
 const html=await readFile(join(staging,'index.html'),'utf8');
 await writeFile(join(staging,'index.html'),html.replace(/app\.bundle\.js\?v=[^"']+/g,'app.bundle.js?v='+appHash).replace(/assets\/cinema-mobile\.css\?v=[^"']+/g,'assets/cinema-mobile.css?v='+cssHash).replace('</head>','<script defer src="cinema-live.js?v='+appHash+'" data-app="'+appHash+'" data-css="'+cssHash+'"></script><meta name="robots" content="noindex,nofollow"><link rel="license" href="LICENSE"><link rel="author" href="about.html"></head>'));
 await writeFile(join(staging,'about.html'),'<meta charset="utf-8"><title>About Cinema</title><h1>Cinema — Nuvio Web</h1><p>Unofficial downstream build of Nuvio Web, based on NuvioMedia/NuvioTVSmart. Nuvio and its contributors retain their copyrights. GPL v3.</p><p><a href="'+sourceUrl+'">Pinned upstream source</a> · <a href="source.zip">Corresponding source archive</a> · <a href="LICENSE">License</a> · <a href="./">Open Cinema</a></p><p>Browser playback only; use media you are authorized to access.</p>');
 await rm(target,{recursive:true,force:true});
 await rename(staging,target);
 console.log('Cinema built from Nuvio revision '+revision);
}catch(error){
 await rm(staging,{recursive:true,force:true});
 console.error('Cinema build failed; leaving the existing Cinema status page intact.',error);
 process.exitCode=1;
}finally{await rm(work,{recursive:true,force:true});}
