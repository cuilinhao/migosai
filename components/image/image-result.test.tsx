import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ImageResult } from './image-result';
import type { GenerationResponse } from '@/lib/contracts';

const processing: GenerationResponse = {id:'image-review-1',status:'processing',progress:45};
const render = (generation: GenerationResponse) => renderToStaticMarkup(createElement(ImageResult,{generation,busy:false,recovering:false,stage:'',outputFormat:'png',pollError:''}));

describe('image generation requiring support',()=>{
  it('shows a held request with its diagnostic and contact link rather than indefinite generation progress',()=>{
    const html=render({...processing,statusMessage:'This request needs support review. It will not be retried automatically.',error:'The provider submission could not be confirmed.'});
    expect(html).toContain('This request needs support review. It will not be retried automatically.');
    expect(html).toContain('The provider submission could not be confirmed.');
    expect(html).toContain('Contact support');
    expect(html).toContain('href="/contact"');
    expect(html).toContain('image-review-1');
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain('Generating your image');
    expect(html).not.toContain('Resume saved request');
  });
  it('does not hide provider diagnostics while a task remains active',()=>{
    const html=render({...processing,error:'The stored image is temporarily unavailable.'});
    expect(html).toContain('The stored image is temporarily unavailable.');
    expect(html).toContain('role="alert"');
    expect(html).toContain('href="/contact"');
  });
});
