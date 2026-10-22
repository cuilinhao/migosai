"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { ArrowUpRight, Check, ImagePlus, LoaderCircle, LockKeyhole, Sparkles, X } from 'lucide-react';
import Link from '@/components/i18n/localized-link';
import { useAuth } from '@/components/auth-provider';
import { useLocale } from '@/components/i18n/locale-provider';
import { readApi, useGeneration, useGenerationTranslations } from '@/components/generator/use-generation';
import { uploadPhoto } from '@/components/generator/photo-upload';
import { IMAGE_ASPECTS, IMAGE_FORMATS, IMAGE_MAX_REFERENCES, IMAGE_RESOLUTIONS, imageCreditCost } from '@/lib/image';
import type { CreateImageRequest, GenerationResponse, ImageOutputFormat, ImageResolution } from '@/lib/contracts';
import { ImageSubmission, ImageSubmissionRejected, validateImageDraft, validateImageFiles, resolveImageReferenceKeys, type ImageReceipt } from './submission';
import { ImageResult, imageTaskNeedsReview } from './image-result';
import styles from './image-generator.module.css';

type Reference = { id: string; file?: File; url?: string; key?: string; progress: number };
type HistoryItem = GenerationResponse & { kind: string };
const terminal = (value: GenerationResponse) => ['completed','failed','cancelled'].includes(value.status);

export function ImageGenerator() {
  const { user } = useAuth();
  // An account transition unmounts every preview, upload and poll immediately.
  return <ImageWorkspace key={user?.id ?? 'anonymous'} owner={user?.id ?? null}/>;
}

function ImageWorkspace({ owner }: { owner: string | null }) {
  const t = useGenerationTranslations();
  const locale = useLocale();
  const { credits, loading: authLoading, openSignIn, refresh } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [references, setReferences] = useState<Reference[]>([]);
  const [aspect, setAspect] = useState('auto');
  const [resolution, setResolution] = useState<ImageResolution>('1K');
  const [outputFormat, setOutputFormat] = useState<ImageOutputFormat>('png');
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(!!owner);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<ImageReceipt | null>(null);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const { generation, setGeneration, pollError } = useGeneration(null);
  const controller = useRef<ImageSubmission | null>(null);
  const uploadAbort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const submitting = useRef(false);
  const objectUrls = useRef(new Set<string>());
  const input = useRef<HTMLInputElement>(null);
  const restoreVersion = useRef(0);
  const cost = imageCreditCost(resolution);
  const active = !!generation && !terminal(generation);
  const needsReview = imageTaskNeedsReview(generation);
  const uncertain = !!receipt && !receipt.generationId;
  const locked = busy || active || recovering || uncertain || restoreFailed;
  const number = (value: number) => value.toLocaleString(locale);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; uploadAbort.current?.abort(); objectUrls.current.forEach(url => URL.revokeObjectURL(url)); }; }, []);
  const restore = useCallback(async () => {
    if (!owner) { setRecovering(false); return; }
    const version = ++restoreVersion.current;
    const abort = new AbortController();
    uploadAbort.current = abort;
    setRecovering(true); setRestoreFailed(false); setError('');
    try {
      controller.current = new ImageSubmission(owner, window.localStorage);
      const saved = controller.current.receipt();
      setReceipt(saved);
      if (saved) {
        setReferences(saved.request.images.map((key,index)=>({id:`saved-${index}`,key,progress:100})));
        setPrompt(saved.request.prompt); setAspect(saved.request.aspect); setResolution(saved.request.resolution); setOutputFormat(saved.request.outputFormat);
      }
      if (saved?.generationId) {
        const result = await readApi<GenerationResponse>(await fetch(`/api/generations/${encodeURIComponent(saved.generationId)}`, { cache:'no-store', signal:abort.signal }));
        if (mounted.current && version === restoreVersion.current) setGeneration(result);
      } else if (!saved) {
        const history = await readApi<{ generations: HistoryItem[] }>(await fetch('/api/generations', { cache:'no-store', signal:abort.signal }));
        const resumable = history.generations.find(item => item.kind === 'image' && !terminal(item));
        if (resumable) {
          const result = await readApi<GenerationResponse>(await fetch(`/api/generations/${encodeURIComponent(resumable.id)}`, { cache:'no-store', signal:abort.signal }));
          if (mounted.current && version === restoreVersion.current) setGeneration(result);
        }
      }
    } catch (cause) {
      if (mounted.current && !abort.signal.aborted) { setRestoreFailed(true); setError(cause instanceof Error ? cause.message : 'Could not restore your image task.'); }
    } finally { if (mounted.current && version === restoreVersion.current) setRecovering(false); }
  }, [owner, setGeneration]);
  useEffect(() => { void restore(); return () => { uploadAbort.current?.abort(); }; }, [restore]);
  useEffect(() => { if (generation && terminal(generation)) void refresh(); }, [generation?.status, refresh]);

  const addFiles = (files: File[]) => {
    if (locked) return;
    if (!owner) { openSignIn(); return; }
    try {
      validateImageFiles(files, references.length);
      const next = files.map(file => { const url = URL.createObjectURL(file); objectUrls.current.add(url); return { id:crypto.randomUUID(), file, url, progress:0 }; });
      setReferences(previous => [...previous,...next]); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add reference images.'); }
  };
  const remove = (reference: Reference) => {
    if (locked) return;
    if (reference.url) { URL.revokeObjectURL(reference.url); objectUrls.current.delete(reference.url); }
    setReferences(previous => previous.filter(item => item.id !== reference.id));
  };
  const drop = (event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (submitting.current || active || recovering || restoreFailed) return;
    if (!owner) { openSignIn(); return; }
    const saved = controller.current?.receipt();
    if (!saved || saved.generationId) {
      try { validateImageDraft({ prompt, images:[], aspect, resolution, outputFormat }); }
      catch (cause) { setError((cause as Error).message); return; }
      if (credits < cost) { setError('You do not have enough credits for this image.'); return; }
    }
    if (!controller.current) { setError('Could not restore your image task.'); return; }
    const abort = new AbortController(); uploadAbort.current = abort;
    submitting.current = true; setBusy(true); setError('');
    try {
      let request: CreateImageRequest;
      if (saved && !saved.generationId) request = saved.request;
      else {
        // Only a known terminal task may release its receipt for a fresh request.
        if (saved?.generationId) controller.current.clear();
        setStage('Uploading reference images…');
        const keys = await resolveImageReferenceKeys(references, async (file,index) => {
          const reference=references[index];
          return uploadPhoto(file, progress => {
            if (!mounted.current) return;
            const percent = progress.phase === 'complete' ? 100 : Math.min(99, Math.floor(progress.loaded/Math.max(1,progress.total)*100));
            setReferences(previous => previous.map(item => item.id === reference.id ? { ...item,progress:percent } : item));
          },abort.signal);
        }, (index,key) => {
          if (!mounted.current || abort.signal.aborted) return;
          setReferences(previous => previous.map(item => item.id === references[index].id ? { ...item,key,progress:100 } : item));
        });
        request = { prompt, images:keys, aspect, resolution, outputFormat };
      }
      if (!mounted.current || abort.signal.aborted) return;
      setStage('Starting your image…');
      const pending = controller.current.submit(request, async (body,key) => {
        const response = await fetch('/api/images', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json','Idempotency-Key':key}, body:JSON.stringify(body), signal:abort.signal });
        try { return await readApi<GenerationResponse>(response); }
        catch (cause) {
          if ([400,402,413,422].includes(response.status)) throw new ImageSubmissionRejected((cause as Error).message);
          throw cause;
        }
      });
      setReceipt(controller.current.receipt());
      const result = await pending;
      if (!mounted.current) return;
      setReceipt(controller.current.receipt()); setGeneration(result); await refresh();
    } catch (cause) {
      if (mounted.current) { setReceipt(controller.current.receipt()); setError(cause instanceof Error ? cause.message : 'Could not create your image.'); }
    } finally {
      if (mounted.current) { setBusy(false); setStage(''); }
      submitting.current = false;
    }
  };
  return <div className={styles.page}>
    <header className={styles.header}><span className={styles.eyebrow}><Sparkles size={14}/> NANO BANANA 2</span><h1>{t('AI Image Generator')}</h1><p>{t('Turn your imagination into an image. Add references to make it yours.')}</p></header>
    <div className={styles.workspace}>
      <form className={styles.form} onSubmit={event => void submit(event)}>
        <div className={styles.model}><span className={styles.modelIcon}>✦</span><div><b>Nano Banana 2</b><small>{t('Text to image · Image to image')}</small></div><span className={styles.modelBadge}>{t('Image')}</span></div>
        <label className={styles.label} htmlFor="image-prompt">{t('Prompt')}<span>{number(prompt.length)} / {number(20000)}</span></label>
        <textarea id="image-prompt" value={prompt} maxLength={20000} disabled={locked} onChange={event=>setPrompt(event.target.value)} placeholder={t('Describe the scene, subject, lighting, and style you imagine…')} rows={6}/>
        <div className={styles.label}><span>{t('Reference images')} <small>{t('Optional')}</small></span><span>{references.length}/{IMAGE_MAX_REFERENCES}</span></div>
        <input ref={input} className={styles.fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={locked} onChange={event=>{addFiles(Array.from(event.target.files ?? []));event.target.value='';}}/>
        <button type="button" className={styles.dropzone} disabled={locked || references.length >= 10} onClick={()=>{ if (!owner) openSignIn(); else input.current?.click(); }} onDragOver={event=>event.preventDefault()} onDrop={drop}><ImagePlus size={24}/><strong>{t('Upload reference images')}</strong><span>{t('JPG, PNG, WebP · 10 MB per image · Up to 10')}</span></button>
        {!!references.length && <div className={styles.references}>{references.map((reference,index)=><div className={styles.reference} key={reference.id}>{reference.url ? <img src={reference.url} alt={t('Reference image {number}',{number:index+1})}/> : <span className={styles.savedReference} role="img" aria-label={t('Saved reference {number}',{number:index+1})}><ImagePlus size={20}/><small>{index+1}</small></span>}<button type="button" aria-label={t('Remove reference {number}',{number:index+1})} disabled={locked} onClick={()=>remove(reference)}><X size={12}/></button>{busy && <div className={styles.referenceProgress} role="progressbar" aria-label={t('Reference image {number}',{number:index+1})} aria-valuenow={reference.progress} aria-valuemin={0} aria-valuemax={100}>{reference.progress === 100 ? <Check size={12}/> : `${reference.progress}%`}</div>}</div>)}</div>}
        {references.some(reference=>!reference.url) && <p className={styles.note}>{t('Saved references will be used again. Remove any you do not need.')}</p>}
        <div className={styles.settings}><label>{t('Aspect ratio')}<select value={aspect} disabled={locked} onChange={event=>setAspect(event.target.value)}>{IMAGE_ASPECTS.map(value=><option key={value} value={value}>{value === 'auto' ? t('Auto') : value}</option>)}</select></label><label>{t('Resolution')}<select value={resolution} disabled={locked} onChange={event=>setResolution(event.target.value as ImageResolution)}>{IMAGE_RESOLUTIONS.map(value=><option key={value}>{value}</option>)}</select></label><label>{t('Format')}<select value={outputFormat} disabled={locked} onChange={event=>setOutputFormat(event.target.value as ImageOutputFormat)}>{IMAGE_FORMATS.map(value=><option key={value} value={value}>{value.toUpperCase()}</option>)}</select></label></div>
        <div className={styles.cost}><span>{t('One image')} <b>{t('{credits} credits',{credits:cost})}</b></span><small>{owner ? t('Balance: {credits} credits',{credits:number(credits)}) : t('Sign in to generate images')}</small></div>
        {owner && credits < cost && !uncertain && <Link className={styles.topup} href="/pricing">{t('Get more credits')} <ArrowUpRight size={14}/></Link>}
        <button className={styles.generate} type="submit" disabled={authLoading || busy || active || recovering || restoreFailed}>{needsReview ? <LockKeyhole size={17}/> : busy || active || recovering ? <LoaderCircle size={17} className={styles.spin}/> : <Sparkles size={17}/>}{t(needsReview ? 'Needs support review' : uncertain ? 'Resume saved request' : busy ? 'Starting your image…' : active ? 'Generating your image…' : 'Generate image')}<span>✦ {cost}</span></button>
        {uncertain && !busy && <p className={styles.note}>{t('Your request is saved. Resume it safely with the same credits and settings.')}</p>}
        <p className={styles.privacy}><LockKeyhole size={12}/>{t('Your images and references are private.')}</p>
        {error && <p className={styles.error} role="alert">{t(error)}</p>}
        {restoreFailed && <button type="button" className={styles.retry} onClick={()=>void restore()}>{t('Retry restoring task')}</button>}
      </form>
      <ImageResult generation={generation} busy={busy} recovering={recovering} stage={stage} outputFormat={outputFormat} pollError={pollError}/>
    </div>
    <section className={styles.guide}><h2>{t('From a spark to something you can see.')}</h2><div>{[['01','Describe your idea','Write a detailed prompt, or add reference images for more control.'],['02','Make it your own','Choose your aspect ratio, resolution, and download format.'],['03','Create and keep','Generate one private image, then download it or find it in My assets.']].map(([step,title,description])=><article key={step}><span>{step}</span><h3>{t(title)}</h3><p>{t(description)}</p></article>)}</div></section>
  </div>;
}
