import { getEnv,appOrigin,database,providerConfigured,moderationConfigured } from './env';
import { requireUser } from './auth';
import { sameOrigin,jsonBody,sha256 } from './security';
import { ApiError } from './errors';
import { validateVideo,getVideoCost } from '../video-options';
import { validateSong } from './provider';
import { reserveGeneration } from './billing';
import { generationResponse } from './jobs';
import { validateVideoUploads } from './reference-uploads';
import { getVideoModelUnavailableReason } from '../video-availability';
export async function createGeneration(request:Request,kind:'video'|'music'){const env=await getEnv();sameOrigin(request,appOrigin(env));const user=await requireUser(request,env);providerConfigured(env,kind==='video'?'kie':'apimart');const input=await jsonBody(request);let payload,cost:number,unavailableReason:string|undefined;
 if(kind==='video'){moderationConfigured(env);try{payload=validateVideo(input);}catch{throw new ApiError(400,'Invalid video options.');}unavailableReason=getVideoModelUnavailableReason(payload.model);const referenceDuration=await validateVideoUploads(database(env),user.id,payload);cost=getVideoCost(payload.duration,payload.resolution,payload.model,referenceDuration);}
 else{payload=validateSong(input);cost=10;}
 const header=request.headers.get('Idempotency-Key');if(header&&!/^[\w-]{8,128}$/.test(header))throw new ApiError(400,'Invalid request identifier.');const key=header??await sha256(`${kind}:${JSON.stringify(payload)}:${Math.floor(Date.now()/60000)}`);const storedPayload=kind==='video'?{...payload,provider:'kie'}:payload;const job=await reserveGeneration(database(env),user.id,key,kind,storedPayload,cost,unavailableReason);return Response.json(generationResponse(job),{status:202,headers:{'Cache-Control':'no-store'}});
}
