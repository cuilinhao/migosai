"use client";

import { useCallback, useEffect, useState } from 'react';
import { Download, Image as ImageIcon, LoaderCircle, Music, RefreshCw, Video } from 'lucide-react';
import Link from '@/components/i18n/localized-link';
import { useAuth } from '@/components/auth-provider';
import { useLocale } from '@/components/i18n/locale-provider';
import { readApi, useGenerationTranslations } from '@/components/generator/use-generation';
import type { GenerationResponse } from '@/lib/contracts';
import styles from './assets.module.css';

export type Asset = GenerationResponse & { kind:'image'|'video'|'music';cost:number;createdAt:string;template?:'ozil-goal'|'flyingcar' };
type Filter = Asset['kind']|'all';
const filters: {kind:Filter;label:string}[] = [{kind:'all',label:'All assets'},{kind:'image',label:'Images'},{kind:'video',label:'Videos'},{kind:'music',label:'Music'}];
export function filterAssets(assets: readonly Asset[],kind:Filter): readonly Asset[] { return kind === 'all' ? assets : assets.filter(asset=>asset.kind === kind); }
const isActive = (asset: Asset) => !['completed','failed','cancelled'].includes(asset.status);
const destinations = {image:'/ai-image-generator',video:'/hotel-lobby-ai-video-generator',music:'/ai-rap-song-generator'};

export function AssetCard({asset}:{asset:Asset}) {
  const t = useGenerationTranslations();
  const locale = useLocale();
  const date = new Date(asset.createdAt);
  const created = Number.isNaN(date.getTime()) ? asset.createdAt : new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(date);
  const Icon = asset.kind === 'image' ? ImageIcon : asset.kind === 'video' ? Video : Music;
  const urls = asset.kind === 'image' ? asset.imageUrls ?? [] : asset.kind === 'music' ? asset.audioUrls ?? [] : asset.videoUrl ? [asset.videoUrl] : [];
  const progress = Math.max(0,Math.min(100,Math.round(asset.progress) || 0));
  const href = asset.template === 'ozil-goal' ? '/ozil-goal-generator' : asset.template === 'flyingcar' ? '/flying-car-ai-video-generator' : destinations[asset.kind];
  return <article className={styles.card}>
    <div className={`${styles.media} ${asset.kind === 'music' ? styles.music : ''}`}>
      {urls.length && asset.kind === 'image' ? <a href={urls[0]} target="_blank" rel="noopener noreferrer"><img src={urls[0]} alt={t('Generated image')} loading="lazy"/></a> : urls.length && asset.kind === 'video' ? <video src={urls[0]} controls preload="metadata"/> : <div className={styles.placeholder}><Icon size={34}/>{isActive(asset) && <span>{t(asset.status)}</span>}</div>}
      <span className={styles.badge}><Icon size={11}/>{t(asset.kind === 'image' ? 'Image' : asset.kind === 'video' ? 'Video' : 'Music')}</span>
    </div>
    <div className={styles.details}><h2>{t(asset.kind === 'image' ? 'Generated image' : asset.kind === 'video' ? 'Generated video' : 'Generated music')}</h2><p>{created} · {t('{credits} credits',{credits:asset.cost.toLocaleString(locale)})}</p>
      {asset.kind === 'music' && urls.map((url,index)=><audio key={url} src={url} controls preload="none" aria-label={t('Generated audio {number}',{number:index+1})}/>)}
      {isActive(asset) && <><div className={styles.progress} role="progressbar" aria-label={t('Generation progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{width:`${progress}%`}}/></div><small>{t(asset.statusMessage ?? 'Your task is processing.')} {progress}%</small><Link className={styles.resume} href={href}>{t('View generation')}</Link></>}
      {asset.error && <small className={styles.error} role="alert">{t(asset.error)}</small>}
      {['failed','cancelled'].includes(asset.status) && <small>{t(asset.status)}</small>}
      {urls.length > 0 && <div className={styles.downloads}>{urls.map((url,index)=><a key={url} href={url} download><Download size={13}/>{t(asset.kind === 'image' ? 'Download image' : asset.kind === 'video' ? 'Download video' : 'Download audio')}{urls.length>1 ? ` ${index+1}` : ''}</a>)}</div>}
    </div>
  </article>;
}

export function Assets() {
  const {user} = useAuth();
  return <AssetLibrary key={user?.id ?? 'anonymous'} owner={user?.id ?? null}/>;
}

function AssetLibrary({owner}:{owner:string|null}) {
  const t = useGenerationTranslations();
  const {loading:authLoading,openSignIn,refresh} = useAuth();
  const [assets,setAssets] = useState<Asset[]>([]);
  const [filter,setFilter] = useState<Filter>('all');
  const [loading,setLoading] = useState(!!owner);
  const [error,setError] = useState('');
  const [revision,setRevision] = useState(0);
  const reload = useCallback(()=>setRevision(previous=>previous+1),[]);
  useEffect(()=>{
    if(!owner) return;
    let mounted = true;
    let timer: ReturnType<typeof setTimeout>;
    const abort = new AbortController();
    setLoading(true);
    const load = async () => {
      try {
        const result = await readApi<{generations:Asset[]}>(await fetch('/api/generations',{cache:'no-store',credentials:'same-origin',signal:abort.signal}));
        const jobs = result.generations.filter(asset=>['image','video','music'].includes(asset.kind));
        // The detail endpoint advances queued tasks. History alone is read-only.
        const advanced = await Promise.all(jobs.map(async asset=>{
          if (!isActive(asset)) return asset;
          try { return {...asset,...await readApi<GenerationResponse>(await fetch(`/api/generations/${encodeURIComponent(asset.id)}`,{cache:'no-store',signal:abort.signal}))}; }
          catch { return asset; }
        }));
        if(!mounted) return;
        setAssets(advanced);setError('');setLoading(false);
        if(jobs.some(isActive)&&advanced.some(asset=>!isActive(asset))) void refresh();
        if(advanced.some(isActive))timer=setTimeout(()=>void load(),5000);
      } catch(cause) {
        if(mounted&&!abort.signal.aborted){setError(cause instanceof Error?cause.message:'Could not load your assets.');setLoading(false);timer=setTimeout(()=>void load(),10000);}
      }
    };
    void load();
    return ()=>{mounted=false;clearTimeout(timer);abort.abort();};
  },[owner,revision,refresh]);
  const visible=filterAssets(assets,filter);
  return <div className={`account-page ${styles.page}`}>
    <header className={styles.heading}><div><h1><ImageIcon size={19}/>{t('My assets')}</h1><p>{t('All your private images, videos, and music in one place.')}</p></div>{owner&&<button type="button" onClick={reload} disabled={loading} aria-label={t('Refresh assets')}><RefreshCw size={15}/>{t('Refresh')}</button>}</header>
    <nav className={styles.filters} aria-label={t('Asset categories')}>{filters.map(({kind,label})=><button type="button" key={kind} aria-pressed={filter===kind} onClick={()=>setFilter(kind)}>{t(label)}{owner&&<span>{filterAssets(assets,kind).length}</span>}</button>)}</nav>
    {(authLoading||loading)&&<div className={styles.message} role="status"><LoaderCircle size={22}/>{t('Loading your assets…')}</div>}
    {!authLoading&&!owner&&<div className={styles.empty}><span><ImageIcon size={32}/></span><h2>{t('Your creations live here')}</h2><p>{t('Sign in to view your private assets.')}</p><button type="button" onClick={openSignIn}>{t('Sign In')}</button></div>}
    {owner&&error&&<p className={styles.error} role="alert">{t(error)} <button onClick={reload}>{t('Try again')}</button></p>}
    {owner&&!loading&&!error&&!visible.length&&<div className={styles.empty}><span>{filter==='music'?<Music size={32}/>:filter==='video'?<Video size={32}/>:<ImageIcon size={32}/>}</span><h2>{t('No assets here yet')}</h2><p>{t('Create something new. Your finished files will appear here.')}</p><Link href={filter==='video'?destinations.video:filter==='music'?destinations.music:destinations.image}>{t(filter==='video'?'Create Video':filter==='music'?'Create music':'Create image')}</Link></div>}
    {owner&&!loading&&visible.length>0&&<div className={styles.grid}>{visible.map(asset=><AssetCard key={asset.id} asset={asset}/>)}</div>}
  </div>;
}
