import { getCloudflareContext } from '@opennextjs/cloudflare';
import { ApiError } from './errors';
export type Env = Partial<CloudflareEnv>;
export async function getEnv():Promise<Env>{let bindings:Env={};try{bindings=(await getCloudflareContext({async:true})).env;}catch{/* Plain Next preview can render public pages without Cloudflare bindings. */}return {...process.env,...bindings} as Env;}
export function database(env:Env):D1Database{if(!env.DB)throw new ApiError(503,'Database service is not configured.');return env.DB;}
export function media(env:Env):R2Bucket{if(!env.MEDIA)throw new ApiError(503,'Media storage is not configured.');return env.MEDIA;}
export function appOrigin(env:Env):string{if(!env.APP_URL)throw new ApiError(503,'Application URL is not configured.');const u=new URL(env.APP_URL);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname)))throw new ApiError(503,'Application URL must use HTTPS.');return u.origin;}
export function authConfigured(env:Env){return !!(env.DB&&env.APP_URL&&env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET);}
export function moderationConfigured(env:Env){if(!env.SEEAPI_API_KEY||!/^sk_seeapi_[A-Za-z0-9_-]{20,}$/.test(env.SEEAPI_API_KEY))throw new ApiError(503,'Video safety review is not configured. Please try again later.');}
export function providerConfigured(env:Env,provider:'apimart'|'kie'='apimart'){const key=provider==='kie'?env.KIE_API_KEY:env.APIMART_API_KEY;const hosts=provider==='kie'?env.KIE_MEDIA_HOSTS:env.APIMART_MEDIA_HOSTS;if(!key||!hosts||!env.MEDIA_SIGNING_SECRET||env.MEDIA_SIGNING_SECRET.length<32)throw new ApiError(503,'AI generation is not configured. Please try again later.');database(env);media(env);appOrigin(env);}
