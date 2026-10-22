import { expect, it } from 'vitest';
import { getResumableSong, SongSubmission, SongSubmissionRejected } from './song-submission';

const draft={model:'v6',custom:false,instrumental:false,prompt:'A jazz rap song'} as const;
it('merges double clicks and retains the captured request after an uncertain submission',async()=>{
  const submission=new SongSubmission(()=> 'music-request-123');
  let release!:()=>void;
  const waiting=new Promise<void>(resolve=>{release=resolve;});
  let calls=0;
  const first=submission.submit(draft,async()=>{calls++;await waiting;throw new Error('network');});
  const second=submission.submit({...draft,prompt:'Changed draft'},async()=>{throw new Error('duplicate');});
  expect(first).toBe(second);
  release();await expect(first).rejects.toThrow('network');
  expect(calls).toBe(1);
  expect(submission.pending()).toBe(true);
  const result=await submission.submit({...draft,prompt:'Changed draft'},async(body,key)=>{
    expect(key).toBe('music-request-123');expect(body.prompt).toBe('A jazz rap song');
    return {id:'song-1',status:'processing',progress:15};
  });
  expect(result.id).toBe('song-1');expect(submission.pending()).toBe(false);
});

it('allows a fresh corrected request after a confirmed rejection',async()=>{
  const submission=new SongSubmission();
  await expect(submission.submit(draft,async()=>{throw new SongSubmissionRejected('Invalid song options.');})).rejects.toThrow();
  expect(submission.pending()).toBe(false);
  await submission.submit({...draft,prompt:'A corrected song'},async body=>{expect(body.prompt).toBe('A corrected song');return {id:'corrected',status:'queued',progress:0};});
});
it('restores only the newest unfinished music task, keeping image and video tasks out',()=>{
  expect(getResumableSong([
    {id:'image',kind:'image',status:'processing',progress:30},
    {id:'done',kind:'music',status:'completed',progress:100},
    {id:'video',kind:'video',status:'queued',progress:0},
    {id:'song',kind:'music',status:'processing',progress:45},
  ])?.id).toBe('song');
  expect(getResumableSong([{id:'failed',kind:'music',status:'failed',progress:0}])).toBeNull();
});
