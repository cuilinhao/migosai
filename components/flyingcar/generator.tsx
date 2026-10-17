"use client";

import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useRef, useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import Link from '@/components/i18n/localized-link';
import { useAuth } from '@/components/auth-provider';
import { getResumableVideo, type VideoHistoryItem } from '@/components/generator/generation-history';
import { prepareFlyingCarPhoto } from './photo-submission';
import { uploadPhoto, type PhotoUploadProgress } from '@/components/generator/photo-upload';
import { readApi, useGeneration, useGenerationTranslations } from '@/components/generator/use-generation';
import { FLYING_CAR_CONFIG, getFlyingCarCost } from '@/lib/flyingcar';
import type { GenerationResponse } from '@/lib/contracts';
import {
  captureFlyingCarSubmission, checkFlyingCarDuration, checkFlyingCarPrompt, executeFlyingCarSubmission,
  FLYING_CAR_PROMPT_MAX, type UploadedFlyingCarPhoto,
} from './submission';
import './generator.css';

type Photo = { file: File; url: string; id: string };
const terminal = new Set(['completed', 'failed', 'cancelled']);
const supportedPhotos = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function FlyingCarGenerator() {
  const t = useGenerationTranslations();
  const { user, credits, loading: authLoading, openSignIn, refresh } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState<number>(FLYING_CAR_CONFIG.defaultDuration);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [consent, setConsent] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const [uploadProgress, setUploadProgress] = useState<PhotoUploadProgress | null>(null);
  const { generation: tracked, setGeneration, pollError } = useGeneration(null);
  const [generationOwner, setGenerationOwner] = useState<string | null>(null);
  const owner = user?.id;
  const ownerRef = useRef(owner); ownerRef.current = owner;
  const previousOwner = useRef(owner);
  const controllerRef = useRef<AbortController | null>(null);
  const idempotency = useRef<{ fingerprint: string; key: string } | null>(null);
  const uploaded = useRef<UploadedFlyingCarPhoto | null>(null);
  const submittedJob = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const generation = generationOwner === owner ? tracked : null;
  const activeJob = Boolean(generation && !terminal.has(generation.status));
  const locked = busy || activeJob;
  const durationError = checkFlyingCarDuration(duration);
  const cost = durationError ? null : getFlyingCarCost(duration);
  const promptReady = !checkFlyingCarPrompt(prompt);
  const ready = promptReady && !durationError && (!photo || consent);

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);
  useEffect(() => () => { controllerRef.current?.abort(); controllerRef.current = null; }, []);
  useEffect(() => {
    let current = true;
    controllerRef.current?.abort(); controllerRef.current = null;
    idempotency.current = null; uploaded.current = null; submittedJob.current = null;
    setBusy(false); setStage(''); setUploadProgress(null); setError('');
    setGeneration(null); setGenerationOwner(owner ?? null);
    // An anonymous draft survives sign-in; an account's private inputs never pass to another account.
    if (previousOwner.current && previousOwner.current !== owner) {
      setPhoto(null); setConsent(false); setPrompt(''); setDuration(FLYING_CAR_CONFIG.defaultDuration); setReviewOpen(false);
    }
    previousOwner.current = owner;
    if (owner && !authLoading) void (async () => {
      try {
        const history = await readApi<{ generations: VideoHistoryItem[] }>(await fetch('/api/generations', { cache: 'no-store' }));
        if (current && !controllerRef.current && !submittedJob.current) setGeneration(getResumableVideo(history.generations, 'flyingcar'));
      } catch { /* A history lookup failure must not prevent a new generation. */ }
    })();
    return () => { current = false; };
  }, [owner, authLoading, setGeneration]);
  useEffect(() => {
    if (generation && terminal.has(generation.status)) void refresh();
  }, [generation?.status, refresh]);

  const changePhoto = (file?: File) => {
    if (controllerRef.current || activeJob || !file) return;
    if (!supportedPhotos.has(file.type)) { setError('Choose a JPG, PNG or WebP photo.'); return; }
    if (!file.size || file.size > 10 * 1024 * 1024) { setError('Choose a photo under 10 MB.'); return; }
    setPhoto({ file, url: URL.createObjectURL(file), id: crypto.randomUUID() });
    setConsent(false); uploaded.current = null; idempotency.current = null; setError('');
  };
  const removePhoto = () => {
    if (controllerRef.current || activeJob) return;
    setPhoto(null); setConsent(false); uploaded.current = null; idempotency.current = null; setError('');
  };
  const checkDraft = () => {
    const promptError = checkFlyingCarPrompt(prompt);
    if (promptError) { setError(promptError); promptRef.current?.focus(); return false; }
    if (durationError) { setError(durationError); return false; }
    if (photo && !consent) { setError('Tick the permission box to use your photo as a reference.'); return false; }
    setError(''); return true;
  };
  const review = () => {
    if (locked || controllerRef.current) return;
    if (checkDraft()) setReviewOpen(true);
  };
  const submit = async () => {
    if (controllerRef.current || activeJob || authLoading || !checkDraft() || cost === null) return;
    if (!user) { setReviewOpen(false); openSignIn(); return; }
    const fingerprint = JSON.stringify([user.id, prompt.trim(), duration, photo?.id ?? null]);
    // A response can be lost after billing. Let the idempotent endpoint resolve the same request even if the balance changed.
    if (credits < cost && idempotency.current?.fingerprint !== fingerprint) {
      setError(`You need ${cost} credits to create this video.`); return;
    }
    if (idempotency.current?.fingerprint !== fingerprint) idempotency.current = { fingerprint, key: crypto.randomUUID() };
    const submission = captureFlyingCarSubmission({ key: idempotency.current.key, prompt, duration,
      ...(photo ? { photo: { file: photo.file, fingerprint: `${user.id}:${photo.id}` }, consent } : {}) });
    const controller = new AbortController();
    const submittingOwner = user.id;
    controllerRef.current = controller;
    const ensureCurrent = () => {
      if (controller.signal.aborted || ownerRef.current !== submittingOwner || controllerRef.current !== controller) throw new Error('Generation request was cancelled.');
    };
    setBusy(true); setError(''); setStage(photo ? 'Preparing photo…' : 'Starting your video…'); setUploadProgress(null); setGeneration(null);
    try {
      const result = await executeFlyingCarSubmission(submission, uploaded.current, async file => {
        const prepared = await prepareFlyingCarPhoto(file, ensureCurrent);
        ensureCurrent(); setStage('Uploading photo…');
        return uploadPhoto(prepared, value => { if (!controller.signal.aborted) setUploadProgress(value); }, controller.signal);
      }, async (body, key) => {
        ensureCurrent(); setStage('Starting your video…'); setUploadProgress(null);
        return readApi<GenerationResponse>(await fetch('/api/flyingcar/generations', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
          body: JSON.stringify(body), signal: controller.signal,
        }));
      }, value => { uploaded.current = value; }, ensureCurrent);
      ensureCurrent(); submittedJob.current = result.id;
      setGenerationOwner(submittingOwner); setGeneration(result); setReviewOpen(false);
      idempotency.current = null; void refresh();
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
  const statusText = busy ? stage : generation?.error ?? generation?.statusMessage ?? (generation?.status === 'queued' ? 'Waiting to start…' : generation?.status === 'reviewing' ? 'Reviewing your scene…' : 'Generating your video…');

  return <>
    <div className="creator-grid">
      <aside className="creator-notes">
        <div className="three-picks">
          <article><b>01</b><p><strong>Describe the scene</strong><span>Write it in your own words. The more specific the better: place, time of day, camera move, mood.</span></p></article>
          <article><b>02</b><p><strong>Add one photo — optional</strong><span>A car, a person, a location. It guides the model; it is never required.</span></p></article>
          <article><b>03</b><p><strong>Review the credits and create</strong><span>Sign in with your LobbyDuo account. Failed renders return the credits automatically.</span></p></article>
        </div>
        <div className="what-you-get"><p className="fc-eyebrow">WHAT YOU GET</p><ul>
          <li>A 9:16 vertical MP4, {FLYING_CAR_CONFIG.minDuration}–{FLYING_CAR_CONFIG.maxSupportedDuration} seconds, 480p, silent, no watermark</li>
          <li>Text-only or one optional reference photo</li>
          <li>Progress, results and downloads in your <Link href="/app/my-videos">My Videos</Link></li>
          <li>A new prompt for every video you create</li>
          <li>Failed generation? The credits come back automatically</li>
          <li>One shared balance across LobbyDuo generators</li>
        </ul></div>
      </aside>
      <div className="creator-stage" aria-busy={locked}>
        <div className="stage-bar"><span><i /> REC · 0:{String(duration).padStart(2, '0')}</span><span>9:16 · SILENT · MP4</span></div>
        <div className="step-block prompt-step">
          <h3><span>1</span> DESCRIBE YOUR SCENE</h3>
          <label className="prompt-field" htmlFor="flyingcar-prompt-input"><span className="prompt-label">YOUR SCENE</span>
            <textarea id="flyingcar-prompt-input" ref={promptRef} value={prompt} maxLength={FLYING_CAR_PROMPT_MAX} disabled={locked}
              onChange={event => { setPrompt(event.target.value); setError(''); }}
              placeholder="Describe the scene you want — place, time of day, camera move, mood." aria-describedby="flyingcar-prompt-help" />
          </label>
          <div className="prompt-meta" id="flyingcar-prompt-help"><span>Describe the car, the place, the action and the camera. Include the vehicle model if you want a specific look.</span><b className={prompt.length > FLYING_CAR_PROMPT_MAX ? 'over' : promptReady ? 'good' : ''}>{prompt.length}/{FLYING_CAR_PROMPT_MAX}</b></div>
        </div>
        <div className="step-block">
          <h3><span>2</span> ADD AN OPTIONAL PHOTO</h3>
          <div className="photo-row">
            <div className={`upload-box optional-upload ${photo ? 'has-preview' : ''} ${dragging ? 'is-over' : ''}`}
              onDragOver={event => { event.preventDefault(); if (!locked) setDragging(true); }} onDragLeave={() => setDragging(false)}
              onDrop={event => { event.preventDefault(); setDragging(false); changePhoto(event.dataTransfer.files[0]); }}>
              <label className="upload-hit">
                {photo ? <img src={photo.url} alt="Your reference photo preview" /> : <><b>+</b><span>ADD A PHOTO</span><small>Optional · JPEG, PNG or WebP · max 10 MB</small></>}
                <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Optional reference photo" disabled={locked}
                  onChange={event => { changePhoto(event.target.files?.[0]); event.target.value = ''; }} />
              </label>
              {uploadProgress && <em className="upload-progress">{progress}%</em>}
              {photo && !locked && <span className="upload-actions"><button type="button" onClick={() => inputRef.current?.click()}>Change</button><button type="button" onClick={removePhoto}>Remove</button></span>}
            </div>
            <div className="photo-guidance"><p><strong>Use it for:</strong> a specific car, a person, or your own street.</p><ul>
              <li>One image only — the model treats it as visual guidance.</li><li>Clear, well-lit photos hold details best.</li><li>No photo? The scene is built from your text alone.</li>
            </ul></div>
          </div>
          {photo && <label className="consent"><span className="req-star" aria-hidden="true">*</span><input type="checkbox" checked={consent} disabled={locked} onChange={event => { setConsent(event.target.checked); setError(''); }} /><span>It&apos;s my photo, or I have permission from anyone in it. No minors. No impersonation.</span></label>}
        </div>
        <div className="step-block duration-step"><h3><span>3</span> CHOOSE LENGTH</h3>
          <label className="duration-field" htmlFor="flyingcar-duration-input"><span className="duration-value">{duration} <small>seconds</small></span>
            <input id="flyingcar-duration-input" type="range" min={FLYING_CAR_CONFIG.minDuration} max={FLYING_CAR_CONFIG.maxDuration} step={1} value={duration} disabled={locked} onChange={event => { setDuration(Number(event.target.value)); setError(''); }} aria-describedby="flyingcar-duration-help" />
            <span className="duration-scale" aria-hidden="true"><span>{FLYING_CAR_CONFIG.minDuration}s</span><span>{FLYING_CAR_CONFIG.maxDuration}s</span></span>
          </label>
          <p className="duration-help" id="flyingcar-duration-help">Longer clips take longer to render and use more credits. {cost !== null ? <>Your {duration}-second video costs <strong>{cost} credits</strong>.</> : durationError}</p>
          {durationError && <p className="form-hint-error" role="alert">{durationError}</p>}
        </div>
        <div className="stage-summary"><div><span>INPUT</span><strong>{photo ? 'Prompt + photo' : 'Prompt only'}</strong></div><div><span>OUTPUT</span><strong>{duration}s · 9:16 · MP4</strong></div><div><span>DELIVERY</span><strong>My Videos</strong></div></div>
      </div>
    </div>
    <button type="button" className="amber-button generate-button" onClick={review} disabled={locked || Boolean(durationError)}>
      {(busy || activeJob) && <LoaderCircle size={20} className="fc-spinner" />}
      {busy ? t(stage) : activeJob ? `MAKING YOUR VIDEO · ${progress}%` : ready ? 'REVIEW MY VIDEO' : 'CHECK MY PROMPT'}<span>▸</span>
    </button>
    {error && !reviewOpen && <p className="form-hint-error" role="alert">{t(error)} {user && cost !== null && credits < cost && <Link href="/pricing">Buy credits</Link>}</p>}
    <p className="under-button">{user ? `${credits.toLocaleString()} credits available` : 'Check your prompt without an account · sign in to generate'} · {cost !== null ? `${cost} credits for ${duration}s` : 'Length unavailable'} · <Link href="/pricing">View credit packs</Link></p>
    <div className="trust-line"><span>✓ ONE SHARED CREDIT BALANCE</span><span>✓ NEW PROMPT PER VIDEO</span><span>✓ FAILED RENDER = CREDITS BACK</span><span>✓ SAVE & DOWNLOAD IN MY VIDEOS</span></div>
    {(busy || activeJob) && <div className="fc-generation-progress" role="status" aria-live="polite"><p>{t(statusText)}{(activeJob || uploadProgress) && <span>{progress}%</span>}</p>
      {(activeJob || uploadProgress) && <div role="progressbar" aria-label={busy ? 'Photo upload progress' : 'Video generation progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>}
      {activeJob && <small>You can leave this page. Find your video in <Link href="/app/my-videos">My Videos</Link>.</small>}
    </div>}
    {generation && pollError && <p className="form-hint-error" role="alert">{t(pollError)} Status will retry automatically.</p>}
    {generation?.status === 'completed' && generation.videoUrl && <div className="fc-generation-result"><p role="status">Your flying car video is ready.</p><video src={generation.videoUrl} controls playsInline preload="metadata" aria-label="Your generated flying car video" /><a href={generation.videoUrl} download><Download size={16} />Download video</a><Link href="/app/my-videos">Open My Videos</Link></div>}
    {generation && ['failed', 'cancelled'].includes(generation.status) && <p className="form-hint-error" role="alert">{t(generation.error ?? generation.statusMessage ?? 'Generation could not be completed.')} <Link href="/app/my-videos">View generation record</Link></p>}
    <div ref={setPortalContainer} className="fc-dialog-anchor" />
    <Dialog.Root open={reviewOpen} onOpenChange={open => { if (!busy) setReviewOpen(open); }}>
      <Dialog.Portal container={portalContainer}><Dialog.Overlay className="dialog-backdrop fc-review-backdrop"><Dialog.Content className="dialog fc-review-dialog" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
        <Dialog.Close className="dialog-close" disabled={busy} aria-label="Close review">×</Dialog.Close>
        <p className="fc-eyebrow">SHARED ACCOUNT CREDITS</p><Dialog.Title asChild><h2>REVIEW YOUR VIDEO</h2></Dialog.Title>
        <Dialog.Description>Your prompt is ready. Review the length and credit cost before generating.</Dialog.Description>
        <blockquote className="dialog-prompt">“{prompt.trim()}”</blockquote>
        <p className="dialog-length"><b>{duration}s</b> · 9:16 · 480p · silent MP4 · no watermark</p>
        <div className="fc-review-summary"><div><span>INPUT</span><strong>{photo ? 'Prompt + photo' : 'Prompt only'}</strong></div><div><span>VIDEO COST</span><strong>{cost} credits</strong></div><div><span>YOUR BALANCE</span><strong>{user ? `${credits.toLocaleString()} credits` : 'Sign in to view'}</strong></div></div>
        <button type="button" className="amber-button dialog-pay" disabled={busy || authLoading || Boolean(durationError)} onClick={() => void submit()}>
          {busy ? t(stage) : authLoading ? 'CHECKING ACCOUNT…' : user ? `GENERATE VIDEO · ${cost} CREDITS` : 'SIGN IN TO GENERATE'}
        </button>
        {error && <p className="dialog-error" role="alert">{t(error)}</p>}
        <p className="dialog-note"><Link href="/pricing">View credit packs</Link> · Failed generations return the credits · Progress and downloads in <Link href="/app/my-videos">My Videos</Link></p>
      </Dialog.Content></Dialog.Overlay></Dialog.Portal>
    </Dialog.Root>
  </>;
}
