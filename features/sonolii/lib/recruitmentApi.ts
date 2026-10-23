import { API_BASE } from './repertoireApi';
import type { TokenGetter } from './mediaApi';

export type RecruitmentInput = {
  pieceId: string | null;
  instruments: string[];
  regions: string[];
  level: string;
  purpose: string;
  description: string;
};
export type RecruitmentRow = {
  id: string;
  user_id: string;
  piece_id: string | null;
  piece_title: string | null;
  composer_name: string | null;
  display_name: string;
  instruments: string[];
  regions: string[];
  level: string;
  purpose: string;
  description: string;
  status: 'open' | 'closed';
  applicants: number;
  instrument_counts?: Record<string, number>;
  my_application?: 'pending' | 'accepted' | 'rejected' | null;
  created_at: string;
};
export type ApplicantRow = {
  id: string;
  applicant_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  display_name: string;
  message: string;
  instrument: string | null;
  created_at: string;
};

async function request(path: string, getToken: TokenGetter, init?: RequestInit): Promise<Response> {
  const token = await getToken();
  const res = await fetch(API_BASE + path, {
    ...init,
    cache: 'no-store',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(`募集APIエラー（HTTP ${res.status}：${error.error ?? 'unknown'}）`);
  }
  return res;
}
export async function listRecruitments(getToken: TokenGetter, options: {
  cursor?: string | null; pieceId?: string | null; instrument?: string; region?: string; level?: string; purpose?: string;
} = {}): Promise<{ recruitments: RecruitmentRow[]; nextCursor: string | null }> {
  const q = new URLSearchParams();
  if (options.cursor) q.set('cursor', options.cursor);
  if (options.pieceId) q.set('pieceId', options.pieceId);
  for (const field of ['instrument', 'region', 'level', 'purpose'] as const) {
    const value = options[field];
    if (value && value !== 'all') q.set(field, value);
  }
  return await (await request('/recruitments?' + q, getToken)).json();
}
export async function getRecruitment(id: string, getToken: TokenGetter): Promise<RecruitmentRow> {
  const res = await request('/recruitments/' + encodeURIComponent(id), getToken);
  return (await res.json() as { recruitment: RecruitmentRow }).recruitment;
}
export async function createRecruitment(input: RecruitmentInput, getToken: TokenGetter): Promise<string> {
  const res = await request('/recruitments', getToken, { method: 'POST', body: JSON.stringify(input) });
  return (await res.json() as { recruitment: { id: string } }).recruitment.id;
}
export async function updateRecruitment(id: string, input: RecruitmentInput, getToken: TokenGetter): Promise<void> {
  await request('/recruitments/' + encodeURIComponent(id), getToken, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function setRecruitmentStatus(id: string, status: 'open' | 'closed', getToken: TokenGetter): Promise<void> {
  await request('/recruitments/' + encodeURIComponent(id) + '/status', getToken, { method: 'PATCH', body: JSON.stringify({ status }) });
}
export async function deleteRecruitment(id: string, getToken: TokenGetter): Promise<void> {
  await request('/recruitments/' + encodeURIComponent(id), getToken, { method: 'DELETE' });
}
export async function applyRecruitment(id: string, getToken: TokenGetter, input: { message: string; instrument: string | null } = { message: '', instrument: null }): Promise<void> {
  await request('/recruitments/' + encodeURIComponent(id) + '/applications', getToken, { method: 'POST', body: JSON.stringify(input) });
}
export async function cancelRecruitmentApplication(id: string, getToken: TokenGetter): Promise<void> {
  await request('/recruitments/' + encodeURIComponent(id) + '/applications', getToken, { method: 'DELETE' });
}
export async function listRecruitmentApplicants(id: string, getToken: TokenGetter): Promise<ApplicantRow[]> {
  const res = await request('/recruitments/' + encodeURIComponent(id) + '/applications', getToken);
  return (await res.json() as { applications: ApplicantRow[] }).applications;
}
export async function decideRecruitmentApplicant(id: string, applicationId: string, decision: 'accept' | 'reject', getToken: TokenGetter): Promise<void> {
  await request('/recruitments/' + encodeURIComponent(id) + '/applications/' + encodeURIComponent(applicationId) + '/' + decision, getToken, { method: 'POST' });
}
