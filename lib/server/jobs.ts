import type { CreateVideoRequest,CreateSongRequest,GenerationResponse,GenerationStatus } from '../contracts';
import { database,providerConfigured,moderationConfigured,type Env } from './env';
import { refundGeneration,type Job,type JobFence } from './billing';
import { ProviderError,providerRequest,normalizeProviderStatus,usableAsset,musicPayload } from './provider';
import { signedMediaUrl,storeProviderMedia } from './media';
import { videoPrompt } from '../prompts/video';
import { createModerationMediaUrl } from './moderation-media';
import { createVideoModeration, getVideoModeration, SeeApiError } from './seeapi';
type Avatar={key:string;side:'left'|'right';taskId?:string;url?:string};
export function generationResponse(job:Job):GenerationResponse{
 const keys:string[]=JSON.parse(job.result_keys??'[]');
 const approved=job.kind==='video'&&job.moderation_verdict==='passed'&&keys.length===1&&keys[0]===job.moderation_key&&!!job.moderation_etag;
 const unreviewed=job.kind==='video'&&job.status==='completed'&&!approved;
 const statusMessage=job.moderation_verdict==='manual'?'Safety review needs attention. Your video remains unavailable.':job.stage.startsWith('moderation_')?'Checking video safety before delivery…':undefined;
 return {id:job.id,status:job.status as GenerationStatus,progress:job.progress,...(job.error||unreviewed?{error:job.error??'This video is unavailable until its safety review is completed.'}:{}),...(statusMessage?{statusMessage}:{}),...(job.status==='completed'?(job.kind==='music'?{audioUrls:keys.map(key=>`/api/media/${key}`)}:approved?{videoUrl:`/api/media/${keys[0]}`}:{ }):{})};
}
class LostLease extends Error {}
async function patch(db:D1Database,id:string,fence:JobFence,fields:Record<string,string|number|null>){
 const names=Object.keys(fields);
 const result=await db.prepare(`UPDATE generations SET ${names.map(n=>`${n}=?`).concat('lease_until=unixepoch()+240').join(',')} WHERE id=? AND lease_owner=? AND stage=? AND lease_until>unixepoch() AND status NOT IN('completed','failed','cancelled')`).bind(...names.map(n=>fields[n]),id,fence.owner,fence.stage).run();
 if(!result.meta.changes)throw new LostLease();
 if(typeof fields.stage==='string')fence.stage=fields.stage;
}

type ModerationState={version:1;requestBody:string;idempotencyKey:string;expiresAt:number;deadline:number;failures:number;taskId?:string;checkedFrames?:number;flaggedFrames?:number};
const REVIEW_TIMEOUT=30*60;
const MAX_REVIEW_FAILURES=8;
function moderationState(job:Job):ModerationState{
 const state=JSON.parse(job.moderation_state??'null');
 if(!state||state.version!==1||typeof state.requestBody!=='string'||state.idempotencyKey!==`migosai-video-moderation-${job.id}`||!Number.isSafeInteger(state.expiresAt)||!Number.isSafeInteger(state.deadline)||!Number.isInteger(state.failures)||state.failures<0||!job.moderation_key||!job.moderation_etag)throw new SeeApiError('Safety review state needs support attention.',false);
 return state;
}
async function holdForReview(db:D1Database,job:Job,fence:JobFence){
 await patch(db,job.id,fence,{stage:'manual_review',status:'reviewing',moderation_verdict:'manual',error:'Safety review could not be completed. Your video is held for review and cannot be downloaded.'});
}
async function refundBlockedVideo(env:Env,job:Job,fence:JobFence){
 const db=database(env);
 if(job.moderation_verdict==='blocked')await patch(db,job.id,fence,{moderation_cleanup_pending:1});
 await refundGeneration(db,job.id,'failed','This video did not pass the content safety check. Your credits have been returned.',fence);
 await cleanupRejectedVideo(env,job.id).catch(()=>{});
}
async function cleanupRejectedVideo(env:Env,id:string){
 const db=database(env);
 const current=await db.prepare("SELECT moderation_key FROM generations WHERE id=? AND status='failed' AND moderation_verdict='blocked' AND moderation_cleanup_pending=1").bind(id).first<{moderation_key:string|null}>();
 if(!current?.moderation_key)return;
 // Deletion is idempotent. A crash before the acknowledgement leaves the row
 // pending so cron can retry even though the generation is already terminal.
 await env.MEDIA!.delete(current.moderation_key);
 await db.prepare("UPDATE generations SET moderation_cleanup_pending=0 WHERE id=? AND status='failed' AND moderation_verdict='blocked' AND moderation_key=?").bind(id,current.moderation_key).run();
}
async function advanceModeration(env:Env,job:Job,fence:JobFence){
 const db=database(env);
 let state:ModerationState|undefined;
 let blocked=job.moderation_verdict==='blocked';
 try{
  if(blocked){await refundBlockedVideo(env,job,fence);return;}
  state=moderationState(job);
  const now=Math.floor(Date.now()/1000);
  if(job.moderation_verdict!=='pending'||now>=state.deadline||now>=state.expiresAt||state.failures>=MAX_REVIEW_FAILURES){await holdForReview(db,job,fence);return;}
  if(job.stage==='moderation_submitting'){
   // This body and key were committed before the first POST. A crashed or timed-out
   // submission replays exactly the same request, including its signed video URL.
   await patch(db,job.id,fence,{moderation_state:JSON.stringify(state)});
   const task=await createVideoModeration(env,state.requestBody,state.idempotencyKey);
   state.taskId=task.id;state.failures=0;
   await patch(db,job.id,fence,{stage:'moderation_polling',moderation_state:JSON.stringify(state),error:null});
   return;
  }
  if(!state.taskId)throw new SeeApiError('Safety review task is missing.',false);
  const result=await getVideoModeration(env,state.taskId);
  if(result.verdict==='pending'){
   state.failures=0;
   await patch(db,job.id,fence,{moderation_state:JSON.stringify(state),error:null});return;
  }
  state.checkedFrames=result.checkedFrames;state.flaggedFrames=result.flaggedFrames;
  if(result.verdict==='blocked'){
   blocked=true;
   await patch(db,job.id,fence,{moderation_verdict:'blocked',moderation_state:JSON.stringify(state),moderation_cleanup_pending:1});
   await refundBlockedVideo(env,job,fence);return;
  }
  const object=await env.MEDIA!.head(job.moderation_key!);
  if(!object||object.etag!==job.moderation_etag)throw new SeeApiError('The reviewed video is unavailable.',false);
  await patch(db,job.id,fence,{moderation_verdict:'passed',moderation_state:JSON.stringify(state),status:'completed',stage:'terminal',result_keys:JSON.stringify([job.moderation_key]),progress:100,error:null});
 }catch(error){
  if(error instanceof LostLease)throw error;
  if(blocked){
   // A verified block is final for content, but credit/storage recovery is still
   // retryable. Never turn a transient refund failure into manual moderation.
   await patch(db,job.id,fence,{moderation_verdict:'blocked',moderation_cleanup_pending:1,next_poll:Math.floor(Date.now()/1000)+60,error:'This video did not pass the content safety check. Your credit return is being retried.'});
   return;
  }
  if(!state||error instanceof SeeApiError&&!error.retryable){await holdForReview(db,job,fence);return;}
  state.failures++;
  const now=Math.floor(Date.now()/1000);
  const delay=Math.max(Math.min(300,30*2**(state.failures-1)),error instanceof SeeApiError?error.retryAfter??0:0);
  if(state.failures>=MAX_REVIEW_FAILURES||now+delay>=state.deadline){await holdForReview(db,job,fence);return;}
  await patch(db,job.id,fence,{moderation_state:JSON.stringify(state),next_poll:now+delay,error:'Safety review is temporarily unavailable. We will retry automatically; your video remains private.'});
 }
}

async function quarantineVideo(env:Env,job:Job,fence:JobFence,url:string,cost:number|null){
 const db=database(env),key=`users/${job.user_id}/results/${job.id}/${crypto.randomUUID()}`;
 try{
  await storeProviderMedia(env,url,key,'video');
  const object=await env.MEDIA!.head(key);
  if(!object?.etag)throw new Error('Could not verify the stored video.');
  const now=Math.floor(Date.now()/1000),expiresAt=now+3600;
  const videoUrl=await createModerationMediaUrl(env,job.id,key,object.etag,expiresAt);
  const state:ModerationState={version:1,idempotencyKey:`migosai-video-moderation-${job.id}`,expiresAt,deadline:now+REVIEW_TIMEOUT,failures:0,requestBody:JSON.stringify({model:'video-nsfw-filter',endpoint:'video-moderation',provider:'seeapi',input:{video_url:videoUrl,num_frames:32,threshold_offset:0.02,strict_special_care:true,return_frames:'none'}})};
  await patch(db,job.id,fence,{stage:'moderation_submitting',status:'reviewing',progress:95,result_keys:null,moderation_key:key,moderation_etag:object.etag,moderation_verdict:'pending',moderation_state:JSON.stringify(state),provider_cost:cost,error:null});
 }catch(error){
  // Unique keys prevent stale uploaders from overwriting the selected candidate.
  // Read back after an uncertain D1 write before deleting an unselected object.
  try{const current=await db.prepare('SELECT moderation_key FROM generations WHERE id=?').bind(job.id).first<{moderation_key:string|null}>();if(current&&current.moderation_key!==key)await env.MEDIA!.delete(key);}catch{/* Uncertain objects remain private and unlinked. */}
  throw error;
 }
}
export async function advanceJob(env:Env,id:string):Promise<void>{const db=database(env),owner=crypto.randomUUID();const acquired=await db.prepare("UPDATE generations SET lease_until=unixepoch()+240,lease_owner=? WHERE id=? AND lease_until<unixepoch() AND next_poll<=unixepoch() AND status NOT IN('completed','failed','cancelled') AND stage!='manual_review'").bind(owner,id).run();if(!acquired.meta.changes)return;const job=await db.prepare('SELECT * FROM generations WHERE id=?').bind(id).first<Job>();if(!job||job.lease_owner!==owner)return;const fence:JobFence={owner,stage:job.stage};
 try{
  if(job.kind==='video'&&job.stage.startsWith('moderation_')){await advanceModeration(env,job,fence);return;}
  providerConfigured(env);
  if(job.kind==='video'&&(job.stage==='new'||job.stage==='ready'))moderationConfigured(env);
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
   if(job.kind==='video'){await quarantineVideo(env,job,fence,urls[0],typeof data.cost==='number'?data.cost:null);return;}
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
 }finally{await db.prepare('UPDATE generations SET lease_until=0,lease_owner=NULL,next_poll=CASE WHEN next_poll>unixepoch() THEN next_poll ELSE unixepoch()+30 END WHERE id=? AND lease_owner=? AND stage=?').bind(id,owner,fence.stage).run();}
}
export async function runDueJobs(env:Env):Promise<void>{if(!env.DB)return;await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires_at<unixepoch()'),env.DB.prepare('DELETE FROM oauth_states WHERE expires_at<unixepoch()')]);const cleanup=await env.DB.prepare("SELECT id FROM generations WHERE moderation_cleanup_pending=1 AND status='failed' AND moderation_verdict='blocked' LIMIT 10").all<{id:string}>();for(const row of cleanup.results)await cleanupRejectedVideo(env,row.id).catch(()=>{});const due=await env.DB.prepare("SELECT id FROM generations WHERE status NOT IN('completed','failed','cancelled') AND stage!='manual_review' AND next_poll<=unixepoch() AND lease_until<unixepoch() ORDER BY next_poll,created_at LIMIT 10").all<{id:string}>();for(const row of due.results)await advanceJob(env,row.id);}
