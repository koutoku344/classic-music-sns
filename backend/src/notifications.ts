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
  if (raw === null) return null;
  const parts = raw.split("|");
  if (parts.length !== 2 || !UUID.test(parts[1]) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(parts[0]) ||
      !Number.isFinite(Date.parse(parts[0]))) return null;
  return { at: parts[0], id: parts[1] };
}

export function isNotificationRoute(path: string): boolean {
  return path === "/me/notifications" ||
    path === "/me/notifications/unread-count" ||
    path === "/me/notifications/read-all" ||
    /^\/me\/notifications\/[^/]+\/read$/.test(path);
}

export async function handleNotifications(
  request: Request,
  sql: Sql,
  userId: string | null,
  headers: Record<string, string>
): Promise<Response> {
  if (!userId) return reply({ error: "unauthorized" }, 401, headers);

  const { pathname, searchParams } = new URL(request.url);
  const method = request.method;

  if (pathname === "/me/notifications") {
    if (method !== "GET") return reply({ error: "method_not_allowed" }, 405, headers);
    const limitRaw = searchParams.get("limit") ?? "20";
    if (!/^\d+$/.test(limitRaw) || Number(limitRaw) < 1 || Number(limitRaw) > 50) {
      return reply({ error: "invalid_limit" }, 400, headers);
    }
    const unexpected = [...searchParams.keys()].some(key => !["limit", "cursor"].includes(key));
    if (unexpected) return reply({ error: "invalid_query" }, 400, headers);

    const cursorRaw = searchParams.get("cursor");
    const cursor = parseCursor(cursorRaw);
    if (cursorRaw !== null && !cursor) return reply({ error: "invalid_cursor" }, 400, headers);

    const limit = Number(limitRaw);
    // Return only safe metadata. Linked post/comment IDs and content must not
    // disclose entries that became restricted or were removed after notification creation.
    const rows = await sql`
      SELECT
        n.id, n.type, n.created_at, n.read_at,
        to_char(n.created_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at
      FROM public.notifications n
      WHERE n.recipient_user_id = ${userId}::uuid
        AND (n.read_at IS NULL OR n.read_at >= now() - interval '30 days')
        AND (${cursor?.at ?? null}::timestamptz IS NULL
          OR (n.created_at, n.id) <
             (${cursor?.at ?? null}::timestamptz, ${cursor?.id ?? null}::uuid))
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT ${limit + 1}
    `;
    const items = rows.slice(0, limit).map(row => ({
      id: row.id,
      type: row.type,
      createdAt: row.created_at,
      readAt: row.read_at,
    }));
    const last = rows[Math.min(rows.length, limit) - 1];
    return reply({
      notifications: items,
      nextCursor: rows.length > limit && last
        ? `${last.cursor_at}|${last.id}` : null,
    }, 200, headers);
  }

  if (pathname === "/me/notifications/unread-count") {
    if (method !== "GET") return reply({ error: "method_not_allowed" }, 405, headers);
    const rows = await sql`
      SELECT count(*)::integer AS count
      FROM public.notifications
      WHERE recipient_user_id = ${userId}::uuid AND read_at IS NULL
    `;
    return reply({ unreadCount: rows[0].count }, 200, headers);
  }

  if (pathname === "/me/notifications/read-all") {
    if (method !== "POST") return reply({ error: "method_not_allowed" }, 405, headers);
    await sql`
      UPDATE public.notifications
      SET read_at = GREATEST(clock_timestamp(), created_at)
      WHERE recipient_user_id = ${userId}::uuid AND read_at IS NULL
    `;
    return empty(headers);
  }

  const match = pathname.match(/^\/me\/notifications\/([^/]+)\/read$/);
  if (match) {
    if (method !== "POST") return reply({ error: "method_not_allowed" }, 405, headers);
    const id = match[1];
    if (!UUID.test(id)) return reply({ error: "not_found" }, 404, headers);
    // Not found and other-user notification IDs are intentionally indistinguishable.
    const rows = await sql`
      UPDATE public.notifications
      SET read_at = GREATEST(clock_timestamp(), created_at)
      WHERE id = ${id}::uuid
        AND recipient_user_id = ${userId}::uuid
        AND read_at IS NULL
      RETURNING id
    `;
    if (!rows.length) {
      const existing = await sql`
        SELECT 1 FROM public.notifications
        WHERE id = ${id}::uuid AND recipient_user_id = ${userId}::uuid
          AND (read_at IS NULL OR read_at >= now() - interval '30 days')
        LIMIT 1
      `;
      if (!existing.length) return reply({ error: "not_found" }, 404, headers);
    }
    return empty(headers);
  }

  return reply({ error: "not_found" }, 404, headers);
}


/**
 * Daily scheduled retention cleanup: physically remove ONLY read notifications
 * whose read_at is strictly older than 30 days. Unread rows are never deleted.
 *
 * Bounded batches avoid one large transaction; future daily runs drain backlog.
 * No HTTP route exposes this function.
 */
export async function cleanupExpiredNotifications(sql: Sql): Promise<number> {
  const BATCH_SIZE = 500;
  const MAX_BATCHES = 10;
  let deleted = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const rows = await sql`
      WITH expired AS (
        SELECT id
        FROM public.notifications
        WHERE read_at < now() - INTERVAL '30 days'
        ORDER BY read_at ASC, id ASC
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM public.notifications n
      USING expired
      WHERE n.id = expired.id
        AND n.read_at < now() - INTERVAL '30 days'
      RETURNING n.id
    `;

    deleted += rows.length;
    if (rows.length < BATCH_SIZE) break;
  }

  return deleted;
}
