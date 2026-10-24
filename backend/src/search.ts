import type { NeonQueryFunction } from "@neondatabase/serverless";

type Sql=NeonQueryFunction<false,false>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const response=(value:unknown,status:number,headers:Record<string,string>)=>Response.json(value,{status,headers:{"Cache-Control":"no-store",...headers}});
export function isPublicUserSearch(method:string,path:string):boolean{
 return method==="GET"&&path==="/users/search";
}
export async function handleUserSearch(request:Request,sql:Sql,headers:Record<string,string>):Promise<Response>{
 if(!isPublicUserSearch(request.method,new URL(request.url).pathname))return response({error:"not_found"},404,headers);
 const params=new URL(request.url).searchParams;
 if([...params.keys()].some(k=>!["q","instrument","region","cursor"].includes(k)))return response({error:"invalid_filter"},400,headers);
 const q=(params.get("q")??"").trim(),instrument=(params.get("instrument")??"").trim(),region=(params.get("region")??"").trim(),cursor=params.get("cursor");
 if(q.length>100||instrument.length>50||region.length>50||(cursor&&!UUID.test(cursor)))return response({error:"invalid_filter"},400,headers);
 const escaped=q.replace(/[\\%_]/g,s=>"\\"+s);
 const rows=await sql`
  SELECT p.user_id,p.display_name,p.instruments,p.region
  FROM public.profiles p
  WHERE p.visibility='public'
    AND (${q}='' OR p.display_name ILIKE '%'||${escaped}||'%' ESCAPE '\\')
    AND (${instrument}='' OR ${instrument}=ANY(p.instruments))
    AND (${region}='' OR p.region=${region})
    AND (${cursor}::uuid IS NULL OR p.user_id<${cursor}::uuid)
  ORDER BY p.user_id DESC LIMIT 21
 `;
 const items=rows.slice(0,20);
 return response({users:items,nextCursor:rows.length>20?items[items.length-1].user_id:null},200,headers);
}
