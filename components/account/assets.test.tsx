import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AssetCard, filterAssets, type Asset } from './assets';
import { assetUrls, groupAssetsByDay, selectLibraryItems, type LibraryItem } from './asset-utils';

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
  it('preserves every image and audio download when a generation has multiple outputs',()=>{
    for(const asset of [{...image,imageUrls:[...image.imageUrls!,'/api/media/users/alice/results/second-image']},{...music,audioUrls:[...music.audioUrls!,'/api/media/users/alice/results/second-song']}]){
      const html=renderToStaticMarkup(createElement(AssetCard,{asset}));
      const downloads=[...html.matchAll(/<a\b([^>]*\bdownload=""[^>]*)>/g)].map(([,attributes])=>attributes.match(/href="([^"]+)"/)?.[1]);
      expect(downloads).toEqual(assetUrls(asset));
      expect(downloads).toHaveLength(2);
      if(asset.kind==='music')expect(html.match(/<audio\b/g)).toHaveLength(2);
    }
  });
  it.each([
    [undefined,'/hotel-lobby-ai-video-generator'],
    ['ozil-goal','/ozil-goal-generator'],
    ['flyingcar','/flying-car-ai-video-generator'],
    ['window-peeper','/window-peeper-ai-video-generator'],
  ] as const)('keeps the %s video recovery link attached to its original generator', (template,href)=>{
    const html=renderToStaticMarkup(createElement(AssetCard,{asset:{...video,template,status:'processing',progress:20,videoUrl:undefined}}));
    expect(html).toContain(`href="${href}"`);
  });
});

const libraryItem=(asset:Asset,assetId=`generation:${asset.id}`):LibraryItem=>({...asset,assetId});
const selection={kind:'all' as const,collection:null,assignments:{},hidden:[],order:'newest' as const};
describe('asset library views',()=>{
  it('orders by creation timestamp in both directions without mutating source history',()=>{
    const source=Object.freeze([libraryItem(video),libraryItem(image),libraryItem(music)]);
    expect(selectLibraryItems(source,selection).map(item=>item.id)).toEqual(['song-1','video-1','img-1']);
    expect(selectLibraryItems(source,{...selection,order:'oldest'}).map(item=>item.id)).toEqual(['img-1','video-1','song-1']);
    expect(source.map(item=>item.id)).toEqual(['video-1','img-1','song-1']);
  });
  it('keeps Unsorted, collection membership, hidden items and media filters independent',()=>{
    const source=[libraryItem(image),libraryItem(video),libraryItem(music)];
    const options={...selection,assignments:{'generation:img-1':'folder-a','generation:video-1':'folder-a'},hidden:['generation:video-1']};
    expect(selectLibraryItems(source,options).map(item=>item.id)).toEqual(['song-1']);
    expect(selectLibraryItems(source,{...options,collection:'folder-a'}).map(item=>item.id)).toEqual(['img-1']);
    expect(selectLibraryItems(source,{...options,collection:'folder-a',kind:'video'})).toEqual([]);
    expect(selectLibraryItems(source,{...options,collection:'folder-a',kind:'video',hidden:[]}).map(item=>item.id)).toEqual(['video-1']);
  });
  it('uses complete source and owner-prefixed identifiers without cross-applying membership or hiding',()=>{
    const source=[libraryItem(image,'generation:shared'),libraryItem({...image,id:'shared'},'upload:shared'),libraryItem({...image,id:'users/alice/uploads/photo'},'upload:users/alice/uploads/photo'),libraryItem({...image,id:'users/bob/uploads/photo'},'upload:users/bob/uploads/photo')];
    const options={...selection,assignments:{'generation:shared':'folder-a','upload:users/alice/uploads/photo':'folder-a'},hidden:['upload:shared']};
    expect(selectLibraryItems(source,{...options,collection:'folder-a'}).map(item=>item.assetId)).toEqual(['generation:shared','upload:users/alice/uploads/photo']);
    expect(selectLibraryItems(source,options).map(item=>item.assetId)).toEqual(['upload:users/bob/uploads/photo']);
  });
  it('groups adjacent creation days in display order and keeps an invalid legacy date readable',()=>{
    const source=[libraryItem({...image,id:'today',createdAt:'2026-10-22T12:00:00Z'}),libraryItem({...video,id:'today-too',createdAt:'2026-10-22T12:30:00Z'}),libraryItem({...music,id:'yesterday',createdAt:'2026-10-21T12:00:00Z'}),libraryItem({...image,id:'legacy',createdAt:'legacy date'})];
    const groups=groupAssetsByDay(source,'en');
    expect(groups.map(group=>group.items.map(item=>item.id))).toEqual([['today','today-too'],['yesterday'],['legacy']]);
    expect(groups[0].date).toBe('October 22, 2026');
    expect(groups[1].date).toBe('October 21, 2026');
    expect(groups[2].date).toBe('legacy date');
    expect(groupAssetsByDay(source,'fr')[0].date).toBe('22 octobre 2026');
  });
});
