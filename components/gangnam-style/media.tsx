'use client';

import { useEffect, useRef, useState } from 'react';

export const gangnamExamples = [
  { title: 'Gangnam Style trio', description: 'Three friends. One unforgettable street scene.', poster: '/gangnam-style/photo-trio-seoul.jpg', video: '/gangnam-style/photo-trio-seoul-with-audio.mp4' },
  { title: 'Studio solo', description: 'AI-generated studio dance. A solo performance.', poster: '/gangnam-style/seedance-studio.jpg', video: '/gangnam-style/seedance-studio.mp4' },
  { title: 'Friends in motion', description: 'AI-generated group dance in a golden-hour square.', poster: '/gangnam-style/seedance-square.jpg', video: '/gangnam-style/seedance-square.mp4' },
];
const exampleEvent = 'gangnam-style:example';

export function GangnamHeroMedia() {
  const [selected, setSelected] = useState(0);
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const change = (event: Event) => {
      const index = (event as CustomEvent<number>).detail;
      if (Number.isInteger(index) && gangnamExamples[index]) { setSelected(index); setFailed(false); }
    };
    window.addEventListener(exampleEvent, change);
    return () => window.removeEventListener(exampleEvent, change);
  }, []);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !reduced.matches) void element.play().catch(() => {});
      else element.pause();
    }, { threshold: 0.2 });
    observer.observe(element);
    const onMotion = () => { if (reduced.matches) element.pause(); };
    reduced.addEventListener('change', onMotion);
    return () => { observer.disconnect(); reduced.removeEventListener('change', onMotion); };
  }, [selected]);
  const current = gangnamExamples[selected];
  return <div className="gns-hero-media" id="gangnam-player">
    <video key={current.video} ref={video} src={current.video} poster={current.poster} preload="metadata" loop muted={muted} playsInline controls
      aria-label={`${current.title} AI video example`} onVolumeChange={event => setMuted(event.currentTarget.muted)} onError={() => setFailed(true)}/>
    <button type="button" className="gns-sound" aria-pressed={!muted} onClick={() => { setMuted(!muted); void video.current?.play().catch(() => {}); }}>{muted ? 'Sound off ◉' : 'Sound on ◉'}</button>
    <span className="gns-video-tag">YOUR NEXT GROUP CHAT MOMENT ↗</span>
    {failed && <p role="alert">This sample could not load. <a href={current.video}>Open the video</a></p>}
  </div>;
}

export function GangnamExamples() {
  const [selected, setSelected] = useState(0);
  return <div className="gns-cards">{gangnamExamples.map((example, index) => <button key={example.video} type="button"
    className={`gns-example${selected === index ? ' gns-selected' : ''}`} aria-pressed={selected === index}
    aria-label={`Play ${example.title}`} onClick={() => {
      setSelected(index); window.dispatchEvent(new CustomEvent(exampleEvent, { detail: index }));
      document.getElementById('gangnam-player')?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }}>
    <img src={example.poster} alt={`${example.title} AI video example`} loading="lazy" width="640" height="640"/>
    <span>0{index + 1} / {example.title} ↗</span><p>{example.description}</p>
  </button>)}</div>;
}
