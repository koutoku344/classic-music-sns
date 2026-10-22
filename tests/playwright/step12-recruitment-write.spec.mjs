import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";
import { randomUUID } from "node:crypto";

const API = "https://sonolii-api.g57cydy6ks.workers.dev";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function config() {
 const e=process.env;
 expect(e.CI===undefined||/^(false|0)$/i.test(e.CI),"CI writes prohibited").toBe(true);
 expect(e.SONOLII_TEST_PHASE).toBe("PRE_RELEASE");
 expect(e.SONOLII_TEST_WRITE_CONFIRM).toBe("I_CONFIRM_TEST_WRITES");
 expect((e.SONOLII_TEST_API_URL??"").replace(/\/$/,"")).toBe(API);
 expect(e.SONOLII_TEST_OWNER_EMAIL).toBeTruthy();
 expect(e.SONOLII_TEST_ACTOR_EMAIL).toBeTruthy();
 expect(e.SONOLII_TEST_OWNER_EMAIL).not.toBe(e.SONOLII_TEST_ACTOR_EMAIL);
 expect(UUID.test(e.SONOLII_TEST_OWNER_ID??"")).toBe(true);
 return {ownerEmail:e.SONOLII_TEST_OWNER_EMAIL,actorEmail:e.SONOLII_TEST_ACTOR_EMAIL,ownerId:e.SONOLII_TEST_OWNER_ID};
}
async function login(page,email){
 await page.goto("/",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>window.Clerk?.loaded===true,null,{timeout:20000});
 await clerk.signIn({page,emailAddress:email});
 await page.waitForFunction(()=>Boolean(window.Clerk?.session),null,{timeout:20000});
}
async function api(page,method,path,body){
 return page.evaluate(async ({base,method,path,body})=>{
  const token=await window.Clerk.session?.getToken({skipCache:true});
  if(!token)throw Error("Clerk token missing");
  const r=await fetch(base+path,{method,cache:"no-store",signal:AbortSignal.timeout(20000),
   headers:{Authorization:"Bearer "+token,...(body===undefined?{}:{"Content-Type":"application/json"})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  const txt=await r.text();
  return {status:r.status,body:txt?JSON.parse(txt):null};
 },{base:API,method,path,body});
}
function ok(r,expected,label){expect(r.status,label+" "+JSON.stringify(r.body)).toBe(expected);}

test("STEP12 A/B: create, cancel, reject, reapply, accept, close and cleanup",async({browser})=>{
 test.setTimeout(240000);
 const c=config();
 const oc=await browser.newContext(),ac=await browser.newContext();
 const owner=await oc.newPage(),actor=await ac.newPage();
 const marker="STEP12-E2E-"+randomUUID();
 let id=null;
 const errors=[];
 try{
  // Clerk testing sign-in helpers may interfere when invoked concurrently.
  // Keep distinct browser contexts, but complete each sign-in sequentially.
  await login(owner,c.ownerEmail);
  await login(actor,c.actorEmail);
  const op=await api(owner,"GET","/me/profile"),ap=await api(actor,"GET","/me/profile");
  ok(op,200,"owner profile");ok(ap,200,"actor profile");
  expect(op.body.profile?.user_id).toBe(c.ownerId);
  const actorId=ap.body.profile?.user_id;
  expect(UUID.test(actorId??"")).toBe(true);expect(actorId).not.toBe(c.ownerId);
  const created=await api(owner,"POST","/recruitments",{pieceId:null,instruments:["Piano"],regions:["大阪"],level:"問わない",purpose:"アンサンブル",description:marker});
  ok(created,201,"create");
  id=created.body?.recruitment?.id;expect(UUID.test(id??"")).toBe(true);
  const path="/recruitments/"+id;
  const detail=await api(actor,"GET",path);ok(detail,200,"public detail");
  expect(detail.body.recruitment.description).toBe(marker);
  expect(detail.body.recruitment.user_id).toBe(c.ownerId);
  await actor.goto("/recruitments/"+id);
  await expect(actor.getByText(marker,{exact:true})).toBeVisible({timeout:20000});
  await expect(actor.getByRole("button",{name:"応募する"})).toBeVisible();
  ok(await api(actor,"GET",path+"/applications"),404,"nonowner list");
  ok(await api(actor,"PATCH",path+"/status",{status:"closed"}),404,"nonowner status");
  ok(await api(owner,"POST",path+"/applications"),409,"self application");
  ok(await api(actor,"POST",path+"/applications"),201,"apply");
  expect((await api(actor,"GET",path)).body.recruitment.my_application).toBe("pending");
  ok(await api(actor,"POST",path+"/applications"),409,"duplicate");
  ok(await api(actor,"DELETE",path+"/applications"),204,"cancel");
  expect((await api(actor,"GET",path)).body.recruitment.my_application).toBeNull();
  ok(await api(actor,"POST",path+"/applications"),201,"reapply");
  let list=await api(owner,"GET",path+"/applications");ok(list,200,"list");
  let applicant=list.body.applications.find(x=>x.applicant_id===actorId&&x.status==="pending");
  expect(applicant).toBeTruthy();
  ok(await api(owner,"POST",path+"/applications/"+applicant.id+"/reject"),204,"reject");
  expect((await api(actor,"GET",path)).body.recruitment.my_application).toBe("rejected");
  ok(await api(actor,"POST",path+"/applications"),201,"retry after reject");
  list=await api(owner,"GET",path+"/applications");ok(list,200,"list after retry");
  applicant=list.body.applications.find(x=>x.applicant_id===actorId&&x.status==="pending");
  expect(applicant).toBeTruthy();
  ok(await api(owner,"POST",path+"/applications/"+applicant.id+"/accept"),204,"accept");
  expect((await api(actor,"GET",path)).body.recruitment.my_application).toBe("accepted");
  ok(await api(owner,"PATCH",path+"/status",{status:"closed"}),204,"close");
  expect((await api(actor,"GET",path)).body.recruitment.status).toBe("closed");
  ok(await api(actor,"POST",path+"/applications"),409,"closed cannot apply");
  await actor.reload();
  await expect(actor.getByText(/応募が承認されました/)).toBeVisible({timeout:20000});
 }catch(e){errors.push(e);}
 finally{
  if(id){
   try{
    const detail=await api(owner,"GET","/recruitments/"+id);
    if(detail.status===200){
     expect(detail.body.recruitment.user_id).toBe(c.ownerId);
     expect(detail.body.recruitment.description).toBe(marker);
     ok(await api(owner,"DELETE","/recruitments/"+id),204,"fixture cleanup");
     ok(await api(owner,"GET","/recruitments/"+id),404,"cleanup verified");
    }else ok(detail,404,"fixture already deleted");
   }catch(e){errors.push(e);}
  }
  await Promise.allSettled([oc.close(),ac.close()]);
 }
 if(errors.length)throw new AggregateError(errors,"STEP12 E2E failed; inspect cleanup");
});
