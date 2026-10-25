import type { NeonQueryFunction } from "@neondatabase/serverless";
type Sql=NeonQueryFunction<false,false>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply=(x:unknown,status:number,h:Record<string,string>)=>Response.json(x,{status,headers:{"Cache-Control":"no-store",...h}});
export function isSavedRoute(path:string):boolean{return path==="/me/saved"||/^\/me\/saved\/(post|recruitment)\/[^/]+$/.test(path);}
export async function handleSaved(req:Request,sql:Sql,userId:string,headers:Record<string,string>):Promise<Response>{
 const url=new URL(req.url),path=url.pathname,method=req.method;
 if(path==="/me/saved"&&method==="GET"){
  const rows=await sql`
   SELECT s.item_type,s.item_id,s.created_at,
    CASE WHEN s.item_type='post' THEN COALESCE(pc.title,up.title,p.body) ELSE COALESCE(rp.title,r.description) END AS title,
    CASE WHEN s.item_type='post' THEN p.user_id ELSE r.user_id END AS owner_id
   FROM public.saved_items s
   LEFT JOIN public.posts p ON s.item_type='post' AND p.id=s.item_id
   LEFT JOIN public.profiles pp ON pp.user_id=p.user_id
   LEFT JOIN public.pieces pc ON pc.id=p.piece_id
   LEFT JOIN public.user_pieces up ON up.id=p.user_piece_id
   LEFT JOIN public.recruitments r ON s.item_type='recruitment' AND r.id=s.item_id
   LEFT JOIN public.pieces rp ON rp.id=r.piece_id
   WHERE s.user_id=${userId}::uuid
     AND ((s.item_type='post' AND p.id IS NOT NULL
          AND (pp.visibility='public' OR p.user_id=${userId}::uuid
               OR (pp.visibility='followers' AND EXISTS(
                    SELECT 1 FROM public.follows f WHERE f.follower_id=${userId}::uuid AND f.followee_id=p.user_id AND f.status='accepted'))))
          OR (s.item_type='recruitment' AND r.id IS NOT NULL))
   ORDER BY s.created_at DESC,s.item_id DESC LIMIT 100
  `;
  return reply({items:rows},200,headers);
 }
 const match=path.match(/^\/me\/saved\/(post|recruitment)\/([^/]+)$/);
 if(!match||!UUID.test(match[2]))return reply({error:"not_found"},404,headers);
 const kind=match[1],id=match[2];
 if(method==="DELETE"){
  await sql`DELETE FROM public.saved_items WHERE user_id=${userId}::uuid AND item_type=${kind} AND item_id=${id}::uuid`;
  return reply({saved:false},200,headers);
 }
 if(method==="GET"){
  const rows=await sql`SELECT 1 FROM public.saved_items WHERE user_id=${userId}::uuid AND item_type=${kind} AND item_id=${id}::uuid`;
  return reply({saved:rows.length>0},200,headers);
 }
 if(method!=="PUT")return reply({error:"method_not_allowed"},405,headers);
 const visible=kind==="post"
  ? await sql`SELECT 1 FROM public.posts p JOIN public.profiles pr ON pr.user_id=p.user_id
    WHERE p.id=${id}::uuid AND (pr.visibility='public' OR p.user_id=${userId}::uuid
      OR (pr.visibility='followers' AND EXISTS(SELECT 1 FROM public.follows f WHERE f.follower_id=${userId}::uuid AND f.followee_id=p.user_id AND f.status='accepted')))`
  : await sql`SELECT 1 FROM public.recruitments WHERE id=${id}::uuid`;
 if(!visible.length)return reply({error:"not_found"},404,headers);
 await sql`INSERT INTO public.saved_items(user_id,item_type,item_id) VALUES(${userId}::uuid,${kind},${id}::uuid) ON CONFLICT DO NOTHING`;
 return reply({saved:true},200,headers);
}
