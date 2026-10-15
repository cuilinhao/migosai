"use client";

import { useEffect, useRef, useState } from 'react';
import { Download, LoaderCircle, Plus, X } from 'lucide-react';
import Link from '@/components/i18n/localized-link';
import { useAuth } from '@/components/auth-provider';
import { getResumableVideo } from '@/components/generator/generation-history';
import { captureOzilSubmission, executeOzilSubmission, type UploadedOzilPhoto } from '@/components/generator/ozil-submission';
import { preparePhoto } from '@/components/generator/prepare-photo';
import { uploadPhoto, type PhotoUploadProgress } from '@/components/generator/photo-upload';
import { readApi, useGeneration, useGenerationTranslations } from '@/components/generator/use-generation';
import type { GenerationResponse } from '@/lib/contracts';
import { OZIL_GOAL_COST } from '@/lib/ozil-goal';
import './generator.css';

type Photo = { file: File; url: string; id: string };
const terminal = new Set(['completed', 'failed', 'cancelled']);
const supported = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function OzilGoalGenerator() {
  const t = useGenerationTranslations();
  const { user, credits, loading: authLoading, openSignIn, refresh } = useAuth();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [consent, setConsent] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState<PhotoUploadProgress | null>(null);
  const { generation: tracked, setGeneration, pollError } = useGeneration(null);
  const [generationOwner, setGenerationOwner] = useState<string | null>(null);
  const owner = user?.id;
  const ownerRef = useRef(owner); ownerRef.current = owner;
  const previousOwner = useRef(owner);
  const controllerRef = useRef<AbortController | null>(null);
  const idempotency = useRef<{ fingerprint: string; key: string } | null>(null);
  const uploaded = useRef<UploadedOzilPhoto | null>(null);
  const submittedJob = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const generation = generationOwner === owner ? tracked : null;
  const activeJob = Boolean(generation && !terminal.has(generation.status));
  const locked = busy || activeJob;

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);
  useEffect(() => () => { controllerRef.current?.abort(); controllerRef.current = null; }, []);
  useEffect(() => {
    let active = true;
    controllerRef.current?.abort(); controllerRef.current = null;
    idempotency.current = null; uploaded.current = null; submittedJob.current = null;
    setBusy(false); setStage(''); setUploadProgress(null); setError('');
    setGeneration(null); setGenerationOwner(owner ?? null);
    // Keep an anonymous selection through sign-in; clear private selections on account changes.
    if (previousOwner.current && previousOwner.current !== owner) { setPhoto(null); setConsent(false); }
    previousOwner.current = owner;
    if (owner && !authLoading) void (async () => {
      try {
        const result = await readApi<{ generations: (GenerationResponse & { kind: string; template?: 'ozil-goal' })[] }>(
          await fetch('/api/generations', { cache: 'no-store' }));
        if (active && !controllerRef.current && !submittedJob.current) setGeneration(getResumableVideo(result.generations, 'ozil-goal'));
      } catch { /* History is optional; a lookup failure must not block a new photo. */ }
    })();
    return () => { active = false; };
  }, [owner, authLoading, setGeneration]);
  useEffect(() => {
    if (generation && terminal.has(generation.status)) void refresh();
  }, [generation?.status, refresh]);

  const changePhoto = (file?: File) => {
    if (controllerRef.current || activeJob || !file) return;
    if (!supported.has(file.type)) { setError('Choose a JPG, PNG or WebP photo.'); return; }
    if (!file.size || file.size > 10 * 1024 * 1024) { setError('Choose a photo under 10 MB.'); return; }
    setPhoto({ file, url: URL.createObjectURL(file), id: crypto.randomUUID() });
    uploaded.current = null; idempotency.current = null;
    setError('');
  };
  const removePhoto = () => {
    if (controllerRef.current || activeJob) return;
    setPhoto(null); uploaded.current = null; idempotency.current = null; setError('');
  };
  const submit = async () => {
    if (controllerRef.current || activeJob || authLoading) return;
    if (!user) { openSignIn(); return; }
    if (!photo) { setError('Add one clear photo first.'); inputRef.current?.focus(); return; }
    if (!consent) { setError('Please confirm photo consent before generating.'); return; }
    const fingerprint = `${user.id}:${photo.id}`;
    // A lost response may already have reserved credits. Retrying must still reach the idempotent endpoint.
    if (credits < OZIL_GOAL_COST && idempotency.current?.fingerprint !== fingerprint) {
      setError(`You need ${OZIL_GOAL_COST} credits to create this video.`); return;
    }
    if (idempotency.current?.fingerprint !== fingerprint) idempotency.current = { fingerprint, key: crypto.randomUUID() };
    const requestKey = idempotency.current.key;
    const submission = captureOzilSubmission(requestKey, fingerprint, photo.file, consent);
    const controller = new AbortController();
    const submittingOwner = user.id;
    controllerRef.current = controller;
    const ensureCurrent = () => {
      if (controller.signal.aborted || ownerRef.current !== submittingOwner || controllerRef.current !== controller) throw new Error('Photo upload was cancelled.');
    };
    setBusy(true); setError(''); setStage('Preparing photo…'); setUploadProgress(null); setGeneration(null);
    try {
      const result = await executeOzilSubmission(submission, uploaded.current, async file => {
        const prepared = await preparePhoto(file);
        ensureCurrent(); setStage('Uploading photo…');
        return uploadPhoto(prepared, value => {
          if (!controller.signal.aborted) setUploadProgress(value);
        }, controller.signal);
      }, async (body, key) => {
        ensureCurrent(); setStage('Starting your video…'); setUploadProgress(null);
        return readApi<GenerationResponse>(await fetch('/api/ozil-goal/generations', {
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
      if (!controller.signal.aborted && ownerRef.current === submittingOwner) setError(failure instanceof Error ? failure.message : 'Could not create the video.');
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
  const statusText = busy ? stage : generation?.error ?? generation?.statusMessage ?? (generation?.status === 'queued' ? 'Waiting to start…' : generation?.status === 'reviewing' ? 'Reviewing your photo…' : 'Generating your video…');

  return <div className="og-generator">
    <fieldset disabled={locked}>
      <legend><span className="og-generator-step og-mono">1</span>Your photo</legend>
      <div className={`og-generator-upload ${photo ? 'has-photo' : ''} ${dragging ? 'is-over' : ''}`}
        onDragOver={event => { event.preventDefault(); if (!locked) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => { event.preventDefault(); setDragging(false); changePhoto(event.dataTransfer.files[0]); }}>
        <label className="og-generator-photo-label">
          {photo ? <img src={photo.url} alt="Your selected player photo" /> : <span className="og-generator-plus"><Plus size={24} /></span>}
          <span><strong>{photo ? photo.file.name : 'Add one clear photo'}</strong><small>{photo ? 'Tap to choose another photo.' : 'One adult, face visible, head to toe if you can. Tap, or drop it here.'}</small></span>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Player photo" onChange={event => { changePhoto(event.target.files?.[0]); event.target.value = ''; }} />
        </label>
        {photo && <button className="og-generator-remove" type="button" onClick={removePhoto} aria-label="Remove photo"><X size={16} /></button>}
      </div>
      <p className="og-generator-hint">JPG, PNG or WebP · Up to 10 MB. <Link href="/privacy-policy">How we handle photos</Link></p>
    </fieldset>
    <div className="og-generator-actions">
      <div className="og-generator-format"><span>15s · 9:16 · with sound</span><span>{OZIL_GOAL_COST} credits</span></div>
      <label className="og-generator-consent"><input type="checkbox" checked={consent} disabled={locked} onChange={event => setConsent(event.target.checked)} /><span>I only use photos of myself or people who agreed to appear, and I accept the <Link href="/terms-of-service">Terms</Link>. The video is AI-generated, not real footage.</span></label>
      <button className="og-cta og-display og-generator-submit" type="button" onClick={() => void submit()} disabled={locked || authLoading}>
        {(busy || activeJob) && <LoaderCircle size={20} className="og-generator-spinner" />}
        {busy ? t(stage) : activeJob ? `Making your video · ${progress}%` : authLoading ? 'Checking account…' : 'Make my video'}
      </button>
      <div className="og-generator-footnote">
        <p>{user ? <>{credits.toLocaleString()} credits available · <Link href="/pricing">Buy credits</Link></> : <>{OZIL_GOAL_COST} credits per video · <Link href="/pricing">View credit packs</Link></>}</p>
        <p>{user ? <>Saved to your <Link href="/app/my-videos">My Videos</Link> · Failed generations are refunded</> : 'Sign in with Google or email first; your photo stays in place'}</p>
      </div>
    </div>
    {(busy || activeJob) && <div className="og-generator-progress" role="status" aria-live="polite">
      <p>{t(statusText)}{(activeJob || uploadProgress) && <span>{progress}%</span>}</p>
      {(activeJob || uploadProgress) && <div role="progressbar" aria-label={busy ? 'Photo upload progress' : 'Video generation progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>}
      {activeJob && <small>You can leave this page. Find your video in <Link href="/app/my-videos">My Videos</Link>.</small>}
    </div>}
    {error && <p className="og-generator-error" role="alert">{t(error)} {user && credits < OZIL_GOAL_COST && <Link href="/pricing">Buy credits</Link>}</p>}
    {generation && pollError && <p className="og-generator-error" role="alert">{t(pollError)} Status will retry automatically.</p>}
    {generation?.status === 'completed' && generation.videoUrl && <div className="og-generator-result">
      <p role="status">Your Ozil goal video is ready.</p>
      <video src={generation.videoUrl} controls playsInline preload="metadata" aria-label="Your generated Ozil goal video" />
      <a href={generation.videoUrl} download><Download size={16} />Download video</a>
    </div>}
    {generation && ['failed', 'cancelled'].includes(generation.status) && <p className="og-generator-error" role="alert">{t(generation.error ?? generation.statusMessage ?? 'Generation could not be completed.')} <Link href="/app/my-videos">View generation record</Link></p>}
  </div>;
}
