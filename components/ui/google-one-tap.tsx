"use client";

import { useEffect, useRef } from "react";
import { startGoogleOneTap, type OneTapCallbacks } from "./google-one-tap-client";

export { disableGoogleOneTap } from "./google-one-tap-client";

export function GoogleOneTap({ enabled, onSuccess, onError }: OneTapCallbacks & { enabled: boolean }) {
  const callbacks = useRef({ onSuccess, onError });
  useEffect(() => { callbacks.current = { onSuccess, onError }; }, [onSuccess, onError]);
  useEffect(() => {
    if (!enabled) return;
    return startGoogleOneTap({
      onSuccess: () => callbacks.current.onSuccess(),
      onError: (message) => callbacks.current.onError?.(message),
    });
  }, [enabled]);
  return null;
}
