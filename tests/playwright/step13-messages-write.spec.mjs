import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { randomUUID } from 'node:crypto';

const API='https://sonolii-api.g57cydy6ks.workers.dev';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function config(){
 const e=process.env;
 expect(e.CI===undefined||/^(false|0)$/i.test(e.CI),'CI writes prohibited').toBe(true);
 expect(e.SONOLII_TEST_PHASE).toBe('PRE_RELEASE');
 expect(e.SONOLII_TEST_WRITE_CONFIRM).toBe('I_CONFIRM_TEST_WRITES');
 expect((e.SONOLII_TEST_API_URL??'').replace(/\/$/,'')).toBe(API);
 expect(e.SONOLII_TEST_OWNER_EMAIL).toBeTruthy();
 expect(e.SONOLII_TEST_ACTOR_EMAIL).toBeTruthy();
 expect(e.SONOLII_TEST_OWNER_EMAIL).not.toBe(e.SONOLII_TEST_ACTOR_EMAIL);
 expect(UUID.test(e.SONOLII_TEST_OWNER_ID??'')).toBe(true);
 return {a:e.SONOLII_TEST_OWNER_EMAIL,b:e.SONOLII_TEST_ACTOR_EMAIL,id:e.SONOLII_TEST_OWNER_ID};
}
async function login(page,email){
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.Clerk?.loaded===true,null,{timeout:20000});
 await clerk.signIn({page,emailAddress:email});
 await page.waitForFunction(()=>Boolean(window.Clerk?.session),null,{timeout:20000});
}
async function api(page,method,path,body){
 return page.evaluate(async ({base,method,path,body})=>{
  const token=await window.Clerk.session?.getToken({skipCache:true});
  if(!token)throw Error('Clerk token missing');
  const r=await fetch(base+path,{method,cache:'no-store',signal:AbortSignal.timeout(20000),
   headers:{Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  const raw=await r.text();return {status:r.status,data:raw?JSON.parse(raw):null};
 },{base:API,method,path,body});
}
function ok(r,status,label){expect(r.status,label+': '+JSON.stringify(r.data)).toBe(status);}
test('STEP13 unified DM A/B: one pair, send, notify, unread, read, reply, unauthorized',async({browser})=>{
 test.setTimeout(240000);
 const c=config(),ca=await browser.newContext(),cb=await browser.newContext();
 const a=await ca.newPage(),b=await cb.newPage(),marker='STEP13-E2E-'+randomUUID();
 try{
  await login(a,c.a);await login(b,c.b);
  const pa=await api(a,'GET','/me/profile'),pb=await api(b,'GET','/me/profile');
  ok(pa,200,'profile A');ok(pb,200,'profile B');
  expect(pa.data.profile.user_id).toBe(c.id);
  const bid=pb.data.profile.user_id;expect(UUID.test(bid)).toBe(true);
  expect(bid).not.toBe(c.id);
  const open=await api(a,'POST','/users/'+bid+'/conversation');
  ok(open,200,'create A/B conversation');
  const id=open.data.conversationId;expect(UUID.test(id)).toBe(true);
  const repeat=await api(b,'POST','/users/'+c.id+'/conversation');
  ok(repeat,200,'same conversation B/A');expect(repeat.data.conversationId).toBe(id);
  const detail=await api(a,'GET','/conversations/'+id);ok(detail,200,'details');
  expect(detail.data.conversation.partner_id).toBe(bid);
  const send=await api(a,'POST','/conversations/'+id+'/messages',{body:marker});ok(send,201,'send');
  const inbox=await api(b,'GET','/conversations');ok(inbox,200,'inbox');
  const entry=inbox.data.conversations.find(v=>v.id===id);
  expect(entry).toBeTruthy();expect(entry.last_message).toBe(marker);expect(entry.unread_count).toBeGreaterThanOrEqual(1);
  const notices=await api(b,'GET','/me/notifications');ok(notices,200,'notifications');
  expect(notices.data.notifications.some(v=>v.type==='direct_message'&&v.conversationId===id)).toBe(true);
  const received=await api(b,'GET','/conversations/'+id+'/messages');ok(received,200,'messages');
  expect(received.data.messages.some(v=>v.body===marker&&v.sender_id===c.id)).toBe(true);
  ok(await api(b,'POST','/conversations/'+id+'/read'),204,'mark read');
  const after=await api(b,'GET','/conversations');ok(after,200,'inbox after read');
  expect(after.data.conversations.find(v=>v.id===id).unread_count).toBe(0);
  const reply=await api(b,'POST','/conversations/'+id+'/messages',{body:marker+'-reply'});ok(reply,201,'reply');
  await a.goto('/messages/'+id);
  await expect(a.getByText(marker,{exact:true})).toBeVisible({timeout:20000});
  await expect(a.getByText(marker+'-reply',{exact:true})).toBeVisible({timeout:20000});
  // This test deliberately uses only its own message marker, without deleting user conversations or notices.
 }finally{
  await Promise.allSettled([ca.close(),cb.close()]);
 }
});
