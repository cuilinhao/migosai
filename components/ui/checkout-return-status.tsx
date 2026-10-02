"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { confirmedCheckout, type CheckoutOrder } from "./checkout-confirmation";

type ReturnState = "idle" | "pending" | "confirmed" | "delayed" | "error";
const orderIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function CheckoutReturnStatus() {
  const { user, loading, openSignIn, refresh } = useAuth();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [returned, setReturned] = useState(false);
  const [state, setState] = useState<ReturnState>("idle");
  const [confirmedCredits, setConfirmedCredits] = useState(0);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("checkout") !== "completed") return;
    setReturned(true);
    setOrderId(query.get("orderId"));
    setState("pending");
  }, []);

  useEffect(() => {
    if (!returned || !user || !orderId || !orderIdPattern.test(orderId)) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now() + 120_000;
    const poll = async () => {
      try {
        const response = await fetch("/api/orders", { cache: "no-store", credentials: "same-origin" });
        const body = await response.json() as { orders?: CheckoutOrder[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "Could not confirm the order.");
        if (!active) return;
        const order = confirmedCheckout(body.orders ?? [], orderId);
        if (order) {
          await refresh();
          if (active) { setConfirmedCredits(order.credits); setState("confirmed"); }
          return;
        }
      } catch {
        // A temporary read failure must never be interpreted as payment success.
      }
      if (!active) return;
      if (Date.now() >= deadline) setState("delayed");
      else timer = setTimeout(poll, 3000);
    };
    setState("pending");
    void poll();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [returned, user?.id, orderId, retry, refresh]);

  if (!returned) return null;
  if (!orderId || !orderIdPattern.test(orderId)) return <div className="mi-checkout-return" role="alert"><strong>Order confirmation unavailable</strong><p>We could not identify this checkout return. Check your order history before purchasing again.</p><Link href="/app/my-orders">View My Orders</Link></div>;
  if (!loading && !user) return <div className="mi-checkout-return" role="status"><strong>Sign in to check your order</strong><p>Your payment status must be confirmed through your account.</p><button type="button" onClick={openSignIn}>Sign In</button></div>;
  if (state === "confirmed") return <div className="mi-checkout-return mi-checkout-confirmed" role="status"><strong>Payment confirmed</strong><p>The server confirmed this order and added {confirmedCredits.toLocaleString()} credits to your account.</p><Link href="/app/my-orders">View My Orders</Link></div>;
  if (state === "delayed" || state === "error") return <div className="mi-checkout-return" role="status"><strong>Still waiting for payment confirmation</strong><p>Your credits will appear once the payment provider confirms this order. Check your order record before trying another purchase.</p><button type="button" onClick={() => setRetry((value) => value + 1)}>Check again</button><Link href="/app/my-orders">View My Orders</Link></div>;
  return <div className="mi-checkout-return" role="status" aria-live="polite"><strong>Confirming your payment…</strong><p>We are checking your order and credits. This can take a moment.</p><Link href="/app/my-orders">View My Orders</Link></div>;
}
