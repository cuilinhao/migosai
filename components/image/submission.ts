import type { CreateImageRequest, GenerationResponse } from '@/lib/contracts';
import { IMAGE_ASPECTS, IMAGE_FORMATS, IMAGE_MAX_REFERENCES, IMAGE_RESOLUTIONS } from '@/lib/image';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type ImageReceipt = { owner: string; key: string; request: CreateImageRequest; generationId?: string };
export const imageStorageKey = (owner: string) => `migos:image:v1:${encodeURIComponent(owner)}`;

export function validateImageDraft(input: unknown): CreateImageRequest {
  const value = input as Partial<CreateImageRequest> | null;
  if (!value || typeof value.prompt !== 'string' || !value.prompt.trim() || value.prompt.length > 20000) throw new Error('Describe your image in 1 to 20,000 characters.');
  if (!Array.isArray(value.images) || value.images.length > IMAGE_MAX_REFERENCES || value.images.some(key => typeof key !== 'string' || !key.trim())) throw new Error('Add up to 10 reference images.');
  if (!IMAGE_ASPECTS.includes(value.aspect as typeof IMAGE_ASPECTS[number])) throw new Error('Choose a supported image aspect ratio.');
  if (!IMAGE_RESOLUTIONS.includes(value.resolution as typeof IMAGE_RESOLUTIONS[number])) throw new Error('Choose a supported image resolution.');
  if (!IMAGE_FORMATS.includes(value.outputFormat as typeof IMAGE_FORMATS[number])) throw new Error('Choose JPG or PNG output.');
  return { prompt: value.prompt.trim(), images: [...value.images], aspect: value.aspect!, resolution: value.resolution!, outputFormat: value.outputFormat! };
}

export function readImageReceipt(storage: Storage, owner: string): ImageReceipt | null {
  try {
    const value = JSON.parse(storage.getItem(imageStorageKey(owner)) ?? 'null') as ImageReceipt | null;
    if (!value || value.owner !== owner || typeof value.key !== 'string' || !/^[\w-]{8,128}$/.test(value.key) || (value.generationId !== undefined && (typeof value.generationId !== 'string' || !value.generationId))) return null;
    return { ...value, request: validateImageDraft(value.request) };
  } catch { return null; }
}

/** A confirmed rejection before accepting a job may safely unlock a fresh request. */
export class ImageSubmissionRejected extends Error {}

/** Persist only server upload keys; file bytes and reference previews never enter storage. */
export class ImageSubmission {
  private inFlight: Promise<GenerationResponse> | null = null;
  constructor(private owner: string, private storage: Storage, private makeKey = () => crypto.randomUUID() as string) {}
  receipt() { return readImageReceipt(this.storage, this.owner); }
  clear() { this.storage.removeItem(imageStorageKey(this.owner)); }
  submit(request: CreateImageRequest, create: (body: CreateImageRequest, key: string) => Promise<GenerationResponse>): Promise<GenerationResponse> {
    if (this.inFlight) return this.inFlight;
    let receipt: ImageReceipt;
    try {
      const saved = this.receipt();
      if (saved?.generationId) throw new Error('Resume your saved image task before creating another.');
      receipt = saved ?? { owner: this.owner, key: this.makeKey(), request: validateImageDraft(request) };
      this.storage.setItem(imageStorageKey(this.owner), JSON.stringify(receipt));
    } catch (error) { return Promise.reject(error); }
    this.inFlight = Promise.resolve().then(() => create(receipt.request, receipt.key)).then(result => {
      this.storage.setItem(imageStorageKey(this.owner), JSON.stringify({ ...receipt, generationId: result.id }));
      return result;
    }).catch(error => {
      if (error instanceof ImageSubmissionRejected) this.clear();
      throw error;
    }).finally(() => { this.inFlight = null; });
    return this.inFlight;
  }
}

export function validateImageFiles(files: readonly File[], existing: number): void {
  if (existing + files.length > IMAGE_MAX_REFERENCES) throw new Error('Add up to 10 reference images.');
  for (const file of files) {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size === 0) throw new Error('Choose a JPG, PNG, or WebP image.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Each photo must be 10 MB or smaller.');
  }
}

/** Restored uploads remain usable without recreating private reference previews. */
export async function resolveImageReferenceKeys(
  references: readonly {key?:string;file?:File}[],
  upload: (file:File,index:number)=>Promise<{key:string}>,
  onUploaded?: (index:number,key:string)=>void,
):Promise<string[]> {
  const keys:string[]=[];
  for(let index=0;index<references.length;index++) {
    const reference=references[index];
    if(reference.key) { keys.push(reference.key);continue; }
    if(!reference.file) throw new Error('Choose a JPG, PNG, or WebP image.');
    const result=await upload(reference.file,index);
    keys.push(result.key);
    onUploaded?.(index,result.key);
  }
  return keys;
}
