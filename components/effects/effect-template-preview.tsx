"use client";

import { useState } from "react";
import { Film, RefreshCw } from "lucide-react";
import { useTranslations } from "@/components/i18n/locale-provider";
import type { VideoEffect } from "@/content/effects";
import styles from "./effect-template-preview.module.css";

export function EffectTemplatePreview({ effect }: { effect: VideoEffect }) {
  const t = useTranslations();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return <div className={styles.preview}>
    <div className={styles.heading}><Film size={18}/><h2>{t("Effect preview")}</h2></div>
    <video key={attempt} src={effect.video} poster={effect.poster} controls playsInline preload="metadata" aria-label={`${t("Preview video")}: ${effect.title}`} onError={() => setFailed(true)}/>
    {failed && <div className={styles.error}><p role="alert">{t("Could not load this video.")}</p><button type="button" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}><RefreshCw size={14}/>{t("Retry video")}</button></div>}
    <div className={styles.details}><span>Seedance 2.5</span><span>480P</span><span>{t("Silent")}</span></div>
    <p>{t("Your version is generated from your photo and the prompt. The preview is a reference.")}</p>
  </div>;
}
