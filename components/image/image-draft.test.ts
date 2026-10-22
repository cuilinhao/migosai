import { expect, it } from 'vitest';
import { imageCreditCost } from '@/lib/image';
import { createImageDraft, imageDraftForOwner, imageDraftFromRequest, type OwnedImageDraft } from './image-draft';

const visitor: OwnedImageDraft = { owner: null, draft: { prompt: 'A castle above the clouds', aspect: '16:9', resolution: '4K', outputFormat: 'jpg' } };
it('preserves a visitor prompt and selected output settings after sign-in', () => {
  const signedIn=imageDraftForOwner(visitor,'alice');
  expect(signedIn).toEqual({owner:'alice',draft:visitor.draft});
  expect(imageCreditCost(signedIn.draft.resolution)).toBe(12);
  expect(imageDraftForOwner(signedIn,'alice')).toBe(signedIn);
});
it('clears signed-in drafts before another account or logged-out view receives them', () => {
  const alice=imageDraftForOwner(visitor,'alice');
  expect(imageDraftForOwner(alice,'bob')).toEqual({owner:'bob',draft:createImageDraft()});
  const loggedOut=imageDraftForOwner(alice,null);
  expect(loggedOut).toEqual({owner:null,draft:createImageDraft()});
  expect(imageDraftForOwner(loggedOut,'bob').draft).toEqual(createImageDraft());
});
it('lets a restored receipt replace all four draft fields without lifting private reference keys', () => {
  const savedRequest={prompt:'Original paid request',aspect:'1:1',resolution:'2K',outputFormat:'png',images:['private/upload-1']} as const;
  const restored={...imageDraftForOwner(visitor,'alice').draft,...imageDraftFromRequest({...savedRequest,images:[...savedRequest.images]})};
  expect(restored).toEqual({prompt:'Original paid request',aspect:'1:1',resolution:'2K',outputFormat:'png'});
  expect(imageCreditCost(restored.resolution)).toBe(8);
  expect(restored).not.toHaveProperty('images');
});
