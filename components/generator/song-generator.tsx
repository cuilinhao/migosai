"use client";

import Link from "@/components/i18n/localized-link";
import { CreditCard, Music2, UserRound, WandSparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { useAuth } from "@/components/auth-provider";
import type { CreateSongRequest, GenerationResponse } from "@/lib/contracts";
import { readApi, useGeneration, useGenerationTranslations } from "./use-generation";
import { getResumableSong, SongSubmission, SongSubmissionRejected } from "./song-submission";
import { createSongDraft, songDraftForOwner, type OwnedSongDraft, type SongDraft } from "./song-draft";

const models: { value: CreateSongRequest["model"]; label: string }[] = [
  { value: "v6", label: "Suno V6" }, { value: "v6-wild", label: "Suno V6 Wild" },
  { value: "v6-mini", label: "Suno V6 Mini" },
];

function Switch({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" className="mi-switch-row" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}><span className={`mi-switch ${checked ? "mi-switch-on" : ""}`} aria-hidden="true" /><span>{label}</span></button>;
}

export function SongGenerator() {
  const {user}=useAuth();
  const owner=user?.id??null;
  const [savedDraft,setSavedDraft]=useState<OwnedSongDraft>(()=>({owner,draft:createSongDraft()}));
  const currentDraft=songDraftForOwner(savedDraft,owner);
  if(currentDraft!==savedDraft)setSavedDraft(currentDraft);
  const updateDraft=(changes:Partial<SongDraft>)=>setSavedDraft(previous=>previous.owner===owner?{owner,draft:{...previous.draft,...changes}}:previous);
  return <SongWorkspace key={owner ?? "anonymous"} owner={owner} draft={currentDraft.draft} updateDraft={updateDraft}/>;
}

function SongWorkspace({owner,draft,updateDraft}:{owner:string|null;draft:SongDraft;updateDraft:(changes:Partial<SongDraft>)=>void}) {
  const t = useGenerationTranslations();
  const locale = useLocale();
  const { user, credits, loading: authLoading, openSignIn, refresh } = useAuth();
  const {model,custom,instrumental,prompt,title,style,lyrics}=draft;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { generation, setGeneration, pollError } = useGeneration(null);
  const submission = useRef(new SongSubmission());
  const submitting = useRef(false);
  const mounted = useRef(true);
  const requestAbort = useRef<AbortController|null>(null);
  const [uncertain,setUncertain] = useState(false);
  const [restoring,setRestoring] = useState(!!owner&&!generation);
  const active = !!generation&&!['completed','failed','cancelled'].includes(generation.status);
  const locked = busy||active||uncertain||restoring;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;requestAbort.current?.abort();};},[]);
  useEffect(()=>{
    if(!owner||generation)return;
    const abort=new AbortController();
    let current=true;
    setRestoring(true);
    void (async()=>{
      try {
        const history=await readApi<{generations:(GenerationResponse&{kind:string})[]}>(await fetch('/api/generations',{cache:'no-store',signal:abort.signal}));
        const saved=getResumableSong(history.generations);
        if(current&&saved&&!submitting.current)setGeneration(saved);
      } catch { /* A history lookup never submits a fresh generation. */ }
      finally { if(current)setRestoring(false); }
    })();
    return()=>{current=false;abort.abort();};
  },[owner,setGeneration]);
  useEffect(() => { if (generation?.status === "completed" || generation?.status === "failed") void refresh(); }, [generation?.status, refresh]);

  const generate = async () => {
    if (submitting.current || active || restoring) return;
    if (!user) { openSignIn(); return; }
    if (!submission.current.pending() && credits < 10) { setError("You need 10 credits to create a rap song."); return; }
    if (!submission.current.pending() && (custom ? !title.trim() || !style.trim() || (!instrumental && !lyrics.trim()) : !prompt.trim())) {
      setError(custom ? "Complete the title, style, and lyrics fields to continue." : "Describe the song you want to create."); return;
    }
    const body: CreateSongRequest = { model, custom, instrumental, ...(custom ? { title: title.trim(), style: style.trim(), ...(!instrumental ? { lyrics: lyrics.trim() } : {}) } : { prompt: prompt.trim() }) };
    const abort=new AbortController();requestAbort.current=abort;
    submitting.current=true;setBusy(true);setError("");
    try {
      const pending=submission.current.submit(body,async(request,key)=>{
        const response=await fetch("/api/music",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":key},body:JSON.stringify(request),signal:abort.signal});
        try{return await readApi<GenerationResponse>(response);}
        catch(cause){if([400,402,413,422].includes(response.status))throw new SongSubmissionRejected((cause as Error).message);throw cause;}
      });
      setUncertain(submission.current.pending());
      const result=await pending;
      if(!mounted.current)return;
      setGeneration(result);setUncertain(false);await refresh();
    } catch(failure){if(mounted.current){setUncertain(submission.current.pending());setError(failure instanceof Error?failure.message:"Could not create the song.");}}
    finally{if(mounted.current)setBusy(false);submitting.current=false;}

  };

  return <div className="mi-generator-grid mi-song-grid">
    <div className="mi-song-form mi-panel">
      <h2>{t('AI Rap Song Generator')}</h2>
      <div className="mi-song-toolbar"><Switch checked={custom} disabled={locked} onChange={custom=>updateDraft({custom})} label={t("Custom Mode")} /><label className="mi-model-label">{t("Model")}<select disabled={locked} value={model} onChange={(event) => updateDraft({model:event.target.value as CreateSongRequest["model"]})}>{models.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>
      {custom ? <>
        <label className="mi-field-label" htmlFor="mi-song-title">{t('Title')}</label><input id="mi-song-title" className="mi-text-input" disabled={locked} maxLength={80} value={title} onChange={(event) => updateDraft({title:event.target.value})} placeholder={t('Midnight Hustle')} />
        <label className="mi-field-label" htmlFor="mi-song-style">{t('Style of Music')}</label><textarea id="mi-song-style" className="mi-text-area mi-style-area" maxLength={1000} disabled={locked} value={style} onChange={(event) => updateDraft({style:event.target.value})} placeholder={t('rap, hip-hop, trap, boom bap, hard drums, punchy bass')} /><span className="mi-character-count">{style.length}/1000</span>
      </> : <><label className="mi-field-label" htmlFor="mi-song-prompt">{t('Prompt')}</label><textarea id="mi-song-prompt" className="mi-text-area" disabled={locked} maxLength={3000} value={prompt} onChange={(event) => updateDraft({prompt:event.target.value})} placeholder={t('Describe your song, mood, and sound')} /></>}
      <Switch checked={instrumental} disabled={locked} onChange={instrumental=>updateDraft({instrumental})} label={t("Instrumental")} />
      {custom && !instrumental && <><label className="mi-field-label" htmlFor="mi-song-lyrics">{t('Lyrics')}</label><textarea id="mi-song-lyrics" className="mi-text-area mi-lyrics-area" disabled={locked} maxLength={5000} value={lyrics} onChange={(event) => updateDraft({lyrics:event.target.value})} placeholder={t('Paste your rap lyrics with [Verse], [Chorus], and [Bridge] tags for the best result')} /></>}
      <button type="button" className="mi-primary-button mi-generate-button" disabled={busy || active || restoring || authLoading} onClick={generate}>{user ? <WandSparkles size={17} /> : <UserRound size={17} />}{t(restoring ? "Loading…" : active ? "Generating your song…" : busy ? "Creating rap song…" : uncertain ? "Resume saved request" : authLoading ? "Checking account…" : user ? "Generate Rap Song" : "Sign In to Generate Rap")}</button>
      <div className="mi-credit-line"><span>{t("10 credits cost, {credits} credits remaining", { credits: credits.toLocaleString(locale) })}</span><Link href="/pricing" className="mi-buy-inline"><CreditCard size={15} /> {t("Buy Credits")}</Link></div>
      {uncertain && !busy && <p className="mi-generation-status" role="status">{t("Your request is saved. Resume it safely with the same credits and settings.")}</p>}
      {error && <p className="mi-error" role="alert">{t(error)} {credits < 10 && user ? <Link href="/pricing">{t('Buy Credits')}</Link> : null}</p>}
      {generation && <div className="mi-generation-status" role="status">{generation.status === "completed" ? t("Your rap song is ready.") : generation.status === "failed" || generation.status === "cancelled" ? t(generation.error ?? "Song generation could not be completed.") : t("{status}… {progress}%", { status: t(generation.status), progress: generation.progress.toLocaleString(locale) })}</div>}
      {active && generation?.error && <p className="mi-error" role="alert">{t(generation.error)} <Link href="/contact">{t("Contact support")}</Link></p>}
      {pollError && <p className="mi-error" role="alert">{t(pollError)}</p>}
    </div>
    <div className="mi-song-result mi-panel"><h2><Music2 size={18} /> {t("Generated Rap Song")}</h2>{generation?.status === "completed" && generation.audioUrls?.length ? <div className="mi-audio-results">{generation.audioUrls.map((url, index) => <div className="mi-audio-result" key={`${url}-${index}`}><strong>{t("Track {number}", { number: index + 1 })}</strong><audio src={url} controls preload="none" /><a href={url} download={`migosai-rap-${index + 1}.mp3`}>{t('Download MP3')}</a></div>)}</div> : <div className="mi-song-empty"><Music2 size={31} /><span>{t(generation && !["failed", "cancelled"].includes(generation.status) ? "Generating your song…" : "No Song Generated")}</span></div>}</div>
  </div>;
}
