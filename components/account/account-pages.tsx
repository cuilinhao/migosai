"use client";

import Link from "@/components/i18n/localized-link";
import { useEffect, useRef, useState } from "react";
import { Coins, Video } from "lucide-react";
import { useLocale } from "@/components/i18n/locale-provider";
import { useGenerationTranslations } from "@/components/generator/use-generation";
import { useAuth } from "@/components/auth-provider";
import { creditPacks } from "@/content/pricing";
import type { GenerationResponse } from "@/lib/contracts";

type Generation = GenerationResponse & { kind: "video" | "music"; cost: number; createdAt: string };
type Order = { id: string; packId: string; amountCents: number; currency: string; credits: number; status: string; createdAt: string };
type CreditTransaction = { id: string; amount: number; kind: string; referenceId: string | null; createdAt: string };

function useAccountData<T>(path: string, select: (data: Record<string, unknown>) => T, pollWhile?: (data: T) => boolean) {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selectRef = useRef(select);
  const pollWhileRef = useRef(pollWhile);
  selectRef.current = select;
  pollWhileRef.current = pollWhile;
  useEffect(() => {
    if (!user) { setData(null); setError(""); return; }
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let latest: T | null = null;
    setLoading(true);
    setData(null);
    const load = async (silent: boolean) => {
      controller = new AbortController();
      try {
        const response = await fetch(path, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        const body = await response.json() as Record<string, unknown>;
        if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not load your account details.");
        if (!active) return;
        latest = selectRef.current(body);
        setData(latest);
        setError("");
      } catch (cause) {
        if (active && !controller.signal.aborted && !silent) setError(cause instanceof Error ? cause.message : "Could not load your account details.");
      } finally {
        if (!active) return;
        if (!silent) setLoading(false);
        if (latest !== null && pollWhileRef.current?.(latest)) timer = setTimeout(() => void load(true), 3000);
      }
    };
    void load(false);
    return () => { active = false; if (timer) clearTimeout(timer); controller?.abort(); };
  }, [path, user?.id]);
  return { data, loading: authLoading || loading, error, signedIn: !!user };
}

function dateTime(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "medium" }).format(date);
}

function AccountMessage({ loading, error, signedIn }: { loading: boolean; error: string; signedIn: boolean }) {
  const t = useGenerationTranslations();
  const { openSignIn } = useAuth();
  if (loading) return <p className="account-message">{t('Loading…')}</p>;
  if (error) return <p className="account-message account-error" role="alert">{t(error)}</p>;
  if (!signedIn) return <div className="account-message">{t("Sign in to view your account.")} <button onClick={openSignIn}>{t('Sign In')}</button></div>;
  return null;
}

export function MyVideos() {
  const t = useGenerationTranslations();
  const locale = useLocale();
  const { data, loading, error, signedIn } = useAccountData<Generation[]>("/api/generations", (body) => Array.isArray(body.generations) ? body.generations as Generation[] : [],
    (items) => items.some((item) => item.kind === "video" && !["completed", "failed", "cancelled"].includes(item.status)));
  const videos = (data ?? []).filter((item) => item.kind === "video");
  return <div className="account-page account-videos-page">
    <div className="account-page-heading"><h1><Video size={17}/> {t("My Videos")}</h1><p>{t('Manage and view all your generated videos')}</p></div>
    <AccountMessage loading={loading} error={error} signedIn={signedIn}/>
    {signedIn && !loading && !error && videos.length === 0 && <div className="account-videos-empty"><span className="account-empty-icon"><Video size={30}/></span><h2>{t('No videos yet')}</h2><p>{t('Start creating your first AI-generated video')}</p><Link href="/app/video-generator">{t('Create Video')}</Link></div>}
    {signedIn && !loading && !error && videos.length > 0 && <div className="account-video-grid">{videos.map((video) => <article className="account-video-item" key={video.id}>{video.videoUrl ? <video src={video.videoUrl} controls preload="metadata"/> : <div className="account-video-placeholder"><Video size={29}/></div>}<div><b>{video.videoUrl ? t("Generated video") : video.statusMessage ? t(video.statusMessage) : t("Video: {status}", { status: t(video.status) })}</b><span>{t("{date} · {credits} credits", { date: dateTime(video.createdAt, locale), credits: video.cost.toLocaleString(locale) })}</span>{video.error && <small role="alert">{t(video.error)}</small>}{video.videoUrl && <a href={video.videoUrl} download>{t('Download video')}</a>}</div></article>)}</div>}
  </div>;
}

export function MyOrders() {
  const t = useGenerationTranslations();
  const locale = useLocale();
  const { data, loading, error, signedIn } = useAccountData<Order[]>("/api/orders", (body) => Array.isArray(body.orders) ? body.orders as Order[] : []);
  return <div className="account-page"><div className="account-page-heading account-page-heading-lined"><h1>{t('My Orders')}</h1><p>{t('Orders for LobbyDuo generation credits.')}</p></div>
    <AccountMessage loading={loading} error={error} signedIn={signedIn}/>
    {signedIn && !loading && !error && <div className="account-table-scroll"><table className="account-table orders-table"><thead><tr><th>{t('Order No')}</th><th>{t('Product Name')}</th><th>{t('Amount')}</th><th>{t('Status')}</th><th>{t('Paid At')}</th></tr></thead><tbody>{data?.length ? data.map((order) => <tr key={order.id}><td className="account-code">{order.id}</td><td>{t("{pack} Credits", { pack: t(creditPacks.find((pack) => pack.id === order.packId)?.name ?? order.packId) })}</td><td>{new Intl.NumberFormat(locale, { style: "currency", currency: order.currency || "USD" }).format(order.amountCents/100)}</td><td>{t(order.status)}</td><td>{dateTime(order.createdAt, locale)}</td></tr>) : <tr><td colSpan={5} className="account-table-empty">{t('No orders found')}</td></tr>}</tbody></table></div>}
  </div>;
}

export function MyCredits() {
  const t = useGenerationTranslations();
  const locale = useLocale();
  const { data, loading, error, signedIn } = useAccountData<{balance:number;ledger:CreditTransaction[]}>("/api/credits", (body) => ({ balance: Number(body.balance ?? 0), ledger: Array.isArray(body.ledger) ? body.ledger as CreditTransaction[] : [] }));
  const { credits } = useAuth();
  return <div className="account-page"><div className="account-page-heading account-page-heading-lined"><h1>{t('My Credits')}</h1><p>{t("Remaining credits: {credits}", { credits: (data?.balance ?? credits).toLocaleString(locale) })}</p><Link className="account-buy-credits" href="/pricing"><Coins size={16}/> {t("Buy Credits")}</Link></div>
    <AccountMessage loading={loading} error={error} signedIn={signedIn}/>
    {signedIn && !loading && !error && <div className="account-table-scroll"><table className="account-table credits-table"><thead><tr><th>{t('Trans No')}</th><th>{t('Trans Type')}</th><th>{t('Credits')}</th><th>{t('Updated At')}</th></tr></thead><tbody>{data?.ledger.length ? data.ledger.map((item) => <tr key={item.id}><td className="account-code">{item.id}</td><td>{t(item.kind)}</td><td className={item.amount >= 0 ? "positive-credits" : "negative-credits"}>{new Intl.NumberFormat(locale, { signDisplay: "always" }).format(item.amount)}</td><td>{dateTime(item.createdAt, locale)}</td></tr>) : <tr><td colSpan={4} className="account-table-empty">{t('No credit transactions yet')}</td></tr>}</tbody></table></div>}
  </div>;
}
