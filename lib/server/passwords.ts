import { scrypt, timingSafeEqual } from 'node:crypto';

// OWASP's N=2^14, r=8, p=5 profile keeps memory within a Worker's limit.
const parameters = { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 };
const dummy = `scrypt$16384$8$5$${'00'.repeat(16)}$${'00'.repeat(32)}`;
function derive(password: string, salt: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => scrypt(password, salt, 32, parameters, (error, key) => error ? reject(error) : resolve(key)));
}
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt);
  return `scrypt$16384$8$5$${Buffer.from(salt).toString('hex')}$${Buffer.from(hash).toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const value = stored ?? dummy;
  const match = /^scrypt\$16384\$8\$5\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(value);
  // Invalid/missing records still perform the same expensive derivation.
  const parts = match ?? /^scrypt\$16384\$8\$5\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(dummy)!;
  const actual = await derive(password, Buffer.from(parts[1], 'hex'));
  return timingSafeEqual(actual, Buffer.from(parts[2], 'hex')) && !!stored && !!match;
}
