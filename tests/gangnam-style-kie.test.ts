import { afterEach, describe, expect, it, vi } from 'vitest';
import { GANGNAM_STYLE_CONFIG, type GangnamStylePayload } from '../lib/gangnam-style';
import type { Env } from '../lib/server/env';
import { ApiError } from '../lib/server/errors';
import { createKieGangnamStyleVideo } from '../lib/server/kie';

afterEach(() => vi.restoreAllMocks());
const payload: GangnamStylePayload = {
  ...GANGNAM_STYLE_CONFIG, template: 'gangnam-style', workflow: 'reference-edit-v1', mode: 'friends', consent: true,
  photos: ['users/u/uploads/middle', 'users/u/uploads/right', 'users/u/uploads/left'],
  aspect: '16:9', resolution: '480p', prompt: 'Follow @Video1 with the uploaded cast in a silent selfie relay.',
};
const images = ['https://media.example.test/middle', 'https://media.example.test/right', 'https://media.example.test/left'];

describe('Gangnam Style Kie motion reference', () => {
  it.each([
    ['https://migosai.design/account?next=other', 'https://migosai.design/gangnam-style/photo-trio-seoul-with-audio.mp4'],
    ['http://localhost:3000/', 'http://localhost:3000/gangnam-style/photo-trio-seoul-with-audio.mp4'],
  ])('uses the server origin %s and ignores injected media fields', async (appUrl, referenceUrl) => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: { taskId: 'gangnam_task' } }));
    const injected = { ...payload, referencePath: '//evil.test/override.mp4', reference_video_urls: ['https://evil.test/override.mp4'],
      reference_audio_urls: ['https://evil.test/override.mp3'], first_frame_url: 'https://evil.test/first.png', last_frame_url: 'https://evil.test/last.png',
      generateAudio: true, generate_audio: true } as unknown as GangnamStylePayload;
    expect(await createKieGangnamStyleVideo({ APP_URL: appUrl, KIE_API_KEY: 'test-key' } as Env, injected, images)).toBe('gangnam_task');
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      model: 'bytedance/seedance-2-5', input: {
        prompt: payload.prompt, reference_image_urls: images, reference_video_urls: [referenceUrl],
        duration: -1, resolution: '480p', aspect_ratio: 'adaptive',
        generate_audio: false, output_format: 'mp4', nsfw_checker: true,
      },
    });
  });

  it.each(['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'auto'] as const)('preserves image-only legacy jobs with aspect %s', async aspect => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: { taskId: 'legacy_task' } }));
    const { workflow: _workflow, ...legacy } = payload;
    await createKieGangnamStyleVideo({ KIE_API_KEY: 'test-key' } as Env, { ...legacy, aspect }, images);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ model: 'bytedance/seedance-2-5', input: {
      prompt: payload.prompt, reference_image_urls: images, duration: 15, resolution: '480p',
      aspect_ratio: aspect === 'auto' ? 'adaptive' : aspect, generate_audio: false, output_format: 'mp4', nsfw_checker: true,
    } });
  });

  it.each([undefined, 'http://public.example.test'])('rejects unavailable or insecure reference origin %s before submission', async appUrl => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 200, data: { taskId: 'gangnam_task' } }));
    await expect(createKieGangnamStyleVideo({ APP_URL: appUrl, KIE_API_KEY: 'test-key' } as Env, payload, images)).rejects.toBeInstanceOf(ApiError);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
