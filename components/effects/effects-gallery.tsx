"use client";

import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, ChevronLeft, ChevronRight, LoaderCircle, Play, RefreshCw, Sparkles, X } from "lucide-react";
import { useTranslations } from "@/components/i18n/locale-provider";
import { adjacentEffectIndex, videoEffects, type VideoEffect } from "@/content/effects";
import styles from "./effects-gallery.module.css";

export function EffectsGallery() {
  const t = useTranslations();
  const [selected, setSelected] = useState<number | null>(null);
  const [activePreview, setActivePreview] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(true);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const selectedEffect = selected === null ? null : videoEffects[selected];

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const move = (direction: -1 | 1) => setSelected(current => current === null ? null : adjacentEffectIndex(current, direction, videoEffects.length));

  return <section className={styles.galleryPage} aria-labelledby="effects-heading">
    <h1 id="effects-heading" className={styles.heading}>{t("Effects")}</h1>
    <div className={styles.grid}>
      {videoEffects.map((item, index) => <EffectCard
        key={item.id}
        effect={item}
        active={activePreview === item.id && !reducedMotion && selected === null}
        onActivate={() => setActivePreview(item.id)}
        onDeactivate={() => setActivePreview(current => current === item.id ? null : current)}
        onOpen={button => { trigger.current = button; setActivePreview(null); setSelected(index); }}
      />)}
    </div>
    <Dialog.Root open={selected !== null} onOpenChange={open => { if (!open) setSelected(null); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay}/>
        <Dialog.Content className={styles.dialog}
          onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}
          onKeyDown={event => {
            // Native video controls keep their seek shortcuts.
            if ((event.target as HTMLElement).closest("video")) return;
            if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
            if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
          }}>
          <div className={styles.dialogHeading}>
            <div><Dialog.Title>{selectedEffect?.title}</Dialog.Title><Dialog.Description>{t("Video effect preview")}</Dialog.Description></div>
            <Dialog.Close className={styles.close} aria-label={t("Close")}><X size={21}/></Dialog.Close>
          </div>
          {selectedEffect && <EffectPlayer key={selectedEffect.id} effect={selectedEffect}/>}
          <div className={styles.dialogFooter}>
            <a href={selectedEffect?.sourcePage} target="_blank" rel="noreferrer">{t("View original")}<ArrowUpRight size={14}/></a>
            <div className={styles.navigation}>
              <button type="button" onClick={() => move(-1)} aria-label={t("Previous video")}><ChevronLeft size={20}/></button>
              <span aria-live="polite">{t("{current} of {total}", { current: (selected ?? 0) + 1, total: videoEffects.length })}</span>
              <button type="button" onClick={() => move(1)} aria-label={t("Next video")}><ChevronRight size={20}/></button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </section>;
}

function EffectCard({ effect, active, onActivate, onDeactivate, onOpen }: {
  effect: VideoEffect;
  active: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onOpen: (button: HTMLButtonElement) => void;
}) {
  const t = useTranslations();
  const [previewFailed, setPreviewFailed] = useState(false);
  return <button type="button" className={styles.card} aria-label={`${t("Play video")}: ${effect.title}`}
    onPointerEnter={event => { if (event.pointerType !== "touch") onActivate(); }} onPointerLeave={onDeactivate}
    onFocus={onActivate} onBlur={onDeactivate}
    onClick={event => onOpen(event.currentTarget)}>
    <span className={styles.media}>
      <img src={effect.poster} alt="" loading="lazy" decoding="async"/>
      {active && !previewFailed && <video src={effect.video} poster={effect.poster} autoPlay muted loop playsInline preload="metadata" onError={() => setPreviewFailed(true)} aria-hidden="true"/>}
      {effect.isNew && <span className={styles.newBadge}><Sparkles size={11} fill="currentColor"/>NEW</span>}
      <span className={styles.play}><Play size={20} fill="currentColor"/></span>
    </span>
    <span className={styles.title}>{effect.title}</span>
    {effect.description && <span className={styles.description}>{effect.description}</span>}
  </button>;
}

function EffectPlayer({ effect }: { effect: VideoEffect }) {
  const t = useTranslations();
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  return <div className={styles.player}>
    <video key={attempt} src={effect.video} poster={effect.poster} autoPlay controls playsInline preload="auto"
      aria-label={`${t("Play video")}: ${effect.title}`}
      onCanPlay={() => setLoading(false)} onError={() => { setFailed(true); setLoading(false); }}/>
    {loading && <span className={styles.loading} role="status"><LoaderCircle size={22}/><span className="sr-only">{t("Loading video…")}</span></span>}
    {failed && <div className={styles.failure}><p role="alert">{t("Could not load this video.")}</p><button type="button" onClick={() => { setFailed(false); setLoading(true); setAttempt(value => value + 1); }}><RefreshCw size={16}/>{t("Retry video")}</button></div>}
  </div>;
}
