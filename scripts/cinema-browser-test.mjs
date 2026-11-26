// Responsive guest smoke test for a running Cinema build.
// Usage: node scripts/cinema-browser-test.mjs [url]
//   CINEMA_CDP=http://localhost:29229 reuses an open Chrome; otherwise Chrome is launched
//   (CHROME_PATH overrides the binary). Screenshots go to CINEMA_SHOTS (default cinema-shots/).
import {chromium} from 'playwright-core';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';

const url=process.argv[2]||process.env.CINEMA_URL||'http://localhost:8788/';
const shots=process.env.CINEMA_SHOTS||'cinema-shots';
const widths=(process.env.CINEMA_WIDTHS||'375,390,430,768,1440,1920').split(',').map(Number);
const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

await mkdir(shots,{recursive:true});
const browser=process.env.CINEMA_CDP
 ?await chromium.connectOverCDP(process.env.CINEMA_CDP)
 :await chromium.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{channel:'chrome'});
const failures=[];

for(const width of widths){
 const phone=width<760,touch=width<1000;
 const ctx=await browser.newContext({
  viewport:{width,height:phone?844:width<1000?1024:Math.round(width*9/16)},
  deviceScaleFactor:touch?2:1,isMobile:phone,hasTouch:touch,
  userAgent:width<400?IPHONE:phone?ANDROID:undefined,
 });
 const page=await ctx.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message.slice(0,200)));
 const fail=msg=>failures.push(`${width}px: ${msg}`);
 const visible=sel=>page.locator(sel).first().isVisible().catch(()=>false);
 const go=async action=>{
  await page.evaluate(a=>document.querySelector(`:is(.root-sidebar, .modern-sidebar-panel) [data-action=${a}]`)?.click(),action);
  await page.waitForTimeout(1500);
 };
 const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 try{
  await page.goto(url,{waitUntil:'domcontentloaded'});
  const guest=page.getByText('Continue without account');
  await guest.waitFor({timeout:20000}).then(()=>guest.click()).catch(()=>{});
  await page.waitForFunction(()=>document.querySelectorAll('#home .focusable').length>5,null,{timeout:30000});
  await page.waitForTimeout(2500);

  const runtime=await page.evaluate(()=>document.documentElement.className);
  if(!runtime.includes('cinema-web')||runtime.includes('cinema-tv'))fail(`browser runtime classes missing (${runtime})`);
  if(await overflow()>1)fail(`home overflows horizontally by ${await overflow()}px`);
  const nav=await page.evaluate(()=>{
   const el=[...document.querySelectorAll('.root-sidebar, .modern-sidebar-panel')].find(e=>e.getBoundingClientRect().width);
   if(!el)return null;
   const r=el.getBoundingClientRect();
   return {top:r.top,bottom:r.bottom,height:r.height,width:r.width,h:innerHeight};
  });
  if(!nav)fail('navigation not found');
  else if(phone&&(nav.bottom<nav.h-4||nav.height>110||nav.width<width*0.9))fail(`phone navigation is not a bottom bar (${JSON.stringify(nav)})`);
  if(await page.getByText(/update available/i).first().isVisible().catch(()=>false))fail('TV update prompt shown in browser');
  await page.screenshot({path:join(shots,`home-${width}.png`)});

  await go('gotoSearch');
  const input=await page.evaluate(()=>{
   const el=[...document.querySelectorAll('#search input')].find(e=>e.getBoundingClientRect().width);
   return el&&{left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right};
  });
  if(!input)fail('search input not visible');
  else if(input.left<0||input.right>width+1)fail(`search input outside viewport (${JSON.stringify(input)})`);
  if(await overflow()>1)fail('search overflows horizontally');
  await page.screenshot({path:join(shots,`search-${width}.png`)});

  await go('gotoSettings');
  const settings=await page.evaluate(()=>{
   const items=[...document.querySelectorAll('#settings .focusable')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height;});
   return {count:items.length,onscreen:items.filter(e=>{const r=e.getBoundingClientRect();return r.left>=-1&&r.left<innerWidth;}).length};
  });
  if(!settings.count||!settings.onscreen)fail(`settings controls not on screen (${JSON.stringify(settings)})`);
  if(await overflow()>1)fail('settings overflows horizontally');
  await page.screenshot({path:join(shots,`settings-${width}.png`)});

  await go('gotoHome');
  await page.waitForTimeout(1500);
  if(!(await visible('#home')))fail('could not return to home');
 }catch(e){
  fail(e.message.split('\n')[0]);
  await page.screenshot({path:join(shots,`failure-${width}.png`)}).catch(()=>{});
 }
 if(errors.length)fail(`page errors: ${errors.join(' | ')}`);
 console.log(`${width}px ${failures.some(f=>f.startsWith(`${width}px`))?'FAIL':'ok'}`);
 await ctx.close();
}
if(!process.env.CINEMA_CDP)await browser.close();
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log(`Cinema responsive smoke passed at ${widths.join(', ')}px`);
process.exit(0);
