import type { ScreenName } from '../types';
import { pieces } from '../data';
import { ArrowLeft } from 'lucide-react';

interface CreateRecruitmentProps {
  navigate: (s: ScreenName) => void;
}

export default function CreateRecruitment({ navigate }: CreateRecruitmentProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('recruitment')} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> 戻る
      </button>

      <h1 className="font-serif text-2xl font-bold text-ink-900 mb-6">アンサンブル募集を作成</h1>

      <div className="bg-white rounded-2xl border border-ink-100 p-5 sm:p-6 space-y-5 animate-slide-up">
        <Field label="演奏曲目">
          <select className={inputCls}>
            {pieces.map((p) => <option key={p.id}>{p.composer} / {p.title}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="募集楽器">
            <select className={inputCls}>
              <option>Piano</option><option>Violin</option><option>Cello</option><option>Flute</option><option>その他</option>
            </select>
          </Field>
          <Field label="地域">
            <select className={inputCls}>
              <option>東京</option><option>大阪</option><option>神奈川</option><option>京都</option><option>オンライン</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="レベル">
            <select className={inputCls}>
              <option>初級</option><option>中級</option><option>上級</option><option>問わない</option>
            </select>
          </Field>
          <Field label="目的">
            <select className={inputCls}>
              <option>アンサンブル</option><option>発表会</option><option>趣味で合わせ</option><option>その他</option>
            </select>
          </Field>
        </div>

        <Field label="募集内容">
          <textarea
            placeholder="練習の頻度、合わせの日程、歓迎する条件などを書きましょう"
            className={`${inputCls} resize-none`}
            rows={5}
          />
        </Field>

        <button
          onClick={() => navigate('recruitment')}
          className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors shadow-sm"
        >
          募集を投稿する
        </button>
      </div>
    </div>
  );
}

const inputCls = "w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
