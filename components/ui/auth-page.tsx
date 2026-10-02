"use client";

import Link from "next/link";
import { Globe2 } from "lucide-react";
import { useEffect } from "react";
import { AuthCard, useAuth } from "@/components/auth-provider";
import { authReturnTo } from "./auth-return";

export function AuthPage({ kind }: { kind: "sign-in" | "sign-up" }) {
  const { authConfigured, user, loading } = useAuth();
  useEffect(() => {
    if (!loading && user) window.location.replace(authReturnTo(window.location));
  }, [loading, user]);
  return <main className="mi-auth-page">
    <header className="mi-auth-header">
      <Link href="/" className="mi-auth-brand"><span className="mi-brand-mark">M</span><span>Migos AI</span></Link>
      <button type="button" className="mi-language" aria-label="Language: English"><Globe2 size={16} /> English</button>
    </header>
    <AuthCard kind={kind} authConfigured={authConfigured} />
  </main>;
}
