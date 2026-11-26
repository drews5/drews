// Local Cinema preview with live CSS: `node scripts/cinema-dev.mjs [port]`.
// Builds once (reusing the compiled core cache), serves the output, and rebundles
// cinema/styles on change; open pages pick up new CSS within a second without reloading.
import {createServer} from 'node:http';
import {watch} from 'node:fs';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve,extname,normalize} from 'node:path';
import {execFileSync} from 'node:child_process';

const root=resolve(import.meta.dirname,'..');
const out=resolve(process.env.CINEMA_OUTPUT||join(root,'.cinema-dev','dist'));
const port=Number(process.argv[2]||process.env.PORT||8788);
if(!process.env.CINEMA_SKIP_BUILD)execFileSync(process.execPath,[join(root,'scripts','build-cinema.mjs')],{stdio:'inherit',env:{...process.env,CINEMA_OUTPUT:out,CINEMA_CORE_CACHE:process.env.CINEMA_CORE_CACHE||join(root,'.cinema-dev','core-cache')}});
const {bundleStyles}=await import('./build-cinema.mjs');

async function refreshStyles(){
 const css=await bundleStyles();
 const hash=createHash('sha256').update(css).digest('hex').slice(0,16);
 const versionFile=join(out,'version.json');
 const version=JSON.parse(await readFile(versionFile,'utf8'));
 if(version.css===hash)return;
 await writeFile(join(out,'assets','cinema.css'),css);
 await writeFile(versionFile,JSON.stringify({...version,css:hash}));
 console.log('styles updated',hash);
}
let timer;
watch(join(root,'cinema','styles'),()=>{clearTimeout(timer);timer=setTimeout(()=>refreshStyles().catch(e=>console.error(e)),80)});

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2','.wasm':'application/wasm','.vtt':'text/vtt'};
createServer(async(req,res)=>{
 try{
  let path=decodeURIComponent(new URL(req.url,'http://x').pathname);
  if(path.endsWith('/'))path+='index.html';
  const file=join(out,normalize(path).replace(/^(\.\.[/\\])+/,''));
  if(!file.startsWith(out)||!(await stat(file)).isFile())throw Error('not found');
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(await readFile(file));
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,()=>console.log(`Cinema preview: http://localhost:${port}/`));
