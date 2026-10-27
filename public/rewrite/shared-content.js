export const sharedFields=[
 ['Impact','kits','Kits distributed','integer'],
 ['Impact','underfunded_percent','Illinois districts underfunded (%)','percent'],
 ['Impact','budget_gap_millions','CPS budget gap (millions)','number'],
 ['Impact','metric_people_label','Kit statistic label','text'],
 ['Impact','metric_districts_label','School funding label','text'],
 ['Impact','metric_budget_label','Budget statistic label','text'],
 ['Impact','underfunded_note','School funding source note','text'],
 ['Impact','budget_note','Budget source note','text'],
 ['Impact','budget_source_url','Budget source link','url'],
 ['Giving','kit_price','Cost of one kit ($)','currency'],
 ['Giving','donation_url','Donorbox campaign','donorbox'],
 ['Contact','email','Public email','email'],
 ['Contact','chapter_email','Chapter email','email'],
 ['Contact','address','Mailing address','text'],
 ['Contact','chapter_application','Chapter application link','url'],
 ['Social','facebook','Facebook','url'],
 ['Social','instagram','Instagram','url'],
 ['Social','linkedin','LinkedIn','url'],
].map(([section,key,label,type])=>({section,key,label,type}));
export function parseSharedValue(key,raw){
 const field=sharedFields.find(f=>f.key===key);if(!field)throw Error('Unknown shared setting');
 let value=typeof raw==='string'?raw.trim():raw;
 if(['integer','number','currency','percent'].includes(field.type)){
  if(value==='')throw Error('Enter a number');
  value=Number(value);if(!Number.isFinite(value)||value<0||value>1e9)throw Error('Enter a valid positive number');
  if(field.type==='integer'&&!Number.isInteger(value))throw Error('Enter a whole number');
  if(field.type==='currency'){if(value<.01||value>1000)throw Error('Kit cost must be between $0.01 and $1,000');value=Math.round(value*100)/100;}
  if(field.type==='percent'&&value>1)throw Error('Percentage must be between 0 and 100');
 }else{
  if(typeof value!=='string'||!value||value.length>2000)throw Error('Enter a value under 2,000 characters');
  if(field.type==='email'&&!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(value))throw Error('Enter a valid email');
  if(['url','donorbox'].includes(field.type)){let url;try{url=new URL(value);}catch{throw Error('Enter a full HTTPS link');}if(url.protocol!=='https:'||url.username||url.password||field.type==='donorbox'&&!['donorbox.org','www.donorbox.org'].includes(url.hostname))throw Error(field.type==='donorbox'?'Use a Donorbox campaign link':'Use an HTTPS link');value=url.href;}
 }return value;
}
export function contentState(doc){try{return JSON.parse(doc.querySelector('#site-content-state')?.textContent||'{}');}catch{return {};}}
export function sharedBinding(el,doc){
 const direct=el.dataset.adminField||el.dataset.content;if(sharedFields.some(f=>f.key===direct))return direct;
 if(el.dataset.siteNumber==='kits')return 'kits';
 if(el.hasAttribute('data-site-price'))return 'kit_price';
 if(el.hasAttribute('data-metric-count')){const label=el.closest('.metric')?.querySelector('[data-content]')?.dataset.content;return {metric_people_label:'kits',metric_districts_label:'underfunded_percent',metric_budget_label:'budget_gap_millions'}[label]||'';}
 const values={...contentState(doc).initialValues,...doc.adminSheetValues,...doc.adminSharedValues};
 if(el.closest('.footer-legal')&&el.textContent.trim()===values.address)return 'address';
 const href=el.getAttribute('href');if(href){
  for(const key of ['email','chapter_email'])if(href==='mailto:'+values[key])return key;
  for(const key of ['donation_url','chapter_application','facebook','instagram','linkedin','budget_source_url']){if(!values[key])continue;try{const a=new URL(href,'https://drews.click'),b=new URL(values[key]);if(a.origin===b.origin&&a.pathname===b.pathname)return key;}catch{}}
 }return '';
}
