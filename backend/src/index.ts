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

type Visibility = "public" | "followers" | "private";

type Input = {
  displayName: string;
  bio: string;
  instruments: string[];
  region: string;
  visibility: Visibility;
};

const instrumentsAllowed = [
  "Piano",
  "Violin",
  "Cello",
  "Viola",
  "Flute",
  "Clarinet",
  "Oboe",
  "Trumpet",
  "Guitar",
  "その他",
];

const regionsAllowed = [
  "東京",
  "大阪",
  "神奈川",
  "京都",
  "愛知",
  "兵庫",
  "福岡",
  "非公開",
];

function cors(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");

  if (!origin || !allowedOrigins.includes(origin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    Vary: "Origin",
  };
}

function reply(
  value: unknown,
  status: number,
  headers: Record<string, string>
): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function parse(value: unknown): Input | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const v = value as Record<string, unknown>;

  if (
    Object.keys(v).some(
      (k) => !["displayName", "bio", "instruments", "region", "visibility"].includes(k)
    )
  ) {
    return null;
  }

  if (
    typeof v.displayName !== "string" ||
    typeof v.bio !== "string" ||
    typeof v.region !== "string" ||
    !Array.isArray(v.instruments) ||
    typeof v.visibility !== "string"
  ) {
    return null;
  }

  const name = v.displayName.trim();
  const bio = v.bio.trim();
  const region = v.region.trim();
  const inst = v.instruments;

  if (
    !name ||
    name.length > 60 ||
    bio.length > 500 ||
    inst.length > 10 ||
    inst.some((x) => typeof x !== "string" || !instrumentsAllowed.includes(x)) ||
    new Set(inst).size !== inst.length ||
    !regionsAllowed.includes(region) ||
    !["public", "followers", "private"].includes(v.visibility)
  ) {
    return null;
  }

  return {
    displayName: name,
    bio,
    instruments: inst as string[],
    region,
    visibility: v.visibility as Visibility,
  };
}

type RepertoireStatus = "practicing" | "repertoire";

type RepertoireInput = {
  pieceId: string | null;
  customComposer: string | null;
  customTitle: string | null;
  status: RepertoireStatus;
};

function parseStatus(value: unknown): RepertoireStatus | null {
  return value === "practicing" || value === "repertoire" ? value : null;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; cause?: unknown };
  return e.code === "23505" || (
    e.cause !== undefined && e.cause !== error && isUniqueViolation(e.cause)
  );
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseRepertoire(value: unknown): RepertoireInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const data = value as Record<string, unknown>;
  const keys = ["pieceId", "customComposer", "customTitle", "status"];
  const status = parseStatus(data.status);
  if (!status) return null;

  if (Object.keys(data).some((key) => !keys.includes(key))) {
    return null;
  }

  const pieceId = data.pieceId ?? null;
  const composer = data.customComposer ?? null;
  const title = data.customTitle ?? null;

  if (pieceId !== null) {
    if (typeof pieceId !== "string" || !uuidPattern.test(pieceId)) {
      return null;
    }
    if (composer !== null || title !== null) {
      return null;
    }
    return { pieceId, customComposer: null, customTitle: null, status };
  }

  if (typeof composer !== "string" || typeof title !== "string") {
    return null;
  }

  const customComposer = composer.trim();
  const customTitle = title.trim();

  if (
    !customComposer ||
    !customTitle ||
    customComposer.length > 120 ||
    customTitle.length > 240
  ) {
    return null;
  }

  return { pieceId: null, customComposer, customTitle, status };
}

async function readJson(request: Request): Promise<unknown> {
  const raw = await request.text();
  if (raw.length > 8192) {
    throw new Error("payload_too_large");
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error("invalid_json");
  }
}

async function identity(request: Request, env: Env): Promise<string | null> {
  const auth = request.headers.get("Authorization");

  if (!auth?.startsWith("Bearer ")) {
    return null;
  }

  try {
    const payload = await verifyToken(auth.slice(7).trim(), {
      jwtKey: env.CLERK_JWT_KEY,
      authorizedParties: allowedOrigins,
    });

    return payload.sub || null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const headers = cors(request);

    if (request.method === "OPTIONS") {
      return headers["Access-Control-Allow-Origin"]
        ? new Response(null, { status: 204, headers })
        : new Response(null, { status: 403 });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return reply({ status: "ok", service: "sonolii-api" }, 200, headers);
    }

    const mineGet = request.method === "GET" && url.pathname === "/me/profile";
    const minePatch = request.method === "PATCH" && url.pathname === "/me/profile";
    const sync = request.method === "POST" && url.pathname === "/users/sync";
    const check = request.method === "GET" && url.pathname === "/auth-check";
    const match = url.pathname.match(/^\/profiles\/([0-9a-fA-F-]{36})$/);
    const publicGet = request.method === "GET" && !!match;

    const catalogGet = request.method === "GET" && url.pathname === "/catalog/pieces";
    const repList = request.method === "GET" && url.pathname === "/me/repertoire";
    const repCreate = request.method === "POST" && url.pathname === "/me/repertoire";
    const repMatch = url.pathname.match(/^\/me\/repertoire\/([^/]+)$/);
    const repUpdate = request.method === "PATCH" && !!repMatch;
    const repDelete = request.method === "DELETE" && !!repMatch;

    if (!(mineGet || minePatch || sync || check || publicGet ||
      catalogGet || repList || repCreate || repUpdate || repDelete)) {
      return reply({ error: "not_found" }, 404, headers);
    }

    // Public endpoint: a token is optional. Invalid/expired tokens never grant visibility.
    const clerkId = await identity(request, env);

    if (!publicGet && !catalogGet && !clerkId) {
      return reply({ error: "unauthorized" }, 401, headers);
    }

    if (check) {
      return reply(
        { status: "authenticated", clerkUserId: clerkId },
        200,
        headers
      );
    }

    const sql = neon(env.DATABASE_URL);

    try {
      if (catalogGet) {
        const composerId = url.searchParams.get("composerId");
        const query = (url.searchParams.get("q") ?? "").trim();

        if (composerId && !uuidPattern.test(composerId)) {
          return reply({ error: "invalid_composer_id" }, 400, headers);
        }
        if (query.length > 120) {
          return reply({ error: "invalid_query" }, 400, headers);
        }

        const composers = await sql`
          SELECT id, name
          FROM public.composers
          ORDER BY name
        `;
        const pieces = await sql`
          SELECT p.id, p.composer_id, p.title, c.name AS composer_name
          FROM public.pieces p
          JOIN public.composers c ON c.id = p.composer_id
          WHERE (${composerId}::uuid IS NULL OR p.composer_id = ${composerId}::uuid)
            AND (${query} = '' OR p.title ILIKE '%' || ${query} || '%' OR c.name ILIKE '%' || ${query} || '%')
          ORDER BY c.name, p.title
          LIMIT 500
        `;

        return reply({ composers, pieces }, 200, headers);
      }

      if (sync) {
        const rows = await sql`
          INSERT INTO users (clerk_user_id)
          VALUES (${clerkId!})
          ON CONFLICT (clerk_user_id)
          DO UPDATE SET clerk_user_id = EXCLUDED.clerk_user_id
          RETURNING id, clerk_user_id, created_at, updated_at
        `;

        return reply({ status: "ok", user: rows[0] }, 200, headers);
      }

      if (publicGet) {
        const id = match![1];
        const rows = await sql`
          SELECT
            p.user_id,
            p.display_name,
            p.bio,
            p.instruments,
            p.region,
            p.visibility,
            p.created_at,
            u.clerk_user_id
          FROM profiles p
          JOIN users u ON u.id = p.user_id
          WHERE p.user_id = ${id}::uuid
          LIMIT 1
        `;

        const row = rows[0];

        if (!row) {
          return reply({ error: "not_found" }, 404, headers);
        }

        const isOwner = !!clerkId && clerkId === row.clerk_user_id;

        // STEP10までは承認済みフォロワーを判定できないため followers は本人のみ。
        const canSee = isOwner || row.visibility === "public";

        if (!canSee) {
          return reply(
            {
              profile: {
                user_id: row.user_id,
                display_name: row.display_name,
                visibility: row.visibility,
                restricted: true,
              },
            },
            200,
            headers
          );
        }

        return reply(
          {
            profile: {
              user_id: row.user_id,
              display_name: row.display_name,
              bio: row.bio,
              instruments: row.instruments,
              region: row.region === "非公開" ? null : row.region,
              visibility: row.visibility,
              restricted: false,
            },
          },
          200,
          headers
        );
      }

      const users = await sql`
        INSERT INTO users (clerk_user_id)
        VALUES (${clerkId!})
        ON CONFLICT (clerk_user_id)
        DO UPDATE SET clerk_user_id = EXCLUDED.clerk_user_id
        RETURNING id
      `;

      const userId = users[0].id as string;

      // Read with the same projection for GET, POST and PATCH.
      const getRepertoire = async (id: string) => {
        const rows = await sql`
          SELECT
            r.id, r.piece_id, r.custom_composer, r.custom_title,
            COALESCE(c.name, r.custom_composer) AS composer_name,
            COALESCE(p.title, r.custom_title) AS piece_title,
            r.status, r.created_at
          FROM public.user_repertoire r
          LEFT JOIN public.pieces p ON p.id = r.piece_id
          LEFT JOIN public.composers c ON c.id = p.composer_id
          WHERE r.id = ${id}::uuid AND r.user_id = ${userId}::uuid
          LIMIT 1
        `;
        return rows[0] ?? null;
      };

      if (repList) {
        const rows = await sql`
          SELECT
            r.id, r.piece_id, r.custom_composer, r.custom_title,
            COALESCE(c.name, r.custom_composer) AS composer_name,
            COALESCE(p.title, r.custom_title) AS piece_title,
            r.status, r.created_at
          FROM public.user_repertoire r
          LEFT JOIN public.pieces p ON p.id = r.piece_id
          LEFT JOIN public.composers c ON c.id = p.composer_id
          WHERE r.user_id = ${userId}::uuid
          ORDER BY r.created_at DESC
        `;
        return reply({ repertoire: rows }, 200, headers);
      }

      if (repCreate || repUpdate) {
        let parsed: unknown;
        try {
          parsed = await readJson(request);
        } catch (error) {
          const code = error instanceof Error ? error.message : "invalid_json";
          return reply(
            { error: code },
            code === "payload_too_large" ? 413 : 400,
            headers
          );
        }

        if (repCreate) {
          const input = parseRepertoire(parsed);
          if (!input) return reply({ error: "invalid_repertoire" }, 400, headers);

          const { pieceId, customComposer, customTitle, status } = input;
          if (pieceId) {
            const found = await sql`
              SELECT id FROM public.pieces WHERE id = ${pieceId}::uuid LIMIT 1
            `;
            if (found.length === 0) {
              return reply({ error: "piece_not_found" }, 404, headers);
            }
          }

          const inserted = await sql`
            INSERT INTO public.user_repertoire
              (user_id, piece_id, custom_composer, custom_title, status)
            VALUES
              (${userId}::uuid, ${pieceId}::uuid, ${customComposer}, ${customTitle}, ${status})
            RETURNING id
          `;
          const row = await getRepertoire(inserted[0].id as string);
          return reply({ repertoire: row }, 201, headers);
        }

        // PATCH only changes status; it never replaces the selected piece.
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return reply({ error: "invalid_status" }, 400, headers);
        }
        const data = parsed as Record<string, unknown>;
        if (Object.keys(data).length !== 1 || !("status" in data)) {
          return reply({ error: "invalid_status" }, 400, headers);
        }
        const status = parseStatus(data.status);
        if (!status) return reply({ error: "invalid_status" }, 400, headers);

        const repId = repMatch![1];
        if (!uuidPattern.test(repId)) {
          return reply({ error: "invalid_repertoire_id" }, 400, headers);
        }
        const updated = await sql`
          UPDATE public.user_repertoire
          SET status = ${status}
          WHERE id = ${repId}::uuid AND user_id = ${userId}::uuid
          RETURNING id
        `;
        if (updated.length === 0) {
          return reply({ error: "not_found" }, 404, headers);
        }
        return reply({ repertoire: await getRepertoire(repId) }, 200, headers);
      }

      if (repDelete) {
        const repId = repMatch![1];
        if (!uuidPattern.test(repId)) {
          return reply({ error: "invalid_repertoire_id" }, 400, headers);
        }
        const rows = await sql`
          DELETE FROM public.user_repertoire
          WHERE id = ${repId}::uuid AND user_id = ${userId}::uuid
          RETURNING id
        `;
        return rows.length
          ? new Response(null, { status: 204, headers: { "Cache-Control": "no-store", ...headers } })
          : reply({ error: "not_found" }, 404, headers);
      }

      if (mineGet) {
        const rows = await sql`
          SELECT
            user_id,
            display_name,
            bio,
            instruments,
            region,
            visibility,
            created_at,
            updated_at
          FROM profiles
          WHERE user_id = ${userId}::uuid
          LIMIT 1
        `;

        return reply({ profile: rows[0] || null }, 200, headers);
      }

      if (minePatch) {
        const raw = await request.text();

        if (raw.length > 8192) {
          return reply({ error: "payload_too_large" }, 413, headers);
        }

        let parsed: unknown;

        try {
          parsed = JSON.parse(raw);
        } catch {
          return reply({ error: "invalid_json" }, 400, headers);
        }

        const input = parse(parsed);

        if (!input) {
          return reply({ error: "invalid_profile" }, 400, headers);
        }

        const { displayName, bio, instruments, region, visibility } = input;

        const rows = await sql`
          INSERT INTO profiles (
            user_id,
            display_name,
            bio,
            instruments,
            region,
            visibility
          )
          VALUES (
            ${userId}::uuid,
            ${displayName},
            ${bio},
            ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(instruments)}::jsonb)),
            ${region},
            ${visibility}
          )
          ON CONFLICT (user_id)
          DO UPDATE SET
            display_name = EXCLUDED.display_name,
            bio = EXCLUDED.bio,
            instruments = EXCLUDED.instruments,
            region = EXCLUDED.region,
            visibility = EXCLUDED.visibility,
            updated_at = now()
          RETURNING
            user_id,
            display_name,
            bio,
            instruments,
            region,
            visibility,
            created_at,
            updated_at
        `;

        return reply({ profile: rows[0] }, 200, headers);
      }
    } catch (error) {
      if (isUniqueViolation(error) && repCreate) {
        return reply({ error: "already_exists" }, 409, headers);
      }
      console.error("API failed", error);
      return reply({ error: "internal_server_error" }, 500, headers);
    }

    return reply({ error: "not_found" }, 404, headers);
  },
};
