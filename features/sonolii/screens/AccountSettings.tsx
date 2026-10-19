import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import type { ScreenName } from '../types';
import { me } from '../data';
import Avatar from '../components/Avatar';
import { ArrowLeft, Mail, Lock, Save } from 'lucide-react';

type Profile = {
  display_name: string;
  bio: string;
  instruments: string[];
  region: string;
  visibility: 'public' | 'followers' | 'private';
};

type ProfileResponse = {
  profile: Profile | null;
};

interface AccountSettingsProps {
  navigate: (s: ScreenName) => void;
}

const allInstruments = ['Piano', 'Violin', 'Cello', 'Viola', 'Flute', 'Clarinet', 'Oboe', 'Trumpet', 'Guitar', 'その他'];

const allRegions = ['東京', '大阪', '神奈川', '京都', '愛知', '兵庫', '福岡', '非公開'];

export default function AccountSettings({ navigate }: AccountSettingsProps) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('東京');
  const [visibility, setVisibility] = useState<'public'|'followers'|'private'>('public');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const API = 'https://sonolii-api.g57cydy6ks.workers.dev';
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setLoading(false); return; }
    let active = true;
    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('ログインしてください');
        const res = await fetch(`${API}/me/profile`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(`取得失敗 HTTP ${res.status}`);
        const data: ProfileResponse = await res.json() as ProfileResponse;
        if (active && data.profile) {
          setDisplayName(data.profile.display_name);
          setBio(data.profile.bio);
          setSelectedInstruments(data.profile.instruments);
          setSelectedRegion(data.profile.region);
          setVisibility(data.profile.visibility);
        }
      } catch(e) { if (active) setError(String(e)); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [isLoaded, isSignedIn, getToken]);

  async function saveProfile() {
    if (!isSignedIn || loading || saving) return;
    if (!displayName.trim()) {
      setError('表示名を入力してください。');
      return;
    }
    setSaving(true); setError(''); setNotice('');
    try {
      const token = await getToken();
      if (!token) throw new Error('ログインしてください');
      const res = await fetch(`${API}/me/profile`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, bio, instruments: selectedInstruments, region: selectedRegion, visibility }),
      });
      if (!res.ok) throw new Error(`保存失敗 HTTP ${res.status}`);
      setNotice('プロフィールを保存しました');
    } catch(e) { setError(String(e)); }
    finally { setSaving(false); }
  }

  const toggleInstrument = (inst: string) => {
    setSelectedInstruments(prev => prev.includes(inst) ? prev.filter(i => i !== inst) : [...prev, inst]);
  };
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('settings')} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> 設定
      </button>
      <h1 className="font-serif text-2xl font-bold text-ink-900 mb-6">アカウント設定</h1>
      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-ink-100 p-6">
          <h2 className="text-sm font-semibold text-ink-900 mb-4">プロフィール</h2>
          <div className="flex items-center gap-4 mb-4">
            <Avatar user={me} size="lg" />
            <button type="button" disabled className="px-4 py-2 bg-ink-50 text-ink-400 rounded-lg text-sm font-medium cursor-not-allowed opacity-60">
              画像変更（準備中）
            </button>
          </div>
          <p className="text-xs text-ink-400 mb-4">画像変更は準備中です。プロフィールの保存には含まれません。</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">表示名</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                maxLength={60}
                className="w-full px-4 py-2.5 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">自己紹介</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                maxLength={500}
                rows={3}
                className="w-full px-4 py-2.5 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1.5">楽器（複数選択可）</label>
              <div className="flex flex-wrap gap-2">
                {allInstruments.map((inst) => (
                  <button
                    key={inst}
                    onClick={() => toggleInstrument(inst)}
                    className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors border-2 ${
                      selectedInstruments.includes(inst)
                        ? 'bg-teal-100 text-teal-700 border-teal-300'
                        : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300'
                    }`}
                  >
                    {inst}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1.5">地域</label>
              <div className="flex flex-wrap gap-2">
                {allRegions.map((region) => (
                  <button
                    key={region}
                    onClick={() => setSelectedRegion(region)}
                    className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors border-2 ${
                      selectedRegion === region
                        ? 'bg-teal-100 text-teal-700 border-teal-300'
                        : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300'
                    }`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5 border-t border-ink-100 pt-4">
            <p className="text-xs font-medium text-ink-500 mb-2">プロフィール公開範囲</p>
            <div className="space-y-2">
              {([
                ['public','公開','誰でもプロフィールを閲覧できます'],
                ['followers','フォロワーのみ公開','承認済みフォロワーに公開（STEP 10まで本人以外には非公開）'],
                ['private','非公開','他のユーザーには表示名のみ公開'],
              ] as const).map(([value,label,description]) => (
                <label key={value} className="flex items-start gap-3 p-3 rounded-xl border border-ink-200 cursor-pointer">
                  <input type="radio" name="visibility" checked={visibility===value}
                    onChange={() => setVisibility(value)} className="mt-1" />
                  <span><span className="block text-sm font-medium text-ink-800">{label}</span>
                    <span className="block text-xs text-ink-400">{description}</span></span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-ink-100 p-6">
          <h2 className="text-sm font-semibold text-ink-900 mb-4">メール・パスワード</h2>
          <p className="text-xs text-ink-400 mb-3">この機能は準備中です。「保存する」ボタンでは変更されません。</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">メールアドレス</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="email"
                  placeholder="メールアドレス変更は準備中"
                  disabled
                  readOnly
                  className="w-full pl-9 pr-3 py-2.5 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">新しいパスワード</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="password"
                  placeholder="パスワード変更は準備中"
                  disabled
                  className="w-full pl-9 pr-3 py-2.5 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-ink-100 p-6">
          <h2 className="text-sm font-semibold text-ink-900 mb-4">通知設定</h2>
          <p className="text-xs text-ink-400 mb-3">この機能は準備中です。「保存する」ボタンでは変更されません。</p>
          <div className="space-y-3">
            {[
              { label: '投稿へのいいね・コメント', desc: 'フィードバックの通知' },
              { label: 'フォロー通知', desc: '新しいフォロワーの通知' },
              { label: '募集への応募', desc: '応募があった際の通知' },
              { label: 'メッセージ', desc: '個人チャットの通知' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink-800">{item.label}</p>
                  <p className="text-xs text-ink-400 mt-0.5">{item.desc}</p>
                </div>
                <button type="button" disabled aria-label={`${item.label}（準備中）`} className={`relative w-12 h-6 rounded-full cursor-not-allowed opacity-50 ${i < 3 ? 'bg-teal-600' : 'bg-ink-300'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${i < 3 ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {notice && <p role="status" className="text-sm text-teal-700">{notice}</p>}
        <button onClick={saveProfile} disabled={!isSignedIn || loading || saving || !displayName.trim()}
          className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50">
          <Save size={18} /> {saving ? '保存中...' : '保存する'}
        </button>
      </div>
    </div>
  );
}
