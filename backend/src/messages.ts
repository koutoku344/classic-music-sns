import type { NeonQueryFunction } from "@neondatabase/serverless";
type Sql=NeonQueryFunction<false,false>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply=(body:unknown,status:number,h:Record<string,string>)=>Response.json(body,{status,headers:{"Cache-Control":"no-store",...h}});
export const isMessageRoute=(p:string)=>p==="/conversations"||/^\/conversations\/[^/]+(?:\/(?:messages|read))?$/.test(p)||/^\/users\/[^/]+\/conversation$/.test(p);
export async function handleMessages(request:Request,sql:Sql,userId:string|null,headers:Record<string,string>):Promise<Response>{
 if(!userId)return reply({error:"unauthorized"},401,headers);
 const {pathname:p,searchParams:q}=new URL(request.url),m=request.method;
 if(m==="POST"&&/^\/users\/[^/]+\/conversation$/.test(p)){
  const partner=p.split("/")[2];
  if(!UUID.test(partner)||partner===userId)return reply({error:"invalid_partner"},400,headers);
  // Require both users to have completed profiles; canonical pair prevents duplicates.
  const rows=await sql`
   INSERT INTO public.conversations(user_a_id,user_b_id)
   SELECT LEAST(${userId}::uuid,${partner}::uuid),GREATEST(${userId}::uuid,${partner}::uuid)
   WHERE EXISTS(SELECT 1 FROM public.profiles WHERE user_id=${userId}::uuid)
     AND EXISTS(SELECT 1 FROM public.profiles WHERE user_id=${partner}::uuid)
   ON CONFLICT(user_a_id,user_b_id) DO UPDATE SET user_a_id=excluded.user_a_id
   RETURNING id
  `;
  return rows.length?reply({conversationId:rows[0].id},200,headers):reply({error:"profile_not_found"},404,headers);
 }
 if(m==="GET"&&p==="/conversations"){
  const rows=await sql`
   SELECT c.id,c.updated_at,pr.display_name AS partner_name,
   (SELECT dm.body FROM public.direct_messages dm WHERE dm.conversation_id=c.id ORDER BY dm.created_at DESC,dm.id DESC LIMIT 1) AS last_message,
   (SELECT count(*)::int FROM public.direct_messages dm WHERE dm.conversation_id=c.id AND dm.sender_id<>${userId}::uuid
     AND dm.created_at>(CASE WHEN c.user_a_id=${userId}::uuid THEN c.user_a_read_at ELSE c.user_b_read_at END)) AS unread_count
   FROM public.conversations c
   JOIN public.profiles pr ON pr.user_id=(CASE WHEN c.user_a_id=${userId}::uuid THEN c.user_b_id ELSE c.user_a_id END)
   WHERE c.user_a_id=${userId}::uuid OR c.user_b_id=${userId}::uuid
   ORDER BY c.updated_at DESC,c.id DESC LIMIT 100
  `;
  return reply({conversations:rows},200,headers);
 }
 const match=p.match(/^\/conversations\/([^/]+)(?:\/(messages|read))?$/);
 if(!match||!UUID.test(match[1]))return reply({error:"not_found"},404,headers);
 const id=match[1],part=match[2];
 if(m==="GET"&&!part){
  const rows=await sql`
   SELECT c.id,pr.display_name AS partner_name,
      CASE WHEN c.user_a_id=${userId}::uuid THEN c.user_b_id ELSE c.user_a_id END AS partner_id
   FROM public.conversations c
   JOIN public.profiles pr ON pr.user_id=(CASE WHEN c.user_a_id=${userId}::uuid THEN c.user_b_id ELSE c.user_a_id END)
   WHERE c.id=${id}::uuid AND (c.user_a_id=${userId}::uuid OR c.user_b_id=${userId}::uuid)
  `;
  return rows.length?reply({conversation:rows[0]},200,headers):reply({error:"not_found"},404,headers);
 }
 if(m==="GET"&&part==="messages"){
  const cursor=q.get("cursor");if(cursor&&!UUID.test(cursor))return reply({error:"invalid_cursor"},400,headers);
  const rows=await sql`
   SELECT dm.id,dm.sender_id,dm.body,dm.created_at FROM public.direct_messages dm
   JOIN public.conversations c ON c.id=dm.conversation_id
   WHERE dm.conversation_id=${id}::uuid AND (c.user_a_id=${userId}::uuid OR c.user_b_id=${userId}::uuid)
     AND (${cursor}::uuid IS NULL OR (dm.created_at,dm.id)<(SELECT d.created_at,d.id FROM public.direct_messages d WHERE d.id=${cursor}::uuid AND d.conversation_id=${id}::uuid))
   ORDER BY dm.created_at DESC,dm.id DESC LIMIT 31
  `;
  return reply({messages:rows.slice(0,30),nextCursor:rows.length>30?rows[29].id:null},200,headers);
 }
 if(m==="POST"&&part==="messages"){
  let value:unknown;try{value=await request.json();}catch{return reply({error:"invalid_json"},400,headers);}
  if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).some(k=>k!=="body"))return reply({error:"invalid_message"},400,headers);
  const body=(value as {body?:unknown}).body;
  if(typeof body!=="string"||!body.trim()||body.trim().length>2000)return reply({error:"invalid_message"},400,headers);
  const rows=await sql`
   INSERT INTO public.direct_messages(conversation_id,sender_id,body)
   SELECT c.id,${userId}::uuid,${body.trim()} FROM public.conversations c
   WHERE c.id=${id}::uuid AND (c.user_a_id=${userId}::uuid OR c.user_b_id=${userId}::uuid)
   RETURNING id,sender_id,body,created_at
  `;
  return rows.length?reply({message:rows[0]},201,headers):reply({error:"not_found"},404,headers);
 }
 if(m==="POST"&&part==="read"){
  const rows=await sql`
   UPDATE public.conversations SET
    user_a_read_at=CASE WHEN user_a_id=${userId}::uuid THEN clock_timestamp() ELSE user_a_read_at END,
    user_b_read_at=CASE WHEN user_b_id=${userId}::uuid THEN clock_timestamp() ELSE user_b_read_at END
   WHERE id=${id}::uuid AND (user_a_id=${userId}::uuid OR user_b_id=${userId}::uuid)
   RETURNING id
  `;
  return rows.length?new Response(null,{status:204,headers}):reply({error:"not_found"},404,headers);
 }
 return reply({error:"not_found"},404,headers);
}
