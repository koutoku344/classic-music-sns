import type { NeonQueryFunction } from "@neondatabase/serverless";
import { signUrl, type MediaEnv } from "./media";

type Sql = NeonQueryFunction<false, false>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FEEDBACK = new Set(["感想歓迎", "Advice歓迎", "厳しめAdvice歓迎"]);
type PostInput = {
  body: string;
  pieceId: string | null;
  userPieceId: string | null;
  commentsEnabled: boolean;
  feedbackPrefs: string[];
  mediaIds: string[];
};

function reply(value: unknown, status: number, headers: Record<string, string>): Response {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function parseInput(raw: unknown): PostInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const x = raw as Record<string, unknown>;
  if (Object.keys(x).some(k => ![
    "body", "pieceId", "userPieceId", "commentsEnabled", "feedbackPrefs", "mediaIds"
  ].includes(k))) return null;

  const body = typeof x.body === "string" ? x.body.trim() : null;
  const pieceId = x.pieceId ?? null;
  const userPieceId = x.userPieceId ?? null;
  const commentsEnabled = x.commentsEnabled ?? true;
  const feedbackPrefs = x.feedbackPrefs ?? [];
  const mediaIds = x.mediaIds ?? [];

  if (body === null || body.length > 2000
    || (pieceId !== null && (typeof pieceId !== "string" || !UUID.test(pieceId)))
    || (userPieceId !== null && (typeof userPieceId !== "string" || !UUID.test(userPieceId)))
    || (pieceId !== null && userPieceId !== null)
    || typeof commentsEnabled !== "boolean"
    || !Array.isArray(feedbackPrefs) || feedbackPrefs.length > 3
    || feedbackPrefs.some(p => typeof p !== "string" || !FEEDBACK.has(p))
    || new Set(feedbackPrefs).size !== feedbackPrefs.length
    || !Array.isArray(mediaIds) || mediaIds.length > 6
    || mediaIds.some(id => typeof id !== "string" || !UUID.test(id))
    || new Set(mediaIds).size !== mediaIds.length
    || (!body && mediaIds.length === 0)) return null;

  return {
    body,
    pieceId: pieceId as string | null,
    userPieceId: userPieceId as string | null,
    commentsEnabled,
    feedbackPrefs: feedbackPrefs as string[],
    mediaIds: mediaIds as string[],
  };
}

export function isPostMediaReadUrl(method: string, path: string): boolean {
  return method === "POST"
    && /^\/posts\/[^/]+\/media\/[^/]+\/read-url$/.test(path);
}

function isPostPath(path: string): boolean {
  return path === "/posts"
    || /^\/posts\/[^/]+$/.test(path)
    || /^\/users\/[^/]+\/posts$/.test(path)
    || /^\/posts\/[^/]+\/media\/[^/]+\/read-url$/.test(path);
}

export function isPostRoute(path: string): boolean {
  return isPostPath(path);
}

export function isPublicPostRead(method: string, path: string): boolean {
  return method === "GET" && isPostPath(path);
}

function parseCursor(value: string | null): { at: string; id: string } | null {
  if (!value) return null;
  const parts = value.split("|");
  if (parts.length !== 2 || !UUID.test(parts[1]) || !Number.isFinite(Date.parse(parts[0]))) {
    return null;
  }
  return { at: parts[0], id: parts[1] };
}

function errorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const e = error as { message?: unknown; cause?: unknown };
  const message = typeof e.message === "string" ? e.message : "";
  for (const code of [
    "invalid_post", "invalid_media_ids", "piece_not_found",
    "media_not_available", "post_not_found", "piece_requires_audio"
  ]) {
    if (message.includes(code)) return code;
  }
  return e.cause && e.cause !== error ? errorMessage(e.cause) : null;
}

export async function handlePosts(
  request: Request,
  sql: Sql,
  env: MediaEnv,
  userId: string | null,
  headers: Record<string, string>
): Promise<Response> {
  const { pathname, searchParams } = new URL(request.url);
  const method = request.method;
  const postMatch = pathname.match(/^\/posts\/([^/]+)$/);
  const ownerMatch = pathname.match(/^\/users\/([^/]+)\/posts$/);
  const mediaReadMatch = pathname.match(/^\/posts\/([^/]+)\/media\/([^/]+)\/read-url$/);

  if (mediaReadMatch && method === "POST") {
    const [, postId, mediaId] = mediaReadMatch;
    if (!UUID.test(postId) || !UUID.test(mediaId)) {
      return reply({ error: "not_found" }, 404, headers);
    }

    // Check the *post's* visibility before issuing access to Private R2.
    // Owner, public visitors, or accepted followers of followers-only profiles may view.
    const rows = await sql`
      SELECT m.object_key
      FROM public.posts p
      JOIN public.profiles pr ON pr.user_id = p.user_id
      JOIN public.post_media pm ON pm.post_id = p.id
      JOIN public.media m ON m.id = pm.media_id
      WHERE p.id = ${postId}::uuid
        AND pm.media_id = ${mediaId}::uuid
        AND (pr.visibility = 'public'
          OR p.user_id = ${userId}::uuid
          OR (
            pr.visibility = 'followers'
            AND EXISTS (
              SELECT 1 FROM public.follows f
              WHERE f.follower_id = ${userId}::uuid
                AND f.followee_id = p.user_id
                AND f.status = 'accepted'
            )
          ))
        AND m.upload_status = 'ready'
        AND m.deleted_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) return reply({ error: "not_found" }, 404, headers);
    const readUrl = await signUrl(env, rows[0].object_key as string, "GET", 300);
    return reply({ readUrl, expiresInSeconds: 300 }, 200, headers);
  }

  if (postMatch && !UUID.test(postMatch[1])) return reply({ error: "not_found" }, 404, headers);
  if (ownerMatch && !UUID.test(ownerMatch[1])) return reply({ error: "not_found" }, 404, headers);

  if ((method === "POST" && pathname === "/posts") ||
      (method === "PATCH" && postMatch)) {
    if (!userId) return reply({ error: "unauthorized" }, 401, headers);

    let raw: unknown;
    try {
      const bodyText = await request.text();
      if (bodyText.length > 12000) return reply({ error: "invalid_post" }, 400, headers);
      raw = JSON.parse(bodyText);
    } catch {
      return reply({ error: "invalid_json" }, 400, headers);
    }
    const input = parseInput(raw);
    if (!input) return reply({ error: "invalid_post" }, 400, headers);
    const ids = JSON.stringify(input.mediaIds);
    const prefs = JSON.stringify(input.feedbackPrefs);

    try {
      const result = await sql`
        SELECT public.save_post(
          ${userId}::uuid,
          ${postMatch?.[1] ?? null}::uuid,
          ${input.body},
          ${input.pieceId}::uuid,
          ${input.userPieceId}::uuid,
          ${input.commentsEnabled},
          ARRAY(SELECT jsonb_array_elements_text(${prefs}::jsonb)),
          ARRAY(SELECT jsonb_array_elements_text(${ids}::jsonb)::uuid)
        ) AS id
      `;
      return reply({ post: { id: result[0].id } }, method === "POST" ? 201 : 200, headers);
    } catch (error) {
      const code = errorMessage(error);
      if (code === "post_not_found" || code === "piece_not_found"
        || code === "media_not_available") {
        return reply({ error: code }, 404, headers);
      }
      if (code) return reply({ error: code }, 400, headers);
      throw error;
    }
  }

  if (method === "DELETE" && postMatch) {
    if (!userId) return reply({ error: "unauthorized" }, 401, headers);
    const deleted = await sql`
      DELETE FROM public.posts
      WHERE id = ${postMatch[1]}::uuid AND user_id = ${userId}::uuid
      RETURNING id
    `;
    return deleted.length
      ? new Response(null, { status: 204, headers: { "Cache-Control": "no-store", ...headers } })
      : reply({ error: "not_found" }, 404, headers);
  }

  if (method === "GET" && postMatch) {
    const rows = await sql`
      SELECT
        p.id, p.user_id, p.piece_id, p.user_piece_id,
        p.body, p.comments_enabled, p.feedback_prefs,
        p.created_at, p.updated_at,
        to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at,
        pr.display_name,
        (SELECT COUNT(*)::int FROM public.post_likes pl WHERE pl.post_id=p.id) AS like_count,
        (SELECT COUNT(*)::int FROM public.post_comments pc2 WHERE pc2.post_id=p.id AND pc2.deleted_at IS NULL) AS comment_count,
        COALESCE(c.name, up.composer) AS composer_name,
        COALESCE(pc.title, up.title) AS piece_title,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', m.id, 'media_type', m.media_type,
            'mime_type', m.mime_type, 'duration_seconds', m.duration_seconds,
            'display_order', pm.display_order
          ) ORDER BY pm.display_order)
          FROM public.post_media pm
          JOIN public.media m ON m.id = pm.media_id
          WHERE pm.post_id = p.id
        ), '[]'::json) AS media
      FROM public.posts p
      JOIN public.profiles pr ON pr.user_id = p.user_id
      LEFT JOIN public.pieces pc ON pc.id = p.piece_id
      LEFT JOIN public.composers c ON c.id = pc.composer_id
      LEFT JOIN public.user_pieces up ON up.id = p.user_piece_id
      WHERE p.id = ${postMatch[1]}::uuid
        AND (pr.visibility = 'public'
          OR p.user_id = ${userId}::uuid
          OR (
            pr.visibility = 'followers'
            AND EXISTS (
              SELECT 1 FROM public.follows f
              WHERE f.follower_id = ${userId}::uuid
                AND f.followee_id = p.user_id
                AND f.status = 'accepted'
            )
          ))
      LIMIT 1
    `;
    return rows.length ? reply({ post: rows[0] }, 200, headers)
      : reply({ error: "not_found" }, 404, headers);
  }

  if (method === "GET" && (pathname === "/posts" || ownerMatch)) {
    const limitRaw = searchParams.get("limit") ?? "20";
    const limit = Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      return reply({ error: "invalid_limit" }, 400, headers);
    }
    const cursorRaw = searchParams.get("cursor");
    const cursor = parseCursor(cursorRaw);
    if (cursorRaw && !cursor) return reply({ error: "invalid_cursor" }, 400, headers);
    const pieceId = searchParams.get("pieceId");
    if (pieceId && !UUID.test(pieceId)) {
      return reply({ error: "invalid_piece_id" }, 400, headers);
    }
    const keyword = (searchParams.get('q') ?? '').trim();
    if (keyword.length > 100) return reply({ error: 'invalid_query' }, 400, headers);
    const profileId = ownerMatch?.[1] ?? null;

    const rows = await sql`
      SELECT
        p.id, p.user_id, p.piece_id, p.user_piece_id,
        p.body, p.comments_enabled, p.feedback_prefs,
        p.created_at, p.updated_at,
        to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at,
        pr.display_name,
        COALESCE(c.name, up.composer) AS composer_name,
        COALESCE(pc.title, up.title) AS piece_title,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', m.id, 'media_type', m.media_type,
            'mime_type', m.mime_type, 'duration_seconds', m.duration_seconds,
            'display_order', pm.display_order
          ) ORDER BY pm.display_order)
          FROM public.post_media pm
          JOIN public.media m ON m.id = pm.media_id
          WHERE pm.post_id = p.id
        ), '[]'::json) AS media
      FROM public.posts p
      JOIN public.profiles pr ON pr.user_id = p.user_id
      LEFT JOIN public.pieces pc ON pc.id = p.piece_id
      LEFT JOIN public.composers c ON c.id = pc.composer_id
      LEFT JOIN public.user_pieces up ON up.id = p.user_piece_id
      WHERE (pr.visibility = 'public'
          OR p.user_id = ${userId}::uuid
          OR (
            pr.visibility = 'followers'
            AND EXISTS (
              SELECT 1 FROM public.follows f
              WHERE f.follower_id = ${userId}::uuid
                AND f.followee_id = p.user_id
                AND f.status = 'accepted'
            )
          ))
        AND (${profileId}::uuid IS NULL OR p.user_id = ${profileId}::uuid)
        AND (${pieceId}::uuid IS NULL OR p.piece_id = ${pieceId}::uuid)
        AND (${keyword} = '' OR p.body ILIKE '%' || ${keyword} || '%'
          OR COALESCE(pc.title, up.title, '') ILIKE '%' || ${keyword} || '%'
          OR COALESCE(c.name, up.composer, '') ILIKE '%' || ${keyword} || '%')
        AND (${cursor?.at ?? null}::timestamptz IS NULL
             OR (p.created_at, p.id) < (${cursor?.at ?? null}::timestamptz, ${cursor?.id ?? null}::uuid))
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ${limit + 1}
    `;
    const visible = rows.slice(0, limit);
    const last = visible[visible.length - 1];
    const nextCursor = rows.length > limit && last
      ? `${String(last.cursor_at)}|${last.id}` : null;
    return reply({ posts: visible, nextCursor }, 200, headers);
  }

  return reply({ error: "not_found" }, 404, headers);
}
