"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, CarFront, ChevronDown, Goal, Music2 } from "lucide-react";
import Link from "./i18n/localized-link";
import { useTranslations } from "./i18n/locale-provider";
import "./generator-menu.css";

// The newest generator leads the rotating desktop pill and mobile spotlight.
const generators = [
  { href: "/flying-car-ai-video-generator", label: "Flying Car AI Generator", short: "Flying Car AI", blurb: "Turn your scene or photo into a flying car video", thumb: "/flyingcar/real/overpass-launch.jpg", Icon: CarFront, isNew: true },
  { href: "/ozil-goal-generator", label: "Ozil Goal Generator", short: "Ozil Goal", blurb: "Turn one photo into the viral Ozil goal video", thumb: "/ozil-goal/samples/ai-shot1.jpg", Icon: Goal, isNew: true },
  { href: "/ai-rap-song-generator", label: "AI Rap Song Generator", short: "AI Rap Song", blurb: "Make a full rap song from a prompt or your lyrics", thumb: "/posters/lobbyduo/seedance-2-corgi-rap.jpg", Icon: Music2, isNew: false },
];
const ROTATE_MS = 3200;
const isUnder = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}

const NewBadge = () => <b className="generator-new-badge">NEW</b>;

export function GeneratorMenu({ pathname, mobile = false, onNavigate }: { pathname: string; mobile?: boolean; onNavigate?: () => void }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [ticker, setTicker] = useState({ shown: 0, previous: -1 });
  const reducedMotion = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const focusOnOpen = useRef<"first" | "last" | null>(null);
  const panelId = useId();
  const currentIndex = generators.findIndex(({ href }) => isUnder(pathname, href));
  const active = currentIndex >= 0;
  // On a generator's own pages the trigger names that generator; elsewhere the desktop pill rotates through all of them.
  const rotating = !active && !mobile && !open && !hovered && !focused && !reducedMotion;
  const shown = active ? currentIndex : mobile ? 0 : ticker.shown;
  const leaving = active || mobile ? -1 : ticker.previous;
  const links = () => Array.from(root.current?.querySelectorAll<HTMLAnchorElement>("[data-generator-link]") ?? []);

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(() => setTicker(({ shown }) => ({ shown: (shown + 1) % generators.length, previous: shown })), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [rotating]);

  useEffect(() => {
    if (!open) return;
    const target = focusOnOpen.current;
    if (target) {
      const items = links();
      items[target === "first" ? 0 : items.length - 1]?.focus();
      focusOnOpen.current = null;
    }
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  useEffect(() => { setOpen(false); }, [pathname]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus();
      return;
    }
    if (event.target === trigger.current && ["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      const target = event.key === "ArrowDown" ? "first" : "last";
      if (open) { const items = links(); items[target === "first" ? 0 : items.length - 1]?.focus(); }
      else { focusOnOpen.current = target; setOpen(true); }
      return;
    }
    if (!open || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = links(), index = items.indexOf(event.target as HTMLAnchorElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };

  return <div className={`generator-menu${mobile ? " generator-menu-mobile" : ""}`} ref={root} onKeyDown={onKeyDown}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={event => {
      if (event.currentTarget.contains(event.relatedTarget)) return;
      setFocused(false); setOpen(false);
    }}>
    <button ref={trigger} className={`generator-menu-trigger${active ? " active" : ""}`} type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
      <span className={`generator-menu-ticker${ticker.previous >= 0 ? " has-rotated" : ""}`} aria-hidden="true">
        {generators.map(({ label, Icon, isNew }, index) => <span key={label} className={`generator-menu-slide${index === shown ? " is-shown" : index === leaving ? " is-leaving" : ""}`}>
          <Icon size={mobile ? 17 : 15} strokeWidth={1.9}/><span>{t(label)}</span>{isNew && <NewBadge/>}
        </span>)}
      </span>
      <span className="sr-only">{active ? t(generators[currentIndex].label) : generators.map(({ label }) => t(label)).join(" / ")}</span>
      <ChevronDown className="generator-menu-chevron" size={14} aria-hidden="true"/>
    </button>
    <div id={panelId} className="generator-menu-panel" hidden={!open}>
      {generators.map(({ href, label, blurb, thumb, isNew }) => {
        const selected = isUnder(pathname, href);
        return <Link data-generator-link className={selected ? "active" : undefined} aria-current={selected ? "page" : undefined} href={href} key={href} onClick={() => { setOpen(false); onNavigate?.(); }}>
          <img className="generator-menu-thumb" src={thumb} alt="" width={44} height={56} loading="lazy" decoding="async"/>
          <span className="generator-menu-copy">
            <span className="generator-menu-title">{t(label)}{isNew && <NewBadge/>}</span>
            <span className="generator-menu-blurb">{t(blurb)}</span>
          </span>
        </Link>;
      })}
    </div>
  </div>;
}

// Lives in the header only while the desktop navigation is collapsed, so narrow screens still see the newest generator.
export function GeneratorSpotlight({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const t = useTranslations();
  const featured = generators[0];
  if (isUnder(pathname, featured.href)) return null;
  return <Link className="generator-spotlight" href={featured.href} onClick={onNavigate}>
    <featured.Icon size={15} strokeWidth={1.9} aria-hidden="true"/>
    <span className="generator-spotlight-label">{t(featured.label)}</span>
    <span className="generator-spotlight-short" aria-hidden="true">{t(featured.short)}</span>
    <NewBadge/>
    <ArrowRight className="generator-spotlight-arrow" size={14} aria-hidden="true"/>
  </Link>;
}
