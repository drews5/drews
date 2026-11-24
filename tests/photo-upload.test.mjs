import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePhoto} from '../public/rewrite/admin/photo-upload.js';

const smallFile={name:'headshot.jpg',type:'image/jpeg',size:180000};
function encoder(results,width=4100,height=3000){
 const calls=[];let closed=false;
 const ctx={drawImage(){},fillRect(){}};
 const canvas={getContext:()=>ctx,toBlob(callback,type){calls.push([type,this.width,this.height]);callback(results.shift());}};
 return {calls,closed:()=>closed,options:{decode:async()=>({width,height,close(){closed=true;}}),createCanvas:()=>canvas}};
}

test('a small headshot still uploads when WebP falls back to a large PNG',async()=>{
 const jpeg={type:'image/jpeg',size:290000};
 const fixture=encoder([{type:'image/png',size:4100000},jpeg]);
 assert.equal(await preparePhoto(smallFile,fixture.options),jpeg);
 assert.deepEqual(fixture.calls.map(c=>c[0]),['image/webp','image/jpeg']);
 assert.equal(fixture.closed(),true);
});

test('null or over-limit encodings retry with a smaller image',async()=>{
 const jpeg={type:'image/jpeg',size:225000};
 const fixture=encoder([null,{type:'image/jpeg',size:3100000},jpeg]);
 assert.equal(await preparePhoto({...smallFile,type:''},fixture.options),jpeg);
 assert.deepEqual(fixture.calls.map(c=>c[1]),[2000,1600,1200]);
});

test('ordinary WebP output still uses the first encoding',async()=>{
 const webp={type:'image/webp',size:132000};
 const fixture=encoder([webp],500,900);
 assert.equal(await preparePhoto(smallFile,fixture.options),webp);
 assert.deepEqual(fixture.calls,[['image/webp',500,900]]);
});
