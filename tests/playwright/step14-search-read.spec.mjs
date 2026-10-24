import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';

const BASE='https://sonolii-api.g57cydy6ks.workers.dev';

test('STEP14 public user search: result shape, wildcard, filters and pagination (read-only)',async({request})=>{
 const paths=['/users/search','/users/search?q=%25_%21','/users/search?instrument=Piano','/users/search?region=%E5%A4%A7%E9%98%AA'];
 for(const path of paths){
  const result=await request.get(BASE+path);
  expect(result.status(),path+': '+await result.text()).toBe(200);
  const data=await result.json();
  expect(Array.isArray(data.users)).toBe(true);
  expect(data.users.length).toBeLessThanOrEqual(20);
  for(const u of data.users){
   expect(typeof u.user_id).toBe('string');
   expect(typeof u.display_name).toBe('string');
   expect(Array.isArray(u.instruments)).toBe(true);
   if(path.includes('instrument=Piano'))expect(u.instruments).toContain('Piano');
   if(path.includes('region='))expect(u.region).toBe('大阪');
  }
  if(data.nextCursor){
   const next=await request.get(BASE+path+(path.includes('?')?'&':'?')+'cursor='+data.nextCursor);
   expect(next.status()).toBe(200);
   const follow=await next.json();
   expect(follow.users.every(u=>u.user_id!==data.users[0]?.user_id)).toBe(true);
  }
 }
 const invalid=await request.get(BASE+'/users/search?q='+encodeURIComponent('x'.repeat(101)));
 expect(invalid.status()).toBe(400);
});

test('STEP14 post and recruitment keyword search does not error (read-only)',async({page})=>{
 test.setTimeout(90000);
 const email=process.env.SONOLII_TEST_OWNER_EMAIL;
 expect(email,'SONOLII_TEST_OWNER_EMAIL is required').toBeTruthy();
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.Clerk?.loaded===true,null,{timeout:20000});
 await clerk.signIn({page,emailAddress:email});
 await page.waitForFunction(()=>Boolean(window.Clerk?.session),null,{timeout:20000});
 for(const path of ['/posts?limit=20&q=STEP14-NONEXISTENT-SEARCH-STRING','/recruitments?q=STEP14-NONEXISTENT-SEARCH-STRING']){
  const result=await page.evaluate(async({base,path})=>{
   const token=await window.Clerk.session.getToken({skipCache:true});
   const r=await fetch(base+path,{cache:'no-store',headers:{Authorization:'Bearer '+token}});
   const body=await r.json().catch(()=>null);
   return {status:r.status,body};
  },{base:BASE,path});
  expect(result.status,path+': '+JSON.stringify(result.body)).toBe(200);
  const key=path.startsWith('/posts')?'posts':'recruitments';
  expect(Array.isArray(result.body[key])).toBe(true);
  expect(result.body[key]).toHaveLength(0);
 }
});

test('STEP14 deployed search page shows tabs and user filters',async({page})=>{
 await page.goto('/search');
 await expect(page.getByRole('heading',{name:'検索'})).toBeVisible();
 await expect(page.getByRole('button',{name:'ユーザー',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'投稿',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'募集',exact:true})).toBeVisible();
});
