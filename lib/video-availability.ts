import type { VideoModel } from './contracts';

// Emergency Kie audio incident switch, shared by the UI and new-job guards.
// Both models passed real audio-enabled probes on 2026-10-04; keep them enabled.
// Set false only during a confirmed outage, then re-test both before re-enabling.
export const SEEDANCE_AUDIO_ENABLED = true;
export const SEEDANCE_UNAVAILABLE_MESSAGE = 'Seedance audio generation is temporarily unavailable. Please use Wan 3.0 with the Hotel Lobby stage.';

export function getVideoModelUnavailableReason(model: VideoModel = 'seedance-2', audioEnabled: boolean = SEEDANCE_AUDIO_ENABLED): string | undefined {
  if (!audioEnabled && model !== 'wan-3.0') return SEEDANCE_UNAVAILABLE_MESSAGE;
}
