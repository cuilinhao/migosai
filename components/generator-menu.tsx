"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Goal, Music2 } from "lucide-react";
import Link from "./i18n/localized-link";
import { useTranslations } from "./i18n/locale-provider";
import "./generator-menu.css";

const generators = [
  { href: "/ai-rap-song-generator", label: "AI Rap Song Generator", Icon: Music2 },
  { href: "/ozil-goal-generator", label: "Ozil Goal Generator", Icon: Goal },
];

export function GeneratorMenu({ pathname, mobile = false, onNavigate }: { pathname: string; mobile?: boolean; onNavigate?: () => void }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const focusOnOpen = useRef<"first" | "last" | null>(null);
  const panelId = useId();
  const current = generators.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`));
  const active = !!current;
  // On a generator's own pages the trigger names that generator, so the header shows where you are.
  const { label: triggerLabel, Icon: TriggerIcon } = current ?? generators[0];
  const links = () => Array.from(root.current?.querySelectorAll<HTMLAnchorElement>("[data-generator-link]") ?? []);

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

  return <div className={`generator-menu${mobile ? " generator-menu-mobile" : ""}`} ref={root} onKeyDown={onKeyDown} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} className={`generator-menu-trigger${active ? " active" : ""}`} type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
      <TriggerIcon size={mobile ? 17 : 15} strokeWidth={1.8}/><span>{t(triggerLabel)}</span><ChevronDown className="generator-menu-chevron" size={14} aria-hidden="true"/>
    </button>
    <div id={panelId} className="generator-menu-panel" hidden={!open}>
      {generators.map(({ href, label, Icon }) => {
        const selected = pathname === href || pathname.startsWith(`${href}/`);
        return <Link data-generator-link className={selected ? "active" : undefined} aria-current={selected ? "page" : undefined} href={href} key={href} onClick={() => { setOpen(false); onNavigate?.(); }}><Icon size={17}/><span>{t(label)}</span></Link>;
      })}
    </div>
  </div>;
}
