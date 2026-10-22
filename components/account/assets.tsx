"use client";

import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowDownWideNarrow, ArrowUpWideNarrow, Check, ChevronDown, ChevronLeft, ChevronRight, Cloud, Download, Folder, FolderHeart, FolderInput, FolderOpen, Image as ImageIcon, Info, LayoutGrid, LoaderCircle, Maximize2, MoreHorizontal, Music2, Plus, RefreshCw, Square, Trash2, Upload, Video, X } from 'lucide-react';
import Link from '@/components/i18n/localized-link';
import { useAuth } from '@/components/auth-provider';
import { useLocale } from '@/components/i18n/locale-provider';
import { useGenerationTranslations } from '@/components/generator/use-generation';
import { AssetCard } from './asset-card';
import { assetUrls, destinations, groupAssetsByDay, isActive, selectLibraryItems, type Asset, type LibraryItem, type Source } from './asset-utils';
import { useAssetLibrary } from './use-asset-library';
import styles from './assets.module.css';

export { AssetCard } from './asset-card';
export { filterAssets, type Asset } from './asset-utils';

type CollectionDialog = {mode:'create'|'rename'|'delete';id?:string;name:string}|null;
const categories=[{kind:'image',label:'Image',Icon:ImageIcon},{kind:'video',label:'Video',Icon:Video},{kind:'music',label:'Audio',Icon:Music2}] as const;

export function Assets() {
 const {user}=useAuth();
 return <AssetLibrary key={user?.id??'anonymous'} owner={user?.id??null}/>;
}

function AssetLibrary({owner}:{owner:string|null}) {
 const t=useGenerationTranslations();
 const locale=useLocale();
 const {loading:authLoading,openSignIn}=useAuth();
 const {assets,library,loading,busy,error,reload,mutate,upload}=useAssetLibrary(owner);
 const [source,setSource]=useState<Source>('creation');
 const [kind,setKind]=useState<Asset['kind']>('image');
 const [collection,setCollection]=useState<string|null>(null);
 const [order,setOrder]=useState<'newest'|'oldest'>('newest');
 const [layout,setLayout]=useState<'square'|'full'>('square');
 const [size,setSize]=useState<'small'|'medium'|'large'>('medium');
 const [menu,setMenu]=useState<string|null>(null);
 const [selected,setSelected]=useState<string[]>([]);
 const [preview,setPreview]=useState<string|null>(null);
 const [collectionDialog,setCollectionDialog]=useState<CollectionDialog>(null);
 const [moveOpen,setMoveOpen]=useState(false);
 const [downloadOpen,setDownloadOpen]=useState(false);
 const [removeOpen,setRemoveOpen]=useState(false);
 const [mobileCollections,setMobileCollections]=useState(false);
 const [undo,setUndo]=useState<string[]>([]);
 const panel=useRef<HTMLDivElement>(null);
 const fileInput=useRef<HTMLInputElement>(null);
 const previewTrigger=useRef<HTMLButtonElement|null>(null);
 const preferencesKey=`migosai:assets:view:${owner??'guest'}`;
 const [preferencesReady,setPreferencesReady]=useState(false);
 useEffect(()=>{
  try{const value=JSON.parse(localStorage.getItem(preferencesKey)??'{}');if(['newest','oldest'].includes(value.order))setOrder(value.order);if(['square','full'].includes(value.layout))setLayout(value.layout);if(['small','medium','large'].includes(value.size))setSize(value.size);}catch{/* Storage is optional. */}
  setPreferencesReady(true);
 },[preferencesKey]);
 useEffect(()=>{if(preferencesReady)try{localStorage.setItem(preferencesKey,JSON.stringify({order,layout,size}));}catch{/* Storage is optional. */}},[preferencesKey,preferencesReady,order,layout,size]);
 useEffect(()=>{if(!menu)return;const close=(event:PointerEvent)=>{if(!(event.target as Element).closest('[data-asset-menu]'))setMenu(null);};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setMenu(null);};document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);};},[menu]);
 const allItems:LibraryItem[]=(source==='creation'?assets:library.uploads).map(asset=>({...asset,assetId:`${source==='creation'?'generation':'upload'}:${asset.id}`}));
 const collections=library.collections.filter(item=>item.source===source);
 const visible=selectLibraryItems(allItems,{kind:source==='creation'?kind:'all',collection,assignments:library.assignments,hidden:library.hidden,order});
 const grouped=groupAssetsByDay(visible,locale);
 const visibleIds=new Set(visible.map(item=>item.assetId));
 const selectedItems=allItems.filter(item=>selected.includes(item.assetId)&&visibleIds.has(item.assetId));
 const previewIndex=visible.findIndex(item=>item.assetId===preview);
 const previewItem=visible[previewIndex];
 const count=(id:string|null)=>allItems.filter(item=>!library.hidden.includes(item.assetId)&&(library.assignments[item.assetId]??null)===id).length;
 const resetView=()=>{setSelected([]);setMenu(null);setPreview(null);};
 const chooseSource=(next:Source)=>{setSource(next);setCollection(null);resetView();};
 const chooseCollection=(id:string|null)=>{setCollection(id);resetView();setMobileCollections(false);};
 const authAction=(action:()=>void)=>{if(owner)action();else openSignIn();};
 const toggleSelect=(id:string)=>setSelected(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);
 const collectionName=collections.find(item=>item.id===collection)?.name??t(source==='uploaded'?'Default':'Unsorted');
 const newCollection=()=>authAction(()=>setCollectionDialog({mode:'create',name:''}));
 const openUpload=()=>authAction(()=>fileInput.current?.click());
 const move=async(id:string|null)=>{if(await mutate({action:'move',assetIds:selectedItems.map(item=>item.assetId),collectionId:id})){setMoveOpen(false);setSelected([]);}};
 const cyclePreview=(direction:number)=>{if(visible.length)setPreview(visible[(previewIndex+direction+visible.length)%visible.length].assetId);};
 const folderPanel=<>
  <div className={styles.sourceTabs} role="tablist" aria-label={t('Asset source')}>{(['creation','uploaded'] as const).map(value=><button key={value} role="tab" type="button" aria-selected={source===value} onClick={()=>chooseSource(value)}>{t(value==='creation'?'Creation':'Uploaded')}</button>)}</div>
  {source==='creation'&&<button className={`${styles.folderRow} ${collection===null?styles.activeFolder:''} ${styles.unsorted}`} onClick={()=>chooseCollection(null)}><FolderHeart size={16}/><span>{t('Unsorted')}</span><small>{count(null)}</small></button>}
  <div className={styles.collectionHeading}><span>{t('Collections')}</span><button aria-label={t('New collection')} title={t('New collection')} onClick={newCollection}><Plus size={19}/></button></div>
  <div className={styles.collectionList}>{source==='uploaded'&&<button className={`${styles.folderRow} ${collection===null?styles.activeFolder:''}`} onClick={()=>chooseCollection(null)}><Folder size={16}/><span>{t('Default')}</span><small>{count(null)}</small></button>}{collections.map(item=><div className={`${styles.folderRow} ${collection===item.id?styles.activeFolder:''}`} key={item.id} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(selectedItems.length)void move(item.id);}}>
   <button className={styles.folderName} onClick={()=>chooseCollection(item.id)}><Folder size={16}/><span>{item.name}</span></button><span className={styles.folderCount}>{count(item.id)}</span>
   <div data-asset-menu className={styles.folderMenu}><button aria-label={t('Manage collection {name}',{name:item.name})} onClick={()=>setMenu(menu===item.id?null:item.id)} aria-expanded={menu===item.id}><MoreHorizontal size={16}/></button>{menu===item.id&&<div className={styles.popover}>
    {source==='uploaded'&&<button onClick={()=>{setCollection(item.id);setMenu(null);openUpload();}}><Upload size={16}/>{t('Import File')}</button>}
    <button onClick={()=>{setCollectionDialog({mode:'rename',id:item.id,name:item.name});setMenu(null);}}>{t('Rename')}</button><button className={styles.danger} onClick={()=>{setCollectionDialog({mode:'delete',id:item.id,name:item.name});setMenu(null);}}><Trash2 size={15}/>{t('Delete collection')}</button>
   </div>}</div>
  </div>)}</div>
  <div className={styles.storage}><Cloud size={20}/><span>{t('Storage')}</span><small>{t((source==='uploaded'?library.storage.fileCount:assets.length)===1?'{count} file':'{count} files',{count:source==='uploaded'?library.storage.fileCount:assets.length})}</small><div className={styles.storageTrack}/></div>
 </>;
 return <div className={styles.page}>
  <h1 className="sr-only">{t('Assets')}</h1>
  <aside className={styles.collections} aria-label={t('Collections')}>{folderPanel}</aside>
  <section className={styles.workspace} aria-label={t('Asset gallery')}>
   <div className={styles.toolbar}>
    <div className={styles.topActions}>
     <button className={styles.mobileFolder} onClick={()=>setMobileCollections(true)}><FolderOpen size={19}/><span>{collectionName}</span><ChevronDown size={14}/></button>
     <div className={styles.sortMenu} data-asset-menu><button className={styles.iconButton} aria-label={t('Sort assets')} aria-expanded={menu==='sort'} onClick={()=>setMenu(menu==='sort'?null:'sort')}>{order==='newest'?<ArrowDownWideNarrow size={20}/>:<ArrowUpWideNarrow size={20}/>}<ChevronDown size={16}/></button>{menu==='sort'&&<div className={styles.popover} role="group" aria-label={t('Sort assets')}>{(['newest','oldest'] as const).map(value=><button key={value} aria-pressed={order===value} onClick={()=>{setOrder(value);setMenu(null);}}>{value==='newest'?<ArrowDownWideNarrow size={18}/>:<ArrowUpWideNarrow size={18}/>}<span>{t(value==='newest'?'Descending':'Ascending')}</span>{order===value&&<Check size={16}/>}</button>)}</div>}</div>
     <div className={styles.layoutMenu} data-asset-menu><button className={styles.iconButton} aria-label={t('Gallery layout')} aria-expanded={menu==='layout'} onClick={()=>setMenu(menu==='layout'?null:'layout')}><LayoutGrid size={20}/><ChevronDown size={16}/></button>{menu==='layout'&&<div className={styles.popover} role="group" aria-label={t('Gallery layout')}>{(['full','square'] as const).map(value=><button key={value} aria-pressed={layout===value} onClick={()=>{setLayout(value);setMenu(null);}}>{value==='full'?<Maximize2 size={18}/>:<LayoutGrid size={18}/>}<span>{t(value==='full'?'Full':'Square')}</span>{layout===value&&<Check size={16}/>}</button>)}<hr/>{(['small','medium','large'] as const).map((value,index)=><button key={value} aria-pressed={size===value} onClick={()=>{setSize(value);setMenu(null);}}><Square size={12+index*3}/><span>{t(value[0].toUpperCase()+value.slice(1))}</span>{size===value&&<Check size={16}/>}</button>)}</div>}</div>
    </div>
    {(source==='creation'||(owner&&allItems.length>0))&&<div className={styles.categoryRow}>{source==='creation'?<nav className={styles.categories} aria-label={t('Asset categories')}>{categories.map(({kind:value,label,Icon})=><button key={value} type="button" aria-pressed={kind===value} onClick={()=>{setKind(value);resetView();}}><Icon size={16}/>{t(label)}</button>)}</nav>:<button className={styles.importButton} onClick={openUpload} disabled={busy}><Upload size={16}/>{t('Import File')}</button>}
    {owner&&<button className={styles.refresh} aria-label={t('Refresh assets')} title={t('Refresh assets')} disabled={loading||busy} onClick={reload}><RefreshCw size={16}/></button>}</div>}
    {source==='creation'&&collection===null&&<div className={styles.notice}><Info size={20}/><span>{t('Your creations are private. Organize them into collections to keep everything in one place.')}</span></div>}
   </div>
   <div className={styles.galleryBody} ref={panel}>
    {error&&<p className={styles.error} role="alert">{t(error)} <button onClick={reload}>{t('Try again')}</button></p>}
    {(authLoading||loading)&&<div className={styles.message} role="status"><LoaderCircle size={24}/><span>{t('Loading your assets…')}</span></div>}
    {!authLoading&&!loading&&visible.length===0&&!error&&<div className={styles.empty}><img src="/assets/piclumen/notice-empty.webp" alt="" width={128} height={128}/><p>{!owner?t('Sign in to view your private assets.'):t(source==='creation'?'No creations yet. Start creating something new!':"You haven't uploaded any files yet. Go upload some now!")}</p>{!owner?<button onClick={openSignIn}>{t('Sign In')}</button>:source==='uploaded'?<button onClick={openUpload}>{t('Import File')}</button>:<Link href={destinations[kind]}>{t('Create')}</Link>}</div>}
    {!loading&&grouped.map(group=><section key={group.date} className={styles.dateGroup}><h2>{group.date}</h2><div className={`${styles.grid} ${styles[size]} ${layout==='full'?styles.full:''}`}>{group.items.map(item=><div className={`${styles.tile} ${selected.includes(item.assetId)?styles.selected:''}`} key={item.assetId} draggable={selected.includes(item.assetId)} onDragStart={event=>event.dataTransfer.setData('text/plain',item.assetId)}>
     <button className={styles.tilePreview} aria-label={t('Preview {type}',{type:t(item.kind==='image'?'Image':item.kind==='video'?'Video':'Audio')})} onClick={event=>{if(event.ctrlKey||event.metaKey||event.shiftKey){toggleSelect(item.assetId);return;}previewTrigger.current=event.currentTarget;setPreview(item.assetId);}}>
      {item.kind==='image'&&item.imageUrls?.[0]?<img src={item.imageUrls[0]} alt={t('Generated image')} loading="lazy"/>:item.kind==='video'&&item.videoUrl?<video src={item.videoUrl} preload="metadata" muted playsInline/>:<div className={styles.tilePlaceholder}>{item.kind==='music'?<Music2 size={34}/>:isActive(item)?<LoaderCircle size={26}/>:<ImageIcon size={30}/>}<span>{t(isActive(item)?item.status:item.status==='failed'?'failed':item.kind==='music'?'Audio':item.status)}</span></div>}
      {item.kind!=='image'&&<span className={styles.mediaType}>{item.kind==='video'?<Video size={13}/>:<Music2 size={13}/>}</span>}
      {isActive(item)&&<div className={styles.tileProgress}><span style={{width:`${Math.max(0,Math.min(100,item.progress))}%`}}/></div>}
     </button><button className={styles.selectTile} aria-label={t('Select asset')} aria-pressed={selected.includes(item.assetId)} onClick={()=>toggleSelect(item.assetId)}><Check size={13}/></button>
    </div>)}</div></section>)}
   </div>
   {selectedItems.length>0&&<div className={styles.selectionBar}><span>{t('{count} selected',{count:selectedItems.length})}</span><button aria-label={t('Clear selection')} onClick={()=>setSelected([])}><X size={17}/></button><i/><button onClick={()=>setMoveOpen(true)} disabled={busy}><FolderInput size={18}/><span>{t('Move to collection')}</span></button><button onClick={()=>setDownloadOpen(true)} disabled={!selectedItems.some(item=>assetUrls(item).length)} aria-label={t('Download selected assets')}><Download size={18}/></button><button className={styles.danger} onClick={()=>setRemoveOpen(true)} disabled={busy} aria-label={t('Delete selected assets')}><Trash2 size={18}/></button></div>}
  </section>
  <input ref={fileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple tabIndex={-1} aria-label={t('Import images')} onChange={event=>{const files=Array.from(event.target.files??[]);event.target.value='';if(files.length)void upload(files,collection);}}/>
  {busy&&<div className={styles.busy} role="status"><LoaderCircle size={17}/>{t('Saving…')}</div>}
  {undo.length>0&&<div className={styles.toast} role="status"><span>{t('Assets removed from this library.')}</span><button onClick={async()=>{if(await mutate({action:'restore',assetIds:undo}))setUndo([]);}}>{t('Undo')}</button><button aria-label={t('Close')} onClick={()=>setUndo([])}><X size={15}/></button></div>}
  <Dialog.Root open={mobileCollections} onOpenChange={setMobileCollections}><Dialog.Portal><Dialog.Overlay className={styles.overlay}/><Dialog.Content className={styles.mobileCollections}><Dialog.Title className="sr-only">{t('Collections')}</Dialog.Title><Dialog.Description className="sr-only">{t('Organize your creations and uploads.')}</Dialog.Description><Dialog.Close className={styles.modalClose} aria-label={t('Close')}><X size={20}/></Dialog.Close>{folderPanel}</Dialog.Content></Dialog.Portal></Dialog.Root>
  <Dialog.Root open={!!previewItem} onOpenChange={open=>{if(!open)setPreview(null);}}><Dialog.Portal><Dialog.Overlay className={styles.overlay}/><Dialog.Content className={styles.previewDialog} onCloseAutoFocus={event=>{event.preventDefault();previewTrigger.current?.focus();}} onKeyDown={event=>{if((event.target as HTMLElement).closest('video,audio,input'))return;if(event.key==='ArrowLeft'){event.preventDefault();cyclePreview(-1);}if(event.key==='ArrowRight'){event.preventDefault();cyclePreview(1);}}}><Dialog.Title className="sr-only">{t('Asset preview')}</Dialog.Title><Dialog.Description className="sr-only">{t('Preview and download your creation.')}</Dialog.Description><Dialog.Close className={styles.modalClose} aria-label={t('Close')}><X size={20}/></Dialog.Close>{previewItem&&<AssetCard asset={previewItem}/>}<div className={styles.previewNavigation}><button aria-label={t('Previous asset')} onClick={()=>cyclePreview(-1)} disabled={visible.length<2}><ChevronLeft size={20}/></button><span>{previewIndex+1} / {visible.length}</span><button aria-label={t('Next asset')} onClick={()=>cyclePreview(1)} disabled={visible.length<2}><ChevronRight size={20}/></button></div></Dialog.Content></Dialog.Portal></Dialog.Root>
  <Dialog.Root open={!!collectionDialog} onOpenChange={open=>{if(!open)setCollectionDialog(null);}}><Dialog.Portal><Dialog.Overlay className={styles.overlay}/><Dialog.Content className={styles.modal}><Dialog.Title>{t(collectionDialog?.mode==='delete'?'Delete collection':collectionDialog?.mode==='rename'?'Rename collection':'New collection')}</Dialog.Title><Dialog.Description>{t(collectionDialog?.mode==='delete'?'Files in this collection will be kept in your library.':'Organize your creations and uploads.')}</Dialog.Description><Dialog.Close className={styles.modalClose} aria-label={t('Close')}><X size={20}/></Dialog.Close>{error&&<p className={styles.error} role="alert">{t(error)}</p>}<form onSubmit={async event=>{event.preventDefault();if(!collectionDialog)return;const action=collectionDialog.mode==='create'?{action:'create-collection' as const,name:collectionDialog.name.trim(),source}:collectionDialog.mode==='rename'?{action:'rename-collection' as const,id:collectionDialog.id!,name:collectionDialog.name.trim()}:{action:'delete-collection' as const,id:collectionDialog.id!};if(await mutate(action)){if(collectionDialog.mode==='delete'&&collection===collectionDialog.id)setCollection(null);setCollectionDialog(null);}}}>
   {collectionDialog?.mode!=='delete'&&<label>{t('Collection name')}<input autoFocus maxLength={64} required value={collectionDialog?.name??''} onChange={event=>setCollectionDialog(value=>value?{...value,name:event.target.value}:null)}/></label>}
   <div className={styles.modalActions}><Dialog.Close type="button">{t('Cancel')}</Dialog.Close><button className={styles.primary} disabled={busy||(collectionDialog?.mode!=='delete'&&!collectionDialog?.name.trim())} type="submit">{t(collectionDialog?.mode==='delete'?'Delete':'Save')}</button></div>
  </form></Dialog.Content></Dialog.Portal></Dialog.Root>
  <Dialog.Root open={moveOpen} onOpenChange={setMoveOpen}><Dialog.Portal><Dialog.Overlay className={styles.overlay}/><Dialog.Content className={styles.modal}><Dialog.Title>{t('Move to collection')}</Dialog.Title><Dialog.Description>{t('{count} selected',{count:selectedItems.length})}</Dialog.Description><Dialog.Close className={styles.modalClose} aria-label={t('Close')}><X size={20}/></Dialog.Close><div className={styles.moveList}><button disabled={busy||collection===null} onClick={()=>void move(null)}><FolderHeart size={18}/>{t(source==='uploaded'?'Default':'Unsorted')}</button>{collections.map(item=><button key={item.id} disabled={busy||collection===item.id} onClick={()=>void move(item.id)}><Folder size={18}/>{item.name}</button>)}</div></Dialog.Content></Dialog.Portal></Dialog.Root>
  <Dialog.Root open={downloadOpen} onOpenChange={setDownloadOpen}><Dialog.Portal><Dialog.Overlay className={styles.overlay}/><Dialog.Content className={styles.modal}><Dialog.Title>{t('Download selected assets')}</Dialog.Title><Dialog.Description>{t('Choose a file to download.')}</Dialog.Description><Dialog.Close className={styles.modalClose} aria-label={t('Close')}><X size={20}/></Dialog.Close><div className={styles.moveList}>{selectedItems.flatMap((item,assetIndex)=>assetUrls(item).map((url,index)=><a key={url} href={url} download><Download size={16}/>{t(item.kind==='image'?'Download image':item.kind==='video'?'Download video':'Download audio')} {assetIndex+1}{assetUrls(item).length>1?`.${index+1}`:''}</a>))}</div></Dialog.Content></Dialog.Portal></Dialog.Root>
  <Dialog.Root open={removeOpen} onOpenChange={setRemoveOpen}><Dialog.Portal><Dialog.Overlay className={styles.overlay}/><Dialog.Content className={styles.modal}><Dialog.Title>{t('Remove selected assets?')}</Dialog.Title><Dialog.Description>{t('Remove these files from your library. Your generation history will be kept.')}</Dialog.Description><Dialog.Close className={styles.modalClose} aria-label={t('Close')}><X size={20}/></Dialog.Close><div className={styles.modalActions}><Dialog.Close>{t('Cancel')}</Dialog.Close><button className={styles.primary} disabled={busy} onClick={async()=>{const ids=selectedItems.map(item=>item.assetId);if(await mutate({action:'hide',assetIds:ids})){setUndo(ids);setSelected([]);setRemoveOpen(false);}}}>{t('Remove')}</button></div></Dialog.Content></Dialog.Portal></Dialog.Root>
 </div>;
}
