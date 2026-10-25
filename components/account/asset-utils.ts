import type { GenerationResponse } from '@/lib/contracts';

export type Asset = GenerationResponse & { kind:'image'|'video'|'music';cost:number;createdAt:string;template?:'ozil-goal'|'flyingcar'|'window-peeper';name?:string };
export type Filter = Asset['kind']|'all';
export type Source = 'creation'|'uploaded';
export type LibraryItem = Asset & { assetId:string };
export function filterAssets<T extends Asset>(assets:readonly T[],kind:Filter):readonly T[] { return kind==='all'?assets:assets.filter(asset=>asset.kind===kind); }
export const isActive = (asset:Asset) => !['completed','failed','cancelled'].includes(asset.status);
export const destinations = {image:'/ai-image-generator',video:'/ai-video-generator',music:'/ai-rap-song-generator'};
export function assetUrls(asset:Asset):string[] { return asset.kind==='image'?asset.imageUrls??[]:asset.kind==='music'?asset.audioUrls??[]:asset.videoUrl?[asset.videoUrl]:[]; }
export function selectLibraryItems(assets:readonly LibraryItem[], options:{kind:Filter;collection:string|null;assignments:Record<string,string>;hidden:readonly string[];order:'newest'|'oldest'}):LibraryItem[] {
 const hidden=new Set(options.hidden);
 return filterAssets(assets,options.kind).filter(asset=>!hidden.has(asset.assetId)&&(options.assignments[asset.assetId]??null)===options.collection).sort((a,b)=>{
  const difference=(Date.parse(a.createdAt)||0)-(Date.parse(b.createdAt)||0);
  return options.order==='oldest'?difference:-difference;
 });
}
export function groupAssetsByDay(assets:readonly LibraryItem[],locale:string):{date:string;items:LibraryItem[]}[] {
 const groups=new Map<string,LibraryItem[]>();
 for(const asset of assets){const date=new Date(asset.createdAt);const key=Number.isNaN(date.getTime())?asset.createdAt:new Intl.DateTimeFormat(locale,{year:'numeric',month:'long',day:'numeric'}).format(date);groups.set(key,[...(groups.get(key)??[]),asset]);}
 return [...groups].map(([date,items])=>({date,items}));
}
