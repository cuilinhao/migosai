import { ApiError } from './errors';
const encoder = new TextEncoder();
export function safeReturnTo(value: unknown): string {
 if(typeof value !== 'string'||!value.startsWith('/')||value.startsWith('//'))return '/';
 try { const decoded=decodeURIComponent(value); if(/[\\\x00-\x20]/.test(decoded)||decoded.startsWith('//'))return '/'; const u=new URL(value,'https://local.invalid');return u.origin==='https://local.invalid'?u.pathname+u.search+u.hash:'/'; }catch{return '/';}
}
export function imageType(b:Uint8Array,mime:string):string {
 let actual='';if(b[0]===255&&b[1]===216&&b[2]===255)actual='image/jpeg';
 if([137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))actual='image/png';
 if(new TextDecoder().decode(b.slice(0,4))==='RIFF'&&new TextDecoder().decode(b.slice(8,12))==='WEBP')actual='image/webp';
 if(!actual||actual!==mime)throw new ApiError(400,'Please upload a valid JPEG, PNG or WebP image.');return actual;
}
export function validMediaUrl(value:string,hosts:string):boolean {try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&hosts.split(',').map(v=>v.trim().toLowerCase()).filter(Boolean).includes(u.hostname.toLowerCase())&&!/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(u.hostname);}catch{return false;}}
export async function sha256(value:string):Promise<string>{return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function hmac(secret:string,value:string):Promise<string>{const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function verifyHmac(secret:string,value:string,signature:string):Promise<boolean>{if(!/^[a-f\d]{64}$/i.test(signature))return false;const expected=await hmac(secret,value);let diff=0;for(let i=0;i<64;i++)diff|=expected.charCodeAt(i)^signature.toLowerCase().charCodeAt(i);return diff===0;}
export function randomToken(){const b=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export function sameOrigin(request:Request,origin:string){if(request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site')throw new ApiError(403,'Cross-site request rejected.');}
export async function readLimited(request:Request,max:number):Promise<Uint8Array>{if(Number(request.headers.get('content-length'))>max)throw new ApiError(413,'Request is too large.');const reader=request.body?.getReader();if(!reader)return new Uint8Array();const chunks:Uint8Array[]=[];let total=0;try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();throw new ApiError(413,'Request is too large.');}chunks.push(value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;}
export async function jsonBody(request:Request){try{return JSON.parse(new TextDecoder().decode(await readLimited(request,32*1024)));}catch(e){if(e instanceof ApiError)throw e;throw new ApiError(400,'Invalid JSON.');}}
