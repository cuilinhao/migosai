import { ApiError } from './errors';
export type Job={id:string;user_id:string;idempotency_key:string;kind:'video'|'music';payload:string;cost:number;status:string;stage:string;provider_id:string|null;assets:string|null;result_keys:string|null;error:string|null;progress:number;provider_cost:number|null;lease_until:number;lease_owner:string|null;next_poll:number;created_at:number;moderation_state:string|null;moderation_verdict:string|null;moderation_key:string|null;moderation_etag:string|null};
function matchesReservation(job:Job,kind:string,serialized:string):boolean{
 if(job.kind!==kind)return false;
 if(job.payload===serialized)return true;
 if(kind!=='video')return false;
 // Provider routing is server-owned metadata, not part of the user's options.
 // A retry across a provider rollout must keep its original task and debit.
 const options=(value:string)=>JSON.stringify(JSON.parse(value),(key,value)=>key==='provider'?undefined:value);
 return options(job.payload)===options(serialized);
}
export async function reserveGeneration(db:D1Database,userId:string,key:string,kind:string,payload:unknown,cost:number):Promise<Job>{
 const serialized=JSON.stringify(payload);const previous=await db.prepare('SELECT * FROM generations WHERE user_id=? AND idempotency_key=?').bind(userId,key).first<Job>();
 if(previous){if(!matchesReservation(previous,kind,serialized))throw new ApiError(409,'This request identifier was already used for different options.');return previous;}
 const id=crypto.randomUUID();try{await db.prepare('INSERT INTO generations(id,user_id,idempotency_key,kind,payload,cost) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,idempotency_key) DO NOTHING').bind(id,userId,key,kind,serialized,cost).run();}catch(e){if(String(e).includes('insufficient_credits'))throw new ApiError(402,'Not enough credits. Please purchase a credit pack.');throw e;}
 const job=await db.prepare('SELECT * FROM generations WHERE user_id=? AND idempotency_key=?').bind(userId,key).first<Job>();if(!job)throw new ApiError(503,'Could not reserve credits.');if(!matchesReservation(job,kind,serialized))throw new ApiError(409,'Request identifier conflicts with an earlier generation.');return job;
}
export type JobFence = { owner:string; stage:string };
export async function refundGeneration(db:D1Database,id:string,status:'failed'|'cancelled',error:string,fence?:JobFence):Promise<void>{
 const condition=fence?' AND lease_owner=? AND stage=? AND lease_until>unixepoch()':'';
 const args=fence?[fence.owner,fence.stage]:[];
 await db.batch([
  db.prepare("UPDATE generations SET status=?,error=?,stage='terminal' WHERE id=? AND status NOT IN('completed','failed','cancelled')"+condition).bind(status,error,id,...args),
  db.prepare("INSERT INTO credit_ledger(id,user_id,amount,kind,reference_id) SELECT id||':refund',user_id,cost,'refund',id FROM generations WHERE id=? AND status IN('failed','cancelled')"+(fence?' AND lease_owner=?':'')+" ON CONFLICT(kind,reference_id) DO NOTHING").bind(id,...(fence?[fence.owner]:[]))
 ]);
 if(fence)fence.stage='terminal';
}
