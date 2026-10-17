import { API_BASE } from './repertoireApi';

export type MediaRow = {
  id: string;
  media_type: 'audio' | 'image';
  mime_type: string;
  size_bytes: number;
  duration_seconds: number | null;
  created_at: string;
};

export type TokenGetter = () => Promise<string | null>;

async function authenticated(
  path: string, getToken: TokenGetter, init: RequestInit = {}
): Promise<Response> {
  const token = await getToken();
  if (!token) throw new Error('ログインが必要です。');
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
    });
  } catch {
    throw new Error('Backend APIへ接続できません。ローカルURLとBackendのCORS設定、ネットワークを確認してください。');
  }
  if (!res.ok) {
    let reason = '';
    try {
      const data = await res.json() as { error?: string };
      reason = data.error ?? '';
    } catch {
      // Non-JSON responses are reported using their HTTP status.
    }
    const message: Record<string, string> = {
      invalid_media_upload: '音声形式またはファイルサイズが不正です（上限200MB）。',
      storage_quota_exceeded: '保存容量の上限に達しています。',
      upload_rate_limited: '短時間にアップロードが集中しています。しばらく待ってください。',
      media_storage_unavailable: '音声ストレージを利用できません。',
      upload_metadata_mismatch: '保存されたファイルのサイズまたは形式が一致しません。',
      upload_not_found: 'アップロードしたファイルを確認できません。',
      media_not_available: '音声が見つかりません。',
      unauthorized: '再度ログインしてください。',
      media_in_use: '練習記録または投稿で使用中のメディアです。先に紐づけを解除してください。',
      media_not_restorable: 'この音声は復元できません。',
      delete_first: '先にゴミ箱へ移動してください。',
      invalid_duration: '音声の再生時間が取得できませんでした。別の音声でお試しください。',
    };
    throw new Error(message[reason] ?? `音声APIエラー（HTTP ${res.status}${reason ? `: ${reason}` : ''}）`);
  }
  return res;
}

const audioTypes: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  webm: 'audio/webm',
};

export function getAudioMime(file: File): string {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  // Some browsers report empty or non-standard MIME values for M4A/WAV.
  const mime = audioTypes[extension];
  if (!mime) throw new Error('MP3、M4A、WAV、WebMの音声を選択してください。');
  return mime;
}

// Read browser media metadata without downloading/transcoding the file in JS.
// Some recorded WebM files report Infinity until the browser seeks to the end.
export function getAudioDurationSeconds(source: File | string): Promise<number> {
  return new Promise((resolve, reject) => {
    const element = document.createElement('audio');
    const localUrl = source instanceof File ? URL.createObjectURL(source) : null;
    let finished = false;
    let seekAttempted = false;
    const cleanup = () => {
      element.removeAttribute('src');
      element.load();
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
    const timer = window.setTimeout(() => done(null), 20000);

    function done(seconds: number | null) {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      cleanup();
      if (seconds === null) {
        reject(new Error('音声の再生時間を取得できませんでした。対応形式とファイルを確認してください。'));
      } else {
        resolve(seconds);
      }
    }

    function checkDuration() {
      const duration = element.duration;
      if (Number.isFinite(duration) && duration > 0) {
        const seconds = Math.ceil(duration);
        done(seconds <= 86400 ? seconds : null);
      } else if (!seekAttempted && duration === Infinity && element.seekable.length === 0) {
        seekAttempted = true;
        try { element.currentTime = 1e10; } catch { /* timeout reports the issue */ }
      }
    }
    element.addEventListener('loadedmetadata', checkDuration);
    element.addEventListener('durationchange', checkDuration);
    element.addEventListener('seeked', checkDuration);
    element.addEventListener('error', () => done(null));
    element.preload = 'metadata';
    element.src = localUrl ?? source;
    element.load();
  });
}

export async function saveAudioDuration(
  id: string, seconds: number, getToken: TokenGetter
): Promise<number> {
  const res = await authenticated(`/media/${encodeURIComponent(id)}/duration`, getToken, {
    method: 'PATCH',
    body: JSON.stringify({ durationSeconds: seconds }),
  });
  const result = await res.json() as { durationSeconds: number };
  return result.durationSeconds;
}

export async function backfillMissingAudioDurations(
  getToken: TokenGetter,
  onProgress?: (completed: number, total: number) => void
): Promise<{ updated: number; failed: number; total: number }> {
  const missing: MediaRow[] = [];
  // Backend paginates media results; avoid silently skipping beyond the first 100.
  for (let offset = 0; ; offset += 100) {
    const page = await listMedia(getToken, offset, 100);
    missing.push(...page.filter(m => m.media_type === 'audio' && m.duration_seconds == null));
    if (page.length < 100) break;
  }

  let updated = 0;
  let failed = 0;
  for (const row of missing) {
    try {
      const url = await audioReadUrl(row.id, getToken);
      const seconds = await getAudioDurationSeconds(url);
      await saveAudioDuration(row.id, seconds, getToken);
      updated++;
    } catch (e) {
      console.warn('再生時間の補完に失敗:', row.id, e);
      failed++;
    }
    onProgress?.(updated + failed, missing.length);
  }
  return { updated, failed, total: missing.length };
}

export async function uploadAudio(file: File, getToken: TokenGetter): Promise<string> {
  if (file.size < 1 || file.size > 200_000_000) {
    throw new Error('音声ファイルは200MB以下にしてください。');
  }
  const mimeType = getAudioMime(file);
  const durationSeconds = await getAudioDurationSeconds(file);
  const prep = await authenticated('/media/upload', getToken, {
    method: 'POST',
    body: JSON.stringify({
      mediaType: 'audio',
      mimeType,
      sizeBytes: file.size,
    }),
  });
  const { mediaId, uploadUrl, headers } = await prep.json() as {
    mediaId: string;
    uploadUrl: string;
    headers: Record<string, string>;
  };
  // R2 signed URL must be called without Clerk authorization.
  let upload: Response;
  try {
    upload = await fetch(uploadUrl, {
      method: 'PUT',
      headers,
      body: file,
    });
  } catch {
    throw new Error('R2への直接アップロードで通信エラーが発生しました。ブラウザのConsole/NetworkでCORSエラーとR2のAllowedOriginsを確認してください。');
  }
  if (!upload.ok) throw new Error(`R2への保存に失敗しました（HTTP ${upload.status}）。再試行してください。`);
  await authenticated(`/media/${encodeURIComponent(mediaId)}/complete`, getToken, {
    method: 'POST',
    body: JSON.stringify({ durationSeconds }),
  });
  return mediaId;
}

export async function listPastAudio(getToken: TokenGetter): Promise<MediaRow[]> {
  const res = await authenticated('/media?type=audio&limit=100', getToken);
  const data = await res.json() as { media: MediaRow[] };
  return data.media;
}

export async function audioReadUrl(id: string, getToken: TokenGetter): Promise<string> {
  const res = await authenticated(`/media/${encodeURIComponent(id)}/read-url`, getToken, {
    method: 'POST',
  });
  const data = await res.json() as { readUrl: string };
  return data.readUrl;
}

export type DeletedMediaRow = MediaRow & {
  deleted_at: string;
  purge_at: string;
};

export type MediaUsage = {
  active_bytes: number;
  deleted_bytes: number;
  pending_bytes: number;
  limit_bytes: number;
};

export async function listMedia(
  getToken: TokenGetter,
  offset = 0,
  limit = 30,
): Promise<MediaRow[]> {
  const res = await authenticated(`/media?limit=${limit}&offset=${offset}`, getToken);
  const data = await res.json() as { media: MediaRow[] };
  return data.media;
}

export async function listDeletedMedia(getToken: TokenGetter): Promise<DeletedMediaRow[]> {
  const res = await authenticated('/media/deleted', getToken);
  const data = await res.json() as { media: DeletedMediaRow[] };
  return data.media;
}

export async function getMediaUsage(getToken: TokenGetter): Promise<MediaUsage> {
  const res = await authenticated('/media/usage', getToken);
  const data = await res.json() as { usage: MediaUsage };
  return data.usage;
}

export async function trashMedia(id: string, getToken: TokenGetter): Promise<void> {
  await authenticated(`/media/${encodeURIComponent(id)}`, getToken, { method: 'DELETE' });
}

export async function restoreMedia(id: string, getToken: TokenGetter): Promise<void> {
  await authenticated(`/media/${encodeURIComponent(id)}/restore`, getToken, { method: 'POST' });
}

export async function permanentlyDeleteMedia(id: string, getToken: TokenGetter): Promise<void> {
  await authenticated(`/media/${encodeURIComponent(id)}/permanent`, getToken, { method: 'DELETE' });
}

export function formatMediaBytes(bytes: number): string {
  return bytes >= 1_000_000_000
    ? `${(bytes / 1_000_000_000).toFixed(2)} GB`
    : `${(bytes / 1_000_000).toFixed(1)} MB`;
}

const imageTypes: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

export async function uploadImage(file: File, getToken: TokenGetter): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = imageTypes[extension];
  if (!mimeType) {
    throw new Error('JPEG、PNG、WebP、HEIC、HEIF画像を選択してください。');
  }
  if (file.size < 1 || file.size > 10_000_000) {
    throw new Error('画像ファイルは10MB以下にしてください。');
  }

  const prep = await authenticated('/media/upload', getToken, {
    method: 'POST',
    body: JSON.stringify({
      mediaType: 'image',
      mimeType,
      sizeBytes: file.size,
    }),
  });
  const { mediaId, uploadUrl, headers } = await prep.json() as {
    mediaId: string;
    uploadUrl: string;
    headers: Record<string, string>;
  };

  let uploaded: Response;
  try {
    uploaded = await fetch(uploadUrl, {
      method: 'PUT',
      headers,
      body: file,
    });
  } catch {
    throw new Error('R2への画像アップロードに失敗しました。R2のCORS設定を確認してください。');
  }

  if (!uploaded.ok) {
    throw new Error(`R2への画像保存に失敗しました（HTTP ${uploaded.status}）。`);
  }

  await authenticated(`/media/${encodeURIComponent(mediaId)}/complete`, getToken, {
    method: 'POST',
  });
  return mediaId;
}

export async function listPastImages(getToken: TokenGetter): Promise<MediaRow[]> {
  const res = await authenticated('/media?type=image&limit=100', getToken);
  const data = await res.json() as { media: MediaRow[] };
  return data.media;
}

export async function imageReadUrl(id: string, getToken: TokenGetter): Promise<string> {
  const res = await authenticated(`/media/${encodeURIComponent(id)}/read-url`, getToken, {
    method: 'POST',
  });
  const data = await res.json() as { readUrl: string };
  return data.readUrl;
}
