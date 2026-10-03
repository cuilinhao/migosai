"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "@/components/i18n/locale-provider";
import type { Translator, Values } from "@/lib/i18n/translator";
import type { GenerationResponse } from "@/lib/contracts";

// API errors stay unchanged in transport/state. Translate known dynamic messages
// only when displaying them, so locale switches preserve the original diagnosis.
export function translateGenerationMessage(t: Translator, source: string, values?: Values): string {
  const translated = t(source, values);
  if (translated !== source || values) return translated;
  const request = source.match(/^Request failed \((\d+)\)\.$/);
  if (request) return t("Request failed ({status}).", { status: request[1] });
  const upload = source.match(/^Photo upload failed \(HTTP (\d+)\)\.$/);
  if (upload) return t("Photo upload failed (HTTP {status}).", { status: upload[1] });
  const referenceUpload = source.match(/^Reference upload failed \(HTTP (\d+)\)\.$/);
  if (referenceUpload) return t("Reference upload failed (HTTP {status}).", { status: referenceUpload[1] });
  const credits = source.match(/^You need (\d+) credits to create this video\.$/);
  if (credits) return t("You need {credits} credits to create this video.", { credits: credits[1] });
  const validation = source.match(/^(prompt|lyrics|style|title) must be text of (\d+) characters or fewer\.$/);
  if (validation) {
    const fields: Record<string, string> = { prompt: "Prompt", lyrics: "Lyrics", style: "Style of Music", title: "Title" };
    return t("{field} must be text of {max} characters or fewer.", { field: t(fields[validation[1]]), max: validation[2] });
  }
  const refund = " Your credits have been returned.";
  if (source.endsWith(refund)) return `${t(source.slice(0, -refund.length))} ${t("Your credits have been returned.")}`;
  return translated;
}

export function useGenerationTranslations(): Translator {
  const t = useTranslations();
  return useCallback((source: string, values?: Values) => translateGenerationMessage(t, source, values), [t]);
}

export async function readApi<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as ({ error?: string; message?: string } & T) | null;
  if (!response.ok) throw new Error(payload?.error ?? payload?.message ?? `Request failed (${response.status}).`);
  if (!payload) throw new Error("The server returned an empty response.");
  return payload;
}

export function useGeneration(initial: GenerationResponse | null) {
  const [generation, setGeneration] = useState<GenerationResponse | null>(initial);
  const [pollError, setPollError] = useState("");

  useEffect(() => {
    if (!generation?.id || ["completed", "failed", "cancelled"].includes(generation.status)) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await readApi<GenerationResponse>(await fetch(`/api/generations/${encodeURIComponent(generation.id)}`, { cache: "no-store" }));
        if (active) { setGeneration(result); setPollError(""); }
      } catch (error) {
        if (active) setPollError(error instanceof Error ? error.message : "Could not refresh generation status.");
      } finally {
        if (active) timer = setTimeout(poll, 2500);
      }
    };
    timer = setTimeout(poll, 2500);
    return () => { active = false; clearTimeout(timer); };
  }, [generation?.id, generation?.status]);

  return { generation, setGeneration, pollError };
}
