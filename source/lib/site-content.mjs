import fields from '../content/editor-fields.json' with {type:'json'};
import config from '../content/live-sheet.json' with {type:'json'};
export const defaults=Object.fromEntries(fields.map(f=>[f.key,f.value]));
const definitions=new Map(fields.map(f=>[f.key,f]));
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copyEmail=text=>escapeHtml(text).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,address=>`<span class="email-copy-link"><a href="mailto:${address}">${address}</a><button type="button" class="email-copy-button" data-copy-email="${address}" aria-label="Copy ${address}" title="Copy email address"><svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="14" y="13" width="19" height="23" rx="3"/><path d="M25 13V7a3 3 0 0 0-3-3H8a3 3 0 0 0-3 3v19a3 3 0 0 0 3 3h6"/></svg></button><span class="copy-status sr-only" role="status"></span></span>`);
const money=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
export function parseCsv(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}else cell+=c;}
 if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}
export function readValues(csv){
 const result={...defaults};
 for(const row of parseCsv(csv)){const key=row[4]?.trim(),definition=definitions.get(key);if(!definition)continue;let v=row[2]?.trim();if(!v)continue;
  if(['integer','number','currency','percent'].includes(definition.type)){
   const n=Number(v.replace(/[$,%\s]/g,''));if(!Number.isFinite(n)||n<0)continue;
   if(definition.type==='percent'){v=v.includes('%')||n>1?n/100:n;if(v>1)continue;}
   else if(definition.type==='currency'){if(n<.01||n>1000)continue;v=Math.round(n*100)/100;}
   else{if(n>1e9||(definition.type==='integer'&&!Number.isInteger(n)))continue;v=n;}
  }else if(definition.type==='email'){if(!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(v))continue;}
  else if(['url','donorbox'].includes(definition.type)){try{const u=new URL(v);if(u.protocol!=='https:'||u.username||u.password||(definition.type==='donorbox'&&!['donorbox.org','www.donorbox.org'].includes(u.hostname)))continue;v=u.href;}catch{continue;}}
  else if(v.length>2000)continue;
  result[key]=v;
 }return result;
}
let cached={...defaults},checked=0,pending;
export async function getSiteContent(){
 if(Date.now()-checked<60000)return cached;
 if(pending)return pending;
 pending=(async()=>{try{const response=await fetch(config.csv_url,{signal:AbortSignal.timeout(1500),cf:{cacheTtl:60}});if(!response.ok)throw Error('Content feed unavailable');const csv=await response.text();if(csv.length>150000||!csv.includes('hero_heading'))throw Error('Invalid content feed');cached=readValues(csv);}catch{/* Preserve approved content if Google is temporarily unavailable. */}finally{checked=Date.now();pending=null;}return cached;})();return pending;
}
export function applySiteContent(html,values){
 const v={...defaults,...values};
 html=html.replace(/<([a-z][\w-]*)\b([^>]*\bdata-content="([\w_]+)"[^>]*)>[\s\S]*?<\/\1>/gi,(whole,tag,attrs,key)=>{
  if(!(key in v))return whole;if(['hero_heading','hero_intro'].includes(key)&&v[key]===defaults[key])return whole;let text=String(v[key]);if(/^quote_\d+_text$/.test(key))text='“'+text+'”';return `<${tag}${attrs}>${copyEmail(text)}</${tag}>`;
 });
 html=html.replace(/(<script\b[^>]*data-faq-schema="([\w_]+)"[^>]*>)[\s\S]*?<\/script>/g,(whole,opening,prefix)=>{
  const mainEntity=[];for(let i=1;v[`${prefix}_${i}_question`];i++)mainEntity.push({'@type':'Question',name:String(v[`${prefix}_${i}_question`]),acceptedAnswer:{'@type':'Answer',text:String(v[`${prefix}_${i}_answer`])}});
  return opening+JSON.stringify({'@context':'https://schema.org','@type':'FAQPage',mainEntity}).replace(/</g,'\\u003c')+'</script>';
 });
 const kits=Number(v.kits),percent=Number((Number(v.underfunded_percent)*100).toFixed(2)),budget=Number(v.budget_gap_millions);
 html=html.replace(/18,576/g,money(kits)).replace(/data-count="18576"/g,`data-count="${kits}"`).replace(/data-metric-count="18576"/g,`data-metric-count="${kits}"`)
 .replace(/83%/g,`${money(percent)}%`).replace(/data-metric-count="83"/g,`data-metric-count="${percent}"`)
 .replace(/\$391M/g,`$${money(budget)}M`).replace(/data-metric-count="391"/g,`data-metric-count="${budget}"`);
 html=html.replace(/<a class="metric"[\s\S]*?<\/a>/g,card=>{const art=card.match(/data-content="metric_(\w+)_label"/)?.[1];if(!art)return card;const number=art==='people'?money(kits):art==='districts'?money(percent)+'%':'$'+money(budget)+'M';return card.replace(/aria-label="[^"]*"/,`aria-label="${escapeHtml(number+' '+v['metric_'+art+'_label']+'. Read about our reporting.')}"`);});
 for(const key of ['donation_url','chapter_application','facebook','instagram','linkedin','budget_source_url','address','chapter_email'])html=html.split(escapeHtml(defaults[key])).join(escapeHtml(v[key]));
 // The service delivery account remains verified and separate from public contact copy.
 const delivery='https://formsubmit.co/'+defaults.email;
 html=html.replace('to '+defaults.email+' through FormSubmit','to __FORM_RECIPIENT__ through FormSubmit');
 html=html.split(delivery).join('__VERIFIED_FORM_DELIVERY__').split(defaults.email).join(escapeHtml(v.email)).split('__VERIFIED_FORM_DELIVERY__').join(delivery).replace('__FORM_RECIPIENT__',defaults.email);
 const price=Number(v.kit_price),display=money(price);
 html=html.replace(/data-kit-price="5"/g,`data-kit-price="${price}"`).replace(/data-amount="5"/g,`data-amount="${price}"`).replace(/data-gift-amount="5"/g,`data-gift-amount="${price}"`)
 .replace(/(id="gift-custom"[^>]*\bvalue=")5"/g,`$1${price}"`).replace(/\$5(?![\d,.])/g,`$${display}`);
 if(price!==5){for(const [amount,old] of [[50,10],[100,20]]){const count=Math.floor(amount/price),label=count?`${count} kit${count===1?'':'s'}`:'Part of a kit';html=html.replaceAll(`>${old} kits<`,`>${label}<`);}
 html=html.replace(/(class="gift-link" href="[^\"]*\?amount=)5(&amp;)/g,`$1${price}$2`);}
 return html;
}
