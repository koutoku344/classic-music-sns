import { verifyToken } from "@clerk/backend";
import { neon } from "@neondatabase/serverless";

interface Env {
  DATABASE_URL: string;
  CLERK_JWT_KEY: string;
}

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://sonolii-web.g57cydy6ks.workers.dev",
];

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");

  if (!origin || !allowedOrigins.includes(origin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Vary": "Origin",
  };
}

function jsonResponse(
  data: unknown,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...corsHeaders,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders(request);

    // CORSプリフライト
    if (request.method === "OPTIONS") {
      if (
        !request.headers.get("Origin") ||
        !corsHeaders["Access-Control-Allow-Origin"]
      ) {
        return new Response(null, { status: 403 });
      }

      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // ヘルスチェック
    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse(
        { status: "ok", service: "sonolii-api" },
        200,
        corsHeaders,
      );
    }

    // 認証が必要なAPI
    const isAuthCheck =
      request.method === "GET" && url.pathname === "/auth-check";

    const isUserSync =
      request.method === "POST" && url.pathname === "/users/sync";

    if (isAuthCheck || isUserSync) {
      const authorization = request.headers.get("Authorization");

      if (!authorization?.startsWith("Bearer ")) {
        return jsonResponse(
          { error: "unauthorized" },
          401,
          corsHeaders,
        );
      }

      const token = authorization.slice("Bearer ".length).trim();

      if (!token) {
        return jsonResponse(
          { error: "unauthorized" },
          401,
          corsHeaders,
        );
      }

      let clerkUserId: string;

      try {
        const payload = await verifyToken(token, {
          jwtKey: env.CLERK_JWT_KEY,
          authorizedParties: allowedOrigins,
        });

        clerkUserId = payload.sub;

        if (!clerkUserId) {
          return jsonResponse(
            { error: "unauthorized" },
            401,
            corsHeaders,
          );
        }
      } catch {
        return jsonResponse(
          { error: "unauthorized" },
          401,
          corsHeaders,
        );
      }

      // STEP 4-8の認証確認API
      if (isAuthCheck) {
        return jsonResponse(
          {
            status: "authenticated",
            clerkUserId,
          },
          200,
          corsHeaders,
        );
      }

      // STEP 4-9のユーザー登録・取得API
      if (isUserSync) {
        try {
          const sql = neon(env.DATABASE_URL);

          const rows = await sql`
            INSERT INTO users (clerk_user_id)
            VALUES (${clerkUserId})
            ON CONFLICT (clerk_user_id)
            DO UPDATE SET
              clerk_user_id = EXCLUDED.clerk_user_id
            RETURNING
              id,
              clerk_user_id,
              created_at,
              updated_at
          `;

          return jsonResponse(
            {
              status: "ok",
              user: rows[0],
            },
            200,
            corsHeaders,
          );
        } catch (error) {
          console.error("User sync failed", error);

          return jsonResponse(
            { error: "internal_server_error" },
            500,
            corsHeaders,
          );
        }
      }
    }

    return jsonResponse(
      { error: "not_found" },
      404,
      corsHeaders,
    );
  },
};
