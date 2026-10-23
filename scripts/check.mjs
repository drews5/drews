import assert from 'node:assert/strict';
import {readFile,access,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../_site');let count=0,references=0;
async function visit(dir){for(const item of await readdir(dir,{withFileTypes:true})){
 const path=join(dir,item.name);if(item.isDirectory()){await visit(path);continue;}
 if(!item.name.endsWith('.html'))continue;count++;const html=await readFile(path,'utf8');
 assert(!html.includes('https://rewrite-it-project.drew5.chatgpt.site'),'Old host remains');
 for(const match of html.matchAll(/\b(?:src|href|action)="(\/[^"#?]*)(?:[?#][^"]*)?"/g)){
  const url=match[1];assert(url==='/rewrite'||url.startsWith('/rewrite/'),`Unexpected root URL: ${url}`);
  let target=join(root,decodeURIComponent(url));
  if(url.endsWith('/'))target=join(target,'index.html');
  try{await access(target);}catch{await access(join(target,'index.html'));}references++;
 }
 for(const match of html.matchAll(/\bsrcset="([^"]+)"/g))for(const part of match[1].split(',')){
  const url=part.trim().split(/\s+/)[0];if(url.startsWith('/')){assert(url.startsWith('/rewrite/'));await access(join(root,url));references++;}
 }
}}
await visit(root);assert(count>=30);assert.equal((await readFile(join(root,'CNAME'),'utf8')).trim(),'drews.click');
const home=await readFile(join(root,'rewrite/index.html'),'utf8');
assert(home.includes('https://donorbox.org/'));assert(home.includes('https://drews.click/rewrite/'));
const contact=await readFile(join(root,'rewrite/contact/index.html'),'utf8');
assert(contact.includes('https://formsubmit.co/therewriteitproject@gmail.com'));
assert(contact.includes('https://drews.click/rewrite/message-received/'));
console.log(`PASS: ${count} HTML pages; ${references} local links/assets; forms, checkout, canonical URLs, custom domain.`);
