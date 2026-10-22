import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { DashboardShell } from './dashboard-shell';
import { AuthProvider } from '../auth-provider';
import { LocaleProvider } from '../i18n/locale-provider';
import { getMessages } from '@/lib/i18n';
vi.mock('next/navigation',()=>({usePathname:()=>'/fr/app/my-orders',useRouter:()=>({push:()=>undefined})}));
it('announces the current localized account page and keeps a route to the main MigosAI home',()=>{
  const html=renderToStaticMarkup(<LocaleProvider locale="fr" messages={getMessages('fr')}><AuthProvider><DashboardShell><h1>Orders</h1></DashboardShell></AuthProvider></LocaleProvider>);
  const links=[...html.matchAll(/<a\b([^>]*)>/g)];
  const current=links.filter(([,attributes])=>attributes.includes('aria-current="page"'));
  expect(current).toHaveLength(1);
  expect(current[0][1]).toContain('href="/fr/app/my-orders"');
  expect(html).toContain('href="/fr"');
});
