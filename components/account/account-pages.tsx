"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Coins, Video } from "lucide-react";
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

function dateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function AccountMessage({ loading, error, signedIn }: { loading: boolean; error: string; signedIn: boolean }) {
  const { openSignIn } = useAuth();
  if (loading) return <p className="account-message">Loading…</p>;
  if (error) return <p className="account-message account-error" role="alert">{error}</p>;
  if (!signedIn) return <div className="account-message">Sign in to view your account. <button onClick={openSignIn}>Sign In</button></div>;
  return null;
}

export function MyVideos() {
  const { data, loading, error, signedIn } = useAccountData<Generation[]>("/api/generations", (body) => Array.isArray(body.generations) ? body.generations as Generation[] : [],
    (items) => items.some((item) => item.kind === "video" && !["completed", "failed", "cancelled"].includes(item.status)));
  const videos = (data ?? []).filter((item) => item.kind === "video");
  return <div className="account-page account-videos-page">
    <div className="account-page-heading"><h1><Video size={17}/> My Videos</h1><p>Manage and view all your generated videos</p></div>
    <AccountMessage loading={loading} error={error} signedIn={signedIn}/>
    {signedIn && !loading && !error && videos.length === 0 && <div className="account-videos-empty"><span className="account-empty-icon"><Video size={30}/></span><h2>No videos yet</h2><p>Start creating your first AI-generated video</p><Link href="/app/video-generator">Create Video</Link></div>}
    {signedIn && !loading && !error && videos.length > 0 && <div className="account-video-grid">{videos.map((video) => <article className="account-video-item" key={video.id}>{video.videoUrl ? <video src={video.videoUrl} controls preload="metadata"/> : <div className="account-video-placeholder"><Video size={29}/></div>}<div><b>{video.status === "completed" ? "Generated video" : `Video ${video.status}`}</b><span>{dateTime(video.createdAt)} · {video.cost} credits</span>{video.error && <small role="alert">{video.error}</small>}{video.videoUrl && <a href={video.videoUrl} download>Download video</a>}</div></article>)}</div>}
  </div>;
}

export function MyOrders() {
  const { data, loading, error, signedIn } = useAccountData<Order[]>("/api/orders", (body) => Array.isArray(body.orders) ? body.orders as Order[] : []);
  return <div className="account-page"><div className="account-page-heading account-page-heading-lined"><h1>My Orders</h1><p>Orders for Migos AI generation credits.</p></div>
    <AccountMessage loading={loading} error={error} signedIn={signedIn}/>
    {signedIn && !loading && !error && <div className="account-table-scroll"><table className="account-table orders-table"><thead><tr><th>Order No</th><th>Product Name</th><th>Amount</th><th>Status</th><th>Paid At</th></tr></thead><tbody>{data?.length ? data.map((order) => <tr key={order.id}><td className="account-code">{order.id}</td><td>{creditPacks.find((pack) => pack.id === order.packId)?.name ?? order.packId} Credits</td><td>{new Intl.NumberFormat("en-US", { style: "currency", currency: order.currency || "USD" }).format(order.amountCents/100)}</td><td>{order.status}</td><td>{dateTime(order.createdAt)}</td></tr>) : <tr><td colSpan={5} className="account-table-empty">No orders found</td></tr>}</tbody></table></div>}
  </div>;
}

export function MyCredits() {
  const { data, loading, error, signedIn } = useAccountData<{balance:number;ledger:CreditTransaction[]}>("/api/credits", (body) => ({ balance: Number(body.balance ?? 0), ledger: Array.isArray(body.ledger) ? body.ledger as CreditTransaction[] : [] }));
  const { credits } = useAuth();
  return <div className="account-page"><div className="account-page-heading account-page-heading-lined"><h1>My Credits</h1><p>Remaining credits: {data?.balance ?? credits}</p><Link className="account-buy-credits" href="/pricing"><Coins size={16}/> Buy Credits</Link></div>
    <AccountMessage loading={loading} error={error} signedIn={signedIn}/>
    {signedIn && !loading && !error && <div className="account-table-scroll"><table className="account-table credits-table"><thead><tr><th>Trans No</th><th>Trans Type</th><th>Credits</th><th>Updated At</th></tr></thead><tbody>{data?.ledger.length ? data.ledger.map((item) => <tr key={item.id}><td className="account-code">{item.id}</td><td>{item.kind}</td><td className={item.amount >= 0 ? "positive-credits" : "negative-credits"}>{item.amount >= 0 ? "+" : ""}{item.amount}</td><td>{dateTime(item.createdAt)}</td></tr>) : <tr><td colSpan={4} className="account-table-empty">No credit transactions yet</td></tr>}</tbody></table></div>}
  </div>;
}
