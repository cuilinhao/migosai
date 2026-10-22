import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import AccountVideoGeneratorPage from '../app/app/video-generator/page';
import { AuthProvider } from '../components/auth-provider';

it('gives the account video tool one page heading while preserving its working generator',()=>{
  const html=renderToStaticMarkup(<AuthProvider><AccountVideoGeneratorPage/></AuthProvider>);
  expect(html.match(/<h1(?:\s|>)/g)??[]).toHaveLength(1);
  expect(html).toContain('Generate Video');
  expect(html).toContain('id="mi-left-photo"');expect(html).toContain('id="mi-right-photo"');
});
