"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n/routing";
import { createTranslator, type Messages } from "@/lib/i18n/translator";
const LocaleContext = createContext<{ locale: Locale; messages: Messages }>({ locale: "en", messages: {} });
export function LocaleProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
export function useLocale() { return useContext(LocaleContext).locale; }
export function useTranslations() {
  const { messages } = useContext(LocaleContext);
  return useMemo(() => createTranslator(messages), [messages]);
}
