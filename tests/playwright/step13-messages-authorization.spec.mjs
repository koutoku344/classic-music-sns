import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';

const API='https://sonolii-api.g57cydy6ks.workers.dev';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
function config(){
 const e=process.env;
 expect(e.CI===undefined||/^(false|0)$/i.test(e.CI),'CI write tests prohibited').toBe(true);
 expect(e.SONOLII_TEST_PHASE).toBe('PRE_RELEASE');
 expect(e.SONOLII_TEST_WRITE_CONFIRM).toBe('I_CONFIRM_TEST_WRITES');
 expect((e.SONOLII_TEST_API_URL??'').replace(/\/$/,'')).toBe(API);
 const a=e.SONOLII_TEST_OWNER_EMAIL,b=e.SONOLII_TEST_ACTOR_EMAIL,c=e.SONOLII_TEST_THIRD_EMAIL;
 expect(a,'SONOLII_TEST_OWNER_EMAIL required').toBeTruthy();
 expect(b,'SONOLII_TEST_ACTOR_EMAIL required').toBeTruthy();
 expect(c,'SONOLII_TEST_THIRD_EMAIL required').toBeTruthy();
 expect(new Set([a,b,c]).size).toBe(3);
 return {a,b,c};
}
async function login(page,email){
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.Clerk?.loaded===true,null,{timeout:20000});
 await clerk.signIn({page,emailAddress:email});
 await page.waitForFunction(()=>Boolean(window.Clerk?.session),null,{timeout:20000});
}
async function api(page,method,path,body){
 return await page.evaluate(async ({base,method,path,body})=>{
  const token=await window.Clerk.session?.getToken({skipCache:true});
  if(!token)throw Error('Clerk token missing');
  const r=await fetch(base+path,{method,cache:'no-store',signal:AbortSignal.timeout(20000),
   headers:{Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  const raw=await r.text();
  return {status:r.status,data:raw?JSON.parse(raw):null};
 },{base:API,method,path,body});
}
test('STEP13: third user cannot read, send, or mark another pair conversation',async({browser})=>{
 test.setTimeout(180000);
 const configValues=config();
 const contexts=[];
 try{
  const pages=[];
  for(const email of [configValues.a,configValues.b,configValues.c]){
   const context=await browser.newContext();contexts.push(context);
   const page=await context.newPage();await login(page,email);pages.push(page);
  }
  const [a,b,c]=pages;
  const profiles=await Promise.all(pages.map(page=>api(page,'GET','/me/profile')));
  for(const p of profiles)expect(p.status,JSON.stringify(p.data)).toBe(200);
  const ids=profiles.map(p=>p.data?.profile?.user_id);
  for(const id of ids)expect(UUID.test(id??'')).toBe(true);
  expect(new Set(ids).size).toBe(3);
  const pair=await api(a,'POST','/users/'+ids[1]+'/conversation');
  expect(pair.status,JSON.stringify(pair.data)).toBe(200);
  const conversationId=pair.data.conversationId;
  expect(UUID.test(conversationId)).toBe(true);
  expect((await api(b,'GET','/conversations/'+conversationId)).status).toBe(200);
  const denied=[
   ['GET','/conversations/'+conversationId],
   ['GET','/conversations/'+conversationId+'/messages'],
   ['POST','/conversations/'+conversationId+'/messages',{body:'UNAUTHORIZED-STEP13'}],
   ['POST','/conversations/'+conversationId+'/read'],
  ];
  for(const [method,path,body] of denied){
   const result=await api(c,method,path,body);
   expect(result.status,method+' '+path+' '+JSON.stringify(result.data)).toBe(404);
  }
  const guest=await c.evaluate(async url=>{
   const r=await fetch(url,{cache:'no-store'});
   return r.status;
  },API+'/conversations/'+conversationId);
  expect(guest).toBe(401);
 }finally{
  await Promise.allSettled(contexts.map(x=>x.close()));
 }
});
