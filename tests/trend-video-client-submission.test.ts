import { describe, expect, it } from 'vitest';
import { captureTrendSubmission, executeTrendSubmission, type TrendCreateBody, type UploadedTrendPhoto } from '@/components/generator/trend-video-submission';
import { getTrendVideoCopy, translateTrendVideoMessage } from '@/content/trend-video';
import type { GenerationResponse } from '@/lib/contracts';
import { locales } from '@/lib/i18n/routing';

const file = new File(['portrait'], 'portrait.jpg', { type: 'image/jpeg' });
const response: GenerationResponse = { id:'job-1', status:'queued', progress:0, trendEffect:'goodbye-2026-welcome-2027', trendVariant:'fur-collar' };
const capture = (fingerprint = 'owner:photo:new-year:fur-collar') => captureTrendSubmission('request-1', fingerprint, file, true, 'goodbye-2026-welcome-2027', 'fur-collar');

describe('trend video submission identity', () => {
  it('requires consent before freezing a paid request', () => {
    expect(() => captureTrendSubmission('key','owner:photo',file,false,'stones-to-castle-ai','default')).toThrow('consent');
    expect(Object.isFrozen(capture())).toBe(true);
  });
  it('retries a lost response with the same upload, scene and billing identity', async () => {
    const submission = capture();
    let uploads = 0;
    let cached: UploadedTrendPhoto | null = null;
    const requests: (TrendCreateBody & { key: string })[] = [];
    const run = () => executeTrendSubmission(submission,cached,
      async () => { uploads++; return {key:'users/owner/uploads/portrait'}; },
      async (body,key) => { requests.push({...body,key}); if (requests.length === 1) throw new Error('Connection lost'); return response; },
      value => {cached=value;}, () => {});
    await expect(run()).rejects.toThrow('Connection lost');
    expect(await run()).toEqual(response);
    expect(uploads).toBe(1);
    expect(requests).toEqual([0,1].map(() => ({effectId:'goodbye-2026-welcome-2027',variant:'fur-collar',photo:'users/owner/uploads/portrait',consent:true,key:'request-1'})));
  });
  it('only sends the frozen template, photo and consent, without mutable pricing or prompts', async () => {
    let selectedVariant = 'fur-collar';
    const submission = capture();
    selectedVariant = 'final-seven';
    await executeTrendSubmission(submission,null,async () => ({key:'uploaded'}),async body => {
      expect(selectedVariant).toBe('final-seven');
      expect(body).toEqual({effectId:'goodbye-2026-welcome-2027',variant:'fur-collar',photo:'uploaded',consent:true});
      return response;
    },()=>{},()=>{});
  });
  it.each(['different-owner:photo:new-year:fur-collar','owner:different-photo:new-year:fur-collar','owner:photo:new-year:final-seven','owner:photo:stones:default'])('does not reuse a cached upload across identity %s', async fingerprint => {
    let uploads=0;
    await executeTrendSubmission(capture(fingerprint),{fingerprint:'owner:photo:new-year:fur-collar',photo:'old-upload'},
      async () => {uploads++;return {key:'new-upload'};},async body => {expect(body.photo).toBe('new-upload');return response;},()=>{},()=>{});
    expect(uploads).toBe(1);
  });
  it('does not upload after cancellation', async () => {
    let uploads=0;
    await expect(executeTrendSubmission(capture(),null,async()=>{uploads++;return {key:'upload'};},async()=>response,()=>{},()=>{throw new Error('Cancelled');})).rejects.toThrow('Cancelled');
    expect(uploads).toBe(0);
  });
  it('does not cache or submit a stale account upload', async () => {
    let current=true, cached=false, created=false;
    await expect(executeTrendSubmission(capture(),null,async()=>{current=false;return {key:'upload'};},async()=>{created=true;return response;},()=>{cached=true;},()=>{if(!current)throw new Error('Account changed');})).rejects.toThrow('Account changed');
    expect({cached,created}).toEqual({cached:false,created:false});
  });
  it('discards a late create response after an account switch', async () => {
    let current=true;
    await expect(executeTrendSubmission(capture(),null,async()=>({key:'upload'}),async()=>{current=false;return response;},()=>{},()=>{if(!current)throw new Error('Account changed');})).rejects.toThrow('Account changed');
  });
});

describe('trend photo diagnostics', () => {
  it.each(locales)('localizes prepared-photo dimensions and template errors for %s', locale => {
    const copy=getTrendVideoCopy('stones-to-castle-ai',locale);
    const dimensions=translateTrendVideoMessage('Your prepared photo is 200 × 400 pixels. Choose a photo with both sides between 301 and 5999 pixels and a width-to-height ratio greater than 0.4 and less than 2.5.',copy,s=>s);
    expect(dimensions).toContain('200');expect(dimensions).toContain('400');expect(dimensions).not.toContain('{width}');
    if(locale!=='en') expect(dimensions).not.toContain('Your prepared photo');
    expect(translateTrendVideoMessage('Choose an available video effect and variant.',copy,s=>s)).toBe(copy.invalidOptions);
  });
});
