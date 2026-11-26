// Static checks on a built Cinema directory (default cinema-dist/, or CINEMA_OUTPUT / argv[2]).
import {readFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';

const dist=resolve(process.argv[2]||process.env.CINEMA_OUTPUT||'cinema-dist');
const failures=[];
const read=file=>readFile(join(dist,file),'utf8').catch(()=>{failures.push(`missing ${file}`);return '';});
const expect=(ok,msg)=>{if(!ok)failures.push(msg);};

const [index,bundle,css,version,live]=await Promise.all(['index.html','app.bundle.js','assets/cinema.css','version.json','cinema-live.js'].map(read));
const {app,css:cssHash}=JSON.parse(version||'{}');
expect(/^[0-9a-f]{16}$/.test(app||'')&&/^[0-9a-f]{16}$/.test(cssHash||''),'version.json lacks app/css hashes');
expect(index.includes('viewport-fit=cover'),'index.html viewport lacks viewport-fit=cover');
expect(index.includes('classList.add("cinema-web")'),'index.html lacks browser runtime detection');
expect(index.includes(`assets/cinema.css?v=${cssHash}`),'index.html stylesheet not stamped with css hash');
expect(index.includes(`cinema-live.js?v=${app}`),'index.html live updater not stamped with app hash');
expect(live.includes('version.json'),'cinema-live.js does not poll version.json');
expect(bundle.includes('cinema-login-switch'),'bundle lacks QR/email sign-in switch');
expect(bundle.includes('contains("cinema-touch")'),'bundle lacks browser pointer activation');
expect(css.includes('--cinema-bg')&&css.includes('safe-area-inset-bottom'),'cinema.css lacks design tokens');
const zip=await stat(join(dist,'source.zip')).catch(()=>null);
expect(zip&&zip.size>1e6,'source.zip (GPL corresponding source) missing or empty');
expect((await read('LICENSE')).includes('GNU GENERAL PUBLIC LICENSE'),'LICENSE missing GPL text');

if(failures.length){console.error(failures.map(f=>'✗ '+f).join('\n'));process.exit(1);}
console.log(`Cinema smoke passed (${dist}, app ${app}, css ${cssHash})`);
