'use client';

import { useState } from 'react';
import { ArrowUpRight, Play } from 'lucide-react';
import type { TrendVideoCopy, TrendVideoReference } from '@/content/trend-video';
import styles from './trend-video.module.css';

export function ReferencePlayer({ reference, title, copy }: { reference: TrendVideoReference; title: string; copy: TrendVideoCopy }) {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  return <div className={styles.reference}>
    <div className={styles.referenceMedia}>
      {playing && !failed ? <video src={reference.video} poster={reference.poster} controls autoPlay playsInline preload="metadata" aria-label={`${copy.playPreview}: ${title}`} onError={() => setFailed(true)} /> : <img src={reference.poster} alt={title} loading="lazy" />}
      {!playing && <button type="button" className={styles.playButton} aria-label={`${copy.playPreview}: ${title}`} onClick={() => setPlaying(true)}><Play size={25} fill="currentColor" /></button>}
      {failed && <a className={styles.videoFallback} href={reference.source} target="_blank" rel="noreferrer">{copy.exampleError}<ArrowUpRight size={15} /></a>}
      {!playing && <span className={styles.referenceBadge}>{reference.author} · {copy.previewTitle}</span>}
    </div>
    <div className={styles.referenceLinks}><a href={reference.source} target="_blank" rel="noreferrer">{reference.author} · {copy.sourceLink}<ArrowUpRight size={12} /></a><a href={reference.video} target="_blank" rel="noreferrer">{copy.directVideo}<ArrowUpRight size={12} /></a></div>
  </div>;
}
