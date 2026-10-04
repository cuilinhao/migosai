import type { User } from '../contracts';
import { ApiError } from './errors';
import { appOrigin, authConfigured, database, type Env } from './env';
import { randomToken, safeReturnTo, sha256, sameOrigin } from './security';
import { authBody, limitAuth, normalizeEmail } from './auth-security';
import { hashPassword, verifyPassword } from './passwords';
import { verifyGoogleToken, type GoogleProfile } from './google-token';
const SESSION='migos_session';const OAUTH='migos_oauth';
export function cookie(request:Request,name:string){return request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1);}
export function setCookie(name:string,value:string,env:Env,maxAge:number){return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${appOrigin(env).startsWith('https:')?'; Secure':''}`;}
export async function currentUser(request:Request,env:Env):Promise<(User&{credits:number})|null>{const token=cookie(request,SESSION);if(!env.DB||!token||!/^[\w-]{43}$/.test(token))return null;return env.DB.prepare('SELECT u.id,u.name,u.email,u.picture,u.credits FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>unixepoch()').bind(await sha256(token)).first<User&{credits:number}>();}
export async function requireUser(request:Request,env:Env){const user=await currentUser(request,env);if(!user)throw new ApiError(401,'Please sign in to continue.');return user;}
export async function startGoogle(request:Request,env:Env){if(!authConfigured(env))throw new ApiError(503,'Google sign-in is not configured yet.');if(request.headers.get('sec-fetch-site')==='cross-site')throw new ApiError(403,'Start sign-in from this website.');const db=database(env),state=randomToken(),verifier=randomToken();const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));const challenge=btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');await db.prepare('INSERT INTO oauth_states(state_hash,verifier,return_to,expires_at) VALUES(?,?,?,unixepoch()+600)').bind(await sha256(state),verifier,safeReturnTo(new URL(request.url).searchParams.get('returnTo'))).run();const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID!,redirect_uri:appOrigin(env)+'/api/auth/callback/google',response_type:'code',scope:'openid email profile',state,code_challenge:challenge,code_challenge_method:'S256'}).toString();return new Response(null,{status:302,headers:{Location:url.href,'Set-Cookie':setCookie(OAUTH,state,env,600),'Cache-Control':'no-store'}});}
export async function finishGoogle(request:Request,env:Env){if(!authConfigured(env))throw new ApiError(503,'Google sign-in is not configured yet.');const url=new URL(request.url),state=url.searchParams.get('state'),code=url.searchParams.get('code');if(!state||state!==cookie(request,OAUTH)||!code)throw new ApiError(400,'Sign-in expired or was cancelled. Please try again.');const db=database(env);const saved=await db.prepare('DELETE FROM oauth_states WHERE state_hash=? AND expires_at>unixepoch() RETURNING verifier,return_to').bind(await sha256(state)).first<{verifier:string;return_to:string}>();if(!saved)throw new ApiError(400,'Sign-in has expired. Please try again.');const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID!,client_secret:env.GOOGLE_CLIENT_SECRET!,redirect_uri:appOrigin(env)+'/api/auth/callback/google',grant_type:'authorization_code',code_verifier:saved.verifier}),signal:AbortSignal.timeout(15000)});if(!tokenResponse.ok)throw new ApiError(502,'Google could not complete sign-in.');const tokens=await tokenResponse.json() as {access_token?:string};if(!tokens.access_token)throw new ApiError(502,'Google did not return a sign-in token.');const profileResponse=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${tokens.access_token}`},signal:AbortSignal.timeout(15000)});if(!profileResponse.ok)throw new ApiError(502,'Google could not verify your profile.');const profile=await profileResponse.json() as {sub?:string;email?:string;email_verified?:boolean;name?:string;picture?:string};if(!profile.sub||!profile.email||profile.email_verified!==true)throw new ApiError(403,'A verified Google email is required.');
 const user=await googleUser(db,profile as GoogleProfile);const sessionCookie=await createSession(user.id,env);const headers=new Headers({Location:appOrigin(env)+safeReturnTo(saved.return_to),'Cache-Control':'no-store'});headers.append('Set-Cookie',sessionCookie);headers.append('Set-Cookie',setCookie(OAUTH,'',env,0));return new Response(null,{status:302,headers});}
export async function logout(request:Request,env:Env){const token=cookie(request,SESSION);if(env.DB&&token)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run();return Response.json({ok:true},{headers:{'Set-Cookie':setCookie(SESSION,'',env,0),'Cache-Control':'no-store'}});}

export async function createSession(userId: string, env: Env): Promise<string> {
 const token = randomToken();
 await database(env).prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+2592000)').bind(await sha256(token),userId).run();
 return setCookie(SESSION,token,env,2592000);
}
function emailConflict() { return new ApiError(409, 'An account already uses this email. Sign in with your existing method.'); }
async function emailInput(request: Request, env: Env) {
 sameOrigin(request,appOrigin(env));
 const body = await authBody(request);
 const email = normalizeEmail(body.email);
 if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) throw new ApiError(400, 'Use a password with 8 to 128 characters.');
 return { email, password: body.password, name: body.name };
}
export async function registerEmail(request: Request, env: Env): Promise<Response> {
 const input = await emailInput(request,env), db = database(env);
 await limitAuth(db,request,'email-register',input.email);
 if (input.name !== undefined && (typeof input.name !== 'string' || input.name.trim().length > 80)) throw new ApiError(400, 'Use a name with at most 80 characters.');
 if (await db.prepare('SELECT id FROM users WHERE lower(email)=?').bind(input.email).first()) throw emailConflict();
 const id = crypto.randomUUID(), hash = await hashPassword(input.password);
 try {
  await db.batch([
   db.prepare('INSERT INTO users(id,email,name) VALUES(?,?,?)').bind(id,input.email,typeof input.name === 'string' && input.name.trim() ? input.name.trim() : input.email.split('@')[0]),
   db.prepare('INSERT INTO password_credentials(user_id,password_hash) VALUES(?,?)').bind(id,hash),
  ]);
 } catch (error) {
  if (await db.prepare('SELECT id FROM users WHERE lower(email)=?').bind(input.email).first()) throw emailConflict();
  throw error;
 }
 return Response.json({ok:true},{headers:{'Set-Cookie':await createSession(id,env),'Cache-Control':'no-store'}});
}
export async function loginEmail(request: Request, env: Env): Promise<Response> {
 const input = await emailInput(request,env), db = database(env);
 await limitAuth(db,request,'email-login',input.email);
 const user = await db.prepare('SELECT u.id,p.password_hash FROM users u JOIN password_credentials p ON p.user_id=u.id WHERE lower(u.email)=?').bind(input.email).first<{id:string;password_hash:string}>();
 const valid = await verifyPassword(input.password,user?.password_hash ?? null);
 if (!valid || !user) throw new ApiError(401,'Email or password is incorrect.');
 return Response.json({ok:true},{headers:{'Set-Cookie':await createSession(user.id,env),'Cache-Control':'no-store'}});
}

async function googleUser(db: D1Database, profile: GoogleProfile): Promise<{id: string}> {
 const email = normalizeEmail(profile.email);
 const existing = await db.prepare('SELECT id FROM users WHERE google_sub=?').bind(profile.sub).first<{id:string}>();
 const picture = typeof profile.picture === 'string' && profile.picture.startsWith('https://') ? profile.picture.slice(0,2048) : null;
 if (existing) {
  await db.prepare('UPDATE users SET name=?,picture=? WHERE id=?').bind(profile.name || email,picture,existing.id).run();
  return existing;
 }
 // Email ownership alone never links an existing account, including unverified password accounts.
 if (await db.prepare('SELECT id FROM users WHERE lower(email)=?').bind(email).first()) throw emailConflict();
 const id = crypto.randomUUID();
 try {
  await db.prepare('INSERT INTO users(id,email,name,picture,google_sub) VALUES(?,?,?,?,?)').bind(id,email,profile.name || email,picture,profile.sub).run();
 } catch (error) {
  const concurrent = await db.prepare('SELECT id FROM users WHERE google_sub=?').bind(profile.sub).first<{id:string}>();
  if (concurrent) return concurrent;
  if (await db.prepare('SELECT id FROM users WHERE lower(email)=?').bind(email).first()) throw emailConflict();
  throw error;
 }
 return {id};
}
const ONE_TAP = 'migos_one_tap';
export function oneTapConfigured(env: Env): boolean { return !!(env.DB && env.APP_URL && env.GOOGLE_CLIENT_ID); }
export function emailAuthConfigured(env: Env): boolean { return !!(env.DB && env.APP_URL); }
export async function startOneTap(request: Request, env: Env): Promise<Response> {
 if (!oneTapConfigured(env)) throw new ApiError(503,'Google sign-in is not configured yet.');
 const origin = appOrigin(env);
 if (request.headers.get('sec-fetch-site') === 'cross-site' || (request.headers.has('origin') && request.headers.get('origin') !== origin)) throw new ApiError(403,'Start sign-in from this website.');
 const db = database(env);
 await limitAuth(db,request,'one-tap-start');
 const old = cookie(request,ONE_TAP);
 if (old && /^[\w-]{43}$/.test(old)) {
  // Tabs share cookies: a new prompt must not invalidate another tab's live prompt.
  const live = await db.prepare('SELECT expires_at-unixepoch() AS remaining FROM one_tap_nonces WHERE nonce_hash=? AND expires_at>unixepoch()').bind(await sha256(old)).first<{remaining:number}>();
  if (live) return Response.json({clientId:env.GOOGLE_CLIENT_ID,nonce:old},{headers:{'Set-Cookie':setCookie(ONE_TAP,old,env,live.remaining),'Cache-Control':'no-store'}});
 }
 const nonce = randomToken();
 await db.prepare('DELETE FROM one_tap_nonces WHERE expires_at<=unixepoch()').run();
 await db.prepare('INSERT INTO one_tap_nonces(nonce_hash,expires_at) VALUES(?,unixepoch()+600)').bind(await sha256(nonce)).run();
 return Response.json({clientId:env.GOOGLE_CLIENT_ID,nonce},{headers:{'Set-Cookie':setCookie(ONE_TAP,nonce,env,600),'Cache-Control':'no-store'}});
}
export async function finishOneTap(request: Request, env: Env): Promise<Response> {
 if (!oneTapConfigured(env)) throw new ApiError(503,'Google sign-in is not configured yet.');
 sameOrigin(request,appOrigin(env));
 const db = database(env), body = await authBody(request);
 await limitAuth(db,request,'one-tap-finish');
 const nonce = cookie(request,ONE_TAP);
 if (!nonce || !/^[\w-]{43}$/.test(nonce) || typeof body.credential !== 'string') throw new ApiError(400,'Sign-in expired or was cancelled. Please try again.');
 const nonceHash = await sha256(nonce);
 if (!await db.prepare('SELECT nonce_hash FROM one_tap_nonces WHERE nonce_hash=? AND expires_at>unixepoch()').bind(nonceHash).first()) throw new ApiError(400,'Sign-in has expired. Please try again.');
 const profile = await verifyGoogleToken(body.credential,env.GOOGLE_CLIENT_ID!,nonce);
 // Atomic consume prevents parallel submissions from issuing multiple sessions.
 if (!await db.prepare('DELETE FROM one_tap_nonces WHERE nonce_hash=? AND expires_at>unixepoch() RETURNING nonce_hash').bind(nonceHash).first()) throw new ApiError(400,'Sign-in has expired. Please try again.');
 const user = await googleUser(db,profile);
 const headers = new Headers({'Cache-Control':'no-store'});
 headers.append('Set-Cookie',await createSession(user.id,env));
 headers.append('Set-Cookie',setCookie(ONE_TAP,'',env,0));
 return Response.json({ok:true},{headers});
}
