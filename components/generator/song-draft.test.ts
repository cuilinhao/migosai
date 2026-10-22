import { expect, it } from 'vitest';
import { createSongDraft, songDraftForOwner, type OwnedSongDraft } from './song-draft';

const visitorDraft: OwnedSongDraft = {
  owner: null,
  draft: { model: 'v6-mini', custom: true, instrumental: false, prompt: 'My draft prompt', title: 'Night train', style: 'Jazz rap', lyrics: 'My original lyrics' },
};
it('keeps every visitor form field when the sign-in dialog authenticates the visitor', () => {
  const signedIn = songDraftForOwner(visitorDraft, 'alice');
  expect(signedIn.owner).toBe('alice');
  expect(signedIn.draft).toEqual(visitorDraft.draft);
  expect(songDraftForOwner(signedIn, 'alice')).toBe(signedIn);
});
it('clears private drafts on direct account changes and logout', () => {
  const alice = songDraftForOwner(visitorDraft, 'alice');
  expect(songDraftForOwner(alice, 'bob')).toEqual({ owner: 'bob', draft: createSongDraft() });
  const loggedOut = songDraftForOwner(alice, null);
  expect(loggedOut).toEqual({ owner: null, draft: createSongDraft() });
  expect(songDraftForOwner(loggedOut, 'bob').draft).toEqual(createSongDraft());
});
