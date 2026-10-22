"use client";

import { ArrowUpRight, Download, ImagePlus, LockKeyhole, Sparkles } from 'lucide-react';
import Link from '@/components/i18n/localized-link';
import { useLocale } from '@/components/i18n/locale-provider';
import { useGenerationTranslations } from '@/components/generator/use-generation';
import type { GenerationResponse, ImageOutputFormat } from '@/lib/contracts';
import styles from './image-generator.module.css';

export const IMAGE_SUPPORT_REVIEW_MESSAGE = 'This request needs support review. It will not be retried automatically.';
export const imageTaskNeedsReview = (generation: GenerationResponse | null) => generation?.statusMessage === IMAGE_SUPPORT_REVIEW_MESSAGE;

export function ImageResult({generation,busy,recovering,stage,outputFormat,pollError}:{generation:GenerationResponse|null;busy:boolean;recovering:boolean;stage:string;outputFormat:ImageOutputFormat;pollError:string}) {
  const t=useGenerationTranslations();
  const locale=useLocale();
  const active=!!generation&&!['completed','failed','cancelled'].includes(generation.status);
  const needsReview=imageTaskNeedsReview(generation);
  const progress=generation?.status==='completed'?100:Math.min(99,Math.max(0,Math.round(generation?.progress??0)));
  const status=busy?stage:recovering?'Restoring your image task…':generation?.statusMessage??(generation?.status==='queued'?'Waiting to start…':generation?.status==='failed'?'Image generation failed.':generation?.status==='cancelled'?'Image generation cancelled.':'Generating your image…');
  return <section className={styles.result} aria-label={t('Image result')}>
    <div className={styles.resultHeading}><h2>{t('Your creation')}</h2><Link href="/app/assets">{t('My assets')} <ArrowUpRight size={14}/></Link></div>
    {generation?.status==='completed'&&!!generation.imageUrls?.length?<div className={styles.outputs}>{generation.imageUrls.map((url,index)=><figure key={url}><a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={t('Generated image {number}',{number:index+1})}/></a><a className={styles.download} href={url} download={`migosai-${generation.id}-${index+1}.${outputFormat}`}><Download size={15}/>{t('Download image')}</a></figure>)}</div>:<div className={styles.resultBody}>
      {busy||active||recovering?<><div className={needsReview?styles.reviewIcon:styles.orb}>{needsReview?<LockKeyhole size={32}/>:<Sparkles size={32}/>}</div><h3 aria-live="polite">{t(status)}</h3>{active&&!needsReview&&<><div className={styles.progress} role="progressbar" aria-label={t('Image generation progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{width:`${progress}%`}}/></div><small>{progress.toLocaleString(locale)}%</small></>}{!needsReview&&<p>{t('You can leave this page. Your task will resume when you return.')}</p>}</>:generation&&['failed','cancelled'].includes(generation.status)?<><ImagePlus size={36}/><h3>{t(status)}</h3><p role="alert">{t(generation.error??'Check your credits and try another prompt.')}</p></>:<><div className={styles.emptyArtwork}><span>✦</span><ImagePlus size={46}/><i>✧</i></div><h3>{t('A little imagination. A whole new image.')}</h3><p>{t('Describe your idea and watch it take shape here.')}</p><div className={styles.tags}><span>{t('Photorealistic')}</span><span>{t('Illustration')}</span><span>{t('Product design')}</span></div></>}
      {active&&(generation?.error||needsReview)&&<div className={styles.taskNotice}><p role="alert">{t(generation.error??IMAGE_SUPPORT_REVIEW_MESSAGE)}</p><small>{t('Request ID: {id}',{id:generation.id})}</small><Link href="/contact">{t('Contact support')}<ArrowUpRight size={14}/></Link></div>}
    </div>}
    {pollError&&<p className={styles.error} role="alert">{t(pollError)} {t('Your task is saved. Status checks will retry automatically.')}</p>}
    {generation?.status==='completed'&&!generation.imageUrls?.length&&<p className={styles.note}>{t('Your image is being saved. Check My assets for the download.')}</p>}
    <div className={styles.resultFooter}><LockKeyhole size={13}/><span>{t('Only you can access your generated files.')}</span><Link href="/app/assets">{t('View all assets')}</Link></div>
  </section>;
}
