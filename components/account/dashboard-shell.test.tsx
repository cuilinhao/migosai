import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { DashboardShell } from './dashboard-shell';
import { AuthProvider } from '../auth-provider';
import { LocaleProvider } from '../i18n/locale-provider';
import { getMessages } from '@/lib/i18n';
const route=vi.hoisted(()=>({path:'/fr/app/my-orders'}));
vi.mock('next/navigation',()=>({usePathname:()=>route.path,useRouter:()=>({push:()=>undefined})}));
function renderShell() {
  return renderToStaticMarkup(<LocaleProvider locale="fr" messages={getMessages('fr')}><AuthProvider><DashboardShell><h1>Account content</h1></DashboardShell></AuthProvider></LocaleProvider>);
}
it('announces the current localized account page and keeps a route to the main MigosAI home',()=>{
  route.path='/fr/app/my-orders';
  const html=renderShell();
  const links=[...html.matchAll(/<a\b([^>]*)>/g)];
  const current=links.filter(([,attributes])=>attributes.includes('aria-current="page"'));
  expect(current).toHaveLength(1);
  expect(current[0][1]).toContain('href="/fr/app/my-orders"');
  expect(html).toContain('href="/fr"');
  expect(html).toContain('class="dashboard-nav"');
  expect(html).not.toContain('class="portal-nav"');
});
it('uses one portal navigation and main landmark for the localized assets workspace',()=>{
  route.path='/fr/app/assets';
  const html=renderShell();
  const current=[...html.matchAll(/<a\b([^>]*)>/g)].filter(([,attributes])=>attributes.includes('aria-current="page"'));
  expect(current).toHaveLength(1);
  expect(current[0][1]).toContain('href="/fr/app/assets"');
  expect(html).toContain('class="portal-shell portal-assets-workspace"');
  expect(html.match(/class="portal-nav"/g)).toHaveLength(1);
  expect(html.match(/<main(?:\s|>)/g)).toHaveLength(1);
  expect(html).not.toContain('dashboard-nav');
  expect(html).not.toContain('<footer');
});
it('only switches the exact assets route into the portal workspace',()=>{
  route.path='/fr/app/assets/settings';
  const html=renderShell();
  expect(html).toContain('class="dashboard-nav"');
  expect(html).not.toContain('portal-assets-workspace');
});
