import type { ScreenName } from '../types';
import { recruitments } from '../data';
import Avatar from '../components/Avatar';
import { ArrowLeft, MapPin, Activity, Users, Music2, Send, Check } from 'lucide-react';

interface RecruitmentDetailProps {
  recruitmentId: string;
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
}

export default function RecruitmentDetail({ recruitmentId, navigate }: RecruitmentDetailProps) {
  const r = recruitments.find((x) => x.id === recruitmentId) || recruitments[0];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('recruitment')} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> 募集一覧
      </button>

      <div className="bg-white rounded-2xl border border-ink-100 p-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-5">
          <Avatar user={r.user} size="lg" onClick={() => navigate('userProfile', { id: r.user.id })} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-ink-900 text-base">{r.user.name}</p>
            <p className="text-sm text-ink-400">{r.user.instrument} · {r.user.region} · {r.createdAt}</p>
          </div>
          <span className={`px-3 py-1 text-xs font-medium rounded-full border ${r.status === 'open' ? 'bg-sage-100 text-sage-700 border-sage-300' : 'bg-ink-100 text-ink-500 border-ink-200'}`}>
            {r.status === 'open' ? '募集中' : '募集終了'}
          </span>
        </div>

        <div className="flex items-center gap-2 mb-4 text-base">
          <Music2 size={18} className="text-teal-600" />
          <span className="font-serif text-lg text-ink-800">
            <span className="italic text-ink-600">{r.piece.composer}</span> / {r.piece.title}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <Tag icon={Music2} label="楽器" value={r.instrument} />
          <Tag icon={MapPin} label="地域" value={r.region} />
          <Tag icon={Activity} label="レベル" value={r.level} />
          <Tag icon={Users} label="目的" value={r.purpose} />
        </div>

        <div className="bg-ink-50 rounded-xl p-4 mb-5">
          <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-line">{r.description}</p>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-ink-100">
          <span className="text-sm text-ink-500">応募 {r.applicants}件</span>
          <button className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm">
            <Send size={16} /> 応募する
          </button>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-2xl border border-ink-100 p-5">
        <h2 className="font-serif text-lg font-semibold text-ink-900 mb-4">応募者（{r.applicants}件）</h2>
        <div className="space-y-3">
          {[1, 2, 3].slice(0, r.applicants).map((i) => (
            <div key={i} className="flex items-center gap-3 bg-ink-50 rounded-xl p-3">
              <div className="w-8 h-8 rounded-full bg-ink-200" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-700">応募者 {i}</p>
                <p className="text-xs text-ink-400">Piano · 東京</p>
              </div>
              <button className="flex items-center gap-1 text-xs text-teal-700 font-medium hover:text-teal-800">
                <Check size={14} /> 承認
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Tag({ icon: Icon, label, value }: { icon: typeof Music2; label: string; value: string }) {
  return (
    <div className="bg-ink-50 rounded-lg p-3 text-center">
      <Icon size={16} className="mx-auto text-teal-600 mb-1" />
      <p className="text-xs text-ink-400">{label}</p>
      <p className="text-sm font-medium text-ink-800 mt-0.5">{value}</p>
    </div>
  );
}
