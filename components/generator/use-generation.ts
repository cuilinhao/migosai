"use client";

import { useEffect, useState } from "react";
import type { GenerationResponse } from "@/lib/contracts";

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
