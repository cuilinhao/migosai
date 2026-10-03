"use client";

import Link from "@/components/i18n/localized-link";
import { CreditCard, Music2, UserRound, WandSparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { useAuth } from "@/components/auth-provider";
import type { CreateSongRequest, GenerationResponse } from "@/lib/contracts";
import { readApi, useGeneration, useGenerationTranslations } from "./use-generation";

const models: { value: CreateSongRequest["model"]; label: string }[] = [
  { value: "v6", label: "Suno V6" }, { value: "v6-wild", label: "Suno V6 Wild" },
  { value: "v6-mini", label: "Suno V6 Mini" },
];

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" className="mi-switch-row" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}><span className={`mi-switch ${checked ? "mi-switch-on" : ""}`} aria-hidden="true" /><span>{label}</span></button>;
}

export function SongGenerator() {
  const t = useGenerationTranslations();
  const locale = useLocale();
  const { user, credits, loading: authLoading, openSignIn, refresh } = useAuth();
  const [model, setModel] = useState<CreateSongRequest["model"]>("v6");
  const [custom, setCustom] = useState(false);
  const [instrumental, setInstrumental] = useState(false);
  const [prompt, setPrompt] = useState("An energetic rap song about hustle and ambition, catchy hook, modern trap beat, confident male vocals");
  const [title, setTitle] = useState("");
  const [style, setStyle] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { generation, setGeneration, pollError } = useGeneration(null);
  const idempotency = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => { if (generation?.status === "completed" || generation?.status === "failed") void refresh(); }, [generation?.status, refresh]);

  const generate = async () => {
    if (busy) return;
    if (!user) { openSignIn(); return; }
    if (credits < 10) { setError("You need 10 credits to create a rap song."); return; }
    if (custom ? !title.trim() || !style.trim() || (!instrumental && !lyrics.trim()) : !prompt.trim()) {
      setError(custom ? "Complete the title, style, and lyrics fields to continue." : "Describe the song you want to create."); return;
    }
    const body: CreateSongRequest = { model, custom, instrumental, ...(custom ? { title: title.trim(), style: style.trim(), ...(!instrumental ? { lyrics: lyrics.trim() } : {}) } : { prompt: prompt.trim() }) };
    const fingerprint = JSON.stringify(body);
    if (idempotency.current?.fingerprint !== fingerprint) idempotency.current = { fingerprint, key: crypto.randomUUID() };
    setBusy(true); setError(""); setGeneration(null);
    try {
      const result = await readApi<GenerationResponse>(await fetch("/api/music", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotency.current.key }, body: fingerprint }));
      setGeneration(result); idempotency.current = null; await refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not create the song."); }
    finally { setBusy(false); }
  };

  return <div className="mi-generator-grid mi-song-grid">
    <div className="mi-song-form mi-panel">
      <h2>{t('AI Rap Song Generator')}</h2>
      <div className="mi-song-toolbar"><Switch checked={custom} onChange={setCustom} label={t("Custom Mode")} /><label className="mi-model-label">{t("Model")}<select value={model} onChange={(event) => setModel(event.target.value as CreateSongRequest["model"])}>{models.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>
      {custom ? <>
        <label className="mi-field-label" htmlFor="mi-song-title">{t('Title')}</label><input id="mi-song-title" className="mi-text-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('Midnight Hustle')} />
        <label className="mi-field-label" htmlFor="mi-song-style">{t('Style of Music')}</label><textarea id="mi-song-style" className="mi-text-area mi-style-area" maxLength={1000} value={style} onChange={(event) => setStyle(event.target.value)} placeholder={t('rap, hip-hop, trap, boom bap, hard drums, punchy bass')} /><span className="mi-character-count">{style.length}/1000</span>
      </> : <><label className="mi-field-label" htmlFor="mi-song-prompt">{t('Prompt')}</label><textarea id="mi-song-prompt" className="mi-text-area" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={t('Describe your song, mood, and sound')} /></>}
      <Switch checked={instrumental} onChange={setInstrumental} label={t("Instrumental")} />
      {custom && !instrumental && <><label className="mi-field-label" htmlFor="mi-song-lyrics">{t('Lyrics')}</label><textarea id="mi-song-lyrics" className="mi-text-area mi-lyrics-area" value={lyrics} onChange={(event) => setLyrics(event.target.value)} placeholder={t('Paste your rap lyrics with [Verse], [Chorus], and [Bridge] tags for the best result')} /></>}
      <button type="button" className="mi-primary-button mi-generate-button" disabled={busy || authLoading} onClick={generate}>{user ? <WandSparkles size={17} /> : <UserRound size={17} />}{t(busy ? "Creating rap song…" : authLoading ? "Checking account…" : user ? "Generate Rap Song" : "Sign In to Generate Rap")}</button>
      <div className="mi-credit-line"><span>{t("10 credits cost, {credits} credits remaining", { credits: credits.toLocaleString(locale) })}</span><Link href="/pricing" className="mi-buy-inline"><CreditCard size={15} /> {t("Buy Credits")}</Link></div>
      {error && <p className="mi-error" role="alert">{t(error)} {credits < 10 && user ? <Link href="/pricing">{t('Buy Credits')}</Link> : null}</p>}
      {generation && <div className="mi-generation-status" role="status">{generation.status === "completed" ? t("Your rap song is ready.") : generation.status === "failed" || generation.status === "cancelled" ? t(generation.error ?? "Song generation could not be completed.") : t("{status}… {progress}%", { status: t(generation.status), progress: generation.progress.toLocaleString(locale) })}</div>}
      {pollError && <p className="mi-error" role="alert">{t(pollError)}</p>}
    </div>
    <div className="mi-song-result mi-panel"><h2><Music2 size={18} /> {t("Generated Rap Song")}</h2>{generation?.status === "completed" && generation.audioUrls?.length ? <div className="mi-audio-results">{generation.audioUrls.map((url, index) => <div className="mi-audio-result" key={`${url}-${index}`}><strong>{t("Track {number}", { number: index + 1 })}</strong><audio src={url} controls preload="none" /><a href={url} download={`migos-ai-rap-${index + 1}.mp3`}>{t('Download MP3')}</a></div>)}</div> : <div className="mi-song-empty"><Music2 size={31} /><span>{t(generation && !["failed", "cancelled"].includes(generation.status) ? "Generating your song…" : "No Song Generated")}</span></div>}</div>
  </div>;
}
