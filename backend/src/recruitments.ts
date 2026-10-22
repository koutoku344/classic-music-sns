import type { NeonQueryFunction } from "@neondatabase/serverless";
type Sql = NeonQueryFunction<false, false>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEVELS = ["初級","中級","上級","問わない"];
const PURPOSES = ["アンサンブル","発表会","趣味で合わせ","その他"];
const INST = ["Piano","Violin","Cello","Viola","Flute","Clarinet","Oboe","Trumpet","Guitar","その他"];
const REGION = ["東京","大阪","神奈川","京都","愛知","兵庫","福岡","オンライン"];
const resp=(v:unknown,s:number,h:Record<string,string>)=>Response.json(v,{status:s,headers:{"Cache-Control":"no-store",...h}});
const empty=(h:Record<string,string>)=>new Response(null,{status:204,headers:{"Cache-Control":"no-store",...h}});
export const isRecruitmentRoute=(path:string)=>path==="/recruitments"||/^\/recruitments\/[^/]+(?:\/(?:applications(?:\/[^/]+(?:\/(?:accept|reject))?)?|status))?$/.test(path);
export const isPublicRecruitmentRead=(method:string,path:string)=>method==="GET" && (path==="/recruitments"||/^\/recruitments\/[^/]+$/.test(path));
type RecruitmentInput={pieceId:string|null;instruments:string[];regions:string[];level:string;purpose:string;description:string};
export function parseRecruitment(raw:unknown):RecruitmentInput|null {
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
 const v=raw as Record<string,unknown>;
 if(Object.keys(v).some(k=>!["pieceId","instruments","regions","level","purpose","description"].includes(k)))return null;
 const pieceId=v.pieceId??null, instruments=v.instruments,regions=v.regions;
 if(pieceId!==null&&(typeof pieceId!=="string"||!UUID.test(pieceId)))return null;
 if(!Array.isArray(instruments)||!Array.isArray(regions)||!regions.length||instruments.length>10||regions.length>8)return null;
 if(instruments.some(i=>typeof i!=="string"||!INST.includes(i))||regions.some(i=>typeof i!=="string"||!REGION.includes(i)))return null;
 if(new Set(instruments).size!==instruments.length||new Set(regions).size!==regions.length)return null;
 if(typeof v.level!=="string"||!LEVELS.includes(v.level)||typeof v.purpose!=="string"||!PURPOSES.includes(v.purpose))return null;
 if(typeof v.description!=="string"||!v.description.trim()||v.description.trim().length>2000)return null;
 return {pieceId:pieceId as string|null,instruments:instruments as string[],regions:regions as string[],level:v.level,purpose:v.purpose,description:v.description.trim()};
}
const idOK=(value:string)=>UUID.test(value);
async function jsonBody(request:Request):Promise<unknown>{
 const text=await request.text();if(text.length>10000)throw Error("invalid_input");return JSON.parse(text);
}
export async function handleRecruitments(request:Request,sql:Sql,userId:string|null,headers:Record<string,string>):Promise<Response>{
 const url=new URL(request.url),p=url.pathname,m=request.method;
 const match=p.match(/^\/recruitments\/([^/]+)(?:\/(?:applications(?:\/([^/]+)(?:\/(accept|reject))?)?|status))?$/);
 const id=match?.[1], app=match?.[2], action=match?.[3];
 if(id&&!idOK(id))return resp({error:"not_found"},404,headers);
 if(app&&!idOK(app))return resp({error:"not_found"},404,headers);
 if(m==="GET"&&p==="/recruitments"){
  const piece=url.searchParams.get("pieceId"),inst=url.searchParams.get("instrument"),region=url.searchParams.get("region"),level=url.searchParams.get("level"),purpose=url.searchParams.get("purpose");
  if((piece&&!idOK(piece))||(inst&&!INST.includes(inst))||(region&&!REGION.includes(region))||(level&&!LEVELS.includes(level))||(purpose&&!PURPOSES.includes(purpose)))return resp({error:"invalid_filter"},400,headers);
  const cursor=url.searchParams.get("cursor");
  const parts=cursor?.split("|");if(cursor&&(parts?.length!==2||!Number.isFinite(Date.parse(parts[0]))||!idOK(parts[1])))return resp({error:"invalid_cursor"},400,headers);
  const rows=await sql`
   SELECT r.*,p.display_name,pi.title AS piece_title,c.name AS composer_name,
     (SELECT count(*)::int FROM public.recruitment_applications a WHERE a.recruitment_id=r.id AND a.status='accepted') AS applicants,
     (SELECT coalesce(jsonb_object_agg(instrument,quantity),'{}'::jsonb) FROM (SELECT coalesce(a.instrument,'その他') AS instrument,count(*)::int AS quantity FROM public.recruitment_applications a WHERE a.recruitment_id=r.id AND a.status IN ('pending','accepted') GROUP BY coalesce(a.instrument,'その他')) breakdown) AS instrument_counts
   FROM public.recruitments r
   JOIN public.profiles p ON p.user_id=r.user_id
   LEFT JOIN public.pieces pi ON pi.id=r.piece_id
   LEFT JOIN public.composers c ON c.id=pi.composer_id
   WHERE (${piece}::uuid IS NULL OR r.piece_id=${piece}::uuid)
     AND (${inst}::text IS NULL OR ${inst} = ANY(r.instruments))
     AND (${region}::text IS NULL OR ${region} = ANY(r.regions))
     AND (${level}::text IS NULL OR r.level=${level})
     AND (${purpose}::text IS NULL OR r.purpose=${purpose})
     AND (${parts?.[0]??null}::timestamptz IS NULL OR (r.created_at,r.id)<(${parts?.[0]??null}::timestamptz,${parts?.[1]??null}::uuid))
   ORDER BY r.created_at DESC,r.id DESC LIMIT 21
  `;
  const page=rows.slice(0,20);
  return resp({recruitments:page,nextCursor:rows.length>20?`${page[page.length-1].created_at.toISOString?.()??page[page.length-1].created_at}|${page[page.length-1].id}`:null},200,headers);
 }
 if(m==="GET"&&id&&!app&&p===`/recruitments/${id}`){
  const rows=await sql`
    SELECT r.*,pr.display_name,pi.title AS piece_title,c.name AS composer_name,
    (SELECT count(*)::int FROM public.recruitment_applications a WHERE a.recruitment_id=r.id AND a.status='accepted') AS applicants,
    (SELECT coalesce(jsonb_object_agg(instrument,quantity),'{}'::jsonb) FROM (SELECT coalesce(a.instrument,'その他') AS instrument,count(*)::int AS quantity FROM public.recruitment_applications a WHERE a.recruitment_id=r.id GROUP BY coalesce(a.instrument,'その他')) breakdown) AS instrument_counts,
    (SELECT a.status FROM public.recruitment_applications a WHERE a.recruitment_id=r.id AND a.applicant_id=${userId}::uuid) AS my_application
    FROM public.recruitments r JOIN public.profiles pr ON pr.user_id=r.user_id
    LEFT JOIN public.pieces pi ON pi.id=r.piece_id LEFT JOIN public.composers c ON c.id=pi.composer_id
    WHERE r.id=${id}::uuid LIMIT 1
  `;
  return rows.length?resp({recruitment:rows[0]},200,headers):resp({error:"not_found"},404,headers);
 }
 if(!userId)return resp({error:"unauthorized"},401,headers);
 if((m==="POST"&&p==="/recruitments")||(m==="PATCH"&&id&&!app&&p===`/recruitments/${id}`)){
  let input:RecruitmentInput|null=null;try{input=parseRecruitment(await jsonBody(request));}catch{}
  if(!input)return resp({error:"invalid_input"},400,headers);
  const {pieceId,instruments,regions,level,purpose,description}=input;
  const exists=await sql`SELECT 1 FROM public.profiles WHERE user_id=${userId}::uuid LIMIT 1`;
  if(!exists.length)return resp({error:"profile_required"},403,headers);
  const piece=pieceId?await sql`SELECT 1 FROM public.pieces WHERE id=${pieceId}::uuid LIMIT 1`:[1];
  if(!piece.length)return resp({error:"piece_not_found"},404,headers);
  const ins=JSON.stringify(instruments),regs=JSON.stringify(regions);
  if(m==="POST"){
   const rows=await sql`
    INSERT INTO public.recruitments(user_id,piece_id,instruments,regions,level,purpose,description)
    VALUES(${userId}::uuid,${pieceId}::uuid,ARRAY(SELECT jsonb_array_elements_text(${ins}::jsonb)),ARRAY(SELECT jsonb_array_elements_text(${regs}::jsonb)),${level},${purpose},${description})
    RETURNING id
   `;
   return resp({recruitment:{id:rows[0].id}},201,headers);
  }
  const rows=await sql`
   UPDATE public.recruitments SET piece_id=${pieceId}::uuid,instruments=ARRAY(SELECT jsonb_array_elements_text(${ins}::jsonb)),
   regions=ARRAY(SELECT jsonb_array_elements_text(${regs}::jsonb)),level=${level},purpose=${purpose},description=${description},updated_at=now()
   WHERE id=${id}::uuid AND user_id=${userId}::uuid AND status='open' RETURNING id
  `;
  return rows.length?resp({recruitment:{id}},200,headers):resp({error:"not_found_or_closed"},404,headers);
 }
 if(m==="POST"&&id&&!app&&p===`/recruitments/${id}/applications`){
  let payload:unknown;
  try{const raw=await request.text();payload=raw?JSON.parse(raw):{};}catch{return resp({error:"invalid_application"},400,headers);}
  if(!payload||typeof payload!=="object"||Array.isArray(payload))return resp({error:"invalid_application"},400,headers);
  const v=payload as Record<string,unknown>;
  if(Object.keys(v).some(k=>!["message","instrument"].includes(k)))return resp({error:"invalid_application"},400,headers);
  const message=v.message??"",instrument=v.instrument??null;
  if(typeof message!=="string"||message.trim().length>1000||
    (instrument!==null&&(typeof instrument!=="string"||!INST.includes(instrument))))return resp({error:"invalid_application"},400,headers);
  const body=message.trim();
  // Validate instrument against the exact recruitment in the same write statement.
  const rows=await sql`
   INSERT INTO public.recruitment_applications(recruitment_id,applicant_id,message,instrument)
   SELECT r.id,${userId}::uuid,${body},${instrument}
   FROM public.recruitments r JOIN public.profiles pr ON pr.user_id=${userId}::uuid
   WHERE r.id=${id}::uuid AND r.status='open' AND r.user_id<>${userId}::uuid
     AND ((cardinality(r.instruments)=0 AND ${instrument}::text IS NULL)
       OR (cardinality(r.instruments)>0 AND (${instrument}::text IS NULL OR ${instrument}=ANY(r.instruments))))
   ON CONFLICT (recruitment_id,applicant_id) DO UPDATE
      SET status='pending',message=excluded.message,instrument=excluded.instrument,updated_at=clock_timestamp()
   WHERE recruitment_applications.status='rejected'
   RETURNING id
  `;
  return rows.length?resp({application:{id:rows[0].id}},201,headers):resp({error:"not_eligible_or_already_applied"},409,headers);
 }
 if(m==="DELETE"&&id&&!app&&p===`/recruitments/${id}/applications`){
  const rows=await sql`DELETE FROM public.recruitment_applications WHERE recruitment_id=${id}::uuid AND applicant_id=${userId}::uuid AND status='pending' RETURNING id`;
  return rows.length?empty(headers):resp({error:"not_found"},404,headers);
 }
 if(m==="GET"&&id&&!app&&p===`/recruitments/${id}/applications`){
  const rows=await sql`
   SELECT a.id,a.applicant_id,a.status,a.created_at,a.message,a.instrument,pr.display_name
   FROM public.recruitment_applications a
   JOIN public.recruitments r ON r.id=a.recruitment_id AND r.user_id=${userId}::uuid
   JOIN public.profiles pr ON pr.user_id=a.applicant_id
   WHERE a.recruitment_id=${id}::uuid ORDER BY a.created_at DESC LIMIT 100
  `;
  const owner=await sql`SELECT 1 FROM public.recruitments WHERE id=${id}::uuid AND user_id=${userId}::uuid`;
  return owner.length?resp({applications:rows},200,headers):resp({error:"not_found"},404,headers);
 }
 if(m==="POST"&&id&&app&&action){
  const rows=await sql`
   UPDATE public.recruitment_applications a
   SET status=${action==="accept"?"accepted":"rejected"},updated_at=now()
   FROM public.recruitments r
   WHERE a.id=${app}::uuid AND a.recruitment_id=r.id AND r.id=${id}::uuid
     AND r.user_id=${userId}::uuid AND r.status='open' AND a.status='pending'
   RETURNING a.id
  `;
  return rows.length?empty(headers):resp({error:"not_found_or_decided"},404,headers);
 }
 if(m==="PATCH"&&id&&p===`/recruitments/${id}/status`){
  let body:unknown;try{body=await jsonBody(request);}catch{return resp({error:"invalid_json"},400,headers);}
  if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).length!==1||!["open","closed"].includes((body as {status:string}).status))return resp({error:"invalid_status"},400,headers);
  const rows=await sql`UPDATE public.recruitments SET status=${(body as {status:string}).status},updated_at=now() WHERE id=${id}::uuid AND user_id=${userId}::uuid RETURNING id`;
  return rows.length?empty(headers):resp({error:"not_found"},404,headers);
 }
 if(m==="DELETE"&&id&&!app&&p===`/recruitments/${id}`){
  const rows=await sql`DELETE FROM public.recruitments WHERE id=${id}::uuid AND user_id=${userId}::uuid RETURNING id`;
  return rows.length?empty(headers):resp({error:"not_found"},404,headers);
 }
 return resp({error:"not_found"},404,headers);
}
