import type { GenerationResponse } from './contracts';

export type AssetLibrarySource = 'creation' | 'uploaded';
export type AssetCollection = { id: string; name: string; source: AssetLibrarySource };
export type AssetLibraryUpload = GenerationResponse & {
  kind: 'image' | 'video' | 'music';
  cost: number;
  createdAt: string;
};
export type AssetLibraryResponse = {
  collections: AssetCollection[];
  assignments: Record<string, string>;
  hidden: string[];
  uploads: AssetLibraryUpload[];
  storage: { fileCount: number };
};
export type AssetLibraryAction =
  | { action: 'create-collection'; name: string; source: AssetLibrarySource }
  | { action: 'rename-collection'; id: string; name: string }
  | { action: 'delete-collection'; id: string }
  | { action: 'move'; assetIds: string[]; collectionId: string | null }
  | { action: 'hide' | 'restore'; assetIds: string[] };
