"use client";

import { useEffect, useId, useRef, useState, type DragEvent, type SyntheticEvent } from "react";
import { inspectReference, prepareReference, type PreparedReference, type ReferenceKind, type ReferenceMetadata } from "./reference-media";
import { useGenerationTranslations } from "./use-generation";

export type ReferenceMediaPickerProps = {
  kind: ReferenceKind;
  value: PreparedReference | null;
  onChange: (value: PreparedReference | null) => void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
};

export function ReferenceMediaPicker({ kind, value, onChange, disabled = false, onBusyChange }: ReferenceMediaPickerProps) {
  const t = useGenerationTranslations();
  const id = useId();
  const [source, setSource] = useState<File | null>(() => value?.sourceFile ?? null);
  const [metadata, setMetadata] = useState<ReferenceMetadata | null>(() => value?.sourceFile ? value.sourceMetadata ?? null : null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [start, setStart] = useState(() => value?.sourceFile ? value.start : 0);
  const [length, setLength] = useState(() => value?.sourceFile ? value.selectedDuration ?? value.duration : 2);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const token = useRef(0);
  const media = useRef<HTMLMediaElement | null>(null);
  const callbacks = useRef({ onChange, onBusyChange });
  callbacks.current = { onChange, onBusyChange };
  const maximum = kind === "video" ? 14.9 : 15;

  useEffect(() => () => {
    token.current += 1;
    controller.current?.abort();
    callbacks.current.onBusyChange?.(false);
  }, []);

  const previewFile = source ?? value?.file ?? null;
  useEffect(() => {
    if (!previewFile) { setPreviewUrl(""); return; }
    const url = URL.createObjectURL(previewFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewFile]);

  const setWorking = (working: boolean) => { setBusy(working); callbacks.current.onBusyChange?.(working); };
  const invalidate = () => {
    token.current += 1;
    controller.current?.abort();
    controller.current = null;
    media.current?.pause();
    callbacks.current.onChange(null);
    setProgress(0); setPreparing(false); setWorking(false);
    return token.current;
  };
  const select = async (file?: File) => {
    if (disabled || !file) return;
    const latest = invalidate();
    const next = new AbortController(); controller.current = next;
    setSource(file); setMetadata(null); setStart(0); setLength(2); setError(""); setWorking(true);
    try {
      const info = await inspectReference(file, kind, next.signal);
      if (token.current !== latest) return;
      setMetadata(info); setLength(Math.min(maximum, info.duration));
    } catch (failure) {
      if (token.current === latest && !next.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not read this media file. Choose another MP4, WebM, MP3, or WAV file.");
    } finally { if (token.current === latest) { controller.current = null; setWorking(false); } }
  };
  const remove = () => {
    if (disabled) return;
    invalidate(); setSource(null); setMetadata(null); setStart(0); setLength(2); setError("");
  };
  const edit = (nextStart: number, nextLength: number) => {
    if (disabled || !metadata) return;
    invalidate(); setError("");
    const safeStart = Math.max(0, Math.min(metadata.duration - 2, nextStart));
    setStart(safeStart); setLength(Math.max(2, Math.min(maximum, metadata.duration - safeStart, nextLength)));
    if (media.current) media.current.currentTime = safeStart;
  };
  const apply = async () => {
    if (disabled || busy || !source || !metadata) return;
    const latest = invalidate();
    const next = new AbortController(); controller.current = next;
    setError(""); setPreparing(true); setWorking(true);
    try {
      const prepared = await prepareReference(source, kind, start, start + length, n => {
        if (token.current === latest && !next.signal.aborted) setProgress(Math.round(n * 100));
      }, next.signal);
      if (token.current === latest && !next.signal.aborted) callbacks.current.onChange(prepared);
    } catch (failure) {
      if (token.current === latest && !next.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not prepare this segment. Try a shorter MP4, MP3, or WAV file in a recent Chrome browser.");
    } finally { if (token.current === latest) { controller.current = null; setWorking(false); setPreparing(false); } }
  };
  const drop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); if (!disabled) void select(event.dataTransfer.files[0]); };
  const beginPreview = (event: SyntheticEvent<HTMLMediaElement>) => {
    if (!source || !metadata) return;
    const player = event.currentTarget;
    if (player.currentTime < start || player.currentTime >= start + length) player.currentTime = start;
  };
  const limitPreview = (event: SyntheticEvent<HTMLMediaElement>) => {
    if (source && metadata && event.currentTarget.currentTime >= start + length) {
      event.currentTarget.pause(); event.currentTarget.currentTime = start;
    }
  };
  const sourceName = source?.name ?? value?.sourceName;
  return <div className="mi-reference-picker" onDragOver={event => event.preventDefault()} onDrop={drop}>
    <div className="mi-reference-upload">
      <label htmlFor={id} className="mi-reference-choose">{t(sourceName ? "Replace file" : kind === "video" ? "Choose motion video" : "Choose your song")}</label>
      <input id={id} className="mi-reference-file" type="file" disabled={disabled} accept={kind === "video" ? "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" : "audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"} onChange={event => { void select(event.target.files?.[0]); event.target.value = ""; }} />
      <small>{t("or drop it here · up to 200 MB")}</small>
      {sourceName && <button type="button" className="mi-reference-remove" onClick={remove} disabled={disabled}>{t("Remove file")}</button>}
    </div>
    {sourceName && <p className="mi-reference-name">{sourceName}</p>}
    {previewUrl && <div className="mi-reference-preview">{kind === "video"
      ? <video ref={element => { media.current = element; }} src={previewUrl} controls playsInline preload="metadata" onPlay={beginPreview} onTimeUpdate={limitPreview} onLoadedMetadata={event => { if (source && metadata) event.currentTarget.currentTime = start; }} aria-label={t("Motion video preview")} />
      : <audio ref={element => { media.current = element; }} src={previewUrl} controls preload="metadata" onPlay={beginPreview} onTimeUpdate={limitPreview} onLoadedMetadata={event => { if (source && metadata) event.currentTarget.currentTime = start; }} aria-label={t("Song preview")} />}</div>}
    {metadata && <div className="mi-reference-controls">
      <label htmlFor={`${id}-start`}>{t("Start time")}: {t("{seconds} seconds", { seconds: start.toFixed(1) })}</label>
      <input id={`${id}-start`} type="range" min={0} max={Math.max(0, metadata.duration - 2)} step={0.1} value={start} disabled={disabled} onChange={event => edit(Number(event.target.value), length)} />
      <label htmlFor={`${id}-length`}>{t("Segment length")}: {t("{seconds} seconds", { seconds: length.toFixed(1) })}</label>
      <input id={`${id}-length`} type="range" min={2} max={Math.min(maximum, metadata.duration - start)} step={0.1} value={length} disabled={disabled} onChange={event => edit(start, Number(event.target.value))} />
      <p className="mi-reference-hint">{t("Only the selected segment will be uploaded.")}</p>
      {kind === "video" && !metadata.hasAudio && <p className="mi-reference-hint">{t("This video has no audio. Choose a song or the template soundtrack.")}</p>}
      {kind === "video" && metadata.hasAudio && value && !value.hasAudio && <p className="mi-reference-hint">{t("This segment has no usable audio. Choose a song or the template soundtrack.")}</p>}
      <button type="button" className="mi-reference-apply" disabled={disabled || busy} onClick={() => void apply()}>{t(value ? "Segment ready" : "Apply segment")}</button>
    </div>}
    {busy && <div className="mi-reference-progress" role="status" aria-live="polite"><span>{t(preparing ? "Preparing segment…" : "Reading media…")}</span>{preparing && <><progress max={100} value={progress} aria-label={t("Media preparation progress")} /><span>{progress}%</span></>}</div>}
    {value && !busy && <p className="mi-reference-ready" role="status">{t("Ready: {seconds} seconds", { seconds: value.duration.toFixed(1) })}</p>}
    {error && <p className="mi-reference-error" role="alert">{t(error)}</p>}
  </div>;
}
