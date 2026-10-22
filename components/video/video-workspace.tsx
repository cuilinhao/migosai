"use client";

import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AudioLines, ChevronDown, ChevronRight, ClipboardPaste, Clock3, Download, Heart, ImageIcon, ImagePlus, LoaderCircle, MoreVertical, Pause, Play, RefreshCw, SlidersHorizontal, Sparkles, Video, X, Zap } from "lucide-react";
import Link from "@/components/i18n/localized-link";
import { useGenerationTranslations } from "@/components/generator/use-generation";
import { FLYING_CAR_PROMPT_MAX } from "@/components/flyingcar/submission";
import { videoInspiration } from "@/content/video-inspiration";
import { useVideoWorkspace } from "./use-video-workspace";
import styles from "./video-workspace.module.css";

type Inspiration = (typeof videoInspiration)[number];

export function VideoWorkspace() {
  const t = useGenerationTranslations();
  const creator = useVideoWorkspace();
  const [modelsOpen, setModelsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelGroup, setModelGroup] = useState("recommended");
  const [advanced, setAdvanced] = useState(false);
  const [offset, setOffset] = useState(0);
  const [preview, setPreview] = useState<Inspiration | null>(null);
  const [paused, setPaused] = useState(true);
  const [notice, setNotice] = useState("");
  const prompt = useRef<HTMLTextAreaElement>(null);
  const modelTrigger = useRef<HTMLButtonElement | null>(null);
  const settingsTrigger = useRef<HTMLButtonElement | null>(null);
  const previewTrigger = useRef<HTMLButtonElement | null>(null);
  const focusPromptAfterPreview = useRef(false);
  const restoreFocus = (element: HTMLButtonElement | null) => {
    if (element?.getClientRects().length) element.focus(); else prompt.current?.focus();
  };
  const { generation, locked, busy, progress, cost, error, pollError } = creator;
  const active = generation && !["completed", "failed", "cancelled"].includes(generation.status);
  const inspirations = videoInspiration.map((_, index) => videoInspiration[(index + offset) % videoInspiration.length]);

  useEffect(() => {
    setPaused(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  const pastePrompt = async () => {
    if (locked) return;
    try { creator.setPrompt((await navigator.clipboard.readText()).slice(0, FLYING_CAR_PROMPT_MAX)); }
    catch { setNotice(t("Clipboard is unavailable. Paste directly into the prompt field.")); }
    prompt.current?.focus();
  };
  const generate = () => { void creator.submit(); };

  const modelField = <div className={styles.field}>
    <span className={styles.label}>{t("Model")}</span>
    <button type="button" className={styles.modelTrigger} onClick={event => { modelTrigger.current = event.currentTarget; setModelsOpen(true); }} disabled={locked} aria-haspopup="dialog" aria-expanded={modelsOpen}><span className={styles.modelMark}><AudioLines size={21}/></span>Seedance 2.5<ChevronRight size={15}/></button>
  </div>;
  const referenceField = (id: string) => <div className={styles.field}>
    <label className={styles.label} htmlFor={id}>{t("References")} <span>({creator.photo ? 1 : 0}/1)</span></label>
    <div className={styles.references}>
      <label className={`${styles.upload} ${creator.photo ? styles.uploaded : ""}`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); creator.changePhoto(event.dataTransfer.files[0]); }}>
        {creator.photo ? <img src={creator.photo.url} alt={t("Optional reference photo")}/> : <><ImagePlus size={15}/><span>{t("Start Frame")}</span></>}
        <input id={id} type="file" accept="image/jpeg,image/png,image/webp" disabled={locked} aria-label={t("Optional reference photo")} onChange={event => { creator.changePhoto(event.target.files?.[0]); event.target.value = ""; }}/>
      </label>
      {creator.photo && <button type="button" className={styles.removeReference} onClick={creator.removePhoto} disabled={locked} aria-label={t("Remove reference")}><X size={15}/></button>}
    </div>
    {creator.photo && <label className={styles.consent}><input type="checkbox" checked={creator.consent} disabled={locked} onChange={event => creator.setConsent(event.target.checked)}/>{t("I have permission to use this photo.")}</label>}
  </div>;
  const aspectField = <div className={styles.field}>
    <span className={styles.label}>{t("Aspect Ratio")}</span>
    <div className={styles.aspectRow}><div className={styles.segmented} aria-label={t("Aspect Ratio")}>
      {["1:1", "9:16", "16:9"].map(aspect => <button type="button" key={aspect} aria-pressed={aspect === "9:16"} aria-disabled={aspect !== "9:16"} onClick={() => { if (aspect !== "9:16") setNotice(t("This model currently supports 9:16, 480p and silent video.")); }}><i style={{ aspectRatio: aspect.replace(":", "/") }}/>{aspect}</button>)}
    </div><button type="button" className={styles.moreAspect} aria-label={t("More aspect ratios are coming soon.")} onClick={() => setNotice(t("More aspect ratios are coming soon."))}><MoreVertical size={16}/></button></div>
  </div>;
  const durationField = (id: string) => <div className={styles.field}>
    <label className={styles.label} htmlFor={id}>{t("Duration")}</label>
    <div className={styles.duration}><select id={id} value={creator.duration} disabled={locked} onChange={event => creator.setDuration(Number(event.target.value))}>{Array.from({ length: 26 }, (_, index) => index + 5).map(duration => <option key={duration} value={duration}>{duration}s</option>)}</select><ChevronDown size={13}/></div>
  </div>;
  const advancedField = <div className={styles.advanced}>
    <button type="button" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}>{t("Advanced")}<ChevronDown size={14} className={advanced ? styles.rotated : ""}/></button>
    {advanced && <div className={styles.advancedContent}><div><span>{t("Resolution")}</span><b>480P</b></div><div><span>{t("Generate Audio")}</span><span className={styles.toggle} role="switch" aria-checked="false" aria-disabled="true" aria-label={t("Generate Audio")}/></div><p>{t("This model currently supports 9:16, 480p and silent video.")}</p></div>}
  </div>;

  return <div className={styles.workspace}>
    <h1 className="sr-only">{t("AI Video Generator")}</h1>
    <section className={styles.panel} aria-label={t("Generation settings")} aria-busy={locked}>
      <div className={styles.fields}>
        <div className={styles.desktopOnly}>{modelField}</div>
        <div className={styles.desktopOnly}>{referenceField("video-reference")}</div>
        <div className={styles.promptField}>
          <label className={`${styles.label} ${styles.promptLabel}`} htmlFor="video-workspace-prompt">{t("Prompt")}</label>
          <div className={styles.promptBox}>
            <textarea ref={prompt} id="video-workspace-prompt" value={creator.prompt} disabled={locked} maxLength={FLYING_CAR_PROMPT_MAX} onChange={event => { creator.setPrompt(event.target.value); creator.setError(""); }} placeholder={t("Describe the piece you want to create...")} aria-describedby="video-prompt-count"/>
            <span className={styles.counter} id="video-prompt-count">{creator.prompt.length}/{FLYING_CAR_PROMPT_MAX}</span>
            <div className={styles.promptToolbar}>
              <button type="button" className={styles.mobileDuration} onClick={event => { settingsTrigger.current = event.currentTarget; setNotice(""); setSettingsOpen(true); }}><Clock3 size={13}/>{creator.duration}s</button>
              <button type="button" onClick={() => void pastePrompt()} disabled={locked} aria-label={t("Paste prompt")}><ClipboardPaste size={16}/></button>
              <button type="button" className={styles.translate} role="switch" aria-checked="false" aria-disabled="true" onClick={() => setNotice(t("Automatic translation is coming soon."))}>{t("Translate")}<span className={styles.toggle} aria-hidden="true"/></button>
            </div>
          </div>
        </div>
        <div className={styles.desktopOnly}>{aspectField}</div>
        <div className={styles.desktopOnly}>{durationField("video-duration")}</div>
        <div className={styles.desktopOnly}>{advancedField}</div>
      </div>
      <div className={styles.generateArea}>
        {error && <p className={styles.error} role="alert">{t(error)}{creator.user && cost !== null && creator.credits < cost && <> <Link href="/pricing">{t("Buy credits")}</Link></>}</p>}
        <div className={styles.generateRow}><button className={styles.settingsButton} type="button" aria-label={t("Video settings")} onClick={event => { settingsTrigger.current = event.currentTarget; setNotice(""); setSettingsOpen(true); }}><SlidersHorizontal size={21}/></button><button className={styles.generate} type="button" onClick={generate} disabled={locked || creator.authLoading}>
          {locked ? <><LoaderCircle size={17} className={styles.spinner}/>{busy ? t("Preparing your video…") : `${progress}%`}</> : <>{t("Generate")}<span><Zap size={15} fill="currentColor"/>{cost}</span></>}
        </button></div>
      </div>
    </section>

    <section className={styles.output} aria-label={t("Videos")}>
      {(busy || generation) ? <div className={styles.result}>
        {generation?.status === "completed" && generation.videoUrl ? <><h2>{t("Your video is ready")}</h2><video src={generation.videoUrl} controls playsInline preload="metadata" aria-label={t("Your video is ready")}/><a className={styles.resultDownload} href={generation.videoUrl} download><Download size={17}/>{t("Download video")}</a></> : busy || active ? <><div className={styles.progressIcon}><Sparkles size={30}/></div><h2>{t(busy ? creator.stage : generation?.statusMessage ?? "Generating your video…")}</h2><div className={styles.progress} role="progressbar" aria-label={t("Video generation progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{width:`${progress}%`}}/></div>{generation && <p>{t("Your task is saved in My Videos.")}</p>}</> : <><h2>{t("Generation could not be completed.")}</h2><p role="alert">{t(generation?.error ?? generation?.statusMessage ?? "Generation could not be completed.")}</p></>}
        {pollError && <p role="status">{t(pollError)}</p>}<Link href="/app/my-videos">{t("Open My Videos")}<ChevronRight size={14}/></Link>
      </div> : <div className={styles.inspiration}>
        <h2>{t("Get Inspired Here")}</h2>
        <div className={styles.gallery}>{inspirations.map(item => <InspirationCard key={item.src} item={item} paused={paused} onOpen={trigger => { previewTrigger.current = trigger; setPreview(item); }}/>)}</div>
        <div className={styles.galleryActions}><button type="button" className={styles.refresh} onClick={() => setOffset(value => (value + 1) % videoInspiration.length)}><RefreshCw size={19}/>{t("Refresh")}</button><Link href="/explore">{t("View All")}</Link><button type="button" className={styles.pause} aria-label={t(paused ? "Play previews" : "Pause previews")} onClick={() => setPaused(!paused)}>{paused ? <Play size={14}/> : <Pause size={14}/>}</button></div>
      </div>}
    </section>

    <Dialog.Root open={modelsOpen} onOpenChange={setModelsOpen}><Dialog.Portal><Dialog.Overlay className={styles.modelOverlay}/><Dialog.Content className={styles.modelDialog} onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(modelTrigger.current); }}>
      <Dialog.Title className="sr-only">{t("Choose a model")}</Dialog.Title><Dialog.Description className="sr-only">{t("Create a video from text or one reference image.")}</Dialog.Description><Dialog.Close className={styles.close} aria-label={t("Close")}><X size={17}/></Dialog.Close>
      <div className={styles.modelTabs}><span><Video size={18}/>{t("Video")}</span><Link href="/ai-image-generator"><ImageIcon size={18}/>{t("Image")}</Link><Link href="/ai-rap-song-generator"><AudioLines size={18}/>{t("Audio")}</Link></div>
      <div className={styles.modelBody}><nav aria-label={t("Choose a model")}><button aria-pressed={modelGroup === "recommended"} onClick={() => setModelGroup("recommended")}><Heart size={17} fill="#ea665c" color="#ea665c"/>{t("Models for you")}</button><button aria-pressed={modelGroup === "seedance"} onClick={() => setModelGroup("seedance")}><AudioLines size={18} color="#7bc7d0"/>Seedance</button><button aria-pressed={modelGroup === "templates"} onClick={() => setModelGroup("templates")}><Sparkles size={17}/>{t("Video templates")}</button></nav><div className={styles.modelChoices}>{modelGroup === "templates" ? [ ["Hotel Lobby", "/hotel-lobby-ai-video-generator#generator"], ["Flying Car", "/flying-car-ai-video-generator#create"], ["Ozil Goal", "/ozil-goal-generator#generator"] ].map(([name, href]) => <Link href={href} key={href}><b>{name}<ChevronRight size={14}/></b><p>{t("Open template")}</p></Link>) : <button onClick={() => setModelsOpen(false)}><b><AudioLines size={18}/>Seedance 2.5</b><p>{t("Create a video from text or one reference image.")}</p><div><span><Zap size={12}/>{cost}</span><span><Clock3 size={12}/>5s ~ 30s</span><span>480P</span><span>9:16</span></div></button>}</div></div>
    </Dialog.Content></Dialog.Portal></Dialog.Root>

    <Dialog.Root open={settingsOpen} onOpenChange={setSettingsOpen}><Dialog.Portal><Dialog.Overlay className={styles.overlay}/><Dialog.Content className={styles.settingsDialog} onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(settingsTrigger.current); }}><Dialog.Title>{t("Video settings")}</Dialog.Title><Dialog.Description className="sr-only">{t("Generation settings")}</Dialog.Description><Dialog.Close className={styles.close} aria-label={t("Close settings")}><X size={21}/></Dialog.Close><div className={styles.settingsFields}>{modelField}{referenceField("mobile-video-reference")}{aspectField}{durationField("mobile-video-duration")}{advancedField}{error && <p className={styles.error} role="alert">{t(error)}</p>}{notice && <p className={styles.settingNotice} role="status">{notice}</p>}</div></Dialog.Content></Dialog.Portal></Dialog.Root>

    <Dialog.Root open={!!preview} onOpenChange={open => { if (!open) setPreview(null); }}><Dialog.Portal><Dialog.Overlay className={styles.overlay}/><Dialog.Content className={styles.previewDialog} onCloseAutoFocus={event => { event.preventDefault(); if (focusPromptAfterPreview.current) { focusPromptAfterPreview.current = false; prompt.current?.focus(); } else restoreFocus(previewTrigger.current); }}><Dialog.Title>{t("Preview video")}</Dialog.Title><Dialog.Description>{t("These inspiration clips are examples, not a guarantee of model output.")}</Dialog.Description><Dialog.Close className={styles.close} aria-label={t("Close preview")}><X size={21}/></Dialog.Close>{preview && <><video src={preview.src} poster={preview.poster} controls autoPlay playsInline/><button type="button" disabled={locked} onClick={() => { creator.setPrompt(preview.prompt); creator.setError(""); focusPromptAfterPreview.current = true; setPreview(null); }}>{t("Use this prompt")}<ChevronRight size={17}/></button></>}</Dialog.Content></Dialog.Portal></Dialog.Root>
    {notice && !settingsOpen && <div className={styles.notice} role="status">{notice}<button aria-label={t("Close")} onClick={() => setNotice("")}><X size={16}/></button></div>}
  </div>;
}

function InspirationCard({ item, paused, onOpen }: { item: Inspiration; paused: boolean; onOpen: (trigger: HTMLButtonElement) => void }) {
  const t = useGenerationTranslations();
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (paused) video.current?.pause(); else void video.current?.play().catch(() => {}); }, [paused]);
  return <button type="button" className={styles.inspirationCard} onClick={event => onOpen(event.currentTarget)} aria-label={`${t("Preview video")}: ${item.title}`}><video ref={video} src={item.src} poster={item.poster} muted loop playsInline preload="metadata"/><span><Video size={13} fill="currentColor"/></span></button>;
}
