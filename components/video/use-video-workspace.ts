"use client";

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { prepareFlyingCarPhoto } from '@/components/flyingcar/photo-submission';
import {
  captureFlyingCarSubmission, checkFlyingCarDuration, checkFlyingCarPrompt,
  executeFlyingCarSubmission, type UploadedFlyingCarPhoto,
} from '@/components/flyingcar/submission';
import { getResumableVideo, type VideoHistoryItem } from '@/components/generator/generation-history';
import { uploadPhoto, type PhotoUploadProgress } from '@/components/generator/photo-upload';
import { readApi } from '@/components/generator/use-generation';
import type { GenerationResponse } from '@/lib/contracts';
import { FLYING_CAR_CONFIG, getFlyingCarCost } from '@/lib/flyingcar';

export type VideoWorkspacePhoto = { file: File; url: string; id: string };
export type VideoWorkspaceOptions = { initialPrompt?: string; resumeHistory?: boolean };
type Owner = string | null;
type Draft = { owner: Owner; prompt: string; duration: number; photo: VideoWorkspacePhoto | null; consent: boolean };
type WorkspaceState = {
  owner: Owner; busy: boolean; stage: string; error: string; pollError: string;
  generation: GenerationResponse | null; uploadProgress: PhotoUploadProgress | null;
};
const terminal = new Set(['completed', 'failed', 'cancelled']);
const supportedPhotos = new Set(['image/jpeg', 'image/png', 'image/webp']);
const emptyDraft = (owner: Owner, prompt = ''): Draft => ({ owner, prompt, duration: FLYING_CAR_CONFIG.defaultDuration, photo: null, consent: false });
const emptyWorkspace = (owner: Owner): WorkspaceState => ({ owner, busy: false, stage: '', error: '', pollError: '', generation: null, uploadProgress: null });

/** The existing Seedance 2.5 workflow, independent of the FlyingCar presentation. */
export function useVideoWorkspace({ initialPrompt = '', resumeHistory = true }: VideoWorkspaceOptions = {}) {
  const { user, credits, loading: authLoading, openSignIn, refresh } = useAuth();
  const owner = user?.id ?? null;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const [savedDraft, setDraft] = useState<Draft>(() => emptyDraft(owner, initialPrompt));
  const [savedState, setState] = useState<WorkspaceState>(() => emptyWorkspace(owner));
  // Hide private inputs and results immediately, before the account-change effect runs.
  const draft = savedDraft.owner && savedDraft.owner !== owner ? emptyDraft(owner, initialPrompt) : savedDraft;
  const state = savedState.owner === owner ? savedState : emptyWorkspace(owner);
  const { prompt, duration, photo, consent } = draft;
  const { busy, stage, error, generation, pollError, uploadProgress } = state;
  const controllerRef = useRef<AbortController | null>(null);
  const idempotency = useRef<{ fingerprint: string; key: string } | null>(null);
  const uploaded = useRef<UploadedFlyingCarPhoto | null>(null);
  const submittedJob = useRef<string | null>(null);
  // This ref also closes the interval between an accepted response and React's next render.
  const currentJob = useRef<{ owner: Owner; generation: GenerationResponse } | null>(null);
  const activeJob = Boolean(generation && !terminal.has(generation.status));
  const locked = busy || activeJob;
  const cost = checkFlyingCarDuration(duration) ? null : getFlyingCarCost(duration);

  const updateState = (forOwner: Owner, patch: Partial<WorkspaceState>) => {
    if (ownerRef.current !== forOwner) return;
    setState(current => current.owner === forOwner ? { ...current, ...patch } : current);
  };
  const publishGeneration = (forOwner: Owner, next: GenerationResponse | null) => {
    if (ownerRef.current !== forOwner) return;
    currentJob.current = next ? { owner: forOwner, generation: next } : null;
    updateState(forOwner, { generation: next, pollError: '' });
  };
  const isLocked = () => Boolean(controllerRef.current || (
    currentJob.current?.owner === ownerRef.current && currentJob.current && !terminal.has(currentJob.current.generation.status)
  ));
  const editDraft = (patch: Partial<Draft>) => {
    if (isLocked() || ownerRef.current !== owner) return;
    setDraft(current => ({ ...(current.owner && current.owner !== owner ? emptyDraft(owner, initialPrompt) : current), owner, ...patch }));
    updateState(owner, { error: '' });
  };

  useEffect(() => () => { if (savedDraft.photo) URL.revokeObjectURL(savedDraft.photo.url); }, [savedDraft.photo]);
  useEffect(() => () => { controllerRef.current?.abort(); controllerRef.current = null; }, []);
  useEffect(() => {
    controllerRef.current?.abort(); controllerRef.current = null;
    idempotency.current = null; uploaded.current = null; submittedJob.current = null; currentJob.current = null;
    setState(emptyWorkspace(owner));
    // Anonymous work survives sign-in; an account's private draft never transfers to another owner.
    setDraft(current => current.owner && current.owner !== owner ? emptyDraft(owner, initialPrompt) : { ...current, owner });
  }, [owner]);
  useEffect(() => {
    if (!resumeHistory || !owner || authLoading) return;
    let current = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const history = await readApi<{ generations: VideoHistoryItem[] }>(await fetch('/api/generations', { cache: 'no-store', signal: controller.signal }));
        if (current && ownerRef.current === owner && !controllerRef.current && !submittedJob.current) {
          publishGeneration(owner, getResumableVideo(history.generations, 'flyingcar'));
        }
      } catch { /* A history lookup failure must not prevent a new generation. */ }
    })();
    return () => { current = false; controller.abort(); };
  }, [owner, authLoading, resumeHistory]);
  useEffect(() => {
    if (!generation || terminal.has(generation.status)) return;
    const generationId = generation.id;
    const controller = new AbortController();
    let current = true;
    let timer: ReturnType<typeof setTimeout>;
    const isCurrent = () => current && ownerRef.current === owner && currentJob.current?.owner === owner && currentJob.current.generation.id === generationId;
    const poll = async () => {
      try {
        const result = await readApi<GenerationResponse>(await fetch(`/api/generations/${encodeURIComponent(generationId)}`, { cache: 'no-store', signal: controller.signal }));
        if (isCurrent()) publishGeneration(owner, result);
      } catch (failure) {
        if (isCurrent()) updateState(owner, { pollError: failure instanceof Error ? failure.message : 'Could not refresh generation status.' });
      } finally {
        if (isCurrent() && currentJob.current && !terminal.has(currentJob.current.generation.status)) timer = setTimeout(poll, 2500);
      }
    };
    timer = setTimeout(poll, 2500);
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [generation?.id, generation?.status, owner]);
  useEffect(() => {
    if (generation && terminal.has(generation.status)) void refresh();
  }, [generation?.id, generation?.status, refresh]);

  const setPrompt = (value: string) => editDraft({ prompt: value });
  const setDuration = (value: number) => editDraft({ duration: value });
  const setConsent = (value: boolean) => editDraft({ consent: value });
  const setError = (value: string) => updateState(owner, { error: value });
  const changePhoto = (file?: File) => {
    if (isLocked() || ownerRef.current !== owner || !file) return;
    if (!supportedPhotos.has(file.type)) { setError('Choose a JPG, PNG or WebP photo.'); return; }
    if (!file.size || file.size > 10 * 1024 * 1024) { setError('Choose a photo under 10 MB.'); return; }
    editDraft({ photo: { file, url: URL.createObjectURL(file), id: crypto.randomUUID() }, consent: false });
    uploaded.current = null; idempotency.current = null;
  };
  const removePhoto = () => {
    if (isLocked() || ownerRef.current !== owner) return;
    editDraft({ photo: null, consent: false });
    uploaded.current = null; idempotency.current = null;
  };
  const submit = async () => {
    if (isLocked() || authLoading || ownerRef.current !== owner) return;
    if (!user) { openSignIn(); return; }
    const validationError = checkFlyingCarPrompt(prompt) ?? checkFlyingCarDuration(duration)
      ?? (photo && !consent ? 'Tick the permission box to use your photo as a reference.' : null);
    if (validationError || cost === null) { setError(validationError ?? 'Choose a valid video length.'); return; }
    const fingerprint = JSON.stringify([user.id, prompt.trim(), duration, photo?.id ?? null]);
    // The original request may have charged before its response was lost. Resolve that same key even if the balance is now lower.
    if (credits < cost && idempotency.current?.fingerprint !== fingerprint) {
      setError(`You need ${cost} credits to create this video.`); return;
    }
    if (idempotency.current?.fingerprint !== fingerprint) idempotency.current = { fingerprint, key: crypto.randomUUID() };
    const submission = captureFlyingCarSubmission({ key: idempotency.current.key, prompt, duration,
      ...(photo ? { photo: { file: photo.file, fingerprint: `${user.id}:${photo.id}` }, consent } : {}) });
    const controller = new AbortController();
    const submittingOwner = user.id;
    controllerRef.current = controller;
    const isCurrent = () => !controller.signal.aborted && ownerRef.current === submittingOwner && controllerRef.current === controller;
    const ensureCurrent = () => { if (!isCurrent()) throw new Error('Generation request was cancelled.'); };
    updateState(submittingOwner, { busy: true, error: '', stage: photo ? 'Preparing photo…' : 'Starting your video…', uploadProgress: null });
    publishGeneration(submittingOwner, null);
    try {
      const result = await executeFlyingCarSubmission(submission, uploaded.current, async file => {
        const prepared = await prepareFlyingCarPhoto(file, ensureCurrent);
        ensureCurrent(); updateState(submittingOwner, { stage: 'Uploading photo…' });
        return uploadPhoto(prepared, value => { if (isCurrent()) updateState(submittingOwner, { uploadProgress: value }); }, controller.signal);
      }, async (body, key) => {
        ensureCurrent(); updateState(submittingOwner, { stage: 'Starting your video…', uploadProgress: null });
        return readApi<GenerationResponse>(await fetch('/api/flyingcar/generations', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
          body: JSON.stringify(body), signal: controller.signal,
        }));
      }, value => { uploaded.current = value; }, ensureCurrent);
      ensureCurrent(); submittedJob.current = result.id;
      publishGeneration(submittingOwner, result);
      idempotency.current = null; void refresh();
    } catch (failure) {
      if (isCurrent()) updateState(submittingOwner, { error: failure instanceof Error ? failure.message : 'Could not create the video.' });
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        updateState(submittingOwner, { busy: false, stage: '', uploadProgress: null });
      }
      controller.abort();
    }
  };
  const progress = uploadProgress
    ? uploadProgress.phase === 'complete' ? 100 : Math.min(99, Math.floor(uploadProgress.loaded / Math.max(1, uploadProgress.total) * 100))
    : generation?.status === 'completed' ? 100 : Math.min(99, Math.max(0, Math.round(generation?.progress ?? 0)));

  return { prompt, setPrompt, duration, setDuration, photo, changePhoto, removePhoto, consent, setConsent,
    busy, locked, stage, error, setError, cost, credits, user, authLoading, generation, pollError, progress, submit };
}
