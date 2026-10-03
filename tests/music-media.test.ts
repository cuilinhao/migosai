import { describe,it,expect,vi } from 'vitest';
import { validateSong,musicPayload } from '../lib/server/provider';
import { mediaResponse } from '../lib/server/media';
import { reserveGeneration } from '../lib/server/billing';
import { advanceJob } from '../lib/server/jobs';
import { database,jobEnv } from './helpers';
describe('approved V6 music models',()=>{
 for(const model of ['v6','v6-wild','v6-mini'])it(`passes ${model} unchanged to the provider`,()=>{const song=validateSong({model,custom:false,instrumental:false,prompt:' Original rap '});expect(song.prompt).toBe('Original rap');expect(musicPayload(song)).toMatchObject({model:'suno',version:model,prompt:'Original rap'});});
 it('allows custom instrumental without lyrics and keeps style and title',()=>{expect(musicPayload(validateSong({model:'v6',custom:true,instrumental:true,title:'Studio beat',style:'Jazz rap'}))).toEqual({model:'suno',version:'v6',custom:true,instrumental:true,title:'Studio beat',style:'Jazz rap',prompt:undefined});});
 it('maps custom lyrics rather than inspiration prompt',()=>{expect(musicPayload(validateSong({model:'v6-mini',custom:true,instrumental:false,lyrics:'[Verse]\nOriginal words',prompt:'unused',title:'Song',style:'Rap'})).prompt).toBe('[Verse]\nOriginal words');});
 it('rejects unsupported models and missing mode-specific text',()=>{for(const p of [{model:'v5',custom:false,instrumental:false,prompt:'rap'},{model:'v6',custom:false,instrumental:true},{model:'v6',custom:true,instrumental:false,lyrics:' '}])expect(()=>validateSong(p)).toThrow();});
 it('enforces text limits and types without charging',()=>{for(const [key,length] of [['prompt',3001],['lyrics',5001],['title',81],['style',1001]] as const)expect(()=>validateSong({model:'v6',custom:true,instrumental:true,[key]:'x'.repeat(length)})).toThrow();expect(()=>validateSong({model:'v6',custom:false,instrumental:false,prompt:1})).toThrow();});
 it('submits a music task for exactly ten credits and polls the music endpoint',async()=>{const d=database();const song=validateSong({model:'v6-wild',custom:false,instrumental:false,prompt:'Original jazz rap'});const job=await reserveGeneration(d.db,'u','music-v6','music',song,10);const calls:{url:string;body:any}[]=[];const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async(url,init)=>{calls.push({url:String(url),body:init?.body?JSON.parse(String(init.body)):null});return Response.json(init?.method==='POST'?{data:[{task_id:'music_1'}]}:{data:{status:'cancelled'}});});try{await advanceJob(jobEnv(d.db),job.id);expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(90);expect(calls[0]).toMatchObject({url:'https://api.apimart.ai/v1/music/generations',body:{model:'suno',version:'v6-wild'}});d.sqlite.exec('UPDATE generations SET next_poll=0');await advanceJob(jobEnv(d.db),job.id);expect(calls[1].url).toBe('https://api.apimart.ai/v1/music/tasks/music_1');expect(d.sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(100);}finally{fetcher.mockRestore();}});
});
describe('media HTTP range semantics',()=>{
 function object(){return {size:100,httpMetadata:{contentType:'video/mp4'},range:{offset:0,length:100},body:new ReadableStream()} as unknown as R2ObjectBody;}
 it('returns 200 without a Range request even when R2 includes range metadata',()=>{const response=mediaResponse(object(),false);expect(response.status).toBe(200);expect(response.headers.has('Content-Range')).toBe(false);});
 it('returns 206 and a valid Content-Range for an explicit range',()=>{const response=mediaResponse({...object(),range:{offset:5,length:10}} as R2ObjectBody,true);expect(response.status).toBe(206);expect(response.headers.get('Content-Range')).toBe('bytes 5-14/100');expect(response.headers.get('Content-Length')).toBe('10');});
});
import { createCheckout } from '../lib/server/payments';
it('rejects an unknown credit pack before contacting the payment API',async()=>{
 const d=database(),fetcher=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('unexpected network request'));
 try{
  await expect(createCheckout(jobEnv(d.db),{id:'u',email:'a@b.c',name:'Test'},'forged')).rejects.toThrow(/Unknown credit pack/);
  expect(fetcher).not.toHaveBeenCalled();
 }finally{fetcher.mockRestore();}
});
