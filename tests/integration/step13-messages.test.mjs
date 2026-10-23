import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleMessages,isMessageRoute } from '../../backend/src/messages.ts';

const USER='376fbdf9-c414-4937-8074-2f0c5b700316';
const PEER='176fbdf9-c414-4937-8074-2f0c5b700316';
const CONV='276fbdf9-c414-4937-8074-2f0c5b700316';
const req=(method,path,body)=>new Request('https://test.invalid'+path,{method,...(body===undefined?{}:{body:JSON.stringify(body)})});
const run=(r,sql,user=USER)=>handleMessages(r,sql,user,{});
test('STEP13: authentication is required on all DM routes',async()=>{
 for(const path of ['/conversations','/conversations/'+CONV,'/conversations/'+CONV+'/messages','/conversations/'+CONV+'/read','/users/'+PEER+'/conversation']){
  assert.equal(isMessageRoute(path),true);
  assert.equal((await run(req('GET',path),()=>{throw Error('database reached');},null)).status,401);
 }
 assert.equal(isMessageRoute('/recruitments/'+CONV+'/conversation'),false);
});
test('STEP13: profile DM is canonical and requires both profiles',async()=>{
 const sql=async(strings,...args)=>{
  const statement=strings.join('?');
  assert.match(statement,/LEAST\(\?::uuid,\?::uuid\),GREATEST/);
  assert.match(statement,/EXISTS\(SELECT 1 FROM public.profiles/);
  assert.match(statement,/ON CONFLICT\(user_a_id,user_b_id\)/);
  assert.equal(args[0],USER);assert.equal(args[1],PEER);
  return [{id:CONV}];
 };
 const r=await run(req('POST','/users/'+PEER+'/conversation'),sql);
 assert.equal(r.status,200);
 assert.equal((await r.json()).conversationId,CONV);
});
test('STEP13: self conversation and malformed message rejected before SQL',async()=>{
 const sql=()=>{throw Error('database reached');};
 assert.equal((await run(req('POST','/users/'+USER+'/conversation'),sql)).status,400);
 for(const body of [{body:''},{body:' '},{body:'x'.repeat(2001)},{body:42},{other:'a'},null])
  assert.equal((await run(req('POST','/conversations/'+CONV+'/messages',body),sql)).status,400);
});
test('STEP13: all message reads/writes restricted to conversation participants',()=>{
 const src=readFileSync(new URL('../../backend/src/messages.ts',import.meta.url),'utf8');
 assert.match(src,/c.user_a_id=\$\{userId\}::uuid OR c.user_b_id=\$\{userId\}::uuid/);
 const migration=readFileSync(new URL('../../db/migrations/026_create_conversations.sql',import.meta.url),'utf8');
 assert.match(migration,/conversation_unique_pair/);
 assert.match(migration,/direct_message_notify/);
 assert.match(migration,/direct_message:/);
 assert.doesNotMatch(migration,/recruitment_applications/);
});
test('STEP13: all screens use API, not sample data, and notification links target a DM',()=>{
 const base=new URL('../../features/sonolii/',import.meta.url);
 const list=readFileSync(new URL('screens/Messages.tsx',base),'utf8');
 const detail=readFileSync(new URL('screens/Conversation.tsx',base),'utf8');
 const profile=readFileSync(new URL('screens/UserProfile.tsx',base),'utf8');
 const notifications=readFileSync(new URL('screens/Notifications.tsx',base),'utf8');
 for(const src of [list,detail])assert.doesNotMatch(src,/from '\.\.\/data'/);
 assert.match(profile,/getOrCreateConversation/);
 assert.match(notifications,/direct_message/);
 assert.match(detail,/setInterval/);
});
