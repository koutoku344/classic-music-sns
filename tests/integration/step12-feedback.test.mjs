import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleRecruitments } from '../../backend/src/recruitments.ts';

const ID='076fbdf9-c414-4937-8074-2f0c5b700316';
const ACTOR='176fbdf9-c414-4937-8074-2f0c5b700316';
function req(body) {
 return new Request('https://test.invalid/recruitments/'+ID+'/applications',
  {method:'POST',body:JSON.stringify(body)});
}
const sql=async()=>{throw Error('invalid input reached DB');};
test('STEP12 feedback: malformed application fields rejected before database',async()=>{
 for(const body of [
  {message:'x'.repeat(1001),instrument:null},
  {message:17,instrument:null},
  {message:'hello',instrument:'not-an-instrument'},
  {message:'hello',instrument:['Piano']},
  {message:'hello',instrument:null,mediaId:ID},
  null
 ]){
  const response=await handleRecruitments(req(body),sql,ACTOR,{});
  assert.equal(response.status,400,JSON.stringify(body)?.slice(0,30));
 }
});
test('STEP12 feedback: legacy empty application payload remains accepted syntactically',async()=>{
 const calls=[];
 const stub=async(strings,...args)=>{
  const q=strings.join('?');calls.push(q);
  assert.match(q,/cardinality\(r.instruments\)/);
  assert.match(q,/excluded.message/);
  assert.match(q,/excluded.instrument/);
  assert.match(q,/r.user_id<>\?::uuid/);
  return [];
 };
 const r=await handleRecruitments(new Request('https://test.invalid/recruitments/'+ID+'/applications',{method:'POST'}),stub,ACTOR,{});
 assert.equal(r.status,409);
 assert.equal(calls.length,1);
});
test('STEP12 feedback: comment is only returned by owner-gated applicant endpoint',()=>{
 const source=readFileSync(new URL('../../backend/src/recruitments.ts',import.meta.url),'utf8');
 const list=source.slice(source.indexOf('if(m==="GET"&&id&&!app&&p===`/recruitments/${id}/applications`)'));
 assert.match(list,/a.message,a.instrument/);
 assert.match(list,/r.user_id=\$\{userId\}::uuid/);
 assert.match(source,/AS instrument_counts/);
});
test('STEP12 feedback: notifications are scoped to recruitment and use database trigger',()=>{
 const sqlMigration=readFileSync(new URL('../../db/migrations/025_recruitment_application_feedback.sql',import.meta.url),'utf8');
 assert.match(sqlMigration,/AFTER INSERT OR UPDATE OF status ON public.recruitment_applications/);
 assert.match(sqlMigration,/recruitment_application/);
 assert.match(sqlMigration,/recruitment_accepted/);
 assert.match(sqlMigration,/recruitment_rejected/);
 assert.match(sqlMigration,/ON CONFLICT\(event_key\) DO NOTHING/);
});
test('STEP12 feedback: community refresh and applicant UI present',()=>{
 const base=new URL('../../features/sonolii/',import.meta.url);
 const community=readFileSync(new URL('screens/Community.tsx',base),'utf8');
 const detail=readFileSync(new URL('screens/RecruitmentDetail.tsx',base),'utf8');
 assert.match(community,/sonolii:recruitment-changed/);
 assert.match(detail,/応募コメント/);
 assert.match(detail,/応募する楽器/);
 assert.match(detail,/instrument_counts/);
});
