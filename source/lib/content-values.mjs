// Shared by the static build and the live browser refresh.
export function parseCsv(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(cell);cell='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 if(quoted)throw Error('Incomplete spreadsheet CSV');
 if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}

export function createContentReader(fields){
 const defaults=Object.fromEntries(fields.map(f=>[f.key,f.value]));
 const definitions=new Map(fields.map(f=>[f.key,f]));
 function readValues(csv,baseline=defaults){
  if(typeof csv!=='string'||csv.length>150000)throw Error('Invalid content feed');
  const rows=parseCsv(csv);
  if(!rows.some(r=>r[4]?.trim()==='Key'&&r[2]?.trim()==='Value')||!rows.some(r=>r[4]?.trim()==='hero_heading'))throw Error('Invalid spreadsheet columns');
  const result={...defaults,...baseline};
  for(const row of rows){
   const key=row[4]?.trim(),definition=definitions.get(key);if(!definition)continue;
   let v=row[2]?.trim();if(!v)continue;
   if(['integer','number','currency','percent'].includes(definition.type)){
    const n=Number(v.replace(/[$,%\s,]/g,''));if(!Number.isFinite(n)||n<0)continue;
    if(definition.type==='percent'){v=v.includes('%')||n>1?n/100:n;if(v>1)continue;}
    else if(definition.type==='currency'){if(n<.01||n>1000)continue;v=Math.round(n*100)/100;}
    else{if(n>1e9||(definition.type==='integer'&&!Number.isInteger(n)))continue;v=n;}
   }else if(definition.type==='email'){
    if(!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(v))continue;
   }else if(['url','donorbox'].includes(definition.type)){
    try{const u=new URL(v);if(u.protocol!=='https:'||u.username||u.password||(definition.type==='donorbox'&&!['donorbox.org','www.donorbox.org'].includes(u.hostname)))continue;v=u.href;}catch{continue;}
   }else if(v.length>2000)continue;
   result[key]=v;
  }
  return result;
 }
 return {defaults,readValues};
}
