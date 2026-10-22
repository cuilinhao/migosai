import { expect, it } from 'vitest';
import { accountView } from './account-view';
it('hides previous account data and errors immediately when the authenticated owner changes',()=>{
  const previous={owner:'alice',data:['private-order'],error:'Alice-only detail',loading:false};
  expect(accountView('bob',false,previous)).toEqual({data:null,error:'',loading:true,signedIn:true});
  expect(accountView(null,false,previous)).toEqual({data:null,error:'',loading:false,signedIn:false});
});
it('does not leave a logged-out visitor stuck in an old loading request',()=>{
  expect(accountView(null,false,{owner:'alice',data:null,error:'',loading:true})).toMatchObject({loading:false,signedIn:false});
  expect(accountView(null,true,{owner:null,data:null,error:'',loading:false})).toMatchObject({loading:true});
});
it('preserves the current owner’s loaded empty, failed and populated account views',()=>{
  expect(accountView('alice',false,{owner:'alice',data:[],error:'',loading:false})).toMatchObject({data:[],loading:false,signedIn:true});
  expect(accountView('alice',false,{owner:'alice',data:null,error:'Unavailable',loading:false})).toMatchObject({error:'Unavailable',loading:false});
});
