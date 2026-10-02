"use client";

import { useState } from "react";
import { creditPacks, type PackId } from "@/content/pricing";
import { useAuth } from "./auth-provider";

export function PricingCards() {
  const { user, openSignIn } = useAuth();
  const [busy, setBusy] = useState<PackId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(packId: PackId) {
    setError(null);
    if (!user) { openSignIn(); return; }
    setBusy(packId);
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packId }) });
      const data: { checkoutUrl?: string; error?: string } = await response.json();
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error || "Checkout is unavailable right now. Please try again later.");
      window.location.assign(data.checkoutUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout is unavailable right now. Please try again later.");
      setBusy(null);
    }
  }

  return <div>
    <div className="pricing-grid">{creditPacks.map((pack) => <article className={`pricing-card ${pack.recommended ? "recommended" : ""}`} key={pack.id}>
      <div className="pricing-card-top"><h3>{pack.name}</h3>{pack.recommended && <span className="recommended-badge">Recommended</span>}</div>
      <div className="price">${pack.price.toFixed(2)}</div><p className="unit-price">${pack.unitPrice} / credit</p>
      <div className="credit-summary"><strong>{pack.credits.toLocaleString()} credits</strong><span>About {pack.videos} five-second 720P videos</span></div>
      <ul className="pack-inclusions"><li><b>Included</b> {pack.credits.toLocaleString()} credits</li><li><b>Included</b> AI Rap Song Generator</li><li><b>Included</b> No added watermark</li><li><b>Included</b> {pack.description}</li></ul>
      <button className="buy-button" disabled={busy !== null} onClick={() => void buy(pack.id)}>{busy === pack.id ? "Opening checkout…" : `Buy ${pack.name}`}</button>
    </article>)}</div>
    {error && <p className="pricing-error" role="alert">{error}</p>}
  </div>;
}
