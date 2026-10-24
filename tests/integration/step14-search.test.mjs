import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleUserSearch,isPublicUserSearch} from '../../backend/src/search.ts';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('STEP14 user-search routes are public GET only',()=>{
 assert.equal(isPublicUserSearch('GET','/users/search'),true);
 assert.equal(isPublicUserSearch('POST','/users/search'),false);
 const index=read('backend/src/index.ts');
 assert.match(index,/isPublicUserSearch\(request.method,url.pathname\)/);
 assert.match(index,/handleUserSearch\(request,sql,headers\)/);
});
test('STEP14 user search validates filters before DB and protects private profiles',async()=>{
 const request=new Request('https://example.test/users/search?q='+encodeURIComponent('x'.repeat(101)));
 const res=await handleUserSearch(request,()=>{throw Error('unexpected DB call');},{});
 assert.equal(res.status,400);
 let called=false;
 const sql=async(strings,...args)=>{
  called=true;
  const statement=strings.join('?');
  assert.match(statement,/p.visibility='public'/);
  assert.match(statement,/p.display_name ILIKE/);
  assert.match(statement,/ORDER BY p.user_id DESC LIMIT 21/);
  assert.equal(args[0],'Bach');
  return [];
 };
 const good=await handleUserSearch(new Request('https://example.test/users/search?q=Bach'),sql,{});
 assert.equal(good.status,200);assert.equal(called,true);
});
test('STEP14 post and recruitment searches retain existing filters',()=>{
 const post=read('backend/src/posts.ts'),recruit=read('backend/src/recruitments.ts');
 assert.match(post,/p.body ILIKE/);
 assert.match(post,/pr.visibility = 'public'/);
 assert.match(post,/f.status = 'accepted'/);
 assert.match(recruit,/r.description ILIKE/);
 assert.match(recruit,/r.piece_id=\$\{piece\}/);
});
test('STEP14 search UI does not use sample users',()=>{
 const ui=read('features/sonolii/screens/Search.tsx');
 assert.doesNotMatch(ui,/import \{ users \} from '\.\.\/data'/);
 assert.match(ui,/searchUsers/);
 assert.match(ui,/keyword/);
 assert.match(ui,/userRows.map/);
});
