import { ApiError } from './errors';

type GoogleJwk = JsonWebKey & {kid?: string};
export type GoogleProfile = {sub: string; email: string; email_verified: true; name?: string; picture?: string};
let cachedKeys: {keys: GoogleJwk[]; expiresAt: number; fetchedAt: number} | undefined;
let pendingKeys: Promise<GoogleJwk[]> | undefined;
const invalid = () => new ApiError(401, 'Google sign-in could not be verified. Please try again.');
function decode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw invalid();
  try { return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), char => char.charCodeAt(0)); }
  catch { throw invalid(); }
}
function object(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(decode(value)));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw invalid();
    return parsed;
  } catch { throw invalid(); }
}
async function keysFor(kid: string): Promise<GoogleJwk[]> {
  const now = Date.now();
  if (cachedKeys && cachedKeys.expiresAt > now && (cachedKeys.keys.some(key => key.kid === kid) || now-cachedKeys.fetchedAt < 30000)) return cachedKeys.keys;
  if (!pendingKeys) pendingKeys = (async () => {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/certs', {signal: AbortSignal.timeout(10000), redirect:'manual'});
      if (!response.ok) throw new Error('JWKS unavailable');
      const body = await response.json() as {keys?: GoogleJwk[]};
      if (!Array.isArray(body.keys) || !body.keys.length) throw new Error('Invalid JWKS');
      const ttl = Math.min(Number(/max-age=(\d+)/i.exec(response.headers.get('cache-control') ?? '')?.[1] ?? 300), 3600);
      cachedKeys = {keys:body.keys,expiresAt:Date.now()+ttl*1000,fetchedAt:Date.now()};
      return body.keys;
    } catch { throw new ApiError(503, 'Google sign-in is temporarily unavailable. Please try again.'); }
    finally { pendingKeys = undefined; }
  })();
  return pendingKeys;
}
export async function verifyGoogleToken(credential: string, clientId: string, nonce: string): Promise<GoogleProfile> {
  const parts = credential.split('.');
  if (parts.length !== 3 || credential.length > 6000) throw invalid();
  const header = object(parts[0]), claims = object(parts[1]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid || header.kid.length > 128 || header.crit !== undefined) throw invalid();
  const now = Math.floor(Date.now()/1000);
  if (!['accounts.google.com','https://accounts.google.com'].includes(String(claims.iss)) || claims.aud !== clientId ||
      !Number.isInteger(claims.exp) || Number(claims.exp) <= now || !Number.isInteger(claims.iat) || Number(claims.iat) > now+60 ||
      (claims.nbf !== undefined && (!Number.isInteger(claims.nbf) || Number(claims.nbf) > now)) ||
      (claims.azp !== undefined && claims.azp !== clientId) || claims.nonce !== nonce || claims.email_verified !== true ||
      typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255 || typeof claims.email !== 'string') throw invalid();
  const jwk = (await keysFor(header.kid)).find(key => key.kid === header.kid && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256') && (!key.use || key.use === 'sig'));
  if (!jwk) throw invalid();
  try {
    const key = await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]))) throw invalid();
  } catch { throw invalid(); }
  return {sub:claims.sub,email:claims.email,email_verified:true,name:typeof claims.name==='string'?claims.name.slice(0,200):undefined,picture:typeof claims.picture==='string'?claims.picture:undefined};
}
