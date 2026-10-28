"use client";

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, Check, Download, LoaderCircle, X } from 'lucide-react';
import Link from '@/components/i18n/localized-link';
import { useAuth } from '@/components/auth-provider';
import { prepareFlyingCarPhoto } from '@/components/flyingcar/photo-submission';
import { getResumableVideo, type VideoHistoryItem } from '@/components/generator/generation-history';
import { uploadPhoto, type PhotoUploadProgress } from '@/components/generator/photo-upload';
import { readApi, useGeneration } from '@/components/generator/use-generation';
import type { GenerationResponse } from '@/lib/contracts';
import { GANGNAM_STYLE_CONFIG, GANGNAM_STYLE_RESOLUTIONS, getGangnamStyleCost,
  type GangnamStyleMode, type GangnamStyleResolution } from '@/lib/gangnam-style';
import { captureGangnamStyleSubmission, executeGangnamStyleSubmission, type UploadedGangnamStylePhoto } from './submission';
import { useGangnamTranslations } from './use-translations';
import { useLocale } from '@/components/i18n/locale-provider';
import { localeTags } from '@/lib/i18n/routing';
import './generator.css';

type Photo = { id: string; file: File; url: string; owner: string | null };
type Stage = '' | 'preparing' | 'uploading' | 'starting';
const terminal = new Set(['completed', 'failed', 'cancelled']);
const supported = new Set(['image/jpeg', 'image/png', 'image/webp']);
const modes = [
  { value: 'friends', label: 'Gangnam Style trio', sample: 'photo-trio-seoul-with-audio.mp4', poster: 'photo-trio-seoul.jpg' },
  { value: 'selfie', label: 'Three of you', sample: 'seedance-studio.mp4', poster: 'seedance-studio.jpg' },
  { value: 'pets', label: 'Pet trio', sample: 'seedance-square.mp4', poster: 'seedance-square.jpg' },
] as const;
const roles = [{ name: 'Middle', solo: 'First solo' }, { name: 'Right', solo: 'Second solo' }, { name: 'Left', solo: 'Third solo' }];

export function GangnamStyleGenerator() {
  const { user, credits, loading: authLoading, openSignIn, refresh } = useAuth();
  const t = useGangnamTranslations();
  const locale = useLocale();
  const owner = user?.id ?? null;
  const [mode, setMode] = useState<GangnamStyleMode>('friends');
  const [selections, setSelections] = useState<(Photo | null)[]>([null, null, null]);
  const [resolution, setResolution] = useState<GangnamStyleResolution>('720p');
  const [consent, setConsent] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage>('');
  const [uploadIndex, setUploadIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<PhotoUploadProgress | null>(null);
  const [error, setError] = useState('');
  const [generationOwner, setGenerationOwner] = useState(owner);
  const { generation: tracked, setGeneration, pollError } = useGeneration(null);
  const ownerRef = useRef(owner); ownerRef.current = owner;
  const previousOwner = useRef(owner);
  const controllerRef = useRef<AbortController | null>(null);
  const idempotency = useRef<{ fingerprint: string; key: string } | null>(null);
  const uploaded = useRef<UploadedGangnamStylePhoto[]>([]);
  const submittedJob = useRef<string | null>(null);
  const objectUrls = useRef(new Set<string>());
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const consentRef = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const modeRef = useRef(mode); modeRef.current = mode;
  const id = useId();
  const generation = generationOwner === owner ? tracked : null;
  const activeJob = Boolean(generation && !terminal.has(generation.status));
  const locked = busy || activeJob;
  const lockedRef = useRef(locked); lockedRef.current = locked;
  const photos = selections.map(photo => photo && (photo.owner === null || photo.owner === owner) ? photo : null);
  const photoCount = mode === 'selfie' ? 1 : 3;
  const cost = getGangnamStyleCost(resolution);
  const selectedMode = modes.find(item => item.value === mode)!;

  const clearPhotos = useCallback(() => {
    for (const url of objectUrls.current) URL.revokeObjectURL(url);
    objectUrls.current.clear();
    setSelections([null, null, null]); setConsent(false);
    uploaded.current = []; idempotency.current = null;
  }, []);

  useEffect(() => () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    for (const url of objectUrls.current) URL.revokeObjectURL(url);
    objectUrls.current.clear();
  }, []);
  useEffect(() => {
    let active = true;
    controllerRef.current?.abort(); controllerRef.current = null;
    idempotency.current = null; uploaded.current = []; submittedJob.current = null;
    setBusy(false); setStage(''); setUploadProgress(null); setError('');
    setGeneration(null); setGenerationOwner(owner);
    if (previousOwner.current && previousOwner.current !== owner) clearPhotos();
    else if (owner) setSelections(current => current.map(photo => photo && !photo.owner ? { ...photo, owner } : photo));
    previousOwner.current = owner;
    if (owner && !authLoading) void (async () => {
      try {
        const result = await readApi<{ generations: VideoHistoryItem[] }>(await fetch('/api/generations', { cache: 'no-store' }));
        if (active && ownerRef.current === owner && !controllerRef.current && !submittedJob.current) {
          setGeneration(getResumableVideo(result.generations, 'gangnam-style'));
        }
      } catch { /* History is optional; an unavailable history must not prevent a new submission. */ }
    })();
    return () => { active = false; };
  }, [owner, authLoading, clearPhotos, setGeneration]);
  useEffect(() => {
    if (generation && terminal.has(generation.status)) void refresh();
  }, [generation?.status, refresh]);

  const changeMode = useCallback((next: GangnamStyleMode) => {
    if (controllerRef.current || lockedRef.current || modeRef.current === next) return;
    clearPhotos(); setMode(next); modeRef.current = next; setError(''); setDragging(null);
  }, [clearPhotos]);
  useEffect(() => {
    const showMode = (value: string | undefined) => {
      if (!modes.some(item => item.value === value)) return;
      changeMode(value as GangnamStyleMode);
      document.getElementById('studio')?.scrollIntoView({ block: 'start' });
    };
    const fromHash = () => showMode(window.location.hash.match(/^#studio-(friends|selfie|pets)$/)?.[1]);
    const fromEvent = (event: Event) => showMode((event as CustomEvent<string>).detail);
    fromHash();
    window.addEventListener('hashchange', fromHash);
    window.addEventListener('gangnam-style:mode', fromEvent);
    return () => {
      window.removeEventListener('hashchange', fromHash);
      window.removeEventListener('gangnam-style:mode', fromEvent);
    };
  }, [changeMode]);

  const changePhoto = (index: number, file?: File) => {
    if (!file || controllerRef.current || lockedRef.current) return;
    if (!supported.has(file.type)) { setError('Choose a JPEG, PNG or WebP photo.'); return; }
    if (!file.size || file.size > 10 * 1024 * 1024) { setError('Choose a photo up to 10 MB. Empty files cannot be uploaded.'); return; }
    const previous = selections[index];
    if (previous) { URL.revokeObjectURL(previous.url); objectUrls.current.delete(previous.url); }
    const url = URL.createObjectURL(file); objectUrls.current.add(url);
    setSelections(current => current.map((photo, slot) => slot === index ? { id: crypto.randomUUID(), file, url, owner } : photo));
    if (previous) uploaded.current = uploaded.current.filter(photo => photo.fingerprint !== `${owner}:${previous.id}`);
    idempotency.current = null; setConsent(false); setError('');
  };
  const removePhoto = (index: number) => {
    if (controllerRef.current || lockedRef.current) return;
    const photo = selections[index];
    if (photo) {
      URL.revokeObjectURL(photo.url); objectUrls.current.delete(photo.url);
      uploaded.current = uploaded.current.filter(value => value.fingerprint !== `${owner}:${photo.id}`);
    }
    setSelections(current => current.map((photo, slot) => slot === index ? null : photo));
    idempotency.current = null; setConsent(false); setError(''); inputRefs.current[index]?.focus();
  };

  const submit = async () => {
    if (controllerRef.current || activeJob || authLoading) return;
    if (!user) { openSignIn(); return; }
    const selected = photos.slice(0, photoCount);
    const missingIndex = selected.findIndex(photo => !photo);
    if (missingIndex !== -1) {
      setError(mode === 'selfie' ? 'Add one clear photo of yourself.' : 'Add all three photos: Middle, Right and Left.');
      inputRefs.current[missingIndex]?.focus(); return;
    }
    if (!consent) { setError('Please confirm photo consent before generating.'); consentRef.current?.focus(); return; }
    const chosen = selected as Photo[];
    const fingerprint = JSON.stringify([user.id, mode, chosen.map(photo => photo.id), '16:9', resolution]);
    // A lost response may already have reserved credits; an identical retry must reach the endpoint.
    if (credits < cost && idempotency.current?.fingerprint !== fingerprint) {
      setError(`You need ${cost} credits to create this video.`); return;
    }
    if (idempotency.current?.fingerprint !== fingerprint) idempotency.current = { fingerprint, key: crypto.randomUUID() };
    const submission = captureGangnamStyleSubmission({ key: idempotency.current.key, mode, aspect: '16:9', resolution, consent,
      photos: chosen.map(photo => ({ file: photo.file, fingerprint: `${user.id}:${photo.id}` })) });
    const controller = new AbortController();
    const submittingOwner = user.id;
    controllerRef.current = controller;
    const ensureCurrent = () => {
      if (controller.signal.aborted || ownerRef.current !== submittingOwner || controllerRef.current !== controller) {
        throw new Error('Photo upload was cancelled.');
      }
    };
    setBusy(true); setError(''); setStage('preparing'); setUploadIndex(0); setUploadProgress(null); setGeneration(null);
    try {
      const result = await executeGangnamStyleSubmission(submission, uploaded.current, async (file, index) => {
        ensureCurrent(); setStage('preparing'); setUploadIndex(index); setUploadProgress(null);
        const prepared = await prepareFlyingCarPhoto(file, ensureCurrent);
        ensureCurrent(); setStage('uploading');
        return uploadPhoto(prepared, value => {
          if (!controller.signal.aborted && ownerRef.current === submittingOwner) setUploadProgress(value);
        }, controller.signal);
      }, async (body, key) => {
        ensureCurrent(); setStage('starting'); setUploadProgress(null);
        return readApi<GenerationResponse>(await fetch('/api/gangnam-style/generations', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
          body: JSON.stringify(body), signal: controller.signal,
        }));
      }, value => { uploaded.current = [...uploaded.current.filter(photo => photo.fingerprint !== value.fingerprint), value]; }, ensureCurrent);
      ensureCurrent(); submittedJob.current = result.id;
      setGenerationOwner(submittingOwner); setGeneration(result); idempotency.current = null; void refresh();
    } catch (failure) {
      if (!controller.signal.aborted && ownerRef.current === submittingOwner) {
        setError(failure instanceof Error ? failure.message : 'Could not start your video. Please try again.');
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null; setBusy(false); setStage(''); setUploadProgress(null);
      }
      controller.abort();
    }
  };

  const uploadFraction = uploadProgress ? uploadProgress.phase === 'complete' ? 1 : Math.min(.99, uploadProgress.loaded / Math.max(1, uploadProgress.total)) : 0;
  const progress = uploadProgress ? Math.floor((uploadIndex + uploadFraction) / photoCount * 100) : Math.min(99, Math.max(0, Math.round(generation?.progress ?? 0)));
  const status = busy ? stage === 'preparing' ? t('Preparing photo {current} of {total}…', { current: uploadIndex + 1, total: photoCount })
    : stage === 'uploading' ? t('Uploading photo {current} of {total}…', { current: uploadIndex + 1, total: photoCount }) : 'Starting your video…'
    : generation?.error ?? generation?.statusMessage ?? (generation?.status === 'queued' ? 'Your video is queued.' : generation?.status === 'reviewing' ? 'Checking your photos…' : 'Creating your video…');
  const resultUrl = generation?.status === 'completed' ? generation.videoUrl : undefined;

  return <div className="gns-form">
    <div className="gns-tabs" role="tablist" aria-label={t("Choose a trio")}>
      {modes.map((item, index) => <button key={item.value} type="button" role="tab" id={`${id}-${item.value}`}
        ref={node => { tabRefs.current[index] = node; }} aria-controls={`${id}-panel`} aria-selected={mode === item.value}
        tabIndex={mode === item.value ? 0 : -1} className={mode === item.value ? 'gns-active' : ''} disabled={locked}
        onClick={() => changeMode(item.value)} onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % modes.length;
          changeMode(modes[next].value); tabRefs.current[next]?.focus();
        }}>{t(item.label)}</button>)}
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${mode}`}>
      <div className="gns-studio-specs"><span>{t('{seconds}-second template', { seconds: GANGNAM_STYLE_CONFIG.duration })}</span><span>{t("16:9 · Landscape")}</span><span>{resolution}</span>{t("MP4")}<span>{t("Original soundtrack")}</span></div>
      <h3 className="gns-upload-heading">{t(mode === 'selfie' ? '1 · Add your photo' : '1 · Add your photos')}</h3>
      <div className={`gns-cast-uploads${mode === 'selfie' ? ' gns-single' : ''}`}>
        {roles.slice(0, photoCount).map((role, index) => <div className="gns-cast-slot" key={`${mode}-${index}`}>
          <div className="gns-cast-role"><strong>{t(mode === 'selfie' ? 'You' : role.name)}</strong><small>{t(mode === 'selfie' ? 'All three dancers' : role.solo)}</small></div>
          <label className={`gns-cast-upload${photos[index] ? ' gns-has-photo' : ''}${dragging === index ? ' gns-dragging' : ''}`}
            onDragOver={event => { event.preventDefault(); if (!locked) setDragging(index); }} onDragLeave={() => setDragging(null)}
            onDrop={event => { event.preventDefault(); setDragging(null); changePhoto(index, event.dataTransfer.files[0]); }}>
            {photos[index] ? <><img src={photos[index]!.url} alt={mode === 'selfie' ? t('Your reference photo') : t('{role} reference photo', { role: t(role.name) })} /><span className="gns-replace-photo">{t("Replace photo")}</span></>
              : <span className="gns-cast-placeholder"><span aria-hidden="true">＋</span>{t("Add a clear photo")}</span>}
            <input ref={node => { inputRefs.current[index] = node; }} type="file" accept="image/jpeg,image/png,image/webp"
              aria-label={mode === 'selfie' ? t('Upload your photo') : t('Upload {role} photo', { role: t(role.name) })} disabled={locked}
              onChange={event => { changePhoto(index, event.target.files?.[0]); event.target.value = ''; }} />
          </label>
          {photos[index] && <button className="gns-remove-photo" type="button" disabled={locked} aria-label={mode === 'selfie' ? t('Remove your photo') : t('Remove {role} photo', { role: t(role.name) })} onClick={() => removePhoto(index)}><X size={13} />{t("Remove")}</button>}
        </div>)}
      </div>
      <p className="gns-studio-photo-note">{t("One subject per photo, facing the camera. No sunglasses. JPEG, PNG or WebP · up to 10 MB each.")}</p>
      <fieldset className="gns-output-settings" disabled={locked}>
        <legend>{t("2 · Output settings")}</legend>
        <div className="gns-output-field"><label htmlFor={`${id}-ratio`}>{t("Aspect ratio")}</label>
          <input id={`${id}-ratio`} value={t("16:9 · Landscape")} readOnly className="gns-groove-select-trigger" />
        </div>
        <div className="gns-output-field"><label htmlFor={`${id}-resolution`}>{t("Resolution")}</label>
          <select id={`${id}-resolution`} value={resolution} disabled={locked} className="gns-groove-select-trigger" onChange={event => { setResolution(event.target.value as GangnamStyleResolution); idempotency.current = null; setError(''); }}>
            {GANGNAM_STYLE_RESOLUTIONS.map(value => <option key={value} value={value}>{value} · {t(value === '720p' ? 'HD' : 'Standard')}</option>)}
          </select>
        </div>
        <p>{t('15-second template. Fixed 16:9 landscape preserves the trio scene framing. Each generation uses {credits} MigosAI credits.', { credits: cost })}</p>
      </fieldset>
      <label className="gns-consent"><input ref={consentRef} type="checkbox" checked={consent} disabled={locked} onChange={event => setConsent(event.target.checked)} />{' '}{t(" I own these photos or have permission from everyone pictured, and agree to the ")}<Link href="/terms-of-service">{t("Terms")}</Link>{t(" and ")}<Link href="/privacy-policy">{t("Privacy Policy")}</Link>.
      </label>
      <button type="button" className="gns-primary gns-generate" disabled={locked || authLoading} onClick={() => void submit()}>
        {locked && <LoaderCircle size={16} className="gns-busy-icon" />}
        {authLoading ? t('Checking account…') : busy ? t(status) : activeJob ? t('Creating your video · {progress}%', { progress }) : !user ? t('Sign in to create ↗') : error && idempotency.current ? t('Retry generation ↗') : t('Create my video ↗')}
      </button>
      <p className="gns-generation-credit-note">{t('1 video = {credits} MigosAI credits · Failed generations return your credits.', { credits: cost })}</p>
      {user && <p className="gns-small gns-account-note">{t('{credits} credits available · ', { credits: credits.toLocaleString(localeTags[locale]) })}<Link href="/pricing">{t("Buy credits")}</Link></p>}
      <p className="gns-small">{t("Generation availability and credits are checked before submission. Paid retries are never automatic.")}</p>
      {(busy || activeJob) && <div className="gns-generation-progress" role="status" aria-live="polite">
        <p>{t(status)}{(uploadProgress || activeJob) && <span>{progress}%</span>}</p>
        {(uploadProgress || activeJob) && <div className="gns-progress-track" role="progressbar" aria-label={t(busy ? 'Photo upload progress' : 'Video generation progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>}
        {activeJob && <small>{t("You can leave this page. Your video will be saved in ")}<Link href="/app/my-videos">{t("My videos ↗")}</Link>.</small>}
      </div>}
      {error && <p className="gns-error" role="alert">{t(error)}{' '}{user && credits < cost && <Link href="/pricing">{t("Buy credits")}</Link>}</p>}
      {generation && pollError && <p className="gns-error" role="alert">{t(pollError)}{t(" Status checks will retry automatically. ")}<Link href="/app/my-videos">{t("My videos")}</Link></p>}
      {generation && ['failed', 'cancelled'].includes(generation.status) && <p className="gns-error" role="alert">{t(generation.error ?? generation.statusMessage ?? 'Your video could not be completed.')} <Link href="/app/my-videos">{t("View record")}</Link></p>}
      <div className="gns-studio-sample">
        <h3>{resultUrl ? t('Your video') : t('Preview · {mode}', { mode: t(selectedMode.label) })}</h3>
        <video key={resultUrl ?? selectedMode.sample} src={resultUrl ?? `/gangnam-style/${selectedMode.sample}`} poster={resultUrl ? undefined : `/gangnam-style/${selectedMode.poster}`} controls playsInline preload="metadata" aria-label={resultUrl ? t('Your generated Gangnam Style video') : t('{mode} sample video', { mode: t(selectedMode.label) })} />
        {resultUrl ? <>
          <div className="gns-result-actions"><p role="status"><Check size={15} />{t("Your video is ready")}</p><a href={resultUrl} download="migosai-gangnam-style.mp4"><Download size={16} />{t("Download MP4")}</a><Link href="/app/my-videos">{t("My videos")}<ArrowUpRight size={14} /></Link></div>
          <p className="gns-small">{t("Preview and download your finished MP4.")}</p>
        </> : <p className="gns-small">{t("AI-generated sample. Your completed video will appear here.")}</p>}
      </div>
    </div>
  </div>;
}
