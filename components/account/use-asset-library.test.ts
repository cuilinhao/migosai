import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssetLibraryResponse } from '@/lib/asset-library';
import type { Asset } from './asset-utils';

// Runs the hook's real actions and cleanup logic with mocked network I/O in Node.
const host=vi.hoisted(()=>{
 type Effect={deps?:unknown[];cleanup?:()=>void;run?:()=>void|(()=>void)};
 const cells:unknown[]=[];
 const effects:Effect[]=[];
 return {cells,effects,cursor:0,dirty:false,writes:0,
  reset(){cells.length=0;effects.length=0;this.cursor=0;this.dirty=false;this.writes=0;},
  useState(initial:unknown){const index=this.cursor++;if(!(index in cells))cells[index]=typeof initial==='function'?initial():initial;return [cells[index],(next:unknown)=>{const value=typeof next==='function'?next(cells[index]):next;if(!Object.is(value,cells[index])){cells[index]=value;this.dirty=true;this.writes++;}}];},
  useRef(initial:unknown){const index=this.cursor++;if(!(index in cells))cells[index]={current:initial};return cells[index];},
  useCallback(callback:unknown,deps:unknown[]){const index=this.cursor++;const previous=cells[index] as {callback:unknown;deps:unknown[]}|undefined;if(!previous||deps.some((value,i)=>!Object.is(value,previous.deps[i])))cells[index]={callback,deps};return (cells[index] as {callback:unknown}).callback;},
  useEffect(run:()=>void|(()=>void),deps?:unknown[]){const index=this.cursor++;const previous=effects[index];if(!previous||!deps||!previous.deps||deps.some((value,i)=>!Object.is(value,previous.deps?.[i])))effects[index]={...previous,deps,run};},
  flushEffects(){for(const effect of effects){if(!effect?.run)continue;effect.cleanup?.();const run=effect.run;effect.run=undefined;effect.cleanup=run()||undefined;}},
  dispose(){for(const effect of effects)effect?.cleanup?.();},
 };
});
const auth=vi.hoisted(()=>({user:{id:'alice'} as {id:string}|null,refresh:vi.fn(async()=>{})}));
vi.mock('react',async original=>({...await original<typeof import('react')>(),useState:host.useState.bind(host),useRef:host.useRef.bind(host),useEffect:host.useEffect.bind(host),useCallback:host.useCallback.bind(host)}));
vi.mock('@/components/auth-provider',()=>({useAuth:()=>auth}));
import { useAssetLibrary } from './use-asset-library';
import { Assets } from './assets';

const empty:AssetLibraryResponse={collections:[],assignments:{},hidden:[],uploads:[],storage:{fileCount:0}};
const image:Asset={id:'image-a',kind:'image',status:'completed',progress:100,cost:5,createdAt:'2026-10-22T12:00:00Z',imageUrls:['/api/media/users/alice/results/image-a/0']};
const file=new File(['photo'],'photo.jpg',{type:'image/jpeg'});
const deferred=<T>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(yes=>{resolve=yes;});return {promise,resolve};};
let owner:string|null;
let library:ReturnType<typeof useAssetLibrary>;
let fetchMock:ReturnType<typeof vi.fn<typeof fetch>>;
const render=()=>{host.cursor=0;host.dirty=false;library=useAssetLibrary(owner);host.flushEffects();return library;};
const flush=()=>{render();for(let n=0;host.dirty;n++){if(n>20)throw new Error('Asset library did not settle');render();}return library;};
const settle=async()=>{for(let n=0;n<24;n++)await Promise.resolve();flush();};
const writes=()=>fetchMock.mock.calls.filter(([,init])=>init?.method==='POST');

beforeEach(()=>{
 host.reset();vi.clearAllMocks();owner='alice';auth.user={id:'alice'};
 fetchMock=vi.fn<typeof fetch>().mockImplementation(async url=>Response.json(url==='/api/generations'?{generations:[image]}:empty));
 vi.stubGlobal('fetch',fetchMock);
});
afterEach(()=>{host.dispose();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});

describe('asset library lifecycle',()=>{
 it('keys the whole private workspace by owner, including sign-out',()=>{
  expect(Assets().key).toBe('alice');
  auth.user={id:'bob'};expect(Assets().key).toBe('bob');
  auth.user=null;expect(Assets().key).toBe('anonymous');
 });
 it('does not read or mutate a private library while signed out',async()=>{
  owner=null;flush();await settle();
  expect(library.loading).toBe(false);expect(library.assets).toEqual([]);
  expect(await library.mutate({action:'hide',assetIds:['generation:image-a']})).toBe(false);
  expect(await library.upload([file],null)).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
 });
 it('advances active generations, refreshes credits when complete and stops polling',async()=>{
  vi.useFakeTimers();let polls=0;
  fetchMock.mockImplementation(async url=>{
   if(url==='/api/asset-library')return Response.json(empty);
   if(url==='/api/generations')return Response.json({generations:[{...image,status:'processing',progress:25,imageUrls:undefined}]});
   return Response.json(++polls===1?{id:image.id,status:'processing',progress:60}:image);
  });
  flush();await settle();expect(library.assets[0].progress).toBe(60);
  await vi.advanceTimersByTimeAsync(5000);await settle();
  expect(library.assets[0].imageUrls).toEqual(image.imageUrls);expect(auth.refresh).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(15000);expect(polls).toBe(2);
 });
 it('leaves metadata intact and exposes an unsuccessful mutation for retry',async()=>{
  flush();await settle();
  fetchMock.mockImplementation(async(url,init)=>init?.method==='POST'?Response.json({error:'Could not save collection.'},{status:503}):Response.json(url==='/api/generations'?{generations:[image]}:empty));
  expect(await library.mutate({action:'hide',assetIds:['generation:image-a']})).toBe(false);flush();
  expect(library.error).toBe('Could not save collection.');expect(library.busy).toBe(false);
  expect(library.library.hidden).toEqual([]);expect(library.assets).toEqual([image]);
 });
 it('clears an action error only when the user explicitly retries the library',async()=>{
  flush();await settle();
  fetchMock.mockImplementation(async(url,init)=>init?.method==='POST'?Response.json({error:'Temporary library error.'},{status:503}):Response.json(url==='/api/generations'?{generations:[image]}:empty));
  await library.mutate({action:'hide',assetIds:['generation:image-a']});flush();
  expect(library.error).toBe('Temporary library error.');
  library.reload();flush();await settle();
  expect(library.error).toBe('');expect(library.assets).toEqual([image]);
 });
 it('preserves a mutation failure while an active generation is refreshed in the background',async()=>{
  vi.useFakeTimers();
  fetchMock.mockImplementation(async(url,init)=>{
   if(init?.method==='POST')return Response.json({error:'Collection update failed.'},{status:503});
   if(url==='/api/asset-library')return Response.json(empty);
   if(url==='/api/generations')return Response.json({generations:[{...image,status:'processing',progress:20,imageUrls:undefined}]});
   return Response.json({id:image.id,status:'processing',progress:40});
  });
  flush();await settle();await library.mutate({action:'hide',assetIds:['generation:image-a']});flush();
  await vi.advanceTimersByTimeAsync(5000);await settle();
  expect(library.error).toBe('Collection update failed.');
 });
 it('prevents same-tick duplicate writes while a mutation is pending',async()=>{
  flush();await settle();const pending=deferred<Response>();
  fetchMock.mockImplementation(async(url,init)=>init?.method==='POST'?pending.promise:Response.json(url==='/api/generations'?{generations:[image]}:empty));
  const mutate=library.mutate;
  const first=mutate({action:'create-collection',name:'Portraits',source:'creation'});
  expect(await mutate({action:'create-collection',name:'Portraits',source:'creation'})).toBe(false);
  expect(writes()).toHaveLength(1);flush();expect(library.busy).toBe(true);
  pending.resolve(Response.json({ok:true}));expect(await first).toBe(true);flush();await settle();
  expect(library.busy).toBe(false);
 });
 it('rejects oversized batches and unsupported files before uploading',async()=>{
  flush();await settle();
  expect(await library.upload(Array.from({length:11},()=>file),null)).toBe(false);flush();expect(library.error).toMatch(/10 images/);
  expect(await library.upload([new File(['movie'],'clip.mp4',{type:'video/mp4'})],null)).toBe(false);flush();expect(library.error).toMatch(/JPEG, PNG or WebP/);
  expect(writes()).toHaveLength(0);
 });
 it('keeps an import error visible after refreshing successfully uploaded files',async()=>{
  flush();await settle();let uploads=0;
  fetchMock.mockImplementation(async(url,init)=>{
   if(url==='/api/uploads')return ++uploads===1?Response.json({key:'users/alice/uploads/first'}):Response.json({error:'Second image could not be uploaded.'},{status:503});
   return Response.json(url==='/api/generations'?{generations:[image]}:empty);
  });
  expect(await library.upload([file,file],null)).toBe(false);flush();await settle();
  expect(library.error).toBe('Second image could not be uploaded.');
  expect(library.busy).toBe(false);expect(uploads).toBe(2);
 });
 it('does not move a late upload into a collection after its owner workspace unmounts',async()=>{
  flush();await settle();const pending=deferred<Response>();
  fetchMock.mockImplementation(async(url,init)=>url==='/api/uploads'?pending.promise:Response.json({ok:true}));
  const upload=library.upload([file],'alice-folder');
  host.dispose();pending.resolve(Response.json({key:'users/alice/uploads/late'}));await upload;
  expect(writes().map(([url])=>url)).toEqual(['/api/uploads']);
 });
 it('aborts an old owner history request and ignores its late private response',async()=>{
  const pending=deferred<Response>();
  fetchMock.mockImplementation(async url=>url==='/api/generations'?pending.promise:Response.json(empty));
  flush();const signal=fetchMock.mock.calls.find(([url])=>url==='/api/generations')?.[1]?.signal;
  host.dispose();const count=host.writes;
  expect(signal?.aborted).toBe(true);
  pending.resolve(Response.json({generations:[image]}));for(let n=0;n<24;n++)await Promise.resolve();
  expect(host.writes).toBe(count);
 });
});
