import type { NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reply(
  value: unknown,
  status: number,
  headers: Record<string, string>
): Response {
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
  if (raw === null) return null;
  const parts = raw.split("|");
  if (
    parts.length !== 2 ||
    !UUID.test(parts[1]) ||
    !/^\d{4}-\d{2}-\d{2}T/.test(parts[0]) ||
    !Number.isFinite(Date.parse(parts[0]))
  ) return null;

  return { at: parts[0], id: parts[1] };
}

function getError(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const value = error as { message?: unknown; cause?: unknown };
  const message = typeof value.message === "string" ? value.message : "";

  for (const code of [
    "profile_required",
    "user_not_found",
    "follow_not_found",
    "invalid_follow",
    "follow_conflict",
  ]) {
    if (message.includes(code)) return code;
  }

  return value.cause && value.cause !== error
    ? getError(value.cause)
    : null;
}

function errorResponse(error: unknown, headers: Record<string, string>): Response | null {
  const code = getError(error);
  if (!code) return null;

  const status = code === "profile_required" ? 403
    : code === "follow_not_found" || code === "user_not_found" ? 404
    : code === "follow_conflict" ? 409
    : 400;

  return reply({ error: code }, status, headers);
}

export function isFollowRoute(path: string): boolean {
  return /^\/users\/[^/]+\/follow$/.test(path)
    || /^\/users\/[^/]+\/followers$/.test(path)
    || path === "/me/follow-requests"
    || /^\/me\/follow-requests\/[^/]+\/(accept|reject)$/.test(path)
    || /^\/me\/followers\/[^/]+$/.test(path)
    || path === "/me/following";
}

export function isPublicFollowRead(method: string, path: string): boolean {
  return method === "GET" && /^\/users\/[^/]+\/follow$/.test(path);
}

export async function handleFollow(
  request: Request,
  sql: Sql,
  userId: string | null,
  headers: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url);
  const { pathname, searchParams } = url;
  const method = request.method;
  const followMatch = pathname.match(/^\/users\/([^/]+)\/follow$/);
  const incomingMatch = pathname.match(/^\/users\/([^/]+)\/followers$/);
  const decisionMatch = pathname.match(/^\/me\/follow-requests\/([^/]+)\/(accept|reject)$/);
  const removeMatch = pathname.match(/^\/me\/followers\/([^/]+)$/);

  if (followMatch) {
    const targetId = followMatch[1];
    if (!UUID.test(targetId)) return reply({ error: "not_found" }, 404, headers);

    if (method === "GET") {
      const rows = await sql`
        SELECT
          pr.user_id,
          pr.visibility,
          CASE WHEN ${userId}::uuid IS NOT NULL THEN f.status ELSE NULL END AS status
        FROM public.profiles pr
        LEFT JOIN public.follows f
          ON f.followee_id = pr.user_id
         AND f.follower_id = ${userId}::uuid
        WHERE pr.user_id = ${targetId}::uuid
          AND length(btrim(pr.display_name)) > 0
      `;

      if (!rows.length) return reply({ error: "not_found" }, 404, headers);
      const row = rows[0];
      // Refused requests must not be disclosed to the applicant.
      const status = row.status === "rejected" ? null : row.status;
      return reply({
        targetUserId: row.user_id,
        visibility: row.visibility,
        status: userId === targetId ? "self" : status,
      }, 200, headers);
    }

    if (!userId) return reply({ error: "unauthorized" }, 401, headers);

    if (method === "PUT") {
      try {
        const rows = await sql`
          SELECT public.request_follow(${userId}::uuid, ${targetId}::uuid) AS follow
        `;
        return reply({ follow: rows[0].follow }, 200, headers);
      } catch (error) {
        const response = errorResponse(error, headers);
        if (response) return response;
        throw error;
      }
    }

    if (method === "DELETE") {
      try {
        await sql`
          SELECT public.remove_follow(${userId}::uuid, ${targetId}::uuid, false)
        `;
        return empty(headers);
      } catch (error) {
        const response = errorResponse(error, headers);
        if (response) return response;
        throw error;
      }
    }

    return reply({ error: "method_not_allowed" }, 405, headers);
  }

  if (!userId) return reply({ error: "unauthorized" }, 401, headers);

  if (decisionMatch) {
    const [, followId, action] = decisionMatch;
    if (!UUID.test(followId)) return reply({ error: "not_found" }, 404, headers);
    if (method !== "POST") return reply({ error: "method_not_allowed" }, 405, headers);

    try {
      const rows = await sql`
        SELECT public.respond_follow(
          ${userId}::uuid,
          ${followId}::uuid,
          ${action === "accept"}
        ) AS follow
      `;
      return reply({ follow: rows[0].follow }, 200, headers);
    } catch (error) {
      const response = errorResponse(error, headers);
      if (response) return response;
      throw error;
    }
  }

  if (removeMatch) {
    const followerId = removeMatch[1];
    if (!UUID.test(followerId)) return reply({ error: "not_found" }, 404, headers);
    if (method !== "DELETE") return reply({ error: "method_not_allowed" }, 405, headers);

    try {
      await sql`
        SELECT public.remove_follow(${userId}::uuid, ${followerId}::uuid, true)
      `;
      return empty(headers);
    } catch (error) {
      const response = errorResponse(error, headers);
      if (response) return response;
      throw error;
    }
  }

  const isRequests = pathname === "/me/follow-requests";
  const isFollowing = pathname === "/me/following";
  if (!isRequests && !isFollowing && !incomingMatch) {
    return reply({ error: "not_found" }, 404, headers);
  }
  if (method !== "GET") return reply({ error: "method_not_allowed" }, 405, headers);

  if (incomingMatch) {
    // Another user's follower list must not disclose private relationships.
    // STEP11-3-3 will specify the appropriate public follower-list policy.
    return reply({ error: "not_found" }, 404, headers);
  }

  const limitParam = searchParams.get("limit") ?? "20";
  if (!/^\d+$/.test(limitParam) || Number(limitParam) < 1 || Number(limitParam) > 50) {
    return reply({ error: "invalid_limit" }, 400, headers);
  }

  const limit = Number(limitParam);
  const cursorParam = searchParams.get("cursor");
  const cursor = parseCursor(cursorParam);
  if (cursorParam !== null && !cursor) {
    return reply({ error: "invalid_cursor" }, 400, headers);
  }

  const rows = isRequests
    ? await sql`
      SELECT
        f.id, f.follower_id, f.status, f.requested_at,
        p.display_name AS follower_name
      FROM public.follows f
      JOIN public.profiles p ON p.user_id = f.follower_id
      WHERE f.followee_id = ${userId}::uuid
        AND f.status = 'pending'
        AND (${cursor?.at ?? null}::timestamptz IS NULL OR
          (f.requested_at, f.id) <
          (${cursor?.at ?? null}::timestamptz, ${cursor?.id ?? null}::uuid))
      ORDER BY f.requested_at DESC, f.id DESC
      LIMIT ${limit + 1}
    `
    : await sql`
      SELECT
        f.id, f.followee_id, f.status, f.requested_at,
        p.display_name AS followee_name, p.visibility
      FROM public.follows f
      JOIN public.profiles p ON p.user_id = f.followee_id
      WHERE f.follower_id = ${userId}::uuid
        AND f.status = 'accepted'
        AND (${cursor?.at ?? null}::timestamptz IS NULL OR
          (f.requested_at, f.id) <
          (${cursor?.at ?? null}::timestamptz, ${cursor?.id ?? null}::uuid))
      ORDER BY f.requested_at DESC, f.id DESC
      LIMIT ${limit + 1}
    `;

  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return reply({
    [isRequests ? "requests" : "following"]: items,
    nextCursor: rows.length > limit && last
      ? `${new Date(last.requested_at as string).toISOString()}|${last.id}`
      : null,
  }, 200, headers);
}
