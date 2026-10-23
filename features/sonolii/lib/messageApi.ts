import { API_BASE } from './repertoireApi';
import type { TokenGetter } from './mediaApi';

export type ConversationRow = {
 id:string; application_id:string|null; organizer_id:string; applicant_id:string;
 recruitment_description:string; partner_name:string; partner_id?:string;
 last_message?:string|null; unread_count?:number; updated_at?:string;
};
export type MessageRow = {id:string;sender_id:string;body:string;created_at:string};

async function call(path:string,getToken:TokenGetter,init:RequestInit={}):Promise<Response>{
 const token=await getToken();
 if(!token)throw Error('ログインしてください。');
 const response=await fetch(API_BASE+path,{
  ...init,cache:'no-store',signal:AbortSignal.timeout(15000),
  headers:{...(init.body?{'Content-Type':'application/json'}:{}),Authorization:'Bearer '+token}
 });
 if(!response.ok)throw Error('メッセージAPIエラー（HTTP '+response.status+'）');
 return response;
}
export async function listConversations(getToken:TokenGetter):Promise<ConversationRow[]>{
 return (await (await call('/conversations',getToken)).json() as {conversations:ConversationRow[]}).conversations;
}
export async function getConversation(id:string,getToken:TokenGetter):Promise<ConversationRow>{
 return (await (await call('/conversations/'+encodeURIComponent(id),getToken)).json() as {conversation:ConversationRow}).conversation;
}
export async function listMessages(id:string,getToken:TokenGetter,cursor?:string):Promise<{messages:MessageRow[];nextCursor:string|null}>{
 return await (await call('/conversations/'+encodeURIComponent(id)+'/messages'+(cursor?'?cursor='+encodeURIComponent(cursor):''),getToken)).json();
}
export async function sendMessage(id:string,body:string,getToken:TokenGetter):Promise<MessageRow>{
 return (await (await call('/conversations/'+encodeURIComponent(id)+'/messages',getToken,{method:'POST',body:JSON.stringify({body})})).json() as {message:MessageRow}).message;
}
export async function markConversationRead(id:string,getToken:TokenGetter):Promise<void>{
 await call('/conversations/'+encodeURIComponent(id)+'/read',getToken,{method:'POST'});
}
export async function getOrCreateConversation(recruitmentId:string,applicationId:string,getToken:TokenGetter):Promise<string>{
 const path='/recruitments/'+encodeURIComponent(recruitmentId)+'/applications/'+encodeURIComponent(applicationId)+'/conversation';
 return (await (await call(path,getToken,{method:'POST'})).json() as {conversationId:string}).conversationId;
}
