import { verifyToken } from "@clerk/backend";
import { neon } from "@neondatabase/serverless";
import { handleMedia, isMediaRoute, cleanupMedia, type MediaEnv } from "./media";
import { handlePosts, isPostRoute, isPublicPostRead, isPostMediaReadUrl } from "./posts";

interface Env extends MediaEnv {
  DATABASE_URL: string;
  CLERK_JWT_KEY: string;
}

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
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
  userPieceId: string | null;
  status: RepertoireStatus;
};

function parseStatus(value: unknown): RepertoireStatus | null {
  return value === "practicing" || value === "repertoire" ? value : null;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const e = error as { code?: unknown; cause?: unknown };
  return e.code === "23505" || (
    e.cause !== undefined && e.cause !== error && isUniqueViolation(e.cause)
  );
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function recordObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseRepertoire(value: unknown): RepertoireInput | null {
  const v = recordObject(value);
  if (!v || Object.keys(v).some(k => !["pieceId", "userPieceId", "status"].includes(k))) {
    return null;
  }
  const status = parseStatus(v.status);
  if (!status) {
    return null;
  }
  const pieceId = v.pieceId ?? null;
  const userPieceId = v.userPieceId ?? null;
  if ((pieceId === null) === (userPieceId === null)) {
    return null;
  }
  if (pieceId !== null && (typeof pieceId !== "string" || !uuidPattern.test(pieceId))) {
    return null;
  }
  if (userPieceId !== null && (typeof userPieceId !== "string" || !uuidPattern.test(userPieceId))) {
    return null;
  }
  return { pieceId: pieceId as string | null, userPieceId: userPieceId as string | null, status };
}

function parseUserPiece(value: unknown): { composer: string; title: string } | null {
  const v = recordObject(value);
  if (!v || Object.keys(v).some(k => !["composer", "title"].includes(k))) {
    return null;
  }
  if (typeof v.composer !== "string" || typeof v.title !== "string") {
    return null;
  }
  const composer = v.composer.trim();
  const title = v.title.trim();
  return composer && title && composer.length <= 120 && title.length <= 240
    ? { composer, title } : null;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() + 1 === m && date.getUTCDate() === d;
}

type PracticeInput = {
  practiceDate: string;
  pieceId: string | null;
  userPieceId: string | null;
  durationMinutes: number;
  comment: string;
  audioMediaId: string | null | undefined;
};

function parsePractice(value: unknown): PracticeInput | null {
  const v = recordObject(value);
  if (!v || Object.keys(v).some(k => ![
    "practiceDate", "pieceId", "userPieceId", "durationMinutes", "comment", "audioMediaId"
  ].includes(k))) return null;
  const pieceId = v.pieceId ?? null;
  const userPieceId = v.userPieceId ?? null;
  if (!validDate(v.practiceDate) || ((pieceId === null) === (userPieceId === null))) {
    return null;
  }
  if (pieceId !== null && (typeof pieceId !== "string" || !uuidPattern.test(pieceId))) {
    return null;
  }
  if (userPieceId !== null && (typeof userPieceId !== "string" || !uuidPattern.test(userPieceId))) {
    return null;
  }
  if (typeof v.durationMinutes !== "number" ||
    !Number.isInteger(v.durationMinutes) || v.durationMinutes < 1 || v.durationMinutes > 1440) return null;
  const audioMediaId = v.audioMediaId;
  if (audioMediaId !== undefined && audioMediaId !== null &&
    (typeof audioMediaId !== "string" || !uuidPattern.test(audioMediaId))) return null;
  const comment = v.comment ?? "";
  if (typeof comment !== "string" || comment.length > 2000) {
    return null;
  }
  return {
    practiceDate: v.practiceDate as string,
    pieceId: pieceId as string | null,
    userPieceId: userPieceId as string | null,
    durationMinutes: v.durationMinutes,
    comment,
    audioMediaId: audioMediaId as string | null | undefined
  };
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
    const userPiecesList = request.method === "GET" && url.pathname === "/me/pieces";
    const userPiecesCreate = request.method === "POST" && url.pathname === "/me/pieces";
    const userPieceMatch = url.pathname.match(/^\/me\/pieces\/([^/]+)$/);
    const userPiecesPatch = request.method === "PATCH" && !!userPieceMatch;
    const practicesList = request.method === "GET" && url.pathname === "/practices";
    const practicesCreate = request.method === "POST" && url.pathname === "/practices";
    const practiceMatch = url.pathname.match(/^\/practices\/([^/]+)$/);
    const practiceGet = request.method === "GET" && !!practiceMatch;
    const practicePatch = request.method === "PATCH" && !!practiceMatch;
    const practiceDelete = request.method === "DELETE" && !!practiceMatch;

    if (!(mineGet || minePatch || sync || check || publicGet ||
      catalogGet || repList || repCreate || repUpdate || repDelete ||
      userPiecesList || userPiecesCreate || userPiecesPatch ||
      practicesList || practicesCreate || practiceGet || practicePatch || practiceDelete ||
      isMediaRoute(url.pathname) || isPostRoute(url.pathname))) {
      return reply({ error: "not_found" }, 404, headers);
    }

    // Public endpoint: a token is optional. Invalid/expired tokens never grant visibility.
    const clerkId = await identity(request, env);

    if (!publicGet && !catalogGet && !isPublicPostRead(request.method, url.pathname) &&
      !isPostMediaReadUrl(request.method, url.pathname) && !clerkId) {
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
      // Public post GETs must not upsert a user for anonymous visitors.
      // Authenticated visitors are looked up for owner visibility.
      if (isPublicPostRead(request.method, url.pathname) ||
          isPostMediaReadUrl(request.method, url.pathname)) {
        let viewerId: string | null = null;
        if (clerkId) {
          const viewers = await sql`
            SELECT id FROM public.users WHERE clerk_user_id = ${clerkId} LIMIT 1
          `;
          viewerId = (viewers[0]?.id as string | undefined) ?? null;
        }
        return await handlePosts(request, sql, env, viewerId, headers);
      }

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

      if (isMediaRoute(url.pathname)) {
        return await handleMedia(request, env, sql, userId, headers);
      }

      if (isPostRoute(url.pathname)) {
        return await handlePosts(request, sql, env, userId, headers);
      }

      // Read with the same projection for GET, POST and PATCH.
      const getRepertoire = async (id: string) => {
        const rows = await sql`
          SELECT
            r.id, r.piece_id, r.user_piece_id,
            COALESCE(c.name, up.composer) AS composer_name,
            COALESCE(p.title, up.title) AS piece_title,
            r.status, r.created_at
          FROM public.user_repertoire r
          LEFT JOIN public.pieces p ON p.id = r.piece_id
          LEFT JOIN public.composers c ON c.id = p.composer_id
          LEFT JOIN public.user_pieces up ON up.id = r.user_piece_id AND up.user_id = r.user_id
          WHERE r.id = ${id}::uuid AND r.user_id = ${userId}::uuid
          LIMIT 1
        `;
        return rows[0] ?? null;
      };

      if (repList) {
        const rows = await sql`
          SELECT
            r.id, r.piece_id, r.user_piece_id,
            COALESCE(c.name, up.composer) AS composer_name,
            COALESCE(p.title, up.title) AS piece_title,
            r.status, r.created_at
          FROM public.user_repertoire r
          LEFT JOIN public.pieces p ON p.id = r.piece_id
          LEFT JOIN public.composers c ON c.id = p.composer_id
          LEFT JOIN public.user_pieces up ON up.id = r.user_piece_id AND up.user_id = r.user_id
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
          if (!input) {
            return reply({ error: "invalid_repertoire" }, 400, headers);
          }

          const { pieceId, userPieceId, status } = input;
          if (pieceId) {
            const found = await sql`
              SELECT id FROM public.pieces WHERE id = ${pieceId}::uuid LIMIT 1
            `;
            if (found.length === 0) {
              return reply({ error: "piece_not_found" }, 404, headers);
            }
          }

          if (userPieceId) {
            const owned = await sql`
              SELECT id FROM public.user_pieces
              WHERE id = ${userPieceId}::uuid AND user_id = ${userId}::uuid
              LIMIT 1
            `;
            if (!owned.length) {
              return reply({ error: "not_found" }, 404, headers);
            }
          }
          const inserted = await sql`
            INSERT INTO public.user_repertoire (user_id, piece_id, user_piece_id, status)
            VALUES (${userId}::uuid, ${pieceId}::uuid, ${userPieceId}::uuid, ${status})
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
        if (!status) {
          return reply({ error: "invalid_status" }, 400, headers);
        }

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

      // User-created pieces belong to the authenticated user alone.
      if (userPiecesList) {
        const rows = await sql`
          SELECT id, composer, title, created_at, updated_at
          FROM public.user_pieces WHERE user_id = ${userId}::uuid
          ORDER BY created_at DESC, id DESC LIMIT 500
        `;
        return reply({ pieces: rows }, 200, headers);
      }

      if (userPiecesCreate || userPiecesPatch) {
        let input: ReturnType<typeof parseUserPiece>;
        try {
          input = parseUserPiece(await readJson(request));
        } catch (e) {
          return reply({ error: e instanceof Error ? e.message : "invalid_json" },
            e instanceof Error && e.message === "payload_too_large" ? 413 : 400, headers);
        }
        if (!input) {
          return reply({ error: "invalid_user_piece" }, 400, headers);
        }
        if (userPiecesCreate) {
          // ON CONFLICT protects against concurrent identical submissions.
          const rows = await sql`
            INSERT INTO public.user_pieces(user_id, composer, title)
            VALUES (${userId}::uuid, ${input.composer}, ${input.title})
            ON CONFLICT (user_id, lower(btrim(composer)), lower(btrim(title)))
            DO NOTHING
            RETURNING id, composer, title, created_at, updated_at
          `;
          if (rows.length) {
            return reply({ piece: rows[0] }, 201, headers);
          }
          const existing = await sql`
            SELECT id, composer, title, created_at, updated_at
            FROM public.user_pieces
            WHERE user_id = ${userId}::uuid
              AND lower(btrim(composer)) = lower(btrim(${input.composer}))
              AND lower(btrim(title)) = lower(btrim(${input.title}))
            LIMIT 1
          `;
          return reply({ piece: existing[0] }, 200, headers);
        }

        const id = userPieceMatch![1];
        if (!uuidPattern.test(id)) {
          return reply({ error: "invalid_user_piece_id" }, 400, headers);
        }
        const rows = await sql`
          UPDATE public.user_pieces
          SET composer = ${input.composer}, title = ${input.title}, updated_at = now()
          WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
          RETURNING id, composer, title, created_at, updated_at
        `;
        return rows.length
          ? reply({ piece: rows[0] }, 200, headers)
          : reply({ error: "not_found" }, 404, headers);
      }

      const getPractice = async (id: string) => {
        const rows = await sql`
          SELECT r.id, r.piece_id, r.user_piece_id,
            to_char(r.practice_date, 'YYYY-MM-DD') AS practice_date,
            r.duration_minutes, r.comment, r.audio_media_id,
            r.created_at, r.updated_at,
            COALESCE(c.name, up.composer) AS composer_name,
            COALESCE(p.title, up.title) AS piece_title
          FROM public.practice_records r
          LEFT JOIN public.pieces p ON p.id = r.piece_id
          LEFT JOIN public.composers c ON c.id = p.composer_id
          LEFT JOIN public.user_pieces up ON up.id = r.user_piece_id AND up.user_id = r.user_id
          WHERE r.id = ${id}::uuid AND r.user_id = ${userId}::uuid
          LIMIT 1
        `;
        return rows[0] ?? null;
      };

      if (practicesList) {
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");
        const limitValue = url.searchParams.get("limit") ?? "50";
        const cursor = url.searchParams.get("cursor");
        if ((from !== null && !validDate(from)) || (to !== null && !validDate(to)) ||
          ((from === null) !== (to === null)) || (from !== null && to !== null && from > to) ||
          !/^\d+$/.test(limitValue) || Number(limitValue) < 1 || Number(limitValue) > 100) {
          return reply({ error: "invalid_query" }, 400, headers);
        }
        let offset = 0;
        if (cursor) {
          try {
            const decoded = atob(cursor);
            if (!/^\d+$/.test(decoded)) {
              throw new Error("invalid_cursor");
            }
            offset = Number(decoded);
            if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) {
              throw new Error("invalid_cursor");
            }
          } catch {
            return reply({ error: "invalid_cursor" }, 400, headers);
          }
        }
        const limit = Number(limitValue);
        const rows = await sql`
          SELECT r.id, r.piece_id, r.user_piece_id,
            to_char(r.practice_date, 'YYYY-MM-DD') AS practice_date,
            r.duration_minutes, r.comment, r.created_at, r.updated_at,
            COALESCE(c.name, up.composer) AS composer_name,
            COALESCE(p.title, up.title) AS piece_title
          FROM public.practice_records r
          LEFT JOIN public.pieces p ON p.id = r.piece_id
          LEFT JOIN public.composers c ON c.id = p.composer_id
          LEFT JOIN public.user_pieces up ON up.id = r.user_piece_id AND up.user_id = r.user_id
          WHERE r.user_id = ${userId}::uuid
            AND (${from}::date IS NULL OR r.practice_date >= ${from}::date)
            AND (${to}::date IS NULL OR r.practice_date <= ${to}::date)
          ORDER BY r.practice_date DESC, r.created_at DESC, r.id DESC
          LIMIT ${limit + 1} OFFSET ${offset}
        `;
        const more = rows.length > limit;
        return reply({
          practices: rows.slice(0, limit),
          nextCursor: more ? btoa(String(offset + limit)) : null
        }, 200, headers);
      }

      if (practiceGet || practicePatch || practiceDelete) {
        const id = practiceMatch![1];
        if (!uuidPattern.test(id)) {
          return reply({ error: "invalid_practice_id" }, 400, headers);
        }
        if (practiceGet) {
          const row = await getPractice(id);
          return row
          ? reply({ practice: row }, 200, headers)
          : reply({ error: "not_found" }, 404, headers);
        }
        if (practiceDelete) {
          const rows = await sql`
            DELETE FROM public.practice_records
            WHERE id = ${id}::uuid AND user_id = ${userId}::uuid RETURNING id
          `;
          return rows.length ? new Response(null, {
            status: 204, headers: { "Cache-Control": "no-store", ...headers }
          }) : reply({ error: "not_found" }, 404, headers);
        }
      }

      if (practicesCreate || practicePatch) {
        let input: ReturnType<typeof parsePractice>;
        try {
          input = parsePractice(await readJson(request));
        } catch (e) {
          return reply({ error: e instanceof Error ? e.message : "invalid_json" },
            e instanceof Error && e.message === "payload_too_large" ? 413 : 400, headers);
        }
        if (!input) {
          return reply({ error: "invalid_practice" }, 400, headers);
        }
        if (input.userPieceId) {
          const owned = await sql`
            SELECT id FROM public.user_pieces
            WHERE id = ${input.userPieceId}::uuid AND user_id = ${userId}::uuid
            LIMIT 1
          `;
          if (!owned.length) {
            return reply({ error: "not_found" }, 404, headers);
          }
        } else {
          const found = await sql`
            SELECT id FROM public.pieces WHERE id = ${input.pieceId}::uuid LIMIT 1
          `;
          if (!found.length) {
            return reply({ error: "not_found" }, 404, headers);
          }
        }
        if (input.audioMediaId) {
          const foundMedia = await sql`
            SELECT id FROM public.media
            WHERE id = ${input.audioMediaId}::uuid
              AND user_id = ${userId}::uuid
              AND media_type = 'audio'
              AND upload_status = 'ready'
              AND deleted_at IS NULL
            LIMIT 1
          `;
          if (!foundMedia.length) {
            return reply({ error: "audio_media_not_found" }, 404, headers);
          }
        }
        if (practicesCreate) {
          const rows = await sql`
            INSERT INTO public.practice_records
              (user_id, piece_id, user_piece_id, practice_date, duration_minutes, comment, audio_media_id)
            VALUES
              (${userId}::uuid, ${input.pieceId}::uuid, ${input.userPieceId}::uuid,
               ${input.practiceDate}::date, ${input.durationMinutes}, ${input.comment},
               ${input.audioMediaId ?? null}::uuid)
            RETURNING id
          `;
          return reply({ practice: await getPractice(rows[0].id as string) }, 201, headers);
        }
        const id = practiceMatch![1];
        const rows = await sql`
          UPDATE public.practice_records
          SET piece_id = ${input.pieceId}::uuid,
              user_piece_id = ${input.userPieceId}::uuid,
              practice_date = ${input.practiceDate}::date,
              duration_minutes = ${input.durationMinutes},
              comment = ${input.comment},
              audio_media_id = CASE WHEN ${input.audioMediaId !== undefined}
                THEN ${input.audioMediaId ?? null}::uuid ELSE audio_media_id END,
              updated_at = now()
          WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
          RETURNING id
        `;
        return rows.length
          ? reply({ practice: await getPractice(id) }, 200, headers)
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
      if (isUniqueViolation(error) &&
        (repCreate || userPiecesCreate || userPiecesPatch)) {
        return reply({ error: "already_exists" }, 409, headers);
      }
      console.error("API failed", error);
      return reply({ error: "internal_server_error" }, 500, headers);
    }

    return reply({ error: "not_found" }, 404, headers);
  },

  async scheduled(_event: unknown, env: Env): Promise<void> {
    await cleanupMedia(env, neon(env.DATABASE_URL));
  },
};
