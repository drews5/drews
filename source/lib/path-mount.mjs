// Mount the existing demo without changing its original public URL.
export const DEMO_PREFIX='/rewrite';
const SOURCE_ORIGIN='https://rewrite-it-project.drew5.chatgpt.site';
const PERSONAL_HOST='drews.click';
const staticPath=path=>path.startsWith('/assets/')||['/styles.css','/app.js','/robots.txt','/sitemap.xml'].includes(path);
function mountedUrl(value,origin){
 if(value.startsWith(SOURCE_ORIGIN))return origin+DEMO_PREFIX+value.slice(SOURCE_ORIGIN.length);
 if(value.startsWith('/')&&!value.startsWith('//')&&!value.startsWith(DEMO_PREFIX+'/')&&value!==DEMO_PREFIX)return DEMO_PREFIX+value;
 return value;
}
export function rewriteMountText(text,type,origin){
 text=text.split(SOURCE_ORIGIN).join(origin+DEMO_PREFIX);
 if(type.includes('html')||type.includes('svg')){
  text=text.replace(/(\b(?:href|src|action|poster)=["'])(\/[^"']*)(["'])/g,(all,start,url,end)=>start+mountedUrl(url,origin)+end);
  text=text.replace(/(\bsrcset=["'])([^"']+)(["'])/g,(all,start,set,end)=>start+set.split(',').map(part=>part.replace(/^(\s*)(\/\S+)/,(all,space,url)=>space+mountedUrl(url,origin))).join(',')+end);
 }
 if(type.includes('css')||type.includes('html')||type.includes('svg'))text=text.replace(/(url\(\s*["']?)(\/(?!\/)[^\s)'";]+)(["']?\s*\))/g,(all,start,url,end)=>start+mountedUrl(url,origin)+end);
 return text;
}
export async function mountedResponse(response,origin){
 const headers=new Headers(response.headers),location=headers.get('location');
 if(location){const resolved=new URL(location,origin);if(resolved.origin===origin)headers.set('location',mountedUrl(resolved.pathname+resolved.search+resolved.hash,origin));else if(resolved.origin===SOURCE_ORIGIN)headers.set('location',origin+DEMO_PREFIX+resolved.pathname+resolved.search+resolved.hash);}
 const type=headers.get('content-type')||'';
 if([101,204,205,304].includes(response.status)||!/(?:html|css|svg|xml|text\/plain)/i.test(type))return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 const text=rewriteMountText(await response.text(),type,origin);
 for(const key of ['content-length','content-encoding','etag','content-md5'])headers.delete(key);
 return new Response(text,{status:response.status,statusText:response.statusText,headers});
}
function personalPage(found=true){
 return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${found?"Drew’s projects":"Page not found"}</title><style>body{margin:0;padding:64px 24px;color:#173a61;font:18px/1.6 system-ui,sans-serif}main{max-width:720px;margin:auto}h1{font-size:36px;line-height:1.2;margin:0 0 36px}a{color:inherit;text-underline-offset:5px}a:focus-visible{outline:2px solid currentColor;outline-offset:6px}</style></head><body><main><h1>${found?"Drew’s projects":"Page not found"}</h1><a href="/rewrite/">The Re-Write It Project</a></main></body></html>`,{status:found?200:404,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff'}});
}
export async function routePathMount(request,assets,app){
 const url=new URL(request.url),mounted=url.pathname===DEMO_PREFIX||url.pathname.startsWith(DEMO_PREFIX+'/'),personal=url.hostname===PERSONAL_HOST;
 if(url.pathname===DEMO_PREFIX){url.pathname=DEMO_PREFIX+'/';return Response.redirect(url.href,308);}
 if(personal&&!mounted&&url.pathname!=='/robots.txt'&&url.pathname!=='/sitemap.xml')return personalPage(url.pathname==='/');
 // Also route the root sitemap/robots on the personal domain to this demo.
 if(mounted||personal){
  const inner=new URL(url);if(mounted)inner.pathname=inner.pathname.slice(DEMO_PREFIX.length)||'/';
  const forwarded=new Request(inner.href,request);
  const response=staticPath(inner.pathname)&&assets?await assets.fetch(forwarded):await app(forwarded);
  return mountedResponse(response,url.origin);
 }
 if(staticPath(url.pathname)&&assets)return assets.fetch(request);
 return app(request);
}
