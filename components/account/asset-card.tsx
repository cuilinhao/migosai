"use client";

import { Download, Image as ImageIcon, Music, Video } from "lucide-react";
import Link from "@/components/i18n/localized-link";
import { useLocale } from "@/components/i18n/locale-provider";
import { useGenerationTranslations } from "@/components/generator/use-generation";
import { isActive, destinations, type Asset } from "./asset-utils";
import styles from "./assets.module.css";

export function AssetCard({asset}:{asset:Asset}) {
  const t = useGenerationTranslations();
  const locale = useLocale();
  const date = new Date(asset.createdAt);
  const created = Number.isNaN(date.getTime()) ? asset.createdAt : new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(date);
  const Icon = asset.kind === 'image' ? ImageIcon : asset.kind === 'video' ? Video : Music;
  const urls = asset.kind === 'image' ? asset.imageUrls ?? [] : asset.kind === 'music' ? asset.audioUrls ?? [] : asset.videoUrl ? [asset.videoUrl] : [];
  const progress = Math.max(0,Math.min(100,Math.round(asset.progress) || 0));
  const href = asset.template === 'window-peeper' ? '/window-peeper-ai-video-generator' : asset.template === 'ozil-goal' ? '/ozil-goal-generator' : asset.template === 'flyingcar' ? '/flying-car-ai-video-generator' : asset.kind === 'video' ? '/hotel-lobby-ai-video-generator' : destinations[asset.kind];
  return <article className={styles.card}>
    <div className={`${styles.media} ${asset.kind === 'music' ? styles.music : ''}`}>
      {urls.length && asset.kind === 'image' ? <a href={urls[0]} target="_blank" rel="noopener noreferrer"><img src={urls[0]} alt={t('Generated image')} loading="lazy"/></a> : urls.length && asset.kind === 'video' ? <video src={urls[0]} controls preload="metadata"/> : <div className={styles.placeholder}><Icon size={34}/>{isActive(asset) && <span>{t(asset.status)}</span>}</div>}
      <span className={styles.badge}><Icon size={11}/>{t(asset.kind === 'image' ? 'Image' : asset.kind === 'video' ? 'Video' : 'Music')}</span>
    </div>
    <div className={styles.details}><h2>{asset.template === 'window-peeper' ? 'Window Peeper' : t(asset.kind === 'image' ? 'Generated image' : asset.kind === 'video' ? 'Generated video' : 'Generated music')}</h2><p>{created} · {t('{credits} credits',{credits:asset.cost.toLocaleString(locale)})}</p>
      {asset.kind === 'music' && urls.map((url,index)=><audio key={url} src={url} controls preload="none" aria-label={t('Generated audio {number}',{number:index+1})}/>)}
      {isActive(asset) && <><div className={styles.progress} role="progressbar" aria-label={t('Generation progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{width:`${progress}%`}}/></div><small>{t(asset.statusMessage ?? 'Your task is processing.')} {progress}%</small><Link className={styles.resume} href={href}>{t('View generation')}</Link></>}
      {asset.error && <small className={styles.error} role="alert">{t(asset.error)}</small>}
      {['failed','cancelled'].includes(asset.status) && <small>{t(asset.status)}</small>}
      {urls.length > 0 && <div className={styles.downloads}>{urls.map((url,index)=><a key={url} href={url} download><Download size={13}/>{t(asset.kind === 'image' ? 'Download image' : asset.kind === 'video' ? 'Download video' : 'Download audio')}{urls.length>1 ? ` ${index+1}` : ''}</a>)}</div>}
    </div>
  </article>;
}
