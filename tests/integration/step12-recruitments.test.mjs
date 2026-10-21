import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isRecruitmentRoute, isPublicRecruitmentRead, parseRecruitment } from '../../backend/src/recruitments.ts';

const id='076fbdf9-c414-4937-8074-2f0c5b700316';
const valid={
 pieceId:null,instruments:['Piano','Violin'],regions:['大阪','オンライン'],
 level:'問わない',purpose:'アンサンブル',description:'週末の合わせを募集します'
};

test('STEP12: accepts a valid text-only recruitment and optional piece',()=>{
 assert.deepEqual(parseRecruitment(valid),valid);
 assert.equal(parseRecruitment({...valid,pieceId:id})?.pieceId,id);
});
test('STEP12: rejects media fields and malformed inputs',()=>{
 for(const input of [
  {...valid,audioMediaId:id},{...valid,mediaIds:[id]}, {...valid,instruments:[]},
  {...valid,instruments:['Piano','Piano']},{...valid,regions:['不正な地域']},
  {...valid,description:'  '},{...valid,description:'x'.repeat(2001)},
  {...valid,pieceId:'not-uuid'},{...valid,status:'open'}
 ]) assert.equal(parseRecruitment(input),null,JSON.stringify(input).slice(0,90));
});
test('STEP12: public reads only list and detail, not applicant management',()=>{
 for(const route of ['/recruitments','/recruitments/'+id])assert.equal(isPublicRecruitmentRead('GET',route),true);
 for(const route of ['/recruitments/'+id+'/applications','/recruitments/'+id+'/status','/recruitments/'+id+'/applications/'+id+'/accept']) {
  assert.equal(isRecruitmentRoute(route),true,route);
  assert.equal(isPublicRecruitmentRead('GET',route),false,route);
 }
});
test('STEP12: application decisions and ownership are filtered in SQL',()=>{
 const source=readFileSync(new URL('../../backend/src/recruitments.ts',import.meta.url),'utf8');
 assert.match(source,/r\.user_id=\$\{userId\}::uuid/);
 assert.match(source,/a\.status='pending'/);
 assert.match(source,/r\.status='open'/);
 assert.match(source,/ON CONFLICT \(recruitment_id,applicant_id\)/);
});
test('STEP12: no recruitment audio or mock data in connected screens',()=>{
 const root=new URL('../../features/sonolii/',import.meta.url);
 const create=readFileSync(new URL('screens/CreateRecruitment.tsx',root),'utf8');
 const detail=readFileSync(new URL('screens/RecruitmentDetail.tsx',root),'utf8');
 const community=readFileSync(new URL('screens/Community.tsx',root),'utf8');
 const search=readFileSync(new URL('screens/Search.tsx',root),'utf8');
 assert.doesNotMatch(create,/AudioPreview|audioMediaId|録音開始/);
 assert.match(create,/createRecruitment\(/);
 assert.match(detail,/decideRecruitmentApplicant/);
 assert.match(community,/listRecruitments/);
 assert.match(search,/listRecruitments/);
 assert.doesNotMatch(community,/from '\.\.\/data'/);
});
