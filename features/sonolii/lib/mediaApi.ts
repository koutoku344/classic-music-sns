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

export async function uploadAudio(file: File, getToken: TokenGetter): Promise<string> {
  if (file.size < 1 || file.size > 200_000_000) {
    throw new Error('音声ファイルは200MB以下にしてください。');
  }
  const mimeType = getAudioMime(file);
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
