import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRecruitments } from '../../backend/src/recruitments.ts';

const ID='076fbdf9-c414-4937-8074-2f0c5b700316';
const OWNER='176fbdf9-c414-4937-8074-2f0c5b700316';
const APP='276fbdf9-c414-4937-8074-2f0c5b700316';
const request=(method,path,body)=>new Request('https://test.invalid'+path,{
 method,...(body===undefined?{}:{body:JSON.stringify(body)})
});
const run=(req,sql,user)=>handleRecruitments(req,sql,user,{});
function sqlStub(handlers){
 const calls=[];
 const sql=async(strings,...args)=>{
  const statement=strings.join('?');
  calls.push({statement,args});
  return handlers(statement,args,calls.length);
 };
 return {sql,calls};
}
test('STEP12: anonymous public detail redacts private application state to SQL viewer null',async()=>{
 const db=sqlStub((query,args)=>{
  assert.match(query,/a.applicant_id=\?/);
  assert.equal(args[0],null);
  return [{id:ID,applicants:0,my_application:null}];
 });
 const response=await run(request('GET','/recruitments/'+ID),db.sql,null);
 assert.equal(response.status,200);
 assert.equal((await response.json()).recruitment.my_application,null);
});
test('STEP12: unauthenticated writes and applicant-list reads are denied before DB',async()=>{
 const db=sqlStub(()=>{throw Error('Database must not be called');});
 for(const [method,path] of [
  ['POST','/recruitments'],['POST','/recruitments/'+ID+'/applications'],
  ['GET','/recruitments/'+ID+'/applications'],
  ['POST','/recruitments/'+ID+'/applications/'+APP+'/accept'],
  ['PATCH','/recruitments/'+ID+'/status'],
 ]) {
  const response=await run(request(method,path),db.sql,null);
  assert.equal(response.status,401,method+' '+path);
 }
 assert.equal(db.calls.length,0);
});
test('STEP12: rejecting unauthorized owner status change returns 404',async()=>{
 const db=sqlStub((q,args)=>{assert.match(q,/WHERE id=\?::uuid AND user_id=\?::uuid/);assert.equal(args[2],APP);return [];});
 const res=await run(request('PATCH','/recruitments/'+ID+'/status',{status:'closed'}),db.sql,APP);
 assert.equal(res.status,404);
});
test('STEP12: application decision SQL requires owner, open recruitment and pending application',async()=>{
 const db=sqlStub(q=>{
  assert.match(q,/r.user_id=\?::uuid/);
  assert.match(q,/r.status='open'/);
  assert.match(q,/a.status='pending'/);
  return [];
 });
 const res=await run(request('POST','/recruitments/'+ID+'/applications/'+APP+'/accept'),db.sql,OWNER);
 assert.equal(res.status,404);
});
test('STEP12: invalid filters and malformed status updates do not reach SQL',async()=>{
 const db=sqlStub(()=>{throw Error('invalid request reached database');});
 assert.equal((await run(request('GET','/recruitments?instrument=Unknown'),db.sql,null)).status,400);
 for(const bad of [{status:'pending'},{status:'open',user_id:OWNER},null]) {
  assert.equal((await run(request('PATCH','/recruitments/'+ID+'/status',bad),db.sql,OWNER)).status,400);
 }
 assert.equal(db.calls.length,0);
});
