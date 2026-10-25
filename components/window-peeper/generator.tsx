"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, Check, Download, Gem, ImagePlus, LoaderCircle, Play, Sparkles, X } from 'lucide-react';
import Link from '@/components/i18n/localized-link';
import { useAuth } from '@/components/auth-provider';
import { useLocale } from '@/components/i18n/locale-provider';
import { getResumableVideo, type VideoHistoryItem } from '@/components/generator/generation-history';
import { captureWindowPeeperSubmission, executeWindowPeeperSubmission, type UploadedWindowPeeperPhoto } from '@/components/generator/window-peeper-submission';
import { preparePhoto } from '@/components/generator/prepare-photo';
import { uploadPhoto, type PhotoUploadProgress } from '@/components/generator/photo-upload';
import { readApi, useGeneration, useGenerationTranslations } from '@/components/generator/use-generation';
import { getWindowPeeperCopy, windowPeeperSources } from '@/content/window-peeper';
import type { GenerationResponse } from '@/lib/contracts';
import { WINDOW_PEEPER_CONFIG, WINDOW_PEEPER_COST } from '@/lib/window-peeper';
import styles from './window-peeper.module.css';

type Photo = { file: File; url: string; id: string; owner: string | null };
type Stage = '' | 'preparing' | 'uploading' | 'starting';
const terminal = new Set(['completed', 'failed', 'cancelled']);
const supported = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function WindowPeeperGenerator() {
  const copy = getWindowPeeperCopy(useLocale());
  const t = useGenerationTranslations();
  const { user, credits, loading: authLoading, openSignIn, refresh } = useAuth();
  const [selection, setSelection] = useState<Photo | null>(null);
  const [consent, setConsent] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage>('');
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState<PhotoUploadProgress | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const { generation: tracked, setGeneration, pollError } = useGeneration(null);
  const [generationOwner, setGenerationOwner] = useState<string | null>(null);
  const owner = user?.id ?? null;
  const ownerRef = useRef(owner); ownerRef.current = owner;
  const previousOwner = useRef(owner);
  const controllerRef = useRef<AbortController | null>(null);
  const idempotency = useRef<{ fingerprint: string; key: string } | null>(null);
  const uploaded = useRef<UploadedWindowPeeperPhoto | null>(null);
  const submittedJob = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const photo = selection && (selection.owner === null || selection.owner === owner) ? selection : null;
  const generation = generationOwner === owner ? tracked : null;
  const activeJob = Boolean(generation && !terminal.has(generation.status));
  const locked = busy || activeJob;

  useEffect(() => () => { if (selection) URL.revokeObjectURL(selection.url); }, [selection?.url]);
  useEffect(() => () => { controllerRef.current?.abort(); controllerRef.current = null; }, []);
  useEffect(() => {
    let active = true;
    controllerRef.current?.abort(); controllerRef.current = null;
    idempotency.current = null; uploaded.current = null; submittedJob.current = null;
    setBusy(false); setStage(''); setUploadProgress(null); setError('');
    setGeneration(null); setGenerationOwner(owner);
    if (previousOwner.current && previousOwner.current !== owner) {
      setSelection(null); setConsent(false);
    } else if (owner) {
      // Promote an anonymous selection to this account; later switches cannot reuse it.
      setSelection(current => current && !current.owner ? { ...current, owner } : current);
    }
    previousOwner.current = owner;
    if (owner && !authLoading) void (async () => {
      try {
        const result = await readApi<{ generations: VideoHistoryItem[] }>(await fetch('/api/generations', { cache: 'no-store' }));
        if (active && ownerRef.current === owner && !controllerRef.current && !submittedJob.current) {
          setGeneration(getResumableVideo(result.generations, 'window-peeper'));
        }
      } catch { /* An optional history lookup must not block a new submission. */ }
    })();
    return () => { active = false; };
  }, [owner, authLoading, setGeneration]);
  useEffect(() => {
    if (generation && terminal.has(generation.status)) void refresh();
  }, [generation?.status, refresh]);

  const changePhoto = (file?: File) => {
    if (controllerRef.current || activeJob || !file) return;
    if (!supported.has(file.type)) { setError(copy.invalidType); return; }
    if (!file.size || file.size > 10 * 1024 * 1024) { setError(copy.invalidSize); return; }
    setSelection({ file, url: URL.createObjectURL(file), id: crypto.randomUUID(), owner });
    uploaded.current = null; idempotency.current = null;
    setConsent(false); setError('');
  };
  const removePhoto = () => {
    if (controllerRef.current || activeJob) return;
    setSelection(null); setConsent(false); uploaded.current = null; idempotency.current = null; setError('');
    inputRef.current?.focus();
  };
  const submit = async () => {
    if (controllerRef.current || activeJob || authLoading) return;
    if (!user) { openSignIn(); return; }
    if (!photo) { setError(copy.missingPhoto); inputRef.current?.focus(); return; }
    if (!consent) { setError(copy.missingConsent); consentRef.current?.focus(); return; }
    const fingerprint = `${user.id}:${photo.id}`;
    // A lost response may already have reserved credits. Its retry must reach the idempotent endpoint.
    if (credits < WINDOW_PEEPER_COST && idempotency.current?.fingerprint !== fingerprint) {
      setError(copy.insufficientCredits.replace('{credits}', String(WINDOW_PEEPER_COST))); return;
    }
    if (idempotency.current?.fingerprint !== fingerprint) idempotency.current = { fingerprint, key: crypto.randomUUID() };
    const submission = captureWindowPeeperSubmission(idempotency.current.key, fingerprint, photo.file, consent);
    const controller = new AbortController();
    const submittingOwner = user.id;
    controllerRef.current = controller;
    const ensureCurrent = () => {
      if (controller.signal.aborted || ownerRef.current !== submittingOwner || controllerRef.current !== controller) {
        throw new Error('Photo upload was cancelled.');
      }
    };
    setBusy(true); setError(''); setStage('preparing'); setUploadProgress(null); setGeneration(null);
    try {
      const result = await executeWindowPeeperSubmission(submission, uploaded.current, async file => {
        const prepared = await preparePhoto(file);
        ensureCurrent(); setStage('uploading');
        return uploadPhoto(prepared, value => {
          if (!controller.signal.aborted && ownerRef.current === submittingOwner) setUploadProgress(value);
        }, controller.signal);
      }, async (body, key) => {
        ensureCurrent(); setStage('starting'); setUploadProgress(null);
        return readApi<GenerationResponse>(await fetch('/api/window-peeper/generations', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
          body: JSON.stringify(body), signal: controller.signal,
        }));
      }, value => { uploaded.current = value; }, ensureCurrent);
      ensureCurrent();
      submittedJob.current = result.id;
      setGenerationOwner(submittingOwner); setGeneration(result);
      idempotency.current = null;
      void refresh();
    } catch (failure) {
      if (!controller.signal.aborted && ownerRef.current === submittingOwner) {
        setError(failure instanceof Error ? failure.message : copy.createFailed);
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null; setBusy(false); setStage(''); setUploadProgress(null);
      }
      controller.abort();
    }
  };

  const progress = uploadProgress
    ? uploadProgress.phase === 'complete' ? 100 : Math.min(99, Math.floor(uploadProgress.loaded / Math.max(1, uploadProgress.total) * 100))
    : Math.min(99, Math.max(0, Math.round(generation?.progress ?? 0)));
  const statusText = busy && stage ? copy[stage] : generation?.error ?? generation?.statusMessage ?? (
    generation?.status === 'queued' ? copy.queued : generation?.status === 'reviewing' ? copy.reviewing : copy.generating);
  const resultUrl = generation?.status === 'completed' ? generation.videoUrl : undefined;

  return <section className={styles.generator} id="window-peeper-generator" aria-label={copy.generatorTitle}>
    <div className={styles.controls}>
      <fieldset className={styles.photoFieldset} disabled={locked}>
        <legend><span className={styles.stepNumber}>1</span>{copy.photoLabel}</legend>
        <div className={`${styles.upload} ${photo ? styles.hasPhoto : ''} ${dragging ? styles.dragging : ''}`}
          onDragOver={event => { event.preventDefault(); if (!locked) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={event => { event.preventDefault(); setDragging(false); changePhoto(event.dataTransfer.files[0]); }}>
          <label htmlFor={inputId}>
            {photo ? <img src={photo.url} alt={copy.selectedPhoto} /> : <span className={styles.uploadIcon}><ImagePlus size={27} /></span>}
            <strong>{photo ? photo.file.name : copy.uploadTitle}</strong>
            <span>{photo ? copy.replacePhoto : copy.uploadHint}</span>
            <small>{copy.uploadFormats}</small>
          </label>
          <input id={inputId} ref={inputRef} className={styles.fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label={copy.photoLabel}
            onChange={event => { changePhoto(event.target.files?.[0]); event.target.value = ''; }} />
          {photo && <button className={styles.removePhoto} type="button" onClick={removePhoto} aria-label={copy.removePhoto}><X size={16} /></button>}
        </div>
        <Link className={styles.privacy} href="/privacy-policy">{copy.privacyLink}<ArrowUpRight size={12} /></Link>
      </fieldset>
      <div className={styles.settings}>
        <h3><span className={styles.stepNumber}>2</span>{copy.settingsTitle}</h3>
        <dl className={styles.settingsGrid}>
          <div><dt>{copy.model}</dt><dd><Sparkles size={14} />MiniMax H3</dd></div>
          <div><dt>{copy.duration}</dt><dd>{WINDOW_PEEPER_CONFIG.duration}s</dd></div>
          <div><dt>{copy.resolution}</dt><dd>{WINDOW_PEEPER_CONFIG.resolution}</dd></div>
          <div><dt>{copy.format}</dt><dd>{WINDOW_PEEPER_CONFIG.aspect}</dd></div>
        </dl>
        <p className={styles.fixedSettings}>{copy.fixedSettings}</p>
      </div>
      <label className={styles.consent}><input ref={consentRef} type="checkbox" checked={consent} disabled={locked} onChange={event => setConsent(event.target.checked)} /><span>{copy.consent} <Link href="/terms-of-service">{copy.terms}</Link>. {copy.aiDisclosure}</span></label>
      <button className={`${styles.button} ${styles.generateButton}`} type="button" onClick={() => void submit()} disabled={locked || authLoading}>
        {locked ? <LoaderCircle size={18} className={styles.spinner} /> : <Sparkles size={18} />}
        <span>{busy && stage ? copy[stage] : activeJob ? `${copy.generating} · ${progress}%` : authLoading ? copy.checkingAccount : copy.generate}</span>
        {!locked && !authLoading && <small><Gem size={13} />{WINDOW_PEEPER_COST}</small>}
      </button>
      <div className={styles.accountNotes}>
        <p>{user ? <>{credits.toLocaleString()} {copy.credits} {copy.available} · <Link href="/pricing">{copy.buyCredits}</Link></> : copy.signInNote}</p>
        <p><Check size={12} />{copy.refundNote}</p>
      </div>
      {(busy || activeJob) && <div className={styles.progress} role="status" aria-live="polite">
        <p>{t(statusText)}{(activeJob || uploadProgress) && <span>{progress}%</span>}</p>
        {(activeJob || uploadProgress) && <div className={styles.progressTrack} role="progressbar" aria-label={busy ? copy.uploadProgress : copy.videoProgress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>}
        {activeJob && <small>{copy.leaveNote} <Link href="/app/my-videos">{copy.myVideos}<ArrowUpRight size={11} /></Link></small>}
      </div>}
      {error && <p className={styles.error} role="alert">{t(error)} {user && credits < WINDOW_PEEPER_COST && <Link href="/pricing">{copy.buyCredits}</Link>}</p>}
      {generation && pollError && <p className={styles.error} role="alert">{t(pollError)} {copy.pollRetry}</p>}
      {generation && ['failed', 'cancelled'].includes(generation.status) && <p className={styles.error} role="alert">{t(generation.error ?? generation.statusMessage ?? copy.generationFailed)} <Link href="/app/my-videos">{copy.viewRecord}</Link></p>}
      {resultUrl && <div className={styles.resultActions}><p role="status"><Check size={15} />{copy.resultReady}</p><a className={styles.download} href={resultUrl} download><Download size={16} />{copy.download}</a><Link href="/app/my-videos">{copy.myVideos}<ArrowUpRight size={13} /></Link></div>}
    </div>
    <div className={styles.previewPanel}>
      <div className={styles.previewHeading}><span><span className={styles.liveDot} />{resultUrl ? copy.resultReady : copy.previewTitle}</span><Sparkles size={15} /></div>
      <div className={styles.previewStage}>
        {!resultUrl && <><span className={styles.previewNote}>{copy.previewNote}</span><span className={styles.previewSticker}><Sparkles size={13} />{copy.previewSticker}</span></>}
        <div className={`${styles.phone} ${resultUrl ? styles.resultPhone : ''}`}>
          {resultUrl ? <video key={resultUrl} src={resultUrl} controls playsInline preload="metadata" aria-label={copy.resultLabel} /> : <>
            {previewPlaying && !previewError ? <video src={WINDOW_PEEPER_CONFIG.referencePath} poster="/window-peeper/original-poster.jpg" controls autoPlay playsInline preload="metadata" aria-label={copy.playPreview} onError={() => setPreviewError(true)} /> : <img src="/window-peeper/original-poster.jpg" alt={copy.previewTitle} />}
            {!previewPlaying && <button className={styles.playButton} type="button" aria-label={copy.playPreview} onClick={() => { setPreviewError(false); setPreviewPlaying(true); }}><Play size={26} fill="currentColor" /></button>}
            {previewError && <a className={styles.videoFallback} href={windowPeeperSources.original.url} target="_blank" rel="noreferrer">{copy.exampleError}<ArrowUpRight size={15} /></a>}
            {!previewPlaying && <span className={styles.phoneBadge}>{copy.previewBadge}</span>}
          </>}
        </div>
      </div>
      <div className={styles.previewCaption}>{resultUrl ? <><p>{copy.savedNote} <Link href="/app/my-videos">{copy.myVideos}</Link></p><p>{copy.aiDisclosure}</p></> : <><p>{copy.previewCaption} <a href={windowPeeperSources.original.url} target="_blank" rel="noreferrer">{copy.sourceLink}<ArrowUpRight size={11} /></a></p><p>{copy.previewDisclosure}</p></>}</div>
    </div>
  </section>;
}
