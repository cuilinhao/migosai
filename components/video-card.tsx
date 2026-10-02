"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Play, X } from "lucide-react";
import { useRef, useState } from "react";

export function VideoCard({ src, poster, label, portrait = false }: { src: string; poster?: string; label?: string; portrait?: boolean }) {
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  return <Dialog.Root open={open} onOpenChange={(next) => {
    if (!next && videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
    setOpen(next);
  }}>
    <Dialog.Trigger className={`mi-video-card ${portrait ? "mi-video-card-portrait" : ""}`} aria-label={`Play video${label ? `: ${label}` : ""}`}>
      {poster ? <img src={poster} alt="" loading="lazy" /> : <video src={src} muted playsInline preload="metadata" aria-hidden="true" />}
      <span className="mi-video-play" aria-hidden="true"><Play size={25} fill="currentColor" /></span>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="mi-dialog-overlay" />
      <Dialog.Content className="mi-video-dialog">
        <Dialog.Title className="mi-sr-only">Showcase video</Dialog.Title>
        <video ref={videoRef} src={src} poster={poster} controls autoPlay playsInline preload="metadata" aria-label={label ?? "Showcase video"} />
        <Dialog.Close className="mi-dialog-close" aria-label="Close"><X size={18} /></Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
