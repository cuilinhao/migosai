"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { readApi } from '@/components/generator/use-generation';
import type { GenerationResponse } from '@/lib/contracts';
import type { AssetLibraryResponse, AssetLibraryAction } from '@/lib/asset-library';
import { isActive, type Asset } from './asset-utils';

const emptyLibrary:AssetLibraryResponse = {collections:[],assignments:{},hidden:[],uploads:[],storage:{fileCount:0}};

export function useAssetLibrary(owner:string|null) {
 const { refresh } = useAuth();
 const [assets,setAssets] = useState<Asset[]>([]);
 const [library,setLibrary] = useState<AssetLibraryResponse>(emptyLibrary);
 const [loading,setLoading] = useState(!!owner);
 const [busy,setBusy] = useState(false);
 const [loadError,setLoadError] = useState('');
 const [actionError,setError] = useState('');
 const [revision,setRevision] = useState(0);
 const alive=useRef(true);
 const mutation=useRef(false);
 const reload=useCallback(()=>setRevision(value=>value+1),[]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  if(!owner)return;
  let mounted=true;
  let timer:ReturnType<typeof setTimeout>;
  const abort=new AbortController();
  setLoading(true);
  const load=async()=>{
   try {
    const [history,metadata]=await Promise.all([
     fetch('/api/generations',{cache:'no-store',credentials:'same-origin',signal:abort.signal}).then(readApi<{generations:Asset[]}>),
     fetch('/api/asset-library',{cache:'no-store',credentials:'same-origin',signal:abort.signal}).then(readApi<AssetLibraryResponse>),
    ]);
    const jobs=history.generations.filter(asset=>['image','video','music'].includes(asset.kind));
    const advanced=await Promise.all(jobs.map(async asset=>{
     if(!isActive(asset))return asset;
     try{return {...asset,...await readApi<GenerationResponse>(await fetch(`/api/generations/${encodeURIComponent(asset.id)}`,{cache:'no-store',signal:abort.signal}))};}catch{return asset;}
    }));
    if(!mounted)return;
    setAssets(advanced);setLibrary(metadata);setLoadError('');setLoading(false);
    if(jobs.some(isActive)&&advanced.some(asset=>!isActive(asset)))void refresh();
    if(advanced.some(isActive))timer=setTimeout(()=>void load(),5000);
   }catch(cause){
    if(mounted&&!abort.signal.aborted){setLoadError(cause instanceof Error?cause.message:'Could not load your assets.');setLoading(false);timer=setTimeout(()=>void load(),10000);}
   }
  };
  void load();
  return()=>{mounted=false;clearTimeout(timer);abort.abort();};
 },[owner,revision,refresh]);

 const mutate=useCallback(async(action:AssetLibraryAction)=>{
  if(!owner||mutation.current)return false;
  mutation.current=true;setBusy(true);setError('');
  try{
   await readApi(await fetch('/api/asset-library',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action)}));
   if(!alive.current)return false;
   reload();
   return true;
  }catch(cause){if(alive.current)setError(cause instanceof Error?cause.message:'Could not update your assets.');return false;}
  finally{mutation.current=false;if(alive.current)setBusy(false);}
 },[owner,reload]);

 const upload=useCallback(async(files:File[],collectionId:string|null)=>{
  if(!owner||mutation.current)return false;
  if(files.length>10){setError('Import up to 10 images at a time.');return false;}
  if(files.some(file=>!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)){setError('Choose JPEG, PNG or WebP images up to 10 MB.');return false;}
  mutation.current=true;setBusy(true);setError('');
  let succeeded=true;
  try{
   for(const file of files){
    if(!alive.current)break;
    const form=new FormData();form.append('file',file);
    const result=await readApi<{key:string}>(await fetch('/api/uploads',{method:'POST',body:form}));
    if(!alive.current)return false;
    if(collectionId)await readApi(await fetch('/api/asset-library',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'move',assetIds:[`upload:${result.key}`],collectionId})}));
   }
  }catch(cause){succeeded=false;if(alive.current)setError(cause instanceof Error?cause.message:'Could not import this image.');}
  finally{mutation.current=false;if(alive.current){setBusy(false);reload();}}
  return succeeded;
 },[owner,reload]);
 const retry=useCallback(()=>{setError('');reload();},[reload]);
 return {assets,library,loading,busy,error:actionError||loadError,reload:retry,mutate,upload};
}
