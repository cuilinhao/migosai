import { appOrigin, media, type Env } from './env';
import { hmac, verifyHmac, validMediaUrl } from './security';
import { ApiError } from './errors';
export async function signedMediaUrl(env:Env,key:string){if(!env.MEDIA_SIGNING_SECRET)throw new ApiError(503,'Media signing is not configured.');const expires=Math.floor(Date.now()/1000)+3600;const signature=await hmac(env.MEDIA_SIGNING_SECRET,`${key}\n${expires}`);return `${appOrigin(env)}/api/media/${key}?expires=${expires}&signature=${signature}`;}
export async function verifyMediaSignature(env:Env,key:string,url:URL){const expires=Number(url.searchParams.get('expires'));if(!env.MEDIA_SIGNING_SECRET||!Number.isInteger(expires)||expires<Math.floor(Date.now()/1000)||expires>Math.floor(Date.now()/1000)+3600)return false;return verifyHmac(env.MEDIA_SIGNING_SECRET,`${key}\n${expires}`,url.searchParams.get('signature')??'');}
const MAX_MEDIA_BYTES=64*1024*1024;
const PART_BYTES=5*1024*1024;
/** Retains one 5 MiB multipart buffer plus the current network chunk, regardless of total size. */
export async function storeProviderMedia(env:Env,url:string,key:string,kind:'video'|'music'){
 if(!validMediaUrl(url,env.APIMART_MEDIA_HOSTS??''))throw new ApiError(502,'The provider returned an unapproved media host. Support must review this result.');
 const signal=AbortSignal.timeout(60000);
 const response=await fetch(url,{redirect:'manual',signal});
 if(!response.ok){await response.body?.cancel().catch(()=>{});throw new ApiError(502,'Could not download the generated media.');}
 const mime=response.headers.get('content-type')?.split(';')[0]??'';
 if(kind==='video'?!['video/mp4','video/quicktime'].includes(mime):!['audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/ogg'].includes(mime)){
  await response.body?.cancel();throw new ApiError(502,'The provider returned an unsupported media type.');
 }
 const declared=response.headers.get('content-length');
 const expected=declared===null?null:Number(declared);
 if(expected!==null&&(!Number.isSafeInteger(expected)||expected<=0||expected>MAX_MEDIA_BYTES)){
  await response.body?.cancel();throw new ApiError(413,'Generated media is too large or has an invalid length.');
 }
 if(!response.body)throw new ApiError(502,'The provider returned empty media.');
 const reader=response.body.getReader();
 let upload:R2MultipartUpload|undefined;
 try {
  upload=await media(env).createMultipartUpload(key,{httpMetadata:{contentType:mime}});
  const parts:R2UploadedPart[]=[];
  let buffer=new Uint8Array(PART_BYTES),used=0,total=0;
  while(true){
   signal.throwIfAborted();
   const {value,done}=await reader.read();
   if(done)break;
   total+=value.byteLength;
   if(total>MAX_MEDIA_BYTES||(expected!==null&&total>expected))throw new ApiError(413,'Generated media is too large or exceeds its declared length.');
   let offset=0;
   while(offset<value.byteLength){
    const count=Math.min(PART_BYTES-used,value.byteLength-offset);
    buffer.set(value.subarray(offset,offset+count),used);used+=count;offset+=count;
    if(used===PART_BYTES){
     signal.throwIfAborted();parts.push(await upload.uploadPart(parts.length+1,buffer));
     // uploadPart has finished consuming the bytes before the same buffer is reused.
     used=0;
    }
   }
  }
  if(total===0||(expected!==null&&expected!==total))throw new ApiError(502,'The generated media download was incomplete.');
  signal.throwIfAborted();
  if(used>0)parts.push(await upload.uploadPart(parts.length+1,buffer.subarray(0,used)));
  signal.throwIfAborted();
  await upload.complete(parts);
  return key;
 }catch(error){
  await reader.cancel().catch(()=>{});
  if(upload)await upload.abort().catch(()=>{});
  throw error;
 }finally{reader.releaseLock();}
}

export function mediaResponse(object:R2ObjectBody,requestedRange:boolean){const headers=new Headers({'Content-Type':object.httpMetadata?.contentType??'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes','Content-Disposition':'inline'});if(requestedRange&&object.range&&'offset' in object.range&&object.range.offset!==undefined){const offset=object.range.offset,length=object.range.length??object.size;headers.set('Content-Range',`bytes ${offset}-${offset+length-1}/${object.size}`);headers.set('Content-Length',String(length));return new Response(object.body,{status:206,headers});}headers.set('Content-Length',String(object.size));return new Response(object.body,{headers});}
