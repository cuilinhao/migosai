import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AssetCard, filterAssets, type Asset } from './assets';

const image: Asset = { id:'img-1',kind:'image',status:'completed',progress:100,imageUrls:['/api/media/users/alice/results/one'],cost:8,createdAt:'2026-10-22T01:00:00Z' };
const video: Asset = { id:'video-1',kind:'video',status:'completed',progress:100,videoUrl:'/api/media/users/alice/results/two',cost:50,createdAt:'2026-10-22T02:00:00Z' };
const music: Asset = { id:'song-1',kind:'music',status:'completed',progress:100,audioUrls:['/api/media/users/alice/results/three'],cost:10,createdAt:'2026-10-22T03:00:00Z' };

describe('private asset library', () => {
  it('filters each media category without hiding old video and music jobs',()=>{
    expect(filterAssets([image,video,music],'image').map(item=>item.id)).toEqual(['img-1']);
    expect(filterAssets([image,video,music],'video').map(item=>item.id)).toEqual(['video-1']);
    expect(filterAssets([image,video,music],'music').map(item=>item.id)).toEqual(['song-1']);
    expect(filterAssets([image,video,music],'all')).toHaveLength(3);
  });
  it('renders private image downloads with credit and date metadata',()=>{
    const html = renderToStaticMarkup(createElement(AssetCard,{asset:image}));
    expect(html).toContain('src="/api/media/users/alice/results/one"');
    expect(html).toContain('download=');
    expect(html).toContain('8 credits');
    expect(html).toContain('Oct 22, 2026');
    expect(html).not.toContain('<video');
  });
  it('keeps video and music playback and downloads available',()=>{
    const videoHtml = renderToStaticMarkup(createElement(AssetCard,{asset:video}));
    const musicHtml = renderToStaticMarkup(createElement(AssetCard,{asset:music}));
    expect(videoHtml).toContain('<video');
    expect(videoHtml).toContain('Download video');
    expect(musicHtml).toContain('<audio');
    expect(musicHtml).toContain('Download audio');
  });
  it('shows progress and recovery link when an image has no result yet',()=>{
    const html = renderToStaticMarkup(createElement(AssetCard,{asset:{...image,status:'processing',progress:47,imageUrls:undefined}}));
    expect(html).toContain('aria-valuenow="47"');
    expect(html).toContain('/ai-image-generator');
    expect(html).not.toContain('download=');
  });
});
