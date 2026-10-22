import type { CreateSongRequest, GenerationResponse } from '@/lib/contracts';

export class SongSubmissionRejected extends Error {}

/** Keep one request snapshot while a response is uncertain; double clicks share it. */
export class SongSubmission {
  private request: {body:CreateSongRequest;key:string}|null=null;
  private inFlight:Promise<GenerationResponse>|null=null;
  constructor(private makeKey=()=>crypto.randomUUID() as string) {}
  pending() { return this.request!==null; }
  submit(body:CreateSongRequest,create:(body:CreateSongRequest,key:string)=>Promise<GenerationResponse>):Promise<GenerationResponse> {
    if(this.inFlight)return this.inFlight;
    this.request??={body:Object.freeze({...body}),key:this.makeKey()};
    const saved=this.request;
    this.inFlight=Promise.resolve().then(()=>create(saved.body,saved.key)).then(result=>{
      this.request=null;return result;
    }).catch(error=>{
      if(error instanceof SongSubmissionRejected)this.request=null;
      throw error;
    }).finally(()=>{this.inFlight=null;});
    return this.inFlight;
  }
}

export function getResumableSong(history:readonly (GenerationResponse&{kind:string})[]):GenerationResponse|null {
  return history.find(item=>item.kind==='music'&&!['completed','failed','cancelled'].includes(item.status))??null;
}
