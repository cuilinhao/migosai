import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SiteShell } from '../components/site-shell';
import { AuthProvider } from '../components/auth-provider';
import { LocaleProvider } from '../components/i18n/locale-provider';
import { getMessages, locales, localizeHref, type Locale } from '../lib/i18n';
import HotelLobbyPage from '../app/hotel-lobby-ai-video-generator/page';
import FlyingCarPage from '../app/flying-car-ai-video-generator/page';
import FlyingCarGuide from '../app/flying-car-ai-video-generator/how-to-make-a-tesla-roadster-flying-car-video/page';
import OzilPage from '../app/ozil-goal-generator/page';
import OzilGuide from '../app/ozil-goal-generator/ozil-goal-ai-prompt/page';
import AudioPage from '../app/ai-rap-song-generator/page';
import PricingPage from '../app/pricing/page';
import BlogPage from '../app/blog/page';
import OzilBlogPage from '../app/ozil-goal-generator/blog/page';
import ShowcasesPage from '../app/showcases/page';
import PrivacyPage from '../app/privacy-policy/page';
import TermsPage from '../app/terms-of-service/page';
import RefundPage from '../app/refund-policy/page';
import AcceptableUsePage from '../app/acceptable-use-policy/page';
import ContactPage from '../app/contact/page';
import LandingPage from '../app/landing/page';
import SignInPage from '../app/sign-in/page';
import SignUpPage from '../app/sign-up/page';
import AccountLayout from '../app/app/layout';
import OrdersPage from '../app/app/my-orders/page';
import CreditsPage from '../app/app/my-credits/page';
import AssetsPage from '../app/app/assets/page';

const request=vi.hoisted(()=>({path:'/',locale:'en'}));
vi.mock('next/headers',()=>({headers:async()=>new Headers({'x-migos-locale':request.locale,'x-migos-pathname':request.path})}));
vi.mock('next/navigation',()=>({usePathname:()=>request.path,useRouter:()=>({push:()=>undefined})}));

// Resolve real async server components; all client components render through React.
async function resolveServerNodes(node:ReactNode):Promise<ReactNode> {
  if(Array.isArray(node))return Promise.all(node.map(async(child,index)=>{
    const resolved=await resolveServerNodes(child);
    return isValidElement(resolved)&&resolved.key==null?cloneElement(resolved,{key:`server-${index}`}):resolved;
  }));
  if(!isValidElement(node))return node;
  const element=node as ReactElement<{children?:ReactNode}>;
  if(typeof element.type==='function'&&element.type.constructor.name==='AsyncFunction')return resolveServerNodes(await (element.type as (props:typeof element.props)=>Promise<ReactNode>)(element.props));
  return element.props.children===undefined?element:cloneElement(element,undefined,await resolveServerNodes(element.props.children));
}

async function renderRoute(path:string,page:()=>ReactNode|Promise<ReactNode>,locale:Locale='en') {
  request.path=localizeHref(path,locale);request.locale=locale;
  const content=await resolveServerNodes(await page());
  return renderToStaticMarkup(<LocaleProvider locale={locale} messages={getMessages(locale)}><AuthProvider><SiteShell>{content}</SiteShell></AuthProvider></LocaleProvider>);
}
function activeSidebarLinks(html:string):string[] {
  const sidebar=html.match(/<aside\b[^>]*class="portal-sidebar"[^>]*>([\s\S]*?)<\/aside>/)?.[1]??'';
  return [...sidebar.matchAll(/<a\b([^>]*)>/g)].filter(([,attributes])=>attributes.includes('aria-current="page"')).map(([,attributes])=>attributes.match(/href="([^"]+)"/)?.[1]??'');
}
const publicRoutes=[
  {path:'/hotel-lobby-ai-video-generator',page:HotelLobbyPage,active:'/ai-video-generator'},
  {path:'/flying-car-ai-video-generator',page:FlyingCarPage,active:'/ai-video-generator'},
  {path:'/flying-car-ai-video-generator/how-to-make-a-tesla-roadster-flying-car-video',page:FlyingCarGuide,active:'/ai-video-generator'},
  {path:'/ozil-goal-generator',page:OzilPage,active:'/ai-video-generator'},
  {path:'/ozil-goal-generator/ozil-goal-ai-prompt',page:OzilGuide,active:'/ai-video-generator'},
  {path:'/ai-rap-song-generator',page:AudioPage,active:'/ai-rap-song-generator'},
  {path:'/pricing',page:PricingPage,active:'/pricing'},
  {path:'/blog',page:BlogPage,active:'/blog'},
  {path:'/ozil-goal-generator/blog',page:OzilBlogPage,active:'/blog'},
  {path:'/showcases',page:ShowcasesPage,active:'/explore'},
  {path:'/privacy-policy',page:PrivacyPage,active:null},
  {path:'/terms-of-service',page:TermsPage,active:null},
  {path:'/refund-policy',page:RefundPage,active:null},
  {path:'/acceptable-use-policy',page:AcceptableUsePage,active:null},
  {path:'/contact',page:ContactPage,active:null},
];

describe('public pages share the live portal layout',()=>{
  for(const {path,page,active} of publicRoutes) {
    it.each(locales)(`${path} has one main, one shared footer, and the matching active navigation in %s`,async locale=>{
      const html=await renderRoute(path,page,locale);
      expect(html.match(/<main(?:\s|>)/g)??[],`${path}: main landmarks`).toHaveLength(1);
      expect(html.match(/<footer(?:\s|>)/g)??[],`${path}: footer landmarks`).toHaveLength(1);
      expect(html.match(/class="portal-footer"/g)??[]).toHaveLength(1);
      expect(html.match(/class="portal-shell"/g)??[]).toHaveLength(1);
      expect(html).toContain('<h1');
      expect(activeSidebarLinks(html)).toEqual(active?[localizeHref(active,locale)]:[]);
      for(const href of ['/ai-image-generator','/hotel-lobby-ai-video-generator','/ai-rap-song-generator','/pricing','/blog'])expect(html).toContain(`href="${localizeHref(href,locale)}"`);
    });
  }
});

describe('standalone routes keep their own layout',()=>{
  const standalone=[
    {path:'/landing',page:LandingPage,footerCount:1},
    {path:'/sign-in',page:SignInPage,footerCount:0},
    {path:'/sign-up',page:SignUpPage,footerCount:0},
    {path:'/app/my-orders',page:()=>AccountLayout({children:<OrdersPage/>}),footerCount:0},
    {path:'/app/my-credits',page:()=>AccountLayout({children:<CreditsPage/>}),footerCount:0},
    {path:'/app/assets',page:()=>AccountLayout({children:<AssetsPage/>}),footerCount:0},
  ];
  for(const {path,page,footerCount}of standalone)it.each(locales)(`${path} does not receive a second portal shell in %s`,async locale=>{
    const html=await renderRoute(path,page,locale);
    expect(html.match(/<main(?:\s|>)/g)??[]).toHaveLength(1);
    expect(html.match(/<footer(?:\s|>)/g)??[]).toHaveLength(footerCount);
    expect(html).not.toContain('class="portal-shell"');
    expect(html).not.toContain('class="portal-footer"');
    expect(html).not.toContain('class="portal-nav"');
    expect(html).toContain('MigosAI');
  });
});
