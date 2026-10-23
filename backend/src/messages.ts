import type { NeonQueryFunction } from "@neondatabase/serverless";
type Sql = NeonQueryFunction<false,false>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply=(body:unknown,status:number,h:Record<string,string>)=>Response.json(body,{status,headers:{"Cache-Control":"no-store",...h}});
export const isMessageRoute=(p:string)=>p==="/conversations"||/^\/conversations\/[^/]+(?:\/(?:messages|read))?$/.test(p)||/^\/recruitments\/[^/]+\/applications\/[^/]+\/conversation$/.test(p);
export async function handleMessages(request:Request,sql:Sql,userId:string|null,headers:Record<string,string>):Promise<Response>{
 if(!userId)return reply({error:"unauthorized"},401,headers);
 const {pathname:p,searchParams:q}=new URL(request.url),m=request.method;
 if(m==="POST"&&/^\/recruitments\/[^/]+\/applications\/[^/]+\/conversation$/.test(p)){
  const rid=p.split("/")[2],applicationId=p.split("/")[4];if(!UUID.test(rid)||!UUID.test(applicationId))return reply({error:"not_found"},404,headers);
  // A conversation is only created after the application has been approved.
  // A single INSERT ... SELECT ties participants to the accepted application.
  const rows=await sql`
   INSERT INTO public.conversations(application_id,organizer_id,applicant_id,recruitment_description)
   SELECT a.id,r.user_id,a.applicant_id,r.description
   FROM public.recruitment_applications a JOIN public.recruitments r ON r.id=a.recruitment_id
   WHERE r.id=${rid}::uuid AND a.id=${applicationId}::uuid AND a.status='accepted'
     AND (r.user_id=${userId}::uuid OR a.applicant_id=${userId}::uuid)
   LIMIT 1
   ON CONFLICT (application_id) DO UPDATE SET application_id=excluded.application_id
   RETURNING id
  `;
  return rows.length?reply({conversationId:rows[0].id},200,headers):reply({error:"no_accepted_application"},403,headers);
 }
 if(m==="GET"&&p==="/conversations"){
  const rows=await sql`
   SELECT c.id,c.application_id,c.organizer_id,c.applicant_id,c.recruitment_description,c.updated_at,
   CASE WHEN c.organizer_id=${userId}::uuid THEN c.applicant_read_at ELSE c.organizer_read_at END AS other_read_at,
   pr.display_name AS partner_name,
   (SELECT dm.body FROM public.direct_messages dm WHERE dm.conversation_id=c.id ORDER BY dm.created_at DESC,dm.id DESC LIMIT 1) AS last_message,
   (SELECT count(*)::int FROM public.direct_messages dm WHERE dm.conversation_id=c.id AND dm.sender_id<>${userId}::uuid
      AND dm.created_at>(CASE WHEN c.organizer_id=${userId}::uuid THEN c.organizer_read_at ELSE c.applicant_read_at END)) AS unread_count
   FROM public.conversations c
   JOIN public.profiles pr ON pr.user_id=(CASE WHEN c.organizer_id=${userId}::uuid THEN c.applicant_id ELSE c.organizer_id END)
   WHERE c.organizer_id=${userId}::uuid OR c.applicant_id=${userId}::uuid
   ORDER BY c.updated_at DESC,c.id DESC LIMIT 100
  `;
  return reply({conversations:rows},200,headers);
 }
 const match=p.match(/^\/conversations\/([^/]+)(?:\/(messages|read))?$/);
 if(!match||!UUID.test(match[1]))return reply({error:"not_found"},404,headers);
 const cid=match[1],part=match[2];
 if(m==="GET"&&!part){
  const rows=await sql`
   SELECT c.id,c.organizer_id,c.applicant_id,c.recruitment_description,c.created_at,
   pr.display_name AS partner_name,
   CASE WHEN c.organizer_id=${userId}::uuid THEN c.applicant_id ELSE c.organizer_id END AS partner_id
   FROM public.conversations c
   JOIN public.profiles pr ON pr.user_id=(CASE WHEN c.organizer_id=${userId}::uuid THEN c.applicant_id ELSE c.organizer_id END)
   WHERE c.id=${cid}::uuid AND (c.organizer_id=${userId}::uuid OR c.applicant_id=${userId}::uuid)
  `;
  return rows.length?reply({conversation:rows[0]},200,headers):reply({error:"not_found"},404,headers);
 }
 if(m==="GET"&&part==="messages"){
  const cursor=q.get("cursor");
  if(cursor&&!UUID.test(cursor))return reply({error:"invalid_cursor"},400,headers);
  const rows=await sql`
   SELECT dm.id,dm.sender_id,dm.body,dm.created_at
   FROM public.direct_messages dm JOIN public.conversations c ON c.id=dm.conversation_id
   WHERE dm.conversation_id=${cid}::uuid AND (c.organizer_id=${userId}::uuid OR c.applicant_id=${userId}::uuid)
   AND (${cursor}::uuid IS NULL OR (dm.created_at,dm.id)<(SELECT x.created_at,x.id FROM public.direct_messages x WHERE x.id=${cursor}::uuid AND x.conversation_id=${cid}::uuid))
   ORDER BY dm.created_at DESC,dm.id DESC LIMIT 31
  `;
  return reply({messages:rows.slice(0,30),nextCursor:rows.length>30?rows[29].id:null},200,headers);
 }
 if(m==="POST"&&part==="messages"){
  let value:unknown;try{value=await request.json()}catch{return reply({error:"invalid_json"},400,headers);}
  if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).some(k=>k!=="body"))return reply({error:"invalid_message"},400,headers);
  const raw=(value as {body?:unknown}).body;
  if(typeof raw!=="string"||!raw.trim()||raw.trim().length>2000)return reply({error:"invalid_message"},400,headers);
  const rows=await sql`
   WITH inserted AS (
    INSERT INTO public.direct_messages(conversation_id,sender_id,body)
    SELECT c.id,${userId}::uuid,${raw.trim()} FROM public.conversations c
    WHERE c.id=${cid}::uuid AND (c.organizer_id=${userId}::uuid OR c.applicant_id=${userId}::uuid)
    RETURNING id,conversation_id,sender_id,body,created_at
   ), touched AS (
    UPDATE public.conversations c SET updated_at=now()
    FROM inserted i WHERE c.id=i.conversation_id RETURNING c.id
   )
   SELECT i.id,i.sender_id,i.body,i.created_at FROM inserted i
  `;
  return rows.length?reply({message:rows[0]},201,headers):reply({error:"not_found"},404,headers);
 }
 if(m==="POST"&&part==="read"){
  const rows=await sql`
   UPDATE public.conversations
   SET organizer_read_at=CASE WHEN organizer_id=${userId}::uuid THEN clock_timestamp() ELSE organizer_read_at END,
       applicant_read_at=CASE WHEN applicant_id=${userId}::uuid THEN clock_timestamp() ELSE applicant_read_at END
   WHERE id=${cid}::uuid AND (organizer_id=${userId}::uuid OR applicant_id=${userId}::uuid) RETURNING id
  `;
  return rows.length?new Response(null,{status:204,headers}):reply({error:"not_found"},404,headers);
 }
 return reply({error:"not_found"},404,headers);
}
