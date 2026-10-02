import type { AspectRatio, VideoDuration, VideoResolution, CreateVideoRequest } from './contracts';
export const aspectRatios:readonly AspectRatio[]=['9:16','16:9','4:3','3:4'];
export const videoDurations:readonly VideoDuration[]=[5,10,15];
export const videoResolutions:readonly VideoResolution[]=['720p','480p'];
export const durations=videoDurations;
export const resolutions=videoResolutions;
export function getVideoCost(duration:VideoDuration,resolution:VideoResolution):number{if(!videoDurations.includes(duration)||!videoResolutions.includes(resolution))throw new Error('Invalid video options');return ({5:50,10:75,15:150}[duration])*(resolution==='720p'?2:1);}
export function validateVideo(v:unknown):CreateVideoRequest {const p=v as CreateVideoRequest;if(!p||!aspectRatios.includes(p.aspect)||!videoDurations.includes(p.duration)||!videoResolutions.includes(p.resolution)||typeof p.leftImage!=='string'||typeof p.rightImage!=='string'||!p.leftImage||!p.rightImage||p.leftImage.length>250||p.rightImage.length>250||(p.mode!==undefined&&!['human','pet'].includes(p.mode)))throw new Error('Invalid video options.');return {leftImage:p.leftImage,rightImage:p.rightImage,aspect:p.aspect,duration:p.duration,resolution:p.resolution,mode:p.mode??'human'};}
