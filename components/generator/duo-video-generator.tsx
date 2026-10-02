"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent, type RefObject } from "react";
import Link from "next/link";
import { ImagePlus, Sparkles, CreditCard, UserRound, X, Video } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import type { AspectRatio, GenerationResponse, UploadedPhoto, VideoDuration, VideoResolution } from "@/lib/contracts";
import { getVideoCost } from "@/lib/video-options";
import { readApi, useGeneration } from "./use-generation";
import { captureVideoSubmission, executeVideoSubmission, type UploadedPair } from "./video-submission";

type Photo = { file: File; url: string };
type Side = "left" | "right";
const supported = new Set(["image/jpeg", "image/png", "image/webp"]);

export function DuoVideoGenerator() {
  const { user, credits, loading: authLoading, openSignIn, refresh } = useAuth();
  const [left, setLeft] = useState<Photo | null>(null);
  const [right, setRight] = useState<Photo | null>(null);
  const [aspect, setAspect] = useState<AspectRatio>("9:16");
  const [duration, setDuration] = useState<VideoDuration>(5);
  const [resolution, setResolution] = useState<VideoResolution>("720p");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const { generation, setGeneration, pollError } = useGeneration(null);
  const urls = useRef<Set<string>>(new Set());
  const idempotency = useRef<{ fingerprint: string; key: string } | null>(null);
  const uploaded = useRef<UploadedPair | null>(null);
  const submitting = useRef(false);
  const leftInput = useRef<HTMLInputElement>(null);
  const rightInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => { urls.current.forEach((url) => URL.revokeObjectURL(url)); }, []);
  useEffect(() => { if (generation?.status === "completed" || generation?.status === "failed") void refresh(); }, [generation?.status, refresh]);

  const cost = getVideoCost(duration, resolution);
  const activeJob = Boolean(generation && !["completed", "failed", "cancelled"].includes(generation.status));
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
  const upload = async (file: File) => {
    const form = new FormData(); form.set("file", file);
    return readApi<UploadedPhoto>(await fetch("/api/uploads", { method: "POST", body: form }));
  };
  const submit = async () => {
    if (submitting.current || activeJob) return;
    if (!user) { openSignIn(); return; }
    if (!left || !right) { setError("Upload one photo for each person to continue."); return; }
    if (credits < cost) { setError(`You need ${cost} credits to create this video.`); return; }
    const fingerprint = [left.file.name, left.file.size, left.file.lastModified, right.file.name, right.file.size, right.file.lastModified, aspect, duration, resolution].join(":");
    if (idempotency.current?.fingerprint !== fingerprint) idempotency.current = { fingerprint, key: crypto.randomUUID() };
    const requestKey = idempotency.current.key;
    const submission = captureVideoSubmission(requestKey, fingerprint, left.file, right.file, { aspect, duration, resolution });
    submitting.current = true;
    setBusy(true); setError(""); setGeneration(null);
    try {
      setStage("Uploading photos…");
      const result = await executeVideoSubmission(submission, uploaded.current, upload, async (body, key) => {
        setStage("Starting your video…");
        return readApi<GenerationResponse>(await fetch("/api/generations", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(body) }));
      }, (pair) => { if (idempotency.current?.key === requestKey) uploaded.current = pair; });
      setGeneration(result);
      if (idempotency.current?.key === requestKey) idempotency.current = null;
      await refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not create the video."); }
    finally { submitting.current = false; setBusy(false); setStage(""); }
  };

  const slot = (side: Side, photo: Photo | null, input: RefObject<HTMLInputElement | null>) => <div className="mi-upload-group">
    <div className="mi-upload-label"><label htmlFor={`mi-${side}-photo`}>Person {side === "left" ? "1" : "2"}</label><span>{side === "left" ? "Left performer" : "Right performer"}</span></div>
    <div className={`mi-upload-slot ${photo ? "mi-upload-has-photo" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(event, side)} onKeyDown={(event) => !photo && onKeyDown(event, side)} role={photo ? undefined : "button"} tabIndex={photo ? undefined : 0} aria-label={`Choose photo for person ${side === "left" ? "1" : "2"}`}>
      <input ref={input} id={`mi-${side}-photo`} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event: ChangeEvent<HTMLInputElement>) => { changePhoto(side, event.target.files?.[0]); event.target.value = ""; }} />
      {photo ? <><img src={photo.url} alt={`Person ${side === "left" ? "1" : "2"} preview`} /><button type="button" className="mi-remove-photo" aria-label={`Remove person ${side === "left" ? "1" : "2"} photo`} disabled={busy} onClick={() => removePhoto(side)}><X size={16} /></button></> : <label htmlFor={`mi-${side}-photo`} className="mi-upload-content"><span className="mi-upload-icon"><ImagePlus size={21} /></span><strong>Choose photo</strong><small>or drop it here</small></label>}
    </div>
  </div>;

  return <div className="mi-generator-grid">
    <div className="mi-video-form mi-panel">
      <div className="mi-video-form-header">
        <div className="mi-panel-heading"><h2>Hotel Lobby AI Video Generator</h2><Sparkles size={20} /></div>
        <p className="mi-panel-description">Add one clear, front-facing photo for each person.</p>
      </div>
      <div className="mi-video-form-body">
      <div className="mi-upload-grid">{slot("left", left, leftInput)}{slot("right", right, rightInput)}</div>
      <p className="mi-upload-hint">JPG, PNG or WebP · Up to 10 MB each</p>
      <div className="mi-options-grid">
        <label>Aspect Ratio<select value={aspect} disabled={busy} onChange={(event) => { if (submitting.current) return; setAspect(event.target.value as AspectRatio); idempotency.current = null; uploaded.current = null; }}>{["9:16", "16:9", "4:3", "3:4"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Duration<select value={duration} disabled={busy} onChange={(event) => { if (submitting.current) return; setDuration(Number(event.target.value) as VideoDuration); idempotency.current = null; uploaded.current = null; }}>{[5, 10, 15].map((value) => <option key={value} value={value}>{value} seconds</option>)}</select></label>
        <label>Resolution<select value={resolution} disabled={busy} onChange={(event) => { if (submitting.current) return; setResolution(event.target.value as VideoResolution); idempotency.current = null; uploaded.current = null; }}><option value="720p">720P</option><option value="480p">480P</option></select></label>
      </div>
      <button className="mi-primary-button mi-generate-button" type="button" onClick={submit} disabled={busy || activeJob || authLoading || Boolean(user && (!left || !right))}>{!user && !authLoading ? <UserRound size={17} /> : <Sparkles size={17} />}{busy ? stage : authLoading ? "Checking account…" : activeJob ? "Video in progress…" : user ? "Generate Video" : "Sign In to Generate Video"}</button>
      <div className="mi-credit-line"><span>Cost {cost} credits</span><span>Remaining {credits} credits</span></div>
      <Link className="mi-buy-button" href="/pricing"><CreditCard size={16} /> Buy Credits</Link>
      {error && <p className="mi-error" role="alert">{error} {credits < cost && user ? <Link href="/pricing">Buy Credits</Link> : null}</p>}
      {generation && <div className="mi-generation-status" role="status">{generation.status === "completed" ? "Your video is ready." : generation.status === "failed" || generation.status === "cancelled" ? (generation.error ?? "Generation could not be completed.") : `${generation.status[0].toUpperCase()}${generation.status.slice(1)}… ${generation.progress}%`}{generation.status === "completed" && generation.videoUrl && <a href={generation.videoUrl} download>Download video</a>}</div>}
      {pollError && <p className="mi-error" role="alert">{pollError}</p>}
      </div>
    </div>
    <div className="mi-video-preview mi-panel">
      <h2><Video size={17} /> Video Preview</h2>
      <div className="mi-preview-media"><video src={generation?.status === "completed" && generation.videoUrl ? generation.videoUrl : "/videos/preview.mp4"} poster={generation?.status === "completed" ? undefined : "/posters/preview.jpg"} controls playsInline preload="metadata" /></div>
      <p>{generation?.status === "completed" ? "Your generated video is ready to watch and download." : "Reference preview · Upload two photos to generate"}</p>
    </div>
  </div>;
}
