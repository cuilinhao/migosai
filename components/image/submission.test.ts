import { describe, expect, it } from 'vitest';
import { ImageSubmission, validateImageDraft, readImageReceipt, imageStorageKey, type ImageReceipt } from './submission';

const options = { prompt: ' A tiny red cabin ', images: [], aspect: 'auto', resolution: '1K', outputFormat: 'png' } as const;
const valid = () => ({ ...options, images: [] as string[] });
const storage = () => { const values = new Map<string,string>(); return { getItem: (key:string) => values.get(key) ?? null, setItem: (key:string,value:string) => { values.set(key,value); }, removeItem: (key:string) => { values.delete(key); } }; };

describe('image submission boundary', () => {
  it('rejects invalid prompts and parameters before uploading or spending credits', () => {
    expect(validateImageDraft(valid()).prompt).toBe('A tiny red cabin');
    for (const draft of [{ ...valid(), prompt: '   ' }, { ...valid(), prompt: 'x'.repeat(20001) }, { ...valid(), aspect: 'wrong' }, { ...valid(), resolution: '8K' }, { ...valid(), outputFormat: 'webp' }, { ...valid(), images: Array(11).fill('key') }]) {
      expect(() => validateImageDraft(draft)).toThrow();
    }
  });
  it('deduplicates concurrent clicks and retries an uncertain post with the identical saved request', async () => {
    const saved = storage();
    const controller = new ImageSubmission('alice', saved, () => 'request-12345');
    let release!: () => void;
    let requests = 0;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const first = controller.submit(valid(), async (body,key) => { requests++; expect(body.prompt).toBe('A tiny red cabin'); expect(key).toBe('request-12345'); await gate; throw new Error('network'); });
    const second = controller.submit({ ...valid(), prompt: 'changed' }, async () => { throw new Error('duplicate request'); });
    expect(first).toBe(second);
    release();
    await expect(first).rejects.toThrow('network');
    expect(requests).toBe(1);
    expect(readImageReceipt(saved,'alice')?.request.prompt).toBe('A tiny red cabin');
    const restored = new ImageSubmission('alice', saved, () => 'should-not-be-used');
    await expect(restored.submit({ ...valid(), prompt: 'changed' }, async (body,key) => {
      expect(body.prompt).toBe('A tiny red cabin'); expect(key).toBe('request-12345');
      return { id: 'image-job-1', status: 'queued', progress: 0 };
    })).resolves.toMatchObject({ id: 'image-job-1' });
    expect(readImageReceipt(saved,'alice')?.generationId).toBe('image-job-1');
  });
  it('does not expose another account receipt or accept malformed saved requests', async () => {
    const saved = storage();
    await new ImageSubmission('alice', saved, () => 'request-12345').submit(valid(), async () => ({ id:'private', status:'queued', progress:0 }));
    expect(readImageReceipt(saved,'bob')).toBeNull();
    saved.setItem(imageStorageKey('bob'), saved.getItem(imageStorageKey('alice'))!);
    expect(readImageReceipt(saved,'bob')).toBeNull();
    saved.setItem(imageStorageKey('bob'), '{bad json');
    expect(readImageReceipt(saved,'bob')).toBeNull();
  });
  it('keeps the previous receipt until a terminal task can explicitly start a new generation', async () => {
    const saved = storage();
    let sequence = 0;
    const controller = new ImageSubmission('alice', saved, () => `request-${++sequence}`);
    const create = async (_body:unknown,key:string) => ({ id:key, status:'queued' as const, progress:0 });
    await controller.submit(valid(),create);
    expect(readImageReceipt(saved,'alice')?.generationId).toBe('request-1');
    controller.clear();
    await controller.submit(valid(),create);
    expect(readImageReceipt(saved,'alice')?.generationId).toBe('request-2');
  });
});

it('unlocks only a confirmed rejection and keeps ambiguous failures recoverable', async () => {
  const { ImageSubmissionRejected } = await import('./submission');
  const saved = storage();
  const controller = new ImageSubmission('alice',saved,()=>'request-12345');
  await expect(controller.submit(valid(),async()=>{throw new ImageSubmissionRejected('not enough credits');})).rejects.toThrow();
  expect(controller.receipt()).toBeNull();
});

it('validates reference files before any upload starts', async () => {
  const { validateImageFiles } = await import('./submission');
  expect(() => validateImageFiles([new File(['a'],'a.png',{type:'image/png'})],9)).not.toThrow();
  expect(() => validateImageFiles([new File(['a'],'a.png',{type:'image/png'})],10)).toThrow();
  expect(() => validateImageFiles([new File(['text'],'a.svg',{type:'image/svg+xml'})],0)).toThrow();
  expect(() => validateImageFiles([{type:'image/png',size:10*1024*1024+1} as File],0)).toThrow();
});

it('keeps restored reference keys in the next paid request and uploads only newly added files', async()=>{
  const { resolveImageReferenceKeys }=await import('./submission');
  const saved=storage();
  const references=[{key:'users/alice/uploads/first'},{key:'users/alice/uploads/second'},{file:new File(['a'],'new.png',{type:'image/png'})}];
  // The user explicitly removes the second restored reference before generating.
  const selected=references.filter((_,index)=>index!==1);
  let uploads=0;
  const keys=await resolveImageReferenceKeys(selected,async file=>{uploads++;expect(file.name).toBe('new.png');return {key:'users/alice/uploads/new'};});
  const result=await new ImageSubmission('alice',saved,()=>'request-56789').submit({...valid(),images:keys},async body=>{
    expect(body.images).toEqual(['users/alice/uploads/first','users/alice/uploads/new']);
    return {id:'next-image',status:'queued',progress:0};
  });
  expect(result.id).toBe('next-image');
  expect(uploads).toBe(1);
});
