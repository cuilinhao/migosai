import type { CreateSongRequest } from '@/lib/contracts';

export type SongDraft = {
  model: CreateSongRequest['model'];
  custom: boolean;
  instrumental: boolean;
  prompt: string;
  title: string;
  style: string;
  lyrics: string;
};
export type OwnedSongDraft = { owner: string | null; draft: SongDraft };

export function createSongDraft(): SongDraft {
  return {
    model: 'v6', custom: false, instrumental: false,
    prompt: 'An energetic rap song about hustle and ambition, catchy hook, modern trap beat, confident male vocals',
    title: '', style: '', lyrics: '',
  };
}

/** Carry a visitor's unsent draft through sign-in, but clear an account's private draft on exit. */
export function songDraftForOwner(previous: OwnedSongDraft, owner: string | null): OwnedSongDraft {
  if (previous.owner === owner) return previous;
  return { owner, draft: previous.owner === null && owner !== null ? previous.draft : createSongDraft() };
}
