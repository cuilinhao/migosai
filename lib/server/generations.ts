import { getEnv,appOrigin,database,providerConfigured,moderationConfigured } from './env';
import { requireUser } from './auth';
import { sameOrigin,jsonBody,sha256 } from './security';
import { ApiError } from './errors';
import { validateVideo,getVideoCost } from '../video-options';
import { validateSong } from './provider';
import { reserveGeneration } from './billing';
import { generationResponse } from './jobs';
export async function createGeneration(request:Request,kind:'video'|'music'){const env=await getEnv();sameOrigin(request,appOrigin(env));const user=await requireUser(request,env);providerConfigured(env);const input=await jsonBody(request);let payload,cost:number;
 if(kind==='video'){moderationConfigured(env);try{payload=validateVideo(input);}catch{throw new ApiError(400,'Invalid video options.');}cost=getVideoCost(payload.duration,payload.resolution);for(const key of [payload.leftImage,payload.rightImage]){const owned=await database(env).prepare('SELECT key FROM uploads WHERE key=? AND user_id=?').bind(key,user.id).first();if(!owned)throw new ApiError(400,'Please upload both photos to your account.');}}
 else{payload=validateSong(input);cost=10;}
 const header=request.headers.get('Idempotency-Key');if(header&&!/^[\w-]{8,128}$/.test(header))throw new ApiError(400,'Invalid request identifier.');const key=header??await sha256(`${kind}:${JSON.stringify(payload)}:${Math.floor(Date.now()/60000)}`);const job=await reserveGeneration(database(env),user.id,key,kind,payload,cost);return Response.json(generationResponse(job),{status:202,headers:{'Cache-Control':'no-store'}});
}
