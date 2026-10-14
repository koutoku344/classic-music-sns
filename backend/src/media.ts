import { neon } from "@neondatabase/serverless";

type Sql = ReturnType<typeof neon>;

export interface MediaBucket {
  head(key: string): Promise<{ size: number; httpMetadata?: { contentType?: string } } | null>;
  delete(key: string): Promise<void>;
}

export interface MediaEnv {
  MEDIA_BUCKET: MediaBucket;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
}

const BUCKET = "sonolii-media";
const FREE_QUOTA = 3_000_000_000;
const MAX_AUDIO = 200_000_000;
const MAX_IMAGE = 10_000_000;
const MIME: Record<string, "audio" | "image"> = {
  "audio/mpeg": "audio",
  "audio/mp4": "audio",
  "audio/x-m4a": "audio",
  "audio/wav": "audio",
  "audio/wave": "audio",
  "audio/x-wav": "audio",
  "audio/webm": "audio",
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/heic": "image",
  "image/heif": "image",
};

function response(value: unknown, status: number, headers: Record<string, string>): Response {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function uuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

async function readInput(request: Request): Promise<Record<string, unknown> | null> {
  const raw = await request.text();
  if (raw.length > 8192) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

// Signature Version 4 for R2's S3-compatible API, without adding a heavyweight SDK.
const enc = (value: string): string => encodeURIComponent(value).replace(/[!'()*]/g, c =>
  `%${c.charCodeAt(0).toString(16).toUpperCase()}`
);

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: Uint8Array, value: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(value)));
}

async function signUrl(
  env: MediaEnv, key: string, method: "PUT" | "GET", expires: number, mime?: string
): Promise<string> {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error("r2_credentials_missing");
  }
  const host = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const now = new Date().toISOString().replace(/[-:]|\.\d{3}/g, "");
  const date = now.slice(0, 8);
  const scope = `${date}/auto/s3/aws4_request`;
  const signedHeaders = mime ? "content-type;host" : "host";
  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${env.R2_ACCESS_KEY_ID}/${scope}`,
    "X-Amz-Date": now,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": signedHeaders,
  };
  const query = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${enc(k)}=${enc(v)}`).join("&");
  const resource = `/${BUCKET}/${key.split("/").map(enc).join("/")}`;
  const canonicalHeaders = mime
    ? `content-type:${mime}\nhost:${host}\n`
    : `host:${host}\n`;
  const canonicalRequest = [
    method, resource, query, canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"
  ].join("\n");
  const toSign = [
    "AWS4-HMAC-SHA256", now, scope, await sha256(canonicalRequest)
  ].join("\n");

  let keyBytes = new TextEncoder().encode(`AWS4${env.R2_SECRET_ACCESS_KEY}`);
  for (const part of [date, "auto", "s3", "aws4_request"]) {
    keyBytes = await hmac(keyBytes, part);
  }
  const signatureBytes = await hmac(keyBytes, toSign);
  const signature = Array.from(signatureBytes, b => b.toString(16).padStart(2, "0")).join("");
  return `https://${host}${resource}?${query}&X-Amz-Signature=${signature}`;
}

function dbMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const e = error as { message?: unknown; cause?: unknown };
  const message = typeof e.message === "string" ? e.message : "";
  for (const code of ["storage_quota_exceeded", "upload_rate_limited", "invalid_media_upload", "owner_not_found"]) {
    if (message.includes(code)) return code;
  }
  return e.cause && e.cause !== error ? dbMessage(e.cause) : null;
}

export function isMediaRoute(path: string): boolean {
  return path === "/media" || path.startsWith("/media/");
}

export async function handleMedia(
  request: Request,
  env: MediaEnv,
  sql: Sql,
  userId: string,
  headers: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (path === "/media/upload" && method === "POST") {
    const input = await readInput(request);
    const mediaType = input?.mediaType;
    const mimeType = input?.mimeType;
    const size = input?.sizeBytes;
    if (typeof mediaType !== "string" || typeof mimeType !== "string" ||
      typeof size !== "number" || !Number.isSafeInteger(size) || size <= 0 ||
      MIME[mimeType] !== mediaType ||
      (mediaType === "audio" && size > MAX_AUDIO) ||
      (mediaType === "image" && size > MAX_IMAGE)) {
      return response({ error: "invalid_media_upload" }, 400, headers);
    }

    if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
      return response({ error: "media_storage_unavailable" }, 503, headers);
    }
    const key = `users/${userId}/media/${crypto.randomUUID()}`;
    let mediaId: string;
    try {
      // This PL/pgSQL function locks the owner row before checking concurrent reservations.
      const rows = await sql`
        SELECT public.reserve_media_upload(
          ${userId}::uuid, ${key}, ${mediaType}, ${mimeType}, ${size}, ${FREE_QUOTA}
        ) AS id
      `;
      mediaId = rows[0].id as string;
    } catch (error) {
      const reason = dbMessage(error);
      if (reason === "storage_quota_exceeded") return response({ error: reason }, 413, headers);
      if (reason === "upload_rate_limited") return response({ error: reason }, 429, headers);
      if (reason) return response({ error: reason }, 400, headers);
      throw error;
    }
    // A signed PUT requires this exact Content-Type header on the browser request.
    const uploadUrl = await signUrl(env, key, "PUT", 900, mimeType);
    return response({
      mediaId, uploadUrl, method: "PUT",
      headers: { "Content-Type": mimeType }, expiresInSeconds: 900
    }, 201, headers);
  }

  if (path === "/media" && method === "GET") {
    const mediaType = url.searchParams.get("type");
    if (mediaType && mediaType !== "audio" && mediaType !== "image") {
      return response({ error: "invalid_media_type" }, 400, headers);
    }
    const limitParam = url.searchParams.get("limit") ?? "30";
    const offsetParam = url.searchParams.get("offset") ?? "0";
    if (!/^\d+$/.test(limitParam) || !/^\d+$/.test(offsetParam) ||
      Number(limitParam) < 1 || Number(limitParam) > 100 ||
      Number(offsetParam) > 100000) {
      return response({ error: "invalid_pagination" }, 400, headers);
    }
    const rows = await sql`
      SELECT id, media_type, mime_type, size_bytes::float8 AS size_bytes,
             duration_seconds, created_at
      FROM public.media
      WHERE user_id = ${userId}::uuid
        AND upload_status = 'ready'
        AND deleted_at IS NULL
        AND (${mediaType}::text IS NULL OR media_type = ${mediaType})
      ORDER BY created_at DESC, id DESC
      LIMIT ${Number(limitParam)} OFFSET ${Number(offsetParam)}
    `;
    return response({ media: rows }, 200, headers);
  }

  if (path === "/media/usage" && method === "GET") {
    const rows = await sql`
      SELECT
        COALESCE(SUM(size_bytes) FILTER (
          WHERE upload_status = 'ready' AND deleted_at IS NULL
        ), 0)::float8 AS active_bytes,
        COALESCE(SUM(size_bytes) FILTER (
          WHERE upload_status = 'ready' AND deleted_at IS NOT NULL
        ), 0)::float8 AS deleted_bytes,
        COALESCE(SUM(size_bytes) FILTER (
          WHERE upload_status = 'pending'
        ), 0)::float8 AS pending_bytes
      FROM public.media WHERE user_id = ${userId}::uuid
    `;
    return response({ usage: { ...rows[0], limit_bytes: FREE_QUOTA } }, 200, headers);
  }

  if (path === "/media/deleted" && method === "GET") {
    const rows = await sql`
      SELECT id, media_type, mime_type, size_bytes::float8 AS size_bytes,
             created_at, deleted_at, purge_at
      FROM public.media
      WHERE user_id = ${userId}::uuid AND deleted_at IS NOT NULL
      ORDER BY deleted_at DESC, id DESC LIMIT 100
    `;
    return response({ media: rows }, 200, headers);
  }

  const match = path.match(/^\/media\/([0-9a-f-]{36})(?:\/(complete|read-url|restore|permanent))?$/i);
  if (!match || !uuid(match[1])) return response({ error: "not_found" }, 404, headers);
  const id = match[1];
  const action = match[2] ?? "";
  const existing = await sql`
    SELECT id, object_key, media_type, mime_type, size_bytes::float8 AS size_bytes,
           upload_status, deleted_at, purge_at
    FROM public.media WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
    LIMIT 1
  `;
  const media = existing[0];
  if (!media) return response({ error: "not_found" }, 404, headers);
  const key = media.object_key as string;

  if (action === "complete" && method === "POST") {
    if (media.upload_status === "ready" && !media.deleted_at) {
      return response({ media }, 200, headers);
    }
    if (media.upload_status !== "pending") {
      return response({ error: "media_not_pending" }, 409, headers);
    }
    const object = await env.MEDIA_BUCKET.head(key);
    if (!object) return response({ error: "upload_not_found" }, 409, headers);
    if (object.size !== Number(media.size_bytes) ||
      (object.httpMetadata?.contentType && object.httpMetadata.contentType !== media.mime_type)) {
      // Leave the reservation in place pending cleanup, to avoid freeing a quota
      // slot while a client still holds a usable signed upload URL.
      return response({ error: "upload_metadata_mismatch" }, 409, headers);
    }
    const rows = await sql`
      UPDATE public.media SET upload_status = 'ready', updated_at = now()
      WHERE id = ${id}::uuid AND user_id = ${userId}::uuid AND upload_status = 'pending'
      RETURNING id, media_type, mime_type, size_bytes::float8 AS size_bytes
    `;
    return response({ media: rows[0] ?? media }, 200, headers);
  }

  if (action === "read-url" && method === "POST") {
    if (media.upload_status !== "ready" || media.deleted_at) {
      return response({ error: "media_not_available" }, 404, headers);
    }
    const readUrl = await signUrl(env, key, "GET", 300);
    return response({ readUrl, expiresInSeconds: 300 }, 200, headers);
  }

  if (!action && method === "DELETE") {
    if (media.upload_status !== "ready" || media.deleted_at) {
      return response({ error: "media_not_available" }, 409, headers);
    }
    const linked = await sql`
      SELECT 1 FROM public.practice_records
      WHERE user_id = ${userId}::uuid AND audio_media_id = ${id}::uuid LIMIT 1
    `;
    if (linked.length) return response({ error: "media_in_use" }, 409, headers);
    const rows = await sql`
      UPDATE public.media
      SET deleted_at = now(), purge_at = now() + INTERVAL '30 days', updated_at = now()
      WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
        AND upload_status = 'ready' AND deleted_at IS NULL
      RETURNING id, deleted_at, purge_at
    `;
    return rows.length ? response({ media: rows[0] }, 200, headers)
      : response({ error: "media_not_available" }, 409, headers);
  }

  if (action === "restore" && method === "POST") {
    const rows = await sql`
      UPDATE public.media
      SET deleted_at = NULL, purge_at = NULL, updated_at = now()
      WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
        AND upload_status = 'ready' AND deleted_at IS NOT NULL AND purge_at > now()
      RETURNING id
    `;
    return rows.length ? response({ media: rows[0] }, 200, headers)
      : response({ error: "media_not_restorable" }, 409, headers);
  }

  if (action === "permanent" && method === "DELETE") {
    if (!media.deleted_at) return response({ error: "delete_first" }, 409, headers);
    const linked = await sql`
      SELECT 1 FROM public.practice_records
      WHERE user_id = ${userId}::uuid AND audio_media_id = ${id}::uuid LIMIT 1
    `;
    if (linked.length) return response({ error: "media_in_use" }, 409, headers);
    await env.MEDIA_BUCKET.delete(key);
    await sql`
      DELETE FROM public.media
      WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
        AND deleted_at IS NOT NULL
    `;
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store", ...headers } });
  }

  return response({ error: "not_found" }, 404, headers);
}

export async function cleanupMedia(env: MediaEnv, sql: Sql): Promise<void> {
  // Signature expires after 15min. Delay pending cleanup for 24h to avoid races.
  const stale = await sql`
    SELECT id, object_key FROM public.media
    WHERE upload_status = 'pending' AND created_at < now() - INTERVAL '24 hours'
    ORDER BY created_at LIMIT 100
  `;
  for (const item of stale) {
    await env.MEDIA_BUCKET.delete(item.object_key as string);
    await sql`
      UPDATE public.media SET upload_status = 'failed', updated_at = now()
      WHERE id = ${item.id}::uuid AND upload_status = 'pending'
    `;
  }
  const expired = await sql`
    SELECT id, object_key FROM public.media
    WHERE deleted_at IS NOT NULL AND purge_at <= now()
    ORDER BY purge_at LIMIT 100
  `;
  for (const item of expired) {
    await env.MEDIA_BUCKET.delete(item.object_key as string);
    await sql`
      DELETE FROM public.media
      WHERE id = ${item.id}::uuid AND deleted_at IS NOT NULL AND purge_at <= now()
    `;
  }
}
