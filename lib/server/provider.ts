import type { CreateSongRequest } from '../contracts';
import { ApiError } from './errors';
import type { Env } from './env';
export class ProviderError extends Error{constructor(message:string,public uncertain=false,public transientQuery=false){super(message);}}
export function normalizeProviderStatus(s:string):'pending'|'processing'|'completed'|'failed'|'cancelled'{if(['completed','succeeded','success'].includes(s))return 'completed';if(['cancelled','canceled'].includes(s))return 'cancelled';if(['failed','error','rejected'].includes(s))return 'failed';return s==='processing'?'processing':'pending';}
// One source image per avatar task makes result-to-left/right mapping unambiguous even with partial failures.
export function usableAsset(result:unknown):string{const assets=(result as {usable_assets?:{asset_url?:string}[]})?.usable_assets;if(!Array.isArray(assets)||assets.length!==1||!/^asset:\/\/[\w-]+$/.test(assets[0]?.asset_url??''))throw new ProviderError('Image review did not return one approved reference. Please use a different photo.');return assets[0].asset_url!;}
export function validateSong(value:unknown):CreateSongRequest{
 const p=value as CreateSongRequest;
 if(!p||typeof p.custom!=='boolean'||typeof p.instrumental!=='boolean'||!['v6','v6-wild','v6-mini'].includes(p.model))throw new ApiError(400,'Invalid song options. Choose an available Suno V6 model.');
 for(const [key,max] of [['prompt',3000],['lyrics',5000],['style',1000],['title',80]] as const){
  if(p[key]!==undefined&&(typeof p[key]!=='string'||p[key]!.length>max))throw new ApiError(400,`${key} must be text of ${max} characters or fewer.`);
 }
 const text=(p.custom?p.lyrics:p.prompt)?.trim();
 if(!text&&(!p.custom||!p.instrumental))throw new ApiError(400,p.custom?'Please enter lyrics for a vocal song.':'Please enter a song prompt.');
 // Return only fields used by the selected mode. Never substitute the user's model version.
 return {model:p.model,custom:p.custom,instrumental:p.instrumental,...(p.custom?{lyrics:text||undefined,title:p.title?.trim()||undefined,style:p.style?.trim()||undefined}:{prompt:text})};
}
export function musicPayload(p:CreateSongRequest){return {model:'suno',version:p.model,custom:p.custom,instrumental:p.instrumental,prompt:p.custom?p.lyrics:p.prompt,...(p.custom?{title:p.title,style:p.style}:{})};}
export async function providerRequest(env:Env,path:string,payload?:unknown):Promise<any>{if(!env.APIMART_API_KEY)throw new ApiError(503,'AI generation is not configured.');let response:Response;try{response=await fetch('https://api.apimart.ai'+path,{method:payload===undefined?'GET':'POST',headers:{Authorization:`Bearer ${env.APIMART_API_KEY}`,'Content-Type':'application/json'},...(payload===undefined?{}:{body:JSON.stringify(payload)}),signal:AbortSignal.timeout(20000),redirect:'manual'});}catch{throw new ProviderError('The provider submission could not be confirmed. Support must reconcile this request before it can be retried.',payload!==undefined,payload===undefined);}
 if(!response.ok){await response.body?.cancel().catch(()=>{});const redirect=response.status>=300&&response.status<400;throw new ProviderError(redirect?'The provider returned a redirect. Support must reconcile this request before it can be retried.':response.status<500?'The provider rejected this request. Please check your photos or try again later.':'The provider is temporarily unavailable.',payload!==undefined&&(redirect||response.status>=500||response.status===408),payload===undefined);}let body:any;try{body=await response.json();}catch{throw new ProviderError('The provider returned an unreadable response.',payload!==undefined,payload===undefined);}if(body.error||body.code&&body.code!==200)throw new ProviderError('The provider could not accept this request.',payload!==undefined,payload===undefined);return body.data;}
