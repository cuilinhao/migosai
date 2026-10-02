import type { CreateVideoRequest,CreateSongRequest,GenerationResponse,GenerationStatus } from '../contracts';
import { database,providerConfigured,type Env } from './env';
import { refundGeneration,type Job,type JobFence } from './billing';
import { ProviderError,providerRequest,normalizeProviderStatus,usableAsset,musicPayload } from './provider';
import { signedMediaUrl,storeProviderMedia } from './media';
import { videoPrompt } from '../prompts/video';
type Avatar={key:string;side:'left'|'right';taskId?:string;url?:string};
const terminal=['completed','failed','cancelled'];
export function generationResponse(job:Job):GenerationResponse{const keys:string[]=JSON.parse(job.result_keys??'[]');return {id:job.id,status:job.status as GenerationStatus,progress:job.progress,...(job.error?{error:job.error}:{}),...(job.status==='completed'?(job.kind==='video'?{videoUrl:`/api/media/${keys[0]}`}:{audioUrls:keys.map(key=>`/api/media/${key}`)}):{})};}
class LostLease extends Error {}
async function patch(db:D1Database,id:string,fence:JobFence,fields:Record<string,string|number|null>){
 const names=Object.keys(fields);
 const result=await db.prepare(`UPDATE generations SET ${names.map(n=>`${n}=?`).concat('lease_until=unixepoch()+240').join(',')} WHERE id=? AND lease_owner=? AND stage=? AND lease_until>unixepoch() AND status NOT IN('completed','failed','cancelled')`).bind(...names.map(n=>fields[n]),id,fence.owner,fence.stage).run();
 if(!result.meta.changes)throw new LostLease();
 if(typeof fields.stage==='string')fence.stage=fields.stage;
}
export async function advanceJob(env:Env,id:string):Promise<void>{const db=database(env),owner=crypto.randomUUID();const acquired=await db.prepare("UPDATE generations SET lease_until=unixepoch()+240,lease_owner=? WHERE id=? AND lease_until<unixepoch() AND next_poll<=unixepoch() AND status NOT IN('completed','failed','cancelled') AND stage!='manual_review'").bind(owner,id).run();if(!acquired.meta.changes)return;const job=await db.prepare('SELECT * FROM generations WHERE id=?').bind(id).first<Job>();if(!job||job.lease_owner!==owner)return;const fence:JobFence={owner,stage:job.stage};
 try{
  providerConfigured(env);
  if(job.stage.startsWith('submitting')){await patch(db,id,fence,{stage:'manual_review',error:'The provider submission could not be confirmed. Support is reviewing this request; it will not be resubmitted automatically.'});return;}
  const payload=JSON.parse(job.payload) as CreateVideoRequest&CreateSongRequest;
  if(job.kind==='video'&&(job.stage==='new'||job.stage==='reviewing')){
   const avatars:Avatar[]=job.assets?JSON.parse(job.assets):[{key:payload.leftImage,side:'left'},{key:payload.rightImage,side:'right'}];
   const index=avatars.findIndex(a=>!a.url);const avatar=avatars[index];
   if(avatar&&!avatar.taskId){const source=await signedMediaUrl(env,avatar.key);await patch(db,id,fence,{stage:'submitting_avatar',status:'reviewing',assets:JSON.stringify(avatars)});const data=await providerRequest(env,'/v1/seedance2/private-avatar/assets',{model:'seedance-2.5',asset_type:'Image',assets:[{url:source,name:`${id}-${avatar.side}`}]});if(typeof data?.id!=='string')throw new ProviderError('Image review submission could not be confirmed.',true);avatar.taskId=data.id;await patch(db,id,fence,{stage:'reviewing',assets:JSON.stringify(avatars),progress:10+index*15});return;}
   if(avatar){const data=await providerRequest(env,`/v1/tasks/${encodeURIComponent(avatar.taskId!)}`);const status=normalizeProviderStatus(data?.status);if(status==='failed'||status==='cancelled'){await refundGeneration(db,id,status,'Image review failed. Your credits have been returned.',fence);return;}if(status!=='completed')return;avatar.url=usableAsset(data.result);await patch(db,id,fence,{assets:JSON.stringify(avatars),progress:25+index*15});if(avatars.some(a=>!a.url))return;}
   await patch(db,id,fence,{stage:'ready',assets:JSON.stringify(avatars)});return;
  }
  if(job.stage==='ready'||job.kind==='music'&&job.stage==='new'){
   const avatars:Avatar[]=JSON.parse(job.assets??'[]');const body=job.kind==='video'?{model:'seedance-2.5',image_urls:avatars.map(a=>a.url),prompt:videoPrompt(payload),duration:payload.duration,resolution:payload.resolution,size:payload.aspect,generate_audio:true,nsfw_check:true,omni_reference_task_type:'reference'}:musicPayload(payload);
   await patch(db,id,fence,{stage:'submitting_generation',status:'processing',progress:45});const data=await providerRequest(env,job.kind==='video'?'/v1/videos/generations':'/v1/music/generations',body);if(typeof data?.[0]?.task_id!=='string')throw new ProviderError('Generation submission could not be confirmed.',true);await patch(db,id,fence,{stage:'polling',provider_id:data[0].task_id,status:'processing'});return;
  }
  if(job.stage==='polling'){
   const data=await providerRequest(env,`${job.kind==='video'?'/v1/tasks/':'/v1/music/tasks/'}${encodeURIComponent(job.provider_id!)}`);const status=normalizeProviderStatus(data?.status);
   if(status==='failed'||status==='cancelled'){await refundGeneration(db,id,status,'The provider could not complete your generation. Your credits have been returned.',fence);return;}
   if(status!=='completed'){await patch(db,id,fence,{progress:Math.max(45,Math.min(95,Number(data?.progress)||45))});return;}
   const urls=job.kind==='video'?[data?.result?.videos?.[0]?.url?.[0]]:data?.result?.music?.map((m:{audio_url?:string})=>m.audio_url);
   if(!Array.isArray(urls)||!urls.length||urls.length>4||urls.some(u=>typeof u!=='string'))throw new ProviderError('The provider returned an incomplete result. Support must review this generation.',true);
   const keys:string[]=[];for(let i=0;i<urls.length;i++)keys.push(await storeProviderMedia(env,urls[i],`users/${job.user_id}/results/${job.id}/${i}`,job.kind));
   await patch(db,id,fence,{status:'completed',stage:'terminal',result_keys:JSON.stringify(keys),progress:100,error:null,provider_cost:typeof data.cost==='number'?data.cost:null});return;
  }
 }catch(error){
  try {
  if(error instanceof LostLease)return;
  if(error instanceof ProviderError&&error.transientQuery){await patch(db,id,fence,{error:'The provider status is temporarily unavailable. We will check this saved task again.'});}
  else if(error instanceof ProviderError&&error.uncertain){await patch(db,id,fence,{stage:'manual_review',error:error.message});}
  else if(error instanceof ProviderError&&job.stage!=='polling'){await refundGeneration(db,id,'failed',error.message+' Your credits have been returned.',fence);}
  else {await patch(db,id,fence,{error:job.stage==='polling'?'The result is delayed. We will keep checking automatically.':'The service is temporarily unavailable. Your request is saved.'});}
  } catch(recoveryError) { if(!(recoveryError instanceof LostLease))throw recoveryError; }
 }finally{await db.prepare('UPDATE generations SET lease_until=0,lease_owner=NULL,next_poll=unixepoch()+30 WHERE id=? AND lease_owner=? AND stage=?').bind(id,owner,fence.stage).run();}
}
export async function runDueJobs(env:Env):Promise<void>{if(!env.DB)return;await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires_at<unixepoch()'),env.DB.prepare('DELETE FROM oauth_states WHERE expires_at<unixepoch()')]);const due=await env.DB.prepare("SELECT id FROM generations WHERE status NOT IN('completed','failed','cancelled') AND stage!='manual_review' AND next_poll<=unixepoch() AND lease_until<unixepoch() ORDER BY next_poll,created_at LIMIT 10").all<{id:string}>();for(const row of due.results)await advanceJob(env,row.id);}
