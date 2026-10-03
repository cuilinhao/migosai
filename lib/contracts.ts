export type AspectRatio = "9:16" | "16:9" | "4:3" | "3:4" | "1:1";
export type VideoDuration = number;
export type VideoResolution = "720p" | "480p" | "1080p";
export type VideoModel = "wan-3.0" | "seedance-2" | "seedance-2-fast";
export type VideoScene = "hotel-lobby" | "luxury-lobby" | "recording-studio" | "street-cypher";
export type VideoMotion = "template" | "video";
export type VideoSoundtrack = "template" | "song" | "clip" | "ai";
export type VideoSettings = {
  aspect: AspectRatio; duration: VideoDuration; resolution: VideoResolution;
  model: VideoModel; scene: VideoScene; motion: VideoMotion; soundtrack: VideoSoundtrack; topic: string;
};
export type User = { id: string; name: string; email: string; picture?: string };
export type MeResponse = { user: User | null; credits: number; authConfigured: boolean };
export type UploadedPhoto = { key: string };
export type GenerationStatus = "queued" | "reviewing" | "processing" | "completed" | "failed" | "cancelled";
export type GenerationResponse = {
  id: string; status: GenerationStatus; progress: number;
  videoUrl?: string; audioUrls?: string[]; error?: string;
  statusMessage?: string;
};
export type CreateVideoRequest = {
  leftImage: string; rightImage: string; aspect: AspectRatio;
  duration: VideoDuration; resolution: VideoResolution; mode?: "human" | "pet";
  model?: VideoModel; scene?: VideoScene; motion?: VideoMotion;
  soundtrack?: VideoSoundtrack; topic?: string;
  referenceVideo?: string; referenceAudio?: string;
};
export type CreateSongRequest = {
  model: "v6" | "v6-wild" | "v6-mini";
  custom: boolean; instrumental: boolean; prompt?: string;
  title?: string; style?: string; lyrics?: string;
};
