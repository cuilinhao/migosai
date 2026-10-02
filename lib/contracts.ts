export type AspectRatio = "9:16" | "16:9" | "4:3" | "3:4";
export type VideoDuration = 5 | 10 | 15;
export type VideoResolution = "720p" | "480p";
export type User = { id: string; name: string; email: string; picture?: string };
export type MeResponse = { user: User | null; credits: number; authConfigured: boolean };
export type UploadedPhoto = { key: string };
export type GenerationStatus = "queued" | "reviewing" | "processing" | "completed" | "failed" | "cancelled";
export type GenerationResponse = {
  id: string; status: GenerationStatus; progress: number;
  videoUrl?: string; audioUrls?: string[]; error?: string;
};
export type CreateVideoRequest = {
  leftImage: string; rightImage: string; aspect: AspectRatio;
  duration: VideoDuration; resolution: VideoResolution; mode?: "human" | "pet";
};
export type CreateSongRequest = {
  model: "v6" | "v6-wild" | "v6-mini";
  custom: boolean; instrumental: boolean; prompt?: string;
  title?: string; style?: string; lyrics?: string;
};
