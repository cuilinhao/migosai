"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent, type RefObject } from "react";
import Link from "@/components/i18n/localized-link";
import { ImagePlus, Sparkles, CreditCard, UserRound, X } from "lucide-react";
import { useLocale } from "@/components/i18n/locale-provider";
import { useAuth } from "@/components/auth-provider";
import type { GenerationResponse, VideoSettings } from "@/lib/contracts";
import { defaultVideoSettings, getVideoCost, updateVideoSettings, videoScenes } from "@/lib/video-options";
import { readApi, useGeneration, useGenerationTranslations } from "./use-generation";
import { captureVideoSubmission, executeVideoSubmission, type UploadedPair } from "./video-submission";
import { uploadPhoto, type PhotoUploadProgress } from "./photo-upload";
import { preparePhoto } from "./prepare-photo";
import { VideoPreview } from "./video-preview";
import { VideoSettingsPicker } from './video-settings';
import { SoundMotionSettings } from './sound-motion-settings';
import { uploadReference } from './reference-upload';
import type { PreparedReference } from './reference-media';

type Photo = { file: File; url: string };
type Side = "left" | "right";
const fileIds = new WeakMap<File, string>();
function fileIdentity(file?: File) { if (!file) return ''; let id = fileIds.get(file); if (!id) { id = crypto.randomUUID(); fileIds.set(file, id); } return id; }
const supported = new Set(["image/jpeg", "image/png", "image/webp"]);
const photoPercent = (value: PhotoUploadProgress) => value.phase === "complete" ? 100 : Math.min(99, Math.max(0, Math.floor(value.loaded / Math.max(1, value.total) * 100)));

export function DuoVideoGenerator() {
  const t = useGenerationTranslations();
  const locale = useLocale();
  const formatPercent = (value: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(value / 100);
  const { user, credits, loading: authLoading, openSignIn, refresh } = useAuth();
  const [left, setLeft] = useState<Photo | null>(null);
  const [right, setRight] = useState<Photo | null>(null);
  const [settings, setSettings] = useState<VideoSettings>({ ...defaultVideoSettings });
  const [referenceVideo, setReferenceVideo] = useState<PreparedReference | null>(null);
  const [referenceSong, setReferenceSong] = useState<PreparedReference | null>(null);
  const [videoPreparing, setVideoPreparing] = useState(false);
  const [songPreparing, setSongPreparing] = useState(false);
  const preparationRef = useRef({ video: false, audio: false });
  const markPreparing = (kind: 'video' | 'audio', preparing: boolean) => { preparationRef.current[kind] = preparing; (kind === 'video' ? setVideoPreparing : setSongPreparing)(preparing); };
  const [settingsNotice, setSettingsNotice] = useState('');
  const [referenceProgress, setReferenceProgress] = useState<number | null>(null);
  const ownerRef = useRef(user?.id); ownerRef.current = user?.id;
  const effectiveSettings = { ...settings, duration: settings.motion === 'video' && referenceVideo ? Math.max(settings.model === 'wan-3.0' ? 2 : 4, Math.round(referenceVideo.duration)) : settings.duration };
  const { duration, resolution } = effectiveSettings;
  const referenceAudio = settings.soundtrack === 'song' ? referenceSong?.file : settings.soundtrack === 'clip' ? referenceVideo?.audioFile : undefined;
  const mediaPreparing = videoPreparing || songPreparing;
  const updateSettings = (patch: Partial<VideoSettings>) => {
    if (submitting.current) return;
    const next = updateVideoSettings(settings, patch);
    const adjusted = (['model', 'scene', 'soundtrack', 'resolution'] as const).some(field => next[field] !== settings[field] && !Object.hasOwn(patch, field));
    setSettingsNotice(adjusted ? 'Settings were adjusted for compatibility. Your uploaded media is retained.' : '');
    setSettings(next); idempotency.current = null; uploaded.current = null;
  };
  const changeReference = (kind: 'video' | 'audio', value: PreparedReference | null) => {
    if (submitting.current) return;
    if (kind === 'video') { setReferenceVideo(value); if (value && !value.audioFile && settings.soundtrack === 'clip') { updateSettings({ soundtrack: 'template' }); setSettingsNotice('Your clip has no audio. Template soundtrack was selected.'); } }
    else setReferenceSong(value);
    idempotency.current = null; uploaded.current = null;
  };
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [uploads, setUploads] = useState<Record<Side, PhotoUploadProgress> | null>(null);
  const { generation: trackedGeneration, setGeneration, pollError } = useGeneration(null);
  const [generationOwner, setGenerationOwner] = useState<string | null>(null);
  const generation = generationOwner === user?.id ? trackedGeneration : null;
  const urls = useRef<Set<string>>(new Set());
  const idempotency = useRef<{ fingerprint: string; key: string } | null>(null);
  const uploaded = useRef<UploadedPair | null>(null);
  const submitting = useRef(false);
  const uploadController = useRef<AbortController | null>(null);
  const submittedJob = useRef<string | null>(null);
  const leftInput = useRef<HTMLInputElement>(null);
  const rightInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => { uploadController.current?.abort(); urls.current.forEach((url) => URL.revokeObjectURL(url)); }, []);
  useEffect(() => {
    let active = true;
    uploadController.current?.abort();
    setReferenceVideo(null); setReferenceSong(null);
    preparationRef.current = { video: false, audio: false }; setVideoPreparing(false); setSongPreparing(false);
    uploaded.current = null; idempotency.current = null;
    setGeneration(null);
    setGenerationOwner(user?.id ?? null);
    submittedJob.current = null;
    if (!user?.id || authLoading) return () => { active = false; };
    void (async () => {
      try {
        const response = await readApi<{ generations: (GenerationResponse & { kind: string })[] }>(
          await fetch('/api/generations', { cache: 'no-store' }));
        if (active && !submitting.current && !submittedJob.current) {
          setGeneration(response.generations.find(item => item.kind === 'video') ?? null);
        }
      } catch { /* A failed history lookup must not replace the current task. */ }
    })();
    return () => { active = false; };
  }, [user?.id, authLoading, setGeneration]);
  useEffect(() => { if (generation?.status === "completed" || generation?.status === "failed") void refresh(); }, [generation?.status, refresh]);

  const cost = getVideoCost(duration, resolution, settings.model, settings.motion === 'video' && referenceVideo ? referenceVideo.duration : duration);
  const activeJob = Boolean(generation && !["completed", "failed", "cancelled"].includes(generation.status));
  const videoReady = generation?.status === "completed" && Boolean(generation.videoUrl);
  const progress = videoReady ? 100 : Math.min(99, Math.max(0, Math.round(generation?.progress ?? 0) || 0));
  const progressStage = generation?.error ?? generation?.statusMessage ?? (generation?.status === "queued" ? "Waiting to start…" : generation?.status === "reviewing" ? "Reviewing your photos…" : "Generating your video…");
  const uploadPercent = uploads ? photoPercent({
    phase: uploads.left.phase === "complete" && uploads.right.phase === "complete" ? "complete" : "uploading",
    loaded: uploads.left.loaded + uploads.right.loaded,
    total: uploads.left.total + uploads.right.total,
  }) : 0;
  const uploadStage = uploads && [uploads.left, uploads.right].every((value) => value.phase !== "uploading") ? "Saving photos…" : "Uploading photos…";
  const uploading = busy && stage === "Uploading photos…" && uploads !== null;
  const changePhoto = (side: Side, file?: File) => {
    if (submitting.current) return;
    if (!file) return;
    if (!supported.has(file.type)) { setError("Choose a JPG, PNG, or WebP image."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Each photo must be 10 MB or smaller."); return; }
    const old = side === "left" ? left : right;
    if (old) { URL.revokeObjectURL(old.url); urls.current.delete(old.url); }
    const url = URL.createObjectURL(file);
    urls.current.add(url);
    (side === "left" ? setLeft : setRight)({ file, url });
    idempotency.current = null;
    uploaded.current = null;
    setError("");
  };
  const removePhoto = (side: Side) => {
    if (submitting.current) return;
    const old = side === "left" ? left : right;
    if (old) { URL.revokeObjectURL(old.url); urls.current.delete(old.url); }
    (side === "left" ? setLeft : setRight)(null);
    idempotency.current = null;
    uploaded.current = null;
  };
  const onDrop = (event: DragEvent<HTMLDivElement>, side: Side) => {
    event.preventDefault();
    if (submitting.current) return;
    changePhoto(side, event.dataTransfer.files[0]);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, side: Side) => {
    if (submitting.current) return;
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); (side === "left" ? leftInput : rightInput).current?.click(); }
  };
  const submit = async () => {
    if (submitting.current || activeJob || preparationRef.current.video || preparationRef.current.audio) return;
    if (!user) { openSignIn(); return; }
    if (!left || !right) { setError("Upload one photo for each person to continue."); return; }
    if (credits < cost) { setError(`You need ${cost} credits to create this video.`); return; }
    if (settings.motion === 'video' && !referenceVideo) { setError('Prepare your motion clip before generating.'); return; }
    if (['song', 'clip'].includes(settings.soundtrack) && !referenceAudio) { setError('Prepare your selected soundtrack before generating.'); return; }
    const selectedAudioDuration = settings.soundtrack === 'song' ? referenceSong?.duration : settings.soundtrack === 'clip' ? referenceVideo?.duration : undefined;
    if (selectedAudioDuration !== undefined && selectedAudioDuration + 0.55 < duration) { setError('Choose an audio segment long enough for this video, or shorten the video.'); return; }
    const owner = user.id;
    const ensureCurrent = () => { if (controller.signal.aborted || ownerRef.current !== owner) throw new Error('Generation was cancelled because your account changed.'); };
    const fingerprint = JSON.stringify([owner, fileIdentity(left.file), fileIdentity(right.file), effectiveSettings, settings.motion === 'video' ? fileIdentity(referenceVideo?.file) : '', fileIdentity(referenceAudio)]);
    if (idempotency.current?.fingerprint !== fingerprint) idempotency.current = { fingerprint, key: crypto.randomUUID() };
    const requestKey = idempotency.current.key;
    const submission = captureVideoSubmission(requestKey, fingerprint, left.file, right.file, effectiveSettings, { video: settings.motion === 'video' ? referenceVideo?.file : undefined, audio: referenceAudio });
    const controller = new AbortController();
    uploadController.current = controller;
    submitting.current = true;
    setBusy(true); setError(""); setGeneration(null); setUploads(null); setReferenceProgress(null);
    try {
      let prepared = submission;
      if (uploaded.current?.fingerprint !== fingerprint) {
        setStage("Preparing photos…");
        const [leftFile, rightFile] = await Promise.all([preparePhoto(submission.leftFile), preparePhoto(submission.rightFile)]);
        ensureCurrent();
        prepared = { ...submission, leftFile, rightFile };
        setUploads({
          left: { phase: "uploading", loaded: 0, total: leftFile.size },
          right: { phase: "uploading", loaded: 0, total: rightFile.size },
        });
      }
      setStage("Uploading photos…");
      const result = await executeVideoSubmission(prepared, uploaded.current, (file, side) => uploadPhoto(file, (value) => {
        if (!controller.signal.aborted) setUploads((previous) => previous && { ...previous, [side]: value });
      }, controller.signal), async (body, key) => {
        ensureCurrent();
        setStage("Starting your video…");
        return readApi<GenerationResponse>(await fetch("/api/generations", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(body), signal: controller.signal }));
      }, (pair) => { if (ownerRef.current === owner && idempotency.current?.key === requestKey) uploaded.current = pair; }, async (file, kind) => {
        ensureCurrent();
        return uploadReference(file, kind, value => { if (!controller.signal.aborted) { setStage('Uploading reference media…'); setReferenceProgress(photoPercent(value)); } }, controller.signal);
      });
      ensureCurrent();
      submittedJob.current = result.id;
      setGenerationOwner(user.id);
      setGeneration(result);
      if (idempotency.current?.key === requestKey) idempotency.current = null;
      await refresh();
    } catch (failure) { if (ownerRef.current === owner) setError(failure instanceof Error ? failure.message : "Could not create the video."); }
    finally {
      controller.abort();
      if (uploadController.current === controller) uploadController.current = null;
      submitting.current = false; setBusy(false); setStage(""); setUploads(null); setReferenceProgress(null);
    }
  };

  const slot = (side: Side, photo: Photo | null, input: RefObject<HTMLInputElement | null>) => <div className="mi-upload-group">
    <div className="mi-upload-label"><label htmlFor={`mi-${side}-photo`}>{t("Person {number}", { number: side === "left" ? 1 : 2 })}</label><span>{t(side === "left" ? "Left performer" : "Right performer")}</span></div>
    <div className={`mi-upload-slot ${photo ? "mi-upload-has-photo" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(event, side)} onKeyDown={(event) => !photo && onKeyDown(event, side)} role={photo ? undefined : "button"} tabIndex={photo ? undefined : 0} aria-label={t("Choose photo for person {number}", { number: side === "left" ? 1 : 2 })}>
      <input ref={input} id={`mi-${side}-photo`} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event: ChangeEvent<HTMLInputElement>) => { changePhoto(side, event.target.files?.[0]); event.target.value = ""; }} />
      {photo ? <><img src={photo.url} alt={t("Person {number} preview", { number: side === "left" ? 1 : 2 })} /><button type="button" className="mi-remove-photo" aria-label={t("Remove person {number} photo", { number: side === "left" ? 1 : 2 })} disabled={busy} onClick={() => removePhoto(side)}><X size={16} /></button></> : <label htmlFor={`mi-${side}-photo`} className="mi-upload-content"><span className="mi-upload-icon"><ImagePlus size={21} /></span><strong>{t('Choose photo')}</strong><small>{t('or drop it here')}</small></label>}
    </div>
    {busy && uploads && <div className="mi-photo-upload-progress">
      <div><span>{t(uploads[side].phase === "complete" ? "Photo uploaded" : uploads[side].phase === "saving" ? "Saving photo…" : "Uploading photo…")}</span><strong>{formatPercent(photoPercent(uploads[side]))}</strong></div>
      <div className="mi-generation-progress-track" role="progressbar" aria-label={t("Person {number} photo upload progress", { number: side === "left" ? 1 : 2 })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={photoPercent(uploads[side])} aria-valuetext={t("{progress}% · {stage}", { progress: photoPercent(uploads[side]), stage: t(uploads[side].phase === "saving" ? "Waiting for the server to save the photo" : uploads[side].phase === "complete" ? "Photo uploaded" : "Uploading photo…") })}><div className="mi-generation-progress-fill" style={{ width: `${photoPercent(uploads[side])}%` }} /></div>
    </div>}
  </div>;

  return <div className="mi-generator-grid">
    <div className="mi-video-form mi-panel">
      <div className="mi-video-form-header">
        <div className="mi-panel-heading"><h2>{t('Hotel Lobby AI Video Generator')}</h2><Sparkles size={20} /></div>
        <p className="mi-panel-description">{t('Add one clear, front-facing photo for each person.')}</p>
      </div>
      <div className="mi-video-form-body">
      <div className="mi-upload-grid">{slot("left", left, leftInput)}{slot("right", right, rightInput)}</div>
      <p className="mi-upload-hint">{t('JPG, PNG or WebP · Up to 10 MB each')}</p>
      <fieldset className="mi-scene-field" disabled={busy || activeJob}><legend>{t('Stage')}</legend><div className="mi-scene-grid" role="radiogroup" aria-label={t('Stage')}>{videoScenes.map(scene => <button type="button" key={scene.id} role="radio" aria-checked={settings.scene === scene.id} className={`mi-scene-card mi-scene-${scene.id} ${settings.scene === scene.id ? 'selected' : ''}`} onClick={() => updateSettings({ scene: scene.id })}><span className="mi-scene-swatch"/><strong>{t(scene.label)}</strong><small>{t(scene.description)}</small></button>)}</div></fieldset>
      <VideoSettingsPicker value={effectiveSettings} onChange={updateSettings} disabled={busy || activeJob} ownMotion={settings.motion === 'video' && Boolean(referenceVideo)}/>
      <SoundMotionSettings key={user?.id ?? 'anonymous'} value={effectiveSettings} onChange={updateSettings} video={referenceVideo} song={referenceSong} onVideoChange={value => changeReference('video', value)} onSongChange={value => changeReference('audio', value)} onVideoBusy={value => markPreparing('video', value)} onSongBusy={value => markPreparing('audio', value)} disabled={busy || activeJob}/>
      {settingsNotice && <p className="mi-settings-note" role="status">{t(settingsNotice)}</p>}
      {referenceProgress !== null && <p className="mi-settings-note" role="status">{t('Uploading reference media…')} {formatPercent(referenceProgress)}</p>}
      {mediaPreparing && <p className="mi-settings-note" role="status">{t('Preparing reference media…')}</p>}
      <button className="mi-primary-button mi-generate-button" type="button" onClick={submit} disabled={busy || activeJob || mediaPreparing || authLoading || Boolean(user && (!left || !right))}>{!user && !authLoading ? <UserRound size={17} /> : <Sparkles size={17} />}{busy ? uploading ? t("{stage} {progress}%", { stage: t(uploadStage), progress: uploadPercent }) : t(stage) : authLoading ? t("Checking account…") : activeJob ? t("{status}… {progress}%", { status: t(generation?.error ? "Video status" : "Video in progress"), progress }) : t(user ? "Generate Video" : "Sign In to Generate Video")}</button>
      {uploading && <div className="mi-generation-progress">
        <div className="mi-generation-progress-label" role="status"><span>{t(uploadStage)}</span><strong>{formatPercent(uploadPercent)}</strong></div>
        <div className="mi-generation-progress-track" role="progressbar" aria-label={t("Photo upload progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadPercent}><div className="mi-generation-progress-fill" style={{ width: `${uploadPercent}%` }} /></div>
        <p>{t(uploadStage === "Saving photos…" ? "Photos have been sent. Waiting for the server to finish saving." : "Uploading both photos. Larger photos are optimized before transfer.")}</p>
      </div>}
      {activeJob && <div className="mi-generation-progress">
        <div className="mi-generation-progress-label" role={generation?.error ? "alert" : "status"}><span>{t(progressStage)}</span><strong>{formatPercent(progress)}</strong></div>
        <div className="mi-generation-progress-track" role="progressbar" aria-label={t("Video generation progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={t("{progress}% · {stage}", { progress, stage: t(progressStage) })}><div className="mi-generation-progress-fill" style={{ width: `${progress}%` }} /></div>
        <p>{t(generation?.error ? "Last reported progress · See the status above for details." : "Stage-based progress · Updates may pause while a stage is running.")}</p>
      </div>}
      <div className="mi-credit-line"><span>{t("Cost {credits} credits", { credits: cost.toLocaleString(locale) })}</span><span>{t("Remaining {credits} credits", { credits: credits.toLocaleString(locale) })}</span></div>
      <Link className="mi-buy-button" href="/pricing"><CreditCard size={16} /> {t("Buy Credits")}</Link>
      {error && <p className="mi-error" role="alert">{t(error)} {credits < cost && user ? <Link href="/pricing">{t('Buy Credits')}</Link> : null}</p>}
      {generation && !activeJob && <div className="mi-generation-status" role="status">{t(videoReady ? "Your video is ready. 100%" : generation.error ?? generation.statusMessage ?? "Generation could not be completed.")}{generation.status === "completed" && generation.videoUrl && <a href={generation.videoUrl} download>{t('Download video')}</a>}</div>}
      {pollError && <p className="mi-error" role="alert">{t(pollError)}</p>}
      </div>
    </div>
    <VideoPreview generation={generation} stage={busy ? stage : ''} error={error} pollError={generation ? pollError : ''} />
  </div>;
}
