import type { NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reply(value: unknown, status: number, headers: Record<string, string>): Response {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function empty(headers: Record<string, string>): Response {
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function parseCursor(raw: string | null): { at: string; id: string } | null {
  if (!raw) return null;
  const parts = raw.split("|");
  return parts.length === 2 && UUID.test(parts[1]) &&
    /^\d{4}-\d{2}-\d{2}T/.test(parts[0]) &&
    Number.isFinite(Date.parse(parts[0]))
    ? { at: parts[0], id: parts[1] } : null;
}

function errorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const e = error as { message?: unknown; cause?: unknown };
  const message = typeof e.message === "string" ? e.message : "";
  for (const code of [
    "post_not_found", "comment_not_found", "comments_disabled",
    "invalid_comment", "invalid_timestamp",
  ]) {
    if (message.includes(code)) return code;
  }
  return e.cause && e.cause !== error ? errorMessage(e.cause) : null;
}

function errorReply(error: unknown, headers: Record<string, string>): Response | null {
  const code = errorMessage(error);
  if (!code) return null;
  const status = code === "post_not_found" || code === "comment_not_found" ? 404 :
    code === "comments_disabled" ? 409 : 400;
  return reply({ error: code }, status, headers);
}

async function readInput(request: Request): Promise<{
  body: string;
  audioTimestampSeconds: number | null;
  replyToCommentId: string | null;
} | null> {
  const raw = await request.text();
  if (raw.length > 5000) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => ![
    "body", "audioTimestampSeconds", "replyToCommentId",
  ].includes(k))) return null;
  if (typeof v.body !== "string") return null;
  const body = v.body.trim();
  if (!body || body.length > 1000) return null;

  const audioTimestampSeconds = v.audioTimestampSeconds ?? null;
  if (audioTimestampSeconds !== null && (
    typeof audioTimestampSeconds !== "number" ||
    !Number.isInteger(audioTimestampSeconds) || audioTimestampSeconds < 0
  )) return null;

  const replyToCommentId = v.replyToCommentId ?? null;
  if (replyToCommentId !== null && (
    typeof replyToCommentId !== "string" || !UUID.test(replyToCommentId)
  )) return null;
  if (replyToCommentId && audioTimestampSeconds !== null) return null;
  return {
    body,
    audioTimestampSeconds: audioTimestampSeconds as number | null,
    replyToCommentId: replyToCommentId as string | null,
  };
}

export function isFeedbackRoute(path: string): boolean {
  return /^\/posts\/[^/]+\/(comments(?:\/[^/]+(?:\/replies|\/likes|\/like)?)?|likes|like)$/.test(path);
}

export function isPublicFeedbackRead(method: string, path: string): boolean {
  return method === "GET" && isFeedbackRoute(path);
}

export async function handleFeedback(
  request: Request,
  sql: Sql,
  userId: string | null,
  headers: Record<string, string>
): Promise<Response> {
  const { pathname, searchParams } = new URL(request.url);
  const parts = pathname.split("/").filter(Boolean);
  const method = request.method;
  const postId = parts[1];
  const commentId = parts[3];

  if (!UUID.test(postId) || (commentId && !UUID.test(commentId))) {
    return reply({ error: "not_found" }, 404, headers);
  }

  const isComments = parts[2] === "comments" && parts.length === 3;
  const isComment = parts[2] === "comments" && parts.length === 4;
  const isReplies = parts[2] === "comments" && parts.length === 5 && parts[4] === "replies";
  const isCommentLikes = parts[2] === "comments" && parts.length === 5 && parts[4] === "likes";
  const isCommentLike = parts[2] === "comments" && parts.length === 5 && parts[4] === "like";
  const isPostLikes = parts[2] === "likes" && parts.length === 3;
  const isPostLike = parts[2] === "like" && parts.length === 3;

  if (method !== "GET" && !userId) {
    return reply({ error: "unauthorized" }, 401, headers);
  }

  // Reading feedback and removing existing likes/comments remain allowed.
  // Only NEW public actions require an intentionally configured profile.
  const needsProfile = method === "POST" && isComments ||
    method === "PUT" && (isPostLike || isCommentLike);
  if (needsProfile) {
    const configured = await sql`
      SELECT 1 FROM public.profiles
      WHERE user_id = ${userId}::uuid AND length(btrim(display_name)) > 0
      LIMIT 1
    `;
    if (!configured.length) {
      return reply({ error: "profile_required" }, 403, headers);
    }
  }

  // All read endpoints apply the post's visibility, never client-side filtering.
  if (method === "GET" || method === "DELETE" && isComment) {
    const visible = await sql`
      SELECT p.id, p.user_id, p.comments_enabled
      FROM public.posts p
      JOIN public.profiles pr ON pr.user_id = p.user_id
      WHERE p.id = ${postId}::uuid
        AND (pr.visibility = 'public' OR p.user_id = ${userId}::uuid)
      LIMIT 1
    `;
    // The writer can delete their own comment even if the post became private.
    if (!visible.length && !(method === "DELETE" && isComment)) {
      return reply({ error: "not_found" }, 404, headers);
    }
  }

  if (method === "GET" && (isComments || isReplies)) {
    const limit = Number(searchParams.get("limit") ?? "20");
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      return reply({ error: "invalid_limit" }, 400, headers);
    }
    const rawCursor = searchParams.get("cursor");
    const cursor = parseCursor(rawCursor);
    if (rawCursor && !cursor) return reply({ error: "invalid_cursor" }, 400, headers);

    if (isReplies) {
      const roots = await sql`
        SELECT id FROM public.post_comments
        WHERE id = ${commentId}::uuid AND post_id = ${postId}::uuid
          AND parent_comment_id IS NULL LIMIT 1
      `;
      if (!roots.length) return reply({ error: "not_found" }, 404, headers);
    }

    const rows = await sql`
      SELECT
        c.id, c.post_id, c.user_id, c.parent_comment_id, c.reply_to_comment_id,
        c.body, c.audio_timestamp_seconds, c.deleted_at, c.created_at,
        to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at,
        CASE WHEN c.deleted_at IS NULL THEN pr.display_name ELSE NULL END AS display_name,
        CASE WHEN target.deleted_at IS NULL THEN target_profile.display_name ELSE NULL END
          AS reply_to_display_name,
        (SELECT COUNT(*)::int FROM public.post_comment_likes cl
         WHERE cl.comment_id = c.id) AS like_count,
        EXISTS(
          SELECT 1 FROM public.post_comment_likes cl
          WHERE cl.comment_id = c.id AND cl.user_id = ${userId}::uuid
        ) AS liked_by_me,
        EXISTS(
          SELECT 1 FROM public.post_comments child
          WHERE child.parent_comment_id = c.id AND child.deleted_at IS NULL
        ) AS has_replies
      FROM public.post_comments c
      LEFT JOIN public.profiles pr ON pr.user_id = c.user_id
      LEFT JOIN public.post_comments target ON target.id = c.reply_to_comment_id
      LEFT JOIN public.profiles target_profile ON target_profile.user_id = target.user_id
      WHERE c.post_id = ${postId}::uuid
        AND (
          (${commentId ?? null}::uuid IS NULL AND c.parent_comment_id IS NULL
           AND (c.deleted_at IS NULL OR EXISTS (
             SELECT 1 FROM public.post_comments child
             WHERE child.parent_comment_id = c.id AND child.deleted_at IS NULL
           )))
          OR
          (${commentId ?? null}::uuid IS NOT NULL AND c.parent_comment_id = ${commentId ?? null}::uuid
           AND c.deleted_at IS NULL)
        )
        AND (
          ${cursor?.at ?? null}::timestamptz IS NULL
          OR (${commentId ?? null}::uuid IS NULL AND
              (c.created_at, c.id) < (${cursor?.at ?? null}::timestamptz, ${cursor?.id ?? null}::uuid))
          OR (${commentId ?? null}::uuid IS NOT NULL AND
              (c.created_at, c.id) > (${cursor?.at ?? null}::timestamptz, ${cursor?.id ?? null}::uuid))
        )
      ORDER BY
        CASE WHEN ${commentId ?? null}::uuid IS NULL THEN c.created_at END DESC,
        CASE WHEN ${commentId ?? null}::uuid IS NULL THEN c.id END DESC,
        CASE WHEN ${commentId ?? null}::uuid IS NOT NULL THEN c.created_at END ASC,
        CASE WHEN ${commentId ?? null}::uuid IS NOT NULL THEN c.id END ASC
      LIMIT ${limit + 1}
    `;
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    const nextCursor = rows.length > limit && last ? `${String(last.cursor_at)}|${last.id}` : null;
    return reply({ comments: items, nextCursor }, 200, headers);
  }

  if (method === "POST" && isComments) {
    const input = await readInput(request);
    if (!input) return reply({ error: "invalid_comment" }, 400, headers);
    try {
      const rows = await sql`
        SELECT public.create_post_comment(
          ${userId}::uuid, ${postId}::uuid, ${input.body},
          ${input.audioTimestampSeconds}::integer,
          ${input.replyToCommentId}::uuid
        ) AS id
      `;
      return reply({ comment: { id: rows[0].id } }, 201, headers);
    } catch (error) {
      const response = errorReply(error, headers);
      if (response) return response;
      throw error;
    }
  }

  if (method === "DELETE" && isComment) {
    try {
      await sql`
        SELECT public.delete_post_comment(
          ${userId}::uuid, ${postId}::uuid, ${commentId}::uuid
        )
      `;
      return empty(headers);
    } catch (error) {
      const response = errorReply(error, headers);
      if (response) return response;
      throw error;
    }
  }

  if (method === "GET" && (isPostLikes || isCommentLikes)) {
    if (isCommentLikes) {
      const rows = await sql`
        SELECT c.id,
          (SELECT COUNT(*)::int FROM public.post_comment_likes l
           WHERE l.comment_id = c.id) AS like_count,
          EXISTS(SELECT 1 FROM public.post_comment_likes l
                 WHERE l.comment_id = c.id AND l.user_id = ${userId}::uuid) AS liked_by_me
        FROM public.post_comments c
        WHERE c.post_id = ${postId}::uuid AND c.id = ${commentId}::uuid
          AND c.deleted_at IS NULL
      `;
      return rows.length ? reply({ likeCount: rows[0].like_count, likedByMe: rows[0].liked_by_me }, 200, headers)
        : reply({ error: "not_found" }, 404, headers);
    }
    const rows = await sql`
      SELECT COUNT(*)::int AS like_count,
        EXISTS(SELECT 1 FROM public.post_likes l
               WHERE l.post_id = ${postId}::uuid AND l.user_id = ${userId}::uuid) AS liked_by_me
      FROM public.post_likes
      WHERE post_id = ${postId}::uuid
    `;
    return reply({ likeCount: rows[0].like_count, likedByMe: rows[0].liked_by_me }, 200, headers);
  }

  if ((method === "PUT" || method === "DELETE") && (isPostLike || isCommentLike)) {
    try {
      if (isCommentLike) {
        await sql`SELECT public.set_post_comment_like(
          ${userId}::uuid, ${postId}::uuid, ${commentId}::uuid, ${method === "PUT"}
        )`;
      } else {
        await sql`SELECT public.set_post_like(
          ${userId}::uuid, ${postId}::uuid, ${method === "PUT"}
        )`;
      }
      return empty(headers);
    } catch (error) {
      const response = errorReply(error, headers);
      if (response) return response;
      throw error;
    }
  }

  return reply({ error: "not_found" }, 404, headers);
}
