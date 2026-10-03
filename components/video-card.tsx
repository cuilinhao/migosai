"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "@/components/i18n/locale-provider";

export function VideoCard({ src, poster, label, portrait = false, previewOnVisible = false }: { src: string; poster?: string; label?: string; portrait?: boolean; previewOnVisible?: boolean }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const preview = previewRef.current;
    if (!previewOnVisible || !preview || !window.IntersectionObserver) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const updatePlayback = () => {
      if (visible && !open && !document.hidden && !motion.matches) {
        if (!preview.getAttribute("src")) preview.src = src;
        void preview.play().catch(() => { /* The poster remains available when autoplay is blocked. */ });
      } else preview.pause();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      updatePlayback();
    }, { threshold: 0.2 });
    observer.observe(preview);
    motion.addEventListener("change", updatePlayback);
    document.addEventListener("visibilitychange", updatePlayback);
    return () => {
      observer.disconnect();
      preview.pause();
      motion.removeEventListener("change", updatePlayback);
      document.removeEventListener("visibilitychange", updatePlayback);
    };
  }, [src, open, previewOnVisible]);
  return <Dialog.Root open={open} onOpenChange={(next) => {
    if (!next && videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
    setOpen(next);
  }}>
    <Dialog.Trigger className={`mi-video-card ${portrait ? "mi-video-card-portrait" : ""}`} aria-label={label ? t("Play video: {label}", { label: t(label) }) : t("Play video")}>
      {previewOnVisible ? <video ref={previewRef} poster={poster} muted loop playsInline preload="none" aria-hidden="true" /> : poster ? <img src={poster} alt="" loading="lazy" /> : <video src={src} muted playsInline preload="metadata" aria-hidden="true" />}
      <span className="mi-video-play" aria-hidden="true"><Play size={25} fill="currentColor" /></span>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="mi-dialog-overlay" />
      <Dialog.Content className="mi-video-dialog">
        <Dialog.Title className="mi-sr-only">{t("Showcase video")}</Dialog.Title>
        <video ref={videoRef} src={src} poster={poster} controls autoPlay playsInline preload="metadata" aria-label={t(label ?? "Showcase video")} />
        <Dialog.Close className="mi-dialog-close" aria-label={t("Close")}><X size={18} /></Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
