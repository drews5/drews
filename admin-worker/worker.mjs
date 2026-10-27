const empty=()=>({pages:{},shared:{}});
const encoder=new TextEncoder();
async function digest(value){return new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)));}
async function equal(a,b){const x=await digest(a),y=await digest(b);let difference=0;for(let i=0;i<x.length;i++)difference|=x[i]^y[i];return difference===0;}
function validate(document){
 if(!document||typeof document!=='object'||!document.pages||!document.shared)throw Error('Invalid document');
 if(JSON.stringify(document).length>1500000)throw Error('Content is too large');
 const groups=[document.shared,...Object.entries(document.pages).map(([route,ops])=>{if(!/^\/[a-z0-9/-]*$/.test(route))throw Error('Invalid page');return ops;})];
 for(const group of groups){if(!group||typeof group!=='object')throw Error('Invalid edits');for(const [id,op] of Object.entries(group)){
  if(!/^[a-f0-9]{16}$/.test(id)||!op||typeof op!=='object')throw Error('Invalid edit');
  if(op.text!==undefined&&(typeof op.text!=='string'||op.text.length>20000))throw Error('Text is too long');
  for(const key of ['src','href'])if(op[key]!==undefined){const u=new URL(op[key]);if(!['https:','mailto:','tel:'].includes(u.protocol)||key==='src'&&u.protocol!=='https:')throw Error('Invalid URL');}
  if(op.alt!==undefined&&(typeof op.alt!=='string'||op.alt.length>500))throw Error('Invalid image description');
  if(op.additions){if(!Array.isArray(op.additions)||op.additions.length>20)throw Error('Too many images');for(const image of op.additions){if(!image.src||new URL(image.src).protocol!=='https:'||typeof image.alt!=='string')throw Error('Invalid added image');}}
 }}return document;
}
async function handle(request,env){
 const url=new URL(request.url),origin=request.headers.get('Origin'),allowed=env.SITE_ORIGIN||'https://drews.click';
 const headers={'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization,If-Match','Access-Control-Expose-Headers':'ETag','Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json',...extra}});
 if(origin&&origin!==allowed)return json({error:'Origin not allowed'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 try{
  if(!env.CONTENT||!env.ADMIN_PASSWORD)return json({error:'Admin service setup is incomplete'},503);
  if(url.pathname.startsWith('/images/')&&request.method==='GET'){
   const key=url.pathname.slice(1);if(!/^images\/[a-f0-9-]+$/.test(key))return json({error:'Image not found'},404);
   const file=await env.CONTENT.getWithMetadata(key,{type:'arrayBuffer'});if(!file.value)return json({error:'Image not found'},404);
   return new Response(file.value,{headers:{...headers,'Content-Type':file.metadata.type,'Cache-Control':'public, max-age=31536000, immutable','Content-Security-Policy':"default-src 'none'"}});
  }
  if(url.pathname==='/published'&&request.method==='GET')return json(JSON.parse(await env.CONTENT.get('published')||JSON.stringify({revision:0,document:empty()})));
  if(url.pathname==='/login'&&request.method==='POST'){
   const ip=request.headers.get('CF-Connecting-IP')||'unknown',key='attempts:'+Array.from(await digest(ip)).map(x=>x.toString(16).padStart(2,'0')).join('');
   const attempts=Number(await env.CONTENT.get(key)||0);if(attempts>=6)return json({error:'Too many attempts. Try again in 15 minutes.'},429);
   const {password}=await request.json();if(typeof password!=='string'||password.length>200||!await equal(password,env.ADMIN_PASSWORD)){await env.CONTENT.put(key,String(attempts+1),{expirationTtl:900});return json({error:'Incorrect password'},401);}
   await env.CONTENT.delete(key);const token=crypto.randomUUID()+crypto.randomUUID();await env.CONTENT.put('session:'+token,'1',{expirationTtl:28800});return json({token});
  }
  const token=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');if(!/^[a-f0-9-]{72}$/.test(token)||!await env.CONTENT.get('session:'+token))return json({error:'Please sign in again'},401);
  if(url.pathname==='/logout'&&request.method==='POST'){await env.CONTENT.delete('session:'+token);return json({ok:true});}
  const stored=JSON.parse(await env.CONTENT.get('draft')||await env.CONTENT.get('published')||JSON.stringify({revision:0,document:empty()}));
  if(url.pathname==='/draft'&&request.method==='GET')return json(stored,200,{ETag:String(stored.revision)});
  if(url.pathname==='/draft'&&request.method==='PUT'){
   if(request.headers.get('If-Match')!==String(stored.revision))return json({error:'Another editor saved changes. Reload before editing.'},409);
   const value={revision:stored.revision+1,document:validate(await request.json()),updatedAt:new Date().toISOString()};await env.CONTENT.put('draft',JSON.stringify(value));return json(value);
  }
  if(url.pathname==='/publish'&&request.method==='POST'){
   if(request.headers.get('If-Match')!==String(stored.revision))return json({error:'The draft changed. Reload before publishing.'},409);
   await env.CONTENT.put('published',JSON.stringify({...stored,publishedAt:new Date().toISOString()}));return json({ok:true,revision:stored.revision});
  }
  if(url.pathname==='/upload'&&request.method==='POST'){
   const type=request.headers.get('Content-Type');if(!['image/jpeg','image/png','image/webp'].includes(type))return json({error:'Choose a JPEG, PNG, or WebP image'},400);
   if(Number(request.headers.get('Content-Length'))>3000000)return json({error:'Image must be smaller than 3 MB'},413);
   const bytes=await request.arrayBuffer();if(bytes.byteLength>3000000)return json({error:'Image must be smaller than 3 MB'},413);
   const key='images/'+crypto.randomUUID();await env.CONTENT.put(key,bytes,{metadata:{type}});return json({src:url.origin+'/'+key});
  }
  return json({error:'Not found'},404);
 }catch(error){return json({error:error.message||'Request failed'},400);}
}
export class AdminService {
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 async fetch(request){return this.ctx.blockConcurrencyWhile(async()=>{
  const storage=this.ctx.storage;
  const get=async key=>{const item=await storage.get(key);if(item?.expires&&item.expires<Date.now()){await storage.delete(key);return null;}if(item?.parts){const parts=await Promise.all(item.parts.map(part=>storage.get(part)));if(item.binary){const bytes=new Uint8Array(item.length);let offset=0;for(const part of parts){bytes.set(new Uint8Array(part),offset);offset+=part.byteLength;}item.value=bytes.buffer;}else item.value=parts.join('');}return item||null;};
  const put=async(key,value,options={})=>{const old=await storage.get(key),item={metadata:options.metadata,expires:options.expirationTtl?Date.now()+options.expirationTtl*1000:0};const binary=value instanceof ArrayBuffer;if(binary||value.length>30000){item.parts=[];item.binary=binary;item.length=binary?value.byteLength:value.length;const size=binary?60000:30000;for(let offset=0;offset<item.length;offset+=size){const part='part:'+crypto.randomUUID();await storage.put(part,value.slice(offset,offset+size));item.parts.push(part);}}else item.value=value;await storage.put(key,item);for(const part of old?.parts||[])await storage.delete(part);};
  const CONTENT={get:async key=>(await get(key))?.value||null,getWithMetadata:async key=>{const item=await get(key);return {value:item?.value||null,metadata:item?.metadata};},put,delete:async key=>{const old=await storage.get(key);await storage.delete(key);for(const part of old?.parts||[])await storage.delete(part);}};
  return handle(request,{...this.env,CONTENT});
 });}
}
export default {fetch(request,env){return env.ADMIN_SERVICE.get(env.ADMIN_SERVICE.idFromName('rewrite')).fetch(request);}};
