const uploadLimit=3000000;
const supportedTypes=new Set(['image/jpeg','image/png','image/webp']);

async function decodePhoto(file){
 try{return await createImageBitmap(file);}catch{
  const url=URL.createObjectURL(file);
  try{
   return await new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(Error('This browser could not open the photo. Try a JPEG or PNG.'));
    img.src=url;
   });
  }finally{URL.revokeObjectURL(url);}
 }
}

export async function preparePhoto(file,{decode=decodePhoto,createCanvas=()=>document.createElement('canvas')}={}){
 if(file.type==='image/svg+xml'||/\.svgz?$/i.test(file.name)||file.type&&!file.type.startsWith('image/')&&!['application/octet-stream','application/x-empty'].includes(file.type))throw Error('Choose a photo from your library');
 if(file.size>20000000)throw Error('Choose a photo smaller than 20 MB');
 const source=await decode(file);
 let canvas;
 try{
  const width=source.naturalWidth??source.width,height=source.naturalHeight??source.height;
  if(!width||!height)throw Error('This browser could not open the photo. Try a JPEG or PNG.');
  canvas=createCanvas();
  // Some browsers return PNG or no file when asked for WebP. Retry with JPEG,
  // and shrink the decoded pixels if the browser still makes a large file.
  for(const [max,type,quality] of [[2000,'image/webp',.84],[1600,'image/jpeg',.86],[1200,'image/jpeg',.8],[700,'image/jpeg',.72]]){
   const scale=Math.min(1,max/Math.max(width,height));
   canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
   const ctx=canvas.getContext('2d');
   if(!ctx)continue;
   try{
    if(type==='image/jpeg'){ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);}
    ctx.drawImage(source,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,type,quality));
    if(blob&&blob.size>0&&blob.size<=uploadLimit&&supportedTypes.has(blob.type))return blob;
   }catch{/* A smaller JPEG can succeed when the first encoding fails. */}
  }
  throw Error('This browser could not prepare the photo. Try a JPEG or PNG.');
 }finally{
  source.close?.();
  if(canvas){canvas.width=1;canvas.height=1;}
 }
}
