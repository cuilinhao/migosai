import { describe, expect, it } from 'vitest';
import type { CreateVideoRequest } from '../lib/contracts';
import { videoPrompt } from '../lib/prompts/video';

const options: CreateVideoRequest = { leftImage: 'left', rightImage: 'right', aspect: '9:16', duration: 10, resolution: '480p' };

describe('video performance prompts', () => {
  it('keeps the historic Seedance prompt for requests without a model', () => {
    const prompt = videoPrompt(options);
    expect(prompt).toContain('@图片1 is the left subject and @图片2 is the right subject');
    expect(prompt).toContain('A warm orange studio');
    expect(prompt).toContain('Original instrumental and lyrics, no existing song');
  });

  it.each([['luxury-lobby', 'grand hotel'], ['recording-studio', 'recording booth'], ['street-cypher', 'street']] as const)(
    'uses the selected %s stage without the Hotel Lobby backdrop', (scene, description) => {
      const prompt = videoPrompt({ ...options, model: 'seedance-2', scene, soundtrack: 'ai', topic: 'friendship' });
      expect(prompt).toContain(description);
      expect(prompt).toContain('friendship');
      expect(prompt).not.toContain('orange studio');
      expect(prompt).toContain('Original instrumental and lyrics');
    },
  );

  it('references Wan identities and only media that is actually submitted', () => {
    const prompt = videoPrompt({ ...options, model: 'wan-3.0', scene: 'hotel-lobby', soundtrack: 'template' }, { video: true, audio: true });
    expect(prompt).toContain('Image1 is the left subject and Image2 is the right subject');
    expect(prompt).toContain('Video1');
    expect(prompt).toContain('Audio1');
    expect(prompt).not.toContain('no existing song');
    const withoutMedia = videoPrompt({ ...options, model: 'seedance-2', scene: 'street-cypher', soundtrack: 'ai' });
    expect(withoutMedia).not.toContain('@视频1');
    expect(withoutMedia).not.toContain('@音频1');
  });
});
