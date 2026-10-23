import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleMessages, isMessageRoute } from '../../backend/src/messages.ts';

const RECRUIT='076fbdf9-c414-4937-8074-2f0c5b700316';
const APPLICATION='176fbdf9-c414-4937-8074-2f0c5b700316';
const CONVERSATION='276fbdf9-c414-4937-8074-2f0c5b700316';
const USER='376fbdf9-c414-4937-8074-2f0c5b700316';
const request=(method,path,body)=>new Request('https://test.invalid'+path,
 {method,...(body===undefined?{}:{body:JSON.stringify(body)})});
const run=(req,sql,user)=>handleMessages(req,sql,user,{});
test('STEP13: routes identified, authorization required for every route',async()=>{
 for(const route of ['/conversations','/conversations/'+CONVERSATION,
 '/conversations/'+CONVERSATION+'/messages','/conversations/'+CONVERSATION+'/read',
 '/recruitments/'+RECRUIT+'/applications/'+APPLICATION+'/conversation']){
  assert.equal(isMessageRoute(route),true,route);
  const res=await run(request('GET',route),()=>{throw Error('No DB for guest');},null);
  assert.equal(res.status,401);
 }
});
test('STEP13: unauthenticated and malformed chat writes rejected',async()=>{
 const db=()=>{throw Error('Invalid input must not touch DB');};
 for(const body of [{body:''},{body:' '},{body:'x'.repeat(2001)},{body:42},{other:'abc'},null]){
  const res=await run(request('POST','/conversations/'+CONVERSATION+'/messages',body),db,USER);
  assert.equal(res.status,400);
 }
});
test('STEP13: conversation creation SQL bound to accepted application and caller identity',async()=>{
 let invoked=false;
 const sql=async(strings,...args)=>{
  invoked=true;
  const statement=strings.join('?');
  assert.match(statement,/a.id=\?::uuid AND a.status='accepted'/);
  assert.match(statement,/a.applicant_id=\?::uuid/);
  assert.match(statement,/ON CONFLICT \(application_id\)/);
  assert.deepEqual(args.slice(0,2),[RECRUIT,APPLICATION]);
  return [];
 };
 const res=await run(request('POST','/recruitments/'+RECRUIT+'/applications/'+APPLICATION+'/conversation'),sql,USER);
 assert.equal(res.status,403);
 assert.equal(invoked,true);
});
test('STEP13: messages and reads filter by actual participant identity in SQL',()=>{
 const code=readFileSync(new URL('../../backend/src/messages.ts',import.meta.url),'utf8');
 assert.match(code,/dm.sender_id<>\$\{userId\}::uuid/);
 assert.match(code,/c.organizer_id=\$\{userId\}::uuid OR c.applicant_id=\$\{userId\}::uuid/);
 assert.match(code,/sender_id,body/);
 const migration=readFileSync(new URL('../../db/migrations/026_create_conversations.sql',import.meta.url),'utf8');
 assert.match(migration,/ON DELETE SET NULL/);
 assert.match(migration,/UNIQUE REFERENCES public.recruitment_applications/);
 assert.match(migration,/direct_messages_conversation_idx/);
});
test('STEP13: message screens do not use sample conversations',()=>{
 const root=new URL('../../features/sonolii/screens/',import.meta.url);
 for(const name of ['Messages.tsx','Conversation.tsx']){
  const code=readFileSync(new URL(name,root),'utf8');
  assert.doesNotMatch(code,/from '\.\.\/data'/);
 }
});
