import { DatabaseSync } from 'node:sqlite';
import { readFileSync,readdirSync } from 'node:fs';
export function database() {
 const sqlite = new DatabaseSync(':memory:'); for(const file of readdirSync(new URL('../migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../migrations/'+file, import.meta.url),'utf8'));
 const wrap=(sql:string,args:any[]=[])=>({bind:(...a:any[])=>wrap(sql,a),first:async()=>sqlite.prepare(sql).get(...args)??null,all:async()=>({results:sqlite.prepare(sql).all(...args)}),run:async()=>({meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}})});
 const db={prepare:(sql:string)=>wrap(sql),batch:async(stmts:any[])=>{sqlite.exec('BEGIN');try{const results=[];for(const s of stmts)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}} as unknown as D1Database;
 sqlite.exec("INSERT INTO users(id,email,name,credits) VALUES('u','a@b.c','Test',100)"); return {db,sqlite};
}
export function jobEnv(db:D1Database){return {DB:db,MEDIA:{} as R2Bucket,APP_URL:'https://example.test',APIMART_API_KEY:'test-key',SEEAPI_API_KEY:'sk_seeapi_'+ 'test'.repeat(10),MEDIA_SIGNING_SECRET:'a'.repeat(32),APIMART_MEDIA_HOSTS:'cdn.apimart.ai'};}
