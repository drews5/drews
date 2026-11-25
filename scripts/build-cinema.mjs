import {execFileSync} from 'node:child_process';
import {mkdtemp,cp,rm,readFile,writeFile,rename,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const repo='https://github.com/gablilli/NuvioWeb.git';
const revision='5dbf74a5b510dfb160817d209a3869b27e97dd51';
const sourceUrl='https://github.com/gablilli/NuvioWeb/tree/'+revision;
const root=resolve(import.meta.dirname,'..');
const target=join(root,'_site','cinema');
const work=await mkdtemp(join(tmpdir(),'cinema-'));
const source=join(work,'source');
const staging=join(root,'_site','.cinema-staging');
const run=(cmd,args,cwd)=>execFileSync(cmd,args,{cwd,stdio:'inherit',timeout:240000,env:{...process.env,HUSKY:'0'}});
try{
 run('git',['init',source],work);
 run('git',['fetch','--depth=1',repo,revision],source);
 run('git',['checkout','--detach','FETCH_HEAD'],source);
 const checked=execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim();
 if(checked!==revision)throw Error('Upstream revision mismatch');
 run('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],source);
 run('npm',['run','build'],source);
 const dist=join(source,'dist');
 for(const path of ['index.html','app.bundle.js','core-js.bundle.js','nuvio.env.js','css/bundle.css'])await access(join(dist,path));
 await rm(staging,{recursive:true,force:true});
 await cp(dist,staging,{recursive:true});
 await cp(join(source,'LICENSE'),join(staging,'LICENSE'));
 // Distribute the complete corresponding upstream source alongside the application.
 run('git',['archive','--format=zip','--output='+join(staging,'source.zip'),'HEAD'],source);
 const html=await readFile(join(staging,'index.html'),'utf8');
 await writeFile(join(staging,'index.html'),html.replace('</head>','<meta name="robots" content="noindex,nofollow"><link rel="license" href="LICENSE"><link rel="author" href="about.html"></head>'));
 await writeFile(join(staging,'about.html'),'<meta charset="utf-8"><title>About Cinema</title><h1>Cinema — Nuvio Web</h1><p>Unofficial downstream build of Nuvio Web, based on NuvioMedia/NuvioTVSmart. Nuvio and its contributors retain their copyrights. GPL v3.</p><p><a href="'+sourceUrl+'">Pinned upstream source</a> · <a href="source.zip">Corresponding source archive</a> · <a href="LICENSE">License</a> · <a href="./">Open Cinema</a></p><p>Browser playback only; use media you are authorized to access.</p>');
 await rm(target,{recursive:true,force:true});
 await rename(staging,target);
 console.log('Cinema built from Nuvio revision '+revision);
}catch(error){
 await rm(staging,{recursive:true,force:true});
 console.error('Cinema build failed; leaving the existing Cinema status page intact.',error);
 process.exitCode=1;
}finally{await rm(work,{recursive:true,force:true});}
