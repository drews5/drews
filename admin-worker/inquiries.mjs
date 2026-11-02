const origins=new Set(['https://drews.click','https://www.drews.click','https://therewriteitproject.org','https://www.therewriteitproject.org']);
const recipient='therewriteitproject@gmail.com';
const kinds={contact:['Contact message','contact'],supplies:['School supply request','receive'],volunteer:['Volunteer application','join']};
const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const allowedFields={name:120,email:200,organization:200,location:160,students:6,needed:10,interest:200,supplies:500,message:5000};
export function inquiryPayload(input){
 if(!input||!kinds[input.kind]||typeof input.id!=='string'||!/^[a-f0-9-]{36}$/.test(input.id))throw Error('Invalid submission');
 if(input._honey||input.website)throw Error('Invalid submission');
 const payload={};for(const [key,limit] of Object.entries(allowedFields)){if(input[key]!==undefined){if(typeof input[key]!=='string'||input[key].length>limit)throw Error('Invalid '+key);payload[key]=input[key].trim();}}
 if(!payload.name||!payload.message||!/^\S+@\S+\.\S+$/.test(payload.email)||/[\r\n]/.test(payload.email))throw Error('Enter your name, email, and message.');
 if(input.kind==='supplies'&&(!payload.organization||!payload.location||!/^\d+$/.test(payload.students)||Number(payload.students)<1||Number(payload.students)>100000))throw Error('Complete the organization, location, and student count.');
 return {...payload,_subject:'The Re-Write It Project — '+kinds[input.kind][0],_replyto:payload.email,_template:'table',_captcha:'false',_url:'https://www.therewriteitproject.org/'+kinds[input.kind][1]+'/'};
}
export async function routeInquiry(request,env){
 const path=new URL(request.url).pathname;
 if(path!=='/inquiries'&&!/^\/inquiries\/receipt\/[a-f0-9-]{36}$/.test(path))return null;
 const origin=request.headers.get('Origin'),headers={'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://www.therewriteitproject.org','Access-Control-Allow-Methods':'POST,GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','Cache-Control':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff'};
 const respond=(value,status)=>new Response(JSON.stringify(value),{status,headers});
 if(!origins.has(origin))return respond({error:'Origin not allowed'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST'&&!(request.method==='GET'&&path.startsWith('/inquiries/receipt/')))return respond({error:'Method not allowed'},405);
 if(!env.INQUIRIES)return respond({error:'Form delivery is unavailable. Please try again.'},503);
 const response=await env.INQUIRIES.get(env.INQUIRIES.idFromName('public-forms')).fetch(request);
 return new Response(response.body,{status:response.status,headers});
}
export class InquiryService {
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 async fetch(request){
  try{
   if(request.method==='GET'){const id=new URL(request.url).pathname.split('/').at(-1),receipt=await this.ctx.storage.get('receipt:'+id);const job=receipt?await this.ctx.storage.get('job:'+id):null;return Response.json(receipt?{id,status:receipt.status,...(job?{attempts:job.attempts,nextAttempt:job.nextAttempt,delivery:job.delivery||'pending'}:{})}:{error:'Receipt not found'},{status:receipt?200:404});}
   if(Number(request.headers.get('Content-Length'))>16000)return Response.json({error:'Message is too large'}, {status:413});
   const raw=await request.text();if(raw.length>16000)return Response.json({error:'Message is too large'},{status:413});
   const input=JSON.parse(raw),payload=inquiryPayload(input),fingerprint=await hash(JSON.stringify(payload));
   const rateKey='rate:'+await hash((request.headers.get('CF-Connecting-IP')||'unknown')+':'+Math.floor(Date.now()/600000));
   return await this.ctx.blockConcurrencyWhile(async()=>{
    const storage=this.ctx.storage,receiptKey='receipt:'+input.id,previous=await storage.get(receiptKey);
    if(previous){if(previous.fingerprint!==fingerprint)return Response.json({error:'Please submit again.'},{status:409});if(previous.status!=='sent'&&!await storage.getAlarm())await storage.setAlarm(Date.now()+1000);return Response.json({success:true,id:input.id,status:previous.status},{status:202});}
    const rate=Number((await storage.get(rateKey))?.count||0);if(rate>=8)return Response.json({error:'Too many messages. Please try again in a few minutes.'},{status:429});
    const queued=await storage.list({prefix:'job:',limit:501});if(queued.size>=500)return Response.json({error:'Form delivery is busy. Please try again later.'},{status:503});
    const now=Date.now();
    await storage.put({['job:'+input.id]:{id:input.id,payload,createdAt:now,attempts:0,nextAttempt:now},[receiptKey]:{fingerprint,status:'queued',createdAt:now},[rateKey]:{count:rate+1,expires:now+600000}});
    if(!await storage.getAlarm())await storage.setAlarm(now+1000);
    return Response.json({success:true,id:input.id,status:'queued'},{status:202});
   });
  }catch{return Response.json({error:'Your message could not be saved. Check the required fields and try again.'},{status:400});}
 }
 async alarm(){
  const storage=this.ctx.storage,now=Date.now();
  // Always schedule recovery before external I/O, including if the isolate exits.
  await storage.setAlarm(now+60000);
  const cooldown=Number(await storage.get('retryAfter')||0);if(cooldown>now){await storage.setAlarm(cooldown);return;}
  const jobs=await storage.list({prefix:'job:'});let sent=0;
  for(const [key,job] of jobs){
   if(job.nextAttempt>now||sent>=3){continue;}
   sent++;
   try{
    const response=await fetch('https://formsubmit.co/ajax/'+recipient,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({...job.payload,'Submission reference':job.id}),signal:AbortSignal.timeout(20000)});
    const result=await response.json();
    if(/activat|confirm.*email|email.*confirm/i.test(result?.message||''))throw Error('activation');
    if(!response.ok||!(result?.success===true||result?.success==='true'))throw Error('upstream_rejected');
    const receipt=await storage.get('receipt:'+job.id);await storage.put('receipt:'+job.id,{...receipt,status:'sent',sentAt:Date.now()});await storage.delete(key);
   }catch(error){
    job.attempts++;job.delivery=error.message==='activation'?'activation_required':error.name==='TimeoutError'||error.name==='AbortError'?'upstream_timeout':'retrying';job.nextAttempt=Date.now()+(error.message==='activation'?3600000:Math.min(3600000,60000*2**Math.min(job.attempts-1,6)));await storage.put(key,job);await storage.put('retryAfter',job.nextAttempt);
    // One failed service request is enough; do not flood an unavailable provider.
    break;
   }
  }
  for(const [key,value] of await storage.list({prefix:'rate:'}))if(value.expires<now)await storage.delete(key);
  for(const [key,receipt] of await storage.list({prefix:'receipt:'}))if(receipt.status==='sent'&&receipt.createdAt<now-30*86400000)await storage.delete(key);
  const remaining=await storage.list({prefix:'job:'});
  if(remaining.size)await storage.setAlarm(Math.max(Date.now()+1000,Number(await storage.get('retryAfter')||0),Math.min(...[...remaining.values()].map(job=>job.nextAttempt))));
  else await storage.deleteAlarm();
 }
}
