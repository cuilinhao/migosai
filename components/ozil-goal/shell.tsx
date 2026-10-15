'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from '@/components/i18n/localized-link';
export function OzilShell({ children }: { children: ReactNode }) {
  const [sticky, setSticky] = useState(false); const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => { const generator = wrapper.current?.querySelector('#generator'); let visible = !!generator; const update = () => setSticky(window.scrollY > 700 && !visible); const observer = generator ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }) : null; if (generator) observer?.observe(generator); window.addEventListener('scroll', update, { passive: true }); update(); return () => { observer?.disconnect(); window.removeEventListener('scroll', update); }; }, []);
  return <div className="ozil-page og" ref={wrapper} onClick={event => { const target = (event.target as Element).closest('[data-og-seek]'); if (target) { window.dispatchEvent(new CustomEvent('og:seek', { detail: Number(target.getAttribute('data-og-seek')) })); wrapper.current?.querySelector('.og-slot')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' }); } }}>
    {children}
    <div data-show={sticky} inert={!sticky} className="og-sticky fixed inset-x-0 bottom-0 z-30 border-t border-[var(--og-line-strong)] bg-[color-mix(in_oklab,var(--og-bg-deep)_92%,transparent)] px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"><Link href="/ozil-goal-generator#generator" className="og-cta og-display inline-flex h-[52px] w-full items-center justify-center rounded-2xl text-[20px]">Make my video</Link></div>
  </div>;
}
