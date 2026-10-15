'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Volume2, VolumeX, Pause, Play } from 'lucide-react';
export const beats = [
  { start: 0, end: 3, frame: '/ozil-goal/samples/ai-shot1.jpg', title: 'The flying keeper', alt: 'Beat 1: the goalkeeper dives past a woman in a pink blazer on the ball' },
  { start: 3, end: 8.5, frame: '/ozil-goal/samples/ai-shot2.jpg', title: 'The Ozil bounce', alt: 'Beat 2: the ball bounces off her chest' },
  { start: 8.5, end: 15, frame: '/ozil-goal/samples/ai-shot3.jpg', title: 'The slide and the finish', alt: 'Beat 3: a defender slides in and misses' },
];
function useRespectfulPlayback(video: RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { const element = video.current; if (!element) return; if (preference.matches) element.pause(); else void element.play().catch(() => {}); };
    update(); preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, [video]);
}
export function GuideSampleVideo() {
  const video = useRef<HTMLVideoElement>(null); const [paused, setPaused] = useState(true);
  useRespectfulPlayback(video);
  return <><video ref={video} src="/ozil-goal/samples/ozil-goal-demo-ai.mp4" poster={beats[0].frame} muted loop playsInline preload="metadata" aria-label="Original Ozil Goal reference sample" onPlay={() => setPaused(false)} onPause={() => setPaused(true)} className="absolute inset-0 size-full object-cover" /><button type="button" aria-label={paused ? 'Play reference sample' : 'Pause reference sample'} onClick={() => { const element = video.current; if (element) { if (element.paused) void element.play().catch(() => {}); else element.pause(); } }} className="og-sample-pause">{paused ? <Play size={16} /> : <Pause size={16} />}</button></>;
}
export function SampleVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(true);
  useRespectfulPlayback(video);
  function seek(index: number) { const element = video.current; if (!element || !beats[index]) return; element.currentTime = beats[index].start; setActive(index); void element.play().catch(() => {}); }
  function sound() { const element = video.current; if (!element) return; element.muted = !element.muted; setMuted(element.muted); if (!element.muted) void element.play().catch(() => {}); }
  useEffect(() => { const listener = (event: Event) => seek((event as CustomEvent<number>).detail); window.addEventListener('og:seek', listener); return () => window.removeEventListener('og:seek', listener); }, []);
  return <figure><div className="og-slot"><video ref={video} src="/ozil-goal/samples/ozil-goal-demo-ai.mp4" poster={beats[0].frame} muted loop playsInline preload="metadata" aria-label="Original Ozil Goal reference sample" onClick={sound} onPlay={() => setPaused(false)} onPause={() => setPaused(true)} onTimeUpdate={event => { const time = event.currentTarget.currentTime; setActive(time >= 8.5 ? 2 : time >= 3 ? 1 : 0); }} className="absolute inset-0 size-full cursor-pointer object-cover" /><div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent" /><span className="og-bug og-mono absolute top-3 left-3"><span>Live</span><span>Reference</span></span><button type="button" aria-label={paused ? 'Play sample video' : 'Pause sample video'} onClick={() => { const element = video.current; if (element) { if (element.paused) void element.play().catch(() => {}); else element.pause(); } }} className="og-sample-pause">{paused ? <Play size={16} /> : <Pause size={16} />}</button><div className="absolute inset-x-2.5 bottom-2.5 flex flex-col items-end gap-2"><button type="button" onClick={sound} aria-label={muted ? 'Turn sound on' : 'Mute'} aria-pressed={!muted} className="flex size-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70">{muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}</button><div className="flex w-full gap-1">{beats.map((beat, index) => <button type="button" key={beat.start} onClick={() => seek(index)} aria-label={`Play beat ${index + 1}: ${beat.title}`} aria-pressed={active === index} className={`og-mono h-7 flex-1 rounded-md text-[11px] font-bold backdrop-blur-md transition-colors ${active === index ? 'bg-[var(--og-flash)] text-[var(--og-ink)]' : 'bg-black/50 text-white/85 hover:bg-black/70'}`}>{beat.start}s</button>)}</div></div></div><figcaption className="mt-2 text-[12.5px] leading-snug text-[var(--og-faint)]">Original Ozil Goal reference sample, made from an AI-generated portrait. Your new video uses your own photo with MiniMax H3; results vary.</figcaption></figure>;
}
