"use client";

import { useEffect, useRef } from "react";

/** Decorative previews load and play only while their card is on screen. */
export function ViewportVideo({ src, poster, paused = false }: { src: string; poster: string; paused?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const update = () => {
      if (visible && !paused && !document.hidden && !motion.matches) {
        video.muted = true;
        if (video.getAttribute("src") !== src) video.src = src;
        void video.play().catch(() => { /* Keep the poster when autoplay is unavailable. */ });
      } else video.pause();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.15;
      update();
    }, { threshold: [0, 0.15] });
    observer.observe(video);
    document.addEventListener("visibilitychange", update);
    motion.addEventListener("change", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      motion.removeEventListener("change", update);
      video.pause();
    };
  }, [src, paused]);
  return <video ref={ref} poster={poster} muted loop playsInline preload="none" aria-hidden="true"/>;
}
