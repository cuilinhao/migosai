import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SongGenerator } from './song-generator';

const state=vi.hoisted(()=>({generation:null as import('@/lib/contracts').GenerationResponse|null}));
vi.mock('@/components/auth-provider',()=>({useAuth:()=>({user:{id:'alice',name:'Alice',email:'alice@example.test'},credits:20,loading:false,openSignIn:()=>undefined,refresh:async()=>undefined})}));
vi.mock('./use-generation',async importOriginal=>({...await importOriginal<typeof import('./use-generation')>(),useGeneration:()=>({generation:state.generation,setGeneration:()=>undefined,pollError:''})}));

describe('music generation submission states',()=>{
  it.each(['queued','reviewing','processing'] as const)('locks a %s task against another paid submission and settings changes',status=>{
    state.generation={id:'song-1',status,progress:42};
    const html=renderToStaticMarkup(<SongGenerator/>);
    const generateButton=html.match(/<button[^>]*class="mi-primary-button mi-generate-button"[^>]*>/)?.[0]??'';
    expect(generateButton).toContain('disabled');
    expect(html.match(/<textarea[^>]*id="mi-song-prompt"[^>]*>/)?.[0]).toContain('disabled');
    expect(html.match(/<select[^>]*>/)?.[0]).toContain('disabled');
  });
  it('keeps an active provider error visible with a support route',()=>{
    state.generation={id:'song-review',status:'processing',progress:45,error:'The provider submission could not be confirmed.'};
    const html=renderToStaticMarkup(<SongGenerator/>);
    expect(html).toContain('The provider submission could not be confirmed.');
    expect(html).toContain('role="alert"');
    expect(html).toContain('href="/contact"');
  });
  it.each(['failed','cancelled','completed'] as const)('unlocks the generator after a known %s task',status=>{
    state.generation={id:'song-1',status,progress:100,...(status==='completed'?{audioUrls:['/api/media/song-1']}:{} )};
    const html=renderToStaticMarkup(<SongGenerator/>);
    expect(html.match(/<button[^>]*class="mi-primary-button mi-generate-button"[^>]*>/)?.[0]).not.toContain('disabled');
    if(status==='completed')expect(html).toContain('download="migosai-rap-1.mp3"');
  });
});
