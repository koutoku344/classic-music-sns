import { verifyToken } from "@clerk/backend";
import { neon } from "@neondatabase/serverless";

interface Env { DATABASE_URL: string; CLERK_JWT_KEY: string }
const allowedOrigins = ["http://localhost:5173", "http://localhost:3000", "https://sonolii-web.g57cydy6ks.workers.dev"];
type Visibility = "public" | "followers" | "private";
type Input = { displayName: string; bio: string; instruments: string[]; region: string; visibility: Visibility };
const instrumentsAllowed = ["Piano", "Violin", "Cello", "Viola", "Flute", "Clarinet", "Oboe", "Trumpet", "Guitar", "その他"];
const regionsAllowed = ["東京", "大阪", "神奈川", "京都", "愛知", "兵庫", "福岡", "非公開"];
function cors(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  if (!origin || !allowedOrigins.includes(origin)) return {};
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Vary": "Origin" };
}
function reply(value: unknown, status: number, headers: Record<string,string>): Response {
  return Response.json(value, {status, headers:{"Cache-Control":"no-store", ...headers}});
}
function parse(value: unknown): Input | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k=>!["displayName","bio","instruments","region","visibility"].includes(k))) return null;
  if (typeof v.displayName!=="string" || typeof v.bio!=="string" || typeof v.region!=="string" ||
      !Array.isArray(v.instruments) || typeof v.visibility!=="string") return null;
  const name=v.displayName.trim(), bio=v.bio.trim(), region=v.region.trim();
  const inst=v.instruments;
  if (!name || name.length>60 || bio.length>500 || inst.length>10 ||
      inst.some(x=>typeof x!=="string" || !instrumentsAllowed.includes(x)) ||
      new Set(inst).size!==inst.length || !regionsAllowed.includes(region) ||
      !["public","followers","private"].includes(v.visibility)) return null;
  return {displayName:name, bio, instruments:inst as string[], region, visibility:v.visibility as Visibility};
}
async function identity(request: Request, env: Env): Promise<string|null> {
  const auth=request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const payload=await verifyToken(auth.slice(7).trim(), {jwtKey:env.CLERK_JWT_KEY, authorizedParties:allowedOrigins});
    return payload.sub || null;
  } catch {return null;}
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url=new URL(request.url), headers=cors(request);
    if (request.method==="OPTIONS") return headers["Access-Control-Allow-Origin"] ? new Response(null,{status:204,headers}) : new Response(null,{status:403});
    if (request.method==="GET" && url.pathname==="/health") return reply({status:"ok",service:"sonolii-api"},200,headers);
    const mineGet=request.method==="GET" && url.pathname==="/me/profile";
    const minePatch=request.method==="PATCH" && url.pathname==="/me/profile";
    const sync=request.method==="POST" && url.pathname==="/users/sync";
    const check=request.method==="GET" && url.pathname==="/auth-check";
    const match=url.pathname.match(/^\/profiles\/([0-9a-fA-F-]{36})$/);
    const publicGet=request.method==="GET" && !!match;
    if (!(mineGet || minePatch || sync || check || publicGet)) return reply({error:"not_found"},404,headers);
    // Public endpoint: a token is optional. Invalid/expired tokens never grant visibility.
    const clerkId=await identity(request,env);
    if (!publicGet && !clerkId) return reply({error:"unauthorized"},401,headers);
    if (check) return reply({status:"authenticated",clerkUserId:clerkId},200,headers);
    const sql=neon(env.DATABASE_URL);
    try {
      if (sync) {
        const rows=await sql`INSERT INTO users (clerk_user_id) VALUES (${clerkId!})
          ON CONFLICT (clerk_user_id) DO UPDATE SET clerk_user_id=EXCLUDED.clerk_user_id
          RETURNING id,clerk_user_id,created_at,updated_at`;
        return reply({status:"ok",user:rows[0]},200,headers);
      }
      if (publicGet) {
        const id=match![1];
        const rows=await sql`SELECT p.user_id,p.display_name,p.bio,p.instruments,p.region,p.visibility,
          p.created_at,u.clerk_user_id FROM profiles p JOIN users u ON u.id=p.user_id
          WHERE p.user_id=${id}::uuid LIMIT 1`;
        const row=rows[0];
        if (!row) return reply({error:"not_found"},404,headers);
        const isOwner=!!clerkId && clerkId===row.clerk_user_id;
        // STEP10までは承認済みフォロワーを判定できないため followers は本人のみ。
        const canSee=isOwner || row.visibility==="public";
        if (!canSee) return reply({profile:{user_id:row.user_id,display_name:row.display_name,visibility:row.visibility,restricted:true}},200,headers);
        return reply({profile:{user_id:row.user_id,display_name:row.display_name,bio:row.bio,
          instruments:row.instruments,region:row.region==="非公開"?null:row.region,
          visibility:row.visibility,restricted:false}},200,headers);
      }
      const users=await sql`SELECT id FROM users WHERE clerk_user_id=${clerkId!} LIMIT 1`;
      if (!users[0]) return reply({error:"user_not_synced"},409,headers);
      const userId=users[0].id as string;
      if (mineGet) {
        const rows=await sql`SELECT user_id,display_name,bio,instruments,region,visibility,created_at,updated_at
          FROM profiles WHERE user_id=${userId}::uuid LIMIT 1`;
        return reply({profile:rows[0]||null},200,headers);
      }
      if (minePatch) {
        const raw=await request.text();
        if (raw.length>8192) return reply({error:"payload_too_large"},413,headers);
        let parsed: unknown;
        try {parsed=JSON.parse(raw);} catch {return reply({error:"invalid_json"},400,headers);}
        const input=parse(parsed);
        if (!input) return reply({error:"invalid_profile"},400,headers);
        const {displayName,bio,instruments,region,visibility}=input;
        const rows=await sql`INSERT INTO profiles (user_id,display_name,bio,instruments,region,visibility)
          VALUES (${userId}::uuid,${displayName},${bio},
            ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(instruments)}::jsonb)),${region},${visibility})
          ON CONFLICT (user_id) DO UPDATE SET display_name=EXCLUDED.display_name,bio=EXCLUDED.bio,
            instruments=EXCLUDED.instruments,region=EXCLUDED.region,visibility=EXCLUDED.visibility,updated_at=now()
          RETURNING user_id,display_name,bio,instruments,region,visibility,created_at,updated_at`;
        return reply({profile:rows[0]},200,headers);
      }
    } catch (error) {
      console.error("Profile API failed",error);
      return reply({error:"internal_server_error"},500,headers);
    }
    return reply({error:"not_found"},404,headers);
  }
};
