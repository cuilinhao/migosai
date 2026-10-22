import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationResponse, User } from '@/lib/contracts';

// The project uses Node Vitest without a DOM renderer. This small hook host runs
// the real workspace actions and effect cleanups while keeping network I/O mocked.
const host = vi.hoisted(() => {
  type Effect = { deps?: unknown[]; cleanup?: () => void; run?: () => void | (() => void) };
  const cells: unknown[] = [];
  const effects: Effect[] = [];
  return {
    cells, effects, cursor: 0, dirty: false,
    reset() { cells.length = 0; effects.length = 0; this.cursor = 0; this.dirty = false; },
    useState(initial: unknown) {
      const index = this.cursor++;
      if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial;
      return [cells[index], (next: unknown) => {
        const value = typeof next === 'function' ? next(cells[index]) : next;
        if (!Object.is(value, cells[index])) { cells[index] = value; this.dirty = true; }
      }];
    },
    useRef(initial: unknown) {
      const index = this.cursor++;
      if (!(index in cells)) cells[index] = { current: initial };
      return cells[index];
    },
    useEffect(run: () => void | (() => void), deps?: unknown[]) {
      const index = this.cursor++;
      const previous = effects[index];
      if (!previous || !deps || !previous.deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i]))) {
        effects[index] = { ...previous, deps, run };
      }
    },
    flushEffects() {
      for (const effect of effects) {
        if (!effect?.run) continue;
        effect.cleanup?.();
        const run = effect.run; effect.run = undefined;
        effect.cleanup = run() || undefined;
      }
    },
    dispose() { for (const effect of effects) effect?.cleanup?.(); },
  };
});
const mocks = vi.hoisted(() => ({
  auth: { user: null as User | null, credits: 500, loading: false, openSignIn: vi.fn(), refresh: vi.fn(async () => {}) },
  prepare: vi.fn(), upload: vi.fn(),
}));
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useState: host.useState.bind(host), useRef: host.useRef.bind(host), useEffect: host.useEffect.bind(host),
}));
vi.mock('@/components/auth-provider', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/components/flyingcar/photo-submission', () => ({ prepareFlyingCarPhoto: mocks.prepare }));
vi.mock('@/components/generator/photo-upload', () => ({ uploadPhoto: mocks.upload }));

import { useVideoWorkspace } from './use-video-workspace';

const ownerA: User = { id: 'owner-a', name: 'A', email: 'a@example.test' };
const ownerB: User = { id: 'owner-b', name: 'B', email: 'b@example.test' };
const prompt = 'A red roadster flies above the city at sunset.';
const file = new File(['photo'], 'scene.jpg', { type: 'image/jpeg' });
const queued: GenerationResponse = { id: 'new-job', status: 'queued', progress: 0 };
const response = (body: unknown) => Response.json(body);
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
let workspace: ReturnType<typeof useVideoWorkspace>;
let workspaceOptions: { initialPrompt?: string; resumeHistory?: boolean } | undefined;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
const render = (effects = true) => {
  host.cursor = 0; host.dirty = false;
  workspace = useVideoWorkspace(workspaceOptions);
  if (effects) host.flushEffects();
  return workspace;
};
const flush = () => {
  render();
  for (let n = 0; host.dirty; n++) {
    if (n > 20) throw new Error('Workspace failed to settle');
    render();
  }
  return workspace;
};
const settle = async () => { for (let n = 0; n < 8; n++) await Promise.resolve(); flush(); };
const createRequests = () => fetchMock.mock.calls.filter(([url]) => url === '/api/flyingcar/generations');
const editPrompt = (value = prompt) => { workspace.setPrompt(value); flush(); };

beforeEach(() => {
  host.reset(); vi.clearAllMocks();
  workspaceOptions = undefined;
  mocks.auth.user = ownerA; mocks.auth.credits = 500; mocks.auth.loading = false;
  mocks.prepare.mockImplementation(async (photo: File) => photo);
  mocks.upload.mockResolvedValue({ key: 'users/owner-a/uploads/photo' });
  fetchMock = vi.fn<typeof fetch>().mockImplementation(async url =>
    response(url === '/api/generations' ? { generations: [] } : queued));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:scene-photo');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => { host.dispose(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('video workspace', () => {
  it('starts with the selected template prompt and keeps edits across ordinary rerenders', () => {
    workspaceOptions = { initialPrompt: prompt, resumeHistory: false };
    flush();
    expect(workspace.prompt).toBe(prompt);
    editPrompt('A silver roadster flies above a snowy mountain range.');
    workspaceOptions = { initialPrompt: prompt, resumeHistory: false };
    flush();
    expect(workspace.prompt).toBe('A silver roadster flies above a snowy mountain range.');
  });

  it('preserves an anonymous template draft at sign-in, then restores the public template on account changes and sign-out', () => {
    workspaceOptions = { initialPrompt: prompt, resumeHistory: false };
    mocks.auth.user = null; flush();
    editPrompt('My private car on a quiet mountain road.');
    workspace.changePhoto(file); flush(); workspace.setConsent(true); flush();
    mocks.auth.user = ownerA; flush();
    expect(workspace.prompt).toBe('My private car on a quiet mountain road.');
    expect(workspace.photo?.file).toBe(file);
    expect(workspace.consent).toBe(true);
    mocks.auth.user = ownerB; render(false);
    expect(workspace.prompt).toBe(prompt);
    expect(workspace.photo).toBeNull();
    expect(workspace.consent).toBe(false);
    flush();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:scene-photo');
    editPrompt('Another private scene for the second account.');
    mocks.auth.user = null; render(false);
    expect(workspace.prompt).toBe(prompt);
    expect(workspace.photo).toBeNull();
    flush();
    expect(workspace.prompt).toBe(prompt);
  });

  it('does not fetch or resume unrelated history for a template but submits its prompt and polls the new task', async () => {
    vi.useFakeTimers();
    workspaceOptions = { initialPrompt: prompt, resumeHistory: false };
    fetchMock.mockImplementation(async url => {
      if (url === '/api/generations') return response({ generations: [{ ...queued, id: 'unrelated-video', kind: 'video', template: 'flyingcar' }] });
      if (url === '/api/flyingcar/generations') return response(queued);
      return response({ ...queued, status: 'completed', progress: 100, videoUrl: '/api/media/template-result' });
    });
    flush(); await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(workspace.generation).toBeNull();
    expect(workspace.locked).toBe(false);
    await workspace.submit(); flush();
    expect(JSON.parse(String(createRequests()[0][1]?.body))).toEqual({ prompt, duration: 10 });
    expect(workspace.generation?.id).toBe('new-job');
    await vi.advanceTimersByTimeAsync(2500); flush();
    expect(workspace.generation?.videoUrl).toBe('/api/media/template-result');
    expect(workspace.locked).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/generations')).toBe(false);
  });

  it('opens sign-in for anonymous submission and keeps that draft, but hides it immediately on a later account switch', async () => {
    mocks.auth.user = null;
    flush(); editPrompt(); workspace.changePhoto(file); flush(); workspace.setConsent(true); flush();
    await workspace.submit();
    expect(mocks.auth.openSignIn).toHaveBeenCalledOnce();
    expect(createRequests()).toHaveLength(0);
    mocks.auth.user = ownerA; flush();
    expect(workspace.prompt).toBe(prompt);
    expect(workspace.photo?.file).toBe(file);
    expect(workspace.consent).toBe(true);
    mocks.auth.user = ownerB; render(false);
    expect(workspace.prompt).toBe('');
    expect(workspace.photo).toBeNull();
    expect(workspace.consent).toBe(false);
    flush();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:scene-photo');
  });

  it('uses existing pricing, validation and the exact Seedance endpoint payload', async () => {
    flush(); await settle();
    expect(workspace.duration).toBe(10);
    expect(workspace.cost).toBe(75);
    editPrompt('too short'); await workspace.submit(); flush();
    expect(workspace.error).toMatch(/12/);
    editPrompt(); workspace.setDuration(30); flush();
    expect(workspace.cost).toBe(375);
    mocks.auth.credits = 374; flush(); await workspace.submit(); flush();
    expect(workspace.error).toMatch(/375 credits/);
    expect(createRequests()).toHaveLength(0);
    mocks.auth.credits = 375; flush(); await workspace.submit(); flush();
    const init = createRequests()[0][1]!;
    expect(JSON.parse(String(init.body))).toEqual({ prompt, duration: 30 });
    expect(init.method).toBe('POST');
    expect(init.headers).toHaveProperty('Idempotency-Key');
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(workspace.generation).toEqual(queued);
  });

  it('blocks same-tick duplicate submissions and edits through both request and accepted-job phases', async () => {
    const pending = deferred<Response>();
    fetchMock.mockImplementation(async url => url === '/api/generations' ? response({ generations: [] }) : pending.promise);
    flush(); await settle(); editPrompt();
    const submit = workspace.submit;
    const first = submit();
    await submit();
    workspace.setPrompt('This edit must not change the submitted scene.');
    workspace.setDuration(5); workspace.changePhoto(file);
    expect(createRequests()).toHaveLength(1);
    pending.resolve(response(queued)); await first;
    await submit(); // Still the old render's handler: the synchronous job lock must win.
    flush();
    expect(createRequests()).toHaveLength(1);
    expect(workspace.prompt).toBe(prompt);
    expect(workspace.duration).toBe(10);
    expect(workspace.photo).toBeNull();
    expect(workspace.locked).toBe(true);
  });

  it('requires photo consent and reuses the upload and billing key after a lost response, even with a depleted balance', async () => {
    let attempts = 0;
    fetchMock.mockImplementation(async url => {
      if (url === '/api/generations') return response({ generations: [] });
      if (++attempts === 1) throw new Error('Connection lost after billing');
      return response(queued);
    });
    flush(); await settle(); editPrompt(); workspace.changePhoto(file); flush();
    await workspace.submit(); flush();
    expect(workspace.error).toMatch(/permission/);
    expect(mocks.upload).not.toHaveBeenCalled();
    workspace.setConsent(true); flush(); await workspace.submit(); flush();
    expect(workspace.error).toBe('Connection lost after billing');
    mocks.auth.credits = 0; flush(); await workspace.submit(); flush();
    const requests = createRequests();
    expect(requests).toHaveLength(2);
    expect(requests[0][1]?.headers).toEqual(requests[1][1]?.headers);
    expect(JSON.parse(String(requests[1][1]?.body))).toEqual({ prompt, duration: 10, photo: 'users/owner-a/uploads/photo', consent: true });
    expect(mocks.prepare).toHaveBeenCalledOnce();
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(workspace.generation).toEqual(queued);
  });

  it('does not create or cache a video from an upload completed after the account changes', async () => {
    const upload = deferred<{ key: string }>();
    mocks.upload.mockReturnValueOnce(upload.promise);
    flush(); await settle(); editPrompt(); workspace.changePhoto(file); flush(); workspace.setConsent(true); flush();
    const pending = workspace.submit(); await settle();
    expect(mocks.upload).toHaveBeenCalledOnce();
    const onProgress = mocks.upload.mock.calls[0][1];
    mocks.auth.user = ownerB; flush();
    onProgress({ phase: 'uploading', loaded: 90, total: 100 });
    upload.resolve({ key: 'users/owner-a/uploads/private' }); await pending; flush();
    expect(createRequests()).toHaveLength(0);
    expect(workspace.photo).toBeNull();
    expect(workspace.progress).toBe(0);
    expect(workspace.error).toBe('');
    expect(workspace.busy).toBe(false);
  });

  it('ignores an old owner response without unlocking or replacing the new owner request', async () => {
    const oldRequest = deferred<Response>(); const newRequest = deferred<Response>();
    let attempts = 0;
    fetchMock.mockImplementation(async url => url === '/api/generations' ? response({ generations: [] }) : ++attempts === 1 ? oldRequest.promise : newRequest.promise);
    flush(); await settle(); editPrompt(); const oldPending = workspace.submit();
    mocks.auth.user = ownerB; flush(); await settle(); editPrompt('A silver car lifts off a quiet mountain road.');
    const newPending = workspace.submit();
    oldRequest.resolve(response({ ...queued, id: 'private-owner-a' })); await oldPending; flush();
    expect(workspace.generation).toBeNull();
    expect(workspace.busy).toBe(true);
    expect(workspace.error).toBe('');
    newRequest.resolve(response({ ...queued, id: 'owner-b-job' })); await newPending; flush();
    expect(workspace.generation?.id).toBe('owner-b-job');
  });

  it('does not let slow history overwrite a newly accepted generation', async () => {
    const history = deferred<Response>();
    fetchMock.mockImplementation(async url => url === '/api/generations' ? history.promise : response(queued));
    flush(); editPrompt(); await workspace.submit(); flush();
    history.resolve(response({ generations: [{ ...queued, id: 'older-job', kind: 'video', template: 'flyingcar' }] }));
    await settle();
    expect(workspace.generation?.id).toBe('new-job');
  });

  it('resumes only the Seedance workflow, retries polling failures and unlocks on completion', async () => {
    vi.useFakeTimers(); let polls = 0;
    fetchMock.mockImplementation(async url => {
      if (url === '/api/generations') return response({ generations: [
        { ...queued, id: 'hotel-job', kind: 'video' },
        { ...queued, id: 'seedance-job', kind: 'video', template: 'flyingcar' },
      ] });
      if (++polls === 1) throw new Error('Status temporarily unavailable');
      return response({ id: 'seedance-job', status: 'completed', progress: 100, videoUrl: '/api/media/video' });
    });
    flush(); await settle();
    expect(workspace.generation?.id).toBe('seedance-job');
    expect(workspace.locked).toBe(true);
    await vi.advanceTimersByTimeAsync(2500); flush();
    expect(workspace.pollError).toBe('Status temporarily unavailable');
    await vi.advanceTimersByTimeAsync(2500); flush();
    expect(workspace.generation?.status).toBe('completed');
    expect(workspace.progress).toBe(100);
    expect(workspace.pollError).toBe('');
    expect(workspace.locked).toBe(false);
    expect(mocks.auth.refresh).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(5000);
    expect(polls).toBe(2);
  });

  it('rejects a late polling response after account switch and clears that owner’s polling errors', async () => {
    vi.useFakeTimers(); const poll = deferred<Response>();
    fetchMock.mockImplementation(async url => url === '/api/generations'
      ? response({ generations: mocks.auth.user?.id === ownerA.id ? [{ ...queued, kind: 'video', template: 'flyingcar' }] : [] })
      : poll.promise);
    flush(); await settle(); await vi.advanceTimersByTimeAsync(2500);
    mocks.auth.user = ownerB; flush(); await settle();
    poll.resolve(response({ ...queued, status: 'completed', progress: 100, videoUrl: '/private-owner-a.mp4' }));
    await settle();
    expect(workspace.generation).toBeNull();
    expect(workspace.pollError).toBe('');
    expect(workspace.locked).toBe(false);
    expect(mocks.auth.refresh).not.toHaveBeenCalled();
  });
});
