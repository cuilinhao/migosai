import { expect,it } from 'vitest';
import { minimumVideoCredits,hotelLobbyFaqs } from '../content/hotel-lobby';
import { blogValues } from '../components/blog/blog-shared';
it('advertises the output-only 5-second Wan template price in the guide and blog',()=>{
 expect(minimumVideoCredits).toBe(15);
 expect(hotelLobbyFaqs.find(item=>item.question==='Is there a free Hotel Lobby AI video generator?')?.answer).toContain('needs 15 credits');
 expect(blogValues.shortCredits).toBe(15);
});

import { isValidElement,type ReactNode,type ReactElement } from 'react';
import { vi } from 'vitest';
vi.mock('next/headers',()=>({headers:async()=>new Headers({'x-migos-locale':'en'})}));
import FreeGuide from '../app/hotel-lobby-ai-video-generator-free/page';
it('renders the public credit table with the same output-only rates as checkout',async()=>{
 const tables:Record<string,unknown>[]=[];
 function collect(node:ReactNode){
  if(Array.isArray(node)){node.forEach(collect);return;}
  if(!isValidElement(node))return;
  const props=(node as ReactElement<Record<string,unknown>>).props;
  if(props.caption==='Wan template credits by duration and resolution')tables.push(props);
  if(props.children)collect(props.children as ReactNode);
 }
 collect(await FreeGuide());
 expect(tables).toHaveLength(1);
 expect(tables[0].rows).toEqual([
  ['5 seconds','15 credits','30 credits'],['8 seconds','24 credits','48 credits'],['10 seconds','30 credits','60 credits'],['12 seconds','36 credits','72 credits'],['15 seconds','45 credits','90 credits'],
 ]);
});

import {getMessages} from '../lib/i18n';
it.each(['ko','ja','fr','es','zh-TW'] as const)('translates updated rendered quote labels in %s',locale=>{
 const messages=getMessages(locale);
 expect(messages['5 seconds, 480p: 15 credits']).toBeTruthy();
 expect(messages['5 seconds, 720p: 30 credits']).toBeTruthy();
 expect(messages['5 seconds, 480p: 15 credits']).not.toContain('30');
 expect(messages['5 seconds, 720p: 30 credits']).not.toContain('60');
});
