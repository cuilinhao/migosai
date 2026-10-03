import { getEnv,appOrigin,database,media } from '@/lib/server/env';
import { requireUser } from '@/lib/server/auth';
import { sameOrigin,imageType,readLimited } from '@/lib/server/security';
import { api,ApiError } from '@/lib/server/errors';

export const POST=api(async(request)=>{
 const timings:string[]=[];
 let start=performance.now();
 const mark=(name:string)=>{const now=performance.now();timings.push(`${name};dur=${(now-start).toFixed(1)}`);start=now;};
 const env=await getEnv();
 sameOrigin(request,appOrigin(env));
 const user=await requireUser(request,env);
 const db=database(env),bucket=media(env);
 mark('auth');
 const bytes=await readLimited(request,10*1024*1024+65536);
 mark('receive');
 let form:FormData;
 try{form=await new Response(bytes.buffer as ArrayBuffer,{headers:{'Content-Type':request.headers.get('content-type')??''}}).formData();}
 catch{throw new ApiError(400,'Invalid upload.');}
 const file=form.get('file');
 if(!file||typeof file==='string'||file.size===0)throw new ApiError(400,'Choose an image.');
 if(file.size>10*1024*1024)throw new ApiError(413,'Images must be 10 MB or smaller.');
 const buffer=new Uint8Array(await file.arrayBuffer());
 const mime=imageType(buffer,file.type);
 mark('parse');
 const key=`users/${user.id}/uploads/${crypto.randomUUID()}`;
 await bucket.put(key,buffer,{httpMetadata:{contentType:mime}});
 mark('store');
 await db.prepare('INSERT INTO uploads(key,user_id,content_type) VALUES(?,?,?)').bind(key,user.id,mime).run();
 mark('record');
 return Response.json({key},{status:201,headers:{'Server-Timing':timings.join(', ')}});
});
