import { describe, expect, it } from 'vitest';
import { getVideoCost, getVideoReferenceDuration, validateVideo, updateVideoSettings, defaultVideoSettings } from '../lib/video-options';

const legacy = { leftImage: 'users/u/uploads/left', rightImage: 'users/u/uploads/right', aspect: '9:16', duration: 5, resolution: '720p' };
describe('custom video options', () => {
  it('retains all custom inputs instead of silently dropping selected audio and motion', () => {
    expect(validateVideo({ ...legacy, duration: 12, model: 'wan-3.0', scene: 'hotel-lobby', motion: 'video', soundtrack: 'song', referenceVideo: 'users/u/uploads/video', referenceAudio: 'users/u/uploads/audio', topic: '  birthday  ' })).toMatchObject({ model: 'wan-3.0', duration: 12, motion: 'video', soundtrack: 'song', referenceVideo: 'users/u/uploads/video', referenceAudio: 'users/u/uploads/audio', topic: 'birthday' });
  });
  it('keeps historical requests valid and preserves their original pricing', () => {
    expect(validateVideo(legacy)).toMatchObject(legacy);
    expect(getVideoCost(5, '720p')).toBe(100);
    expect(getVideoCost(10, '480p')).toBe(75);
    expect(getVideoCost(15, '720p')).toBe(300);
  });
  it('rejects missing references, incompatible settings and invalid numbers before charging', () => {
    for (const patch of [
      { model: 'wan-3.0', motion: 'video', soundtrack: 'template' },
      { model: 'wan-3.0', soundtrack: 'song' },
      { model: 'wan-3.0', soundtrack: 'clip', motion: 'template' },
      { model: 'seedance-2', soundtrack: 'song', referenceAudio: 'a' },
      { model: 'wan-3.0', scene: 'street-cypher', soundtrack: 'template' },
      { model: 'seedance-2-fast', resolution: '1080p' },
      { model: 'unknown' }, { duration: NaN }, { duration: 3.5 }, { duration: 16 },
      { topic: 'a'.repeat(1001) }, { referenceVideo: 'https://other.example/video.mp4' },
    ]) expect(() => validateVideo({ ...legacy, ...patch })).toThrow();
  });
  it('prices Wan input and output seconds, never trusting output length alone', () => {
    expect(getVideoCost(10, '480p', 'wan-3.0', 10)).toBe(60);
    expect(getVideoCost(15, '720p', 'wan-3.0', 14.9)).toBe(180);
    expect(getVideoCost(5, '1080p', 'wan-3.0', 5)).toBe(120);
    expect(() => getVideoCost(15, '720p', 'wan-3.0', 16)).toThrow();
  });
  it('quotes the same Wan credits for browser frame timestamps and verified millisecond durations', () => {
    for (const [resolution, credits] of [['480p', 18], ['720p', 35], ['1080p', 69]] as const) {
      expect(getVideoCost(3, resolution, 'wan-3.0', 80 / 30)).toBe(credits);
      expect(getVideoCost(3, resolution, 'wan-3.0', 2.667)).toBe(credits);
    }
    expect(getVideoCost(3, '480p', 'wan-3.0', 3.000000000000001)).toBe(18);
  });
  it('makes compatible transitions when stage, soundtrack or model changes', () => {
    expect(updateVideoSettings(defaultVideoSettings, { scene: 'street-cypher' })).toMatchObject({ model: 'seedance-2', scene: 'street-cypher', soundtrack: 'ai' });
    expect(updateVideoSettings({ ...defaultVideoSettings, model: 'seedance-2', soundtrack: 'ai' }, { soundtrack: 'song' })).toMatchObject({ model: 'wan-3.0', scene: 'hotel-lobby', soundtrack: 'song' });
    expect(updateVideoSettings({ ...defaultVideoSettings, resolution: '1080p' }, { model: 'seedance-2-fast' })).toMatchObject({ resolution: '720p', soundtrack: 'ai' });
  });
  it('returns to an available duration after leaving a short custom motion clip', () => {
    expect(updateVideoSettings({ ...defaultVideoSettings, motion: 'video', duration: 3 }, { motion: 'template' }).duration).toBe(5);
  });
});

const imageTemplate = {duration:5,model:'wan-3.0',scene:'hotel-lobby',motion:'template',soundtrack:'template'} as const;
describe('image-led Hotel Lobby reference pricing',()=>{
  it('quotes output seconds only when no reference video is submitted',()=>{
    const helper=getVideoReferenceDuration;
    expect(helper(imageTemplate)).toBe(0);
    for(const [resolution,want] of [['480p',15],['720p',30],['1080p',60]] as const)expect(getVideoCost(5,resolution,'wan-3.0',0)).toBe(want);
  });
  it('never interprets a positive fraction below one second as a valid reference clip',()=>{
    for(const duration of [-1,0.5,NaN,Infinity])expect(()=>getVideoCost(5,'480p','wan-3.0',duration)).toThrow();
  });
  it('keeps uploaded reference durations and legacy default pricing unchanged',()=>{
    const helper=getVideoReferenceDuration;
    expect(helper({...imageTemplate,motion:'video',referenceVideo:'own-video'},4.9)).toBe(4.9);
    expect(helper({duration:5})).toBe(5);
    expect(helper({...imageTemplate,model:'seedance-2'})).toBe(5);
    expect(helper({...imageTemplate,scene:'luxury-lobby'})).toBe(5);
    expect(helper({...imageTemplate,referenceVideo:'own-video'})).toBe(5);
    expect(helper({...imageTemplate,soundtrack:'song'})).toBe(0);
    expect(getVideoCost(5,'480p','wan-3.0')).toBe(30);
    expect(getVideoCost(5,'480p','wan-3.0',4.9)).toBe(30);
  });
});
