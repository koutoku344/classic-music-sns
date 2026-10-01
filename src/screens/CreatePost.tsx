import { useState } from 'react';
import type { ScreenName } from '../types';
import { pieces } from '../data';
import { ArrowLeft, Upload, Image as ImageIcon, Mic } from 'lucide-react';

interface CreatePostProps {
  navigate: (s: ScreenName) => void;
}

export default function CreatePost({ navigate }: CreatePostProps) {
  const [body, setBody] = useState('');
  const [selectedPiece, setSelectedPiece] = useState(pieces[0].id);
  const [prefs, setPrefs] = useState<string[]>([]);
  const [commentsEnabled, setCommentsEnabled] = useState(true);

  const allPrefs = ['感想歓迎', 'Advice歓迎', '厳しめAdvice歓迎'];

  const togglePref = (p: string) => {
    setPrefs(prefs.includes(p) ? prefs.filter((x) => x !== p) : [...prefs, p]);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('posts')} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> 戻る
      </button>

      <h1 className="font-serif text-2xl font-bold text-ink-900 mb-6">演奏を投稿</h1>

      <div className="bg-white rounded-2xl border border-ink-100 p-5 sm:p-6 space-y-5 animate-slide-up">
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">演奏した曲</label>
          <select
            value={selectedPiece}
            onChange={(e) => setSelectedPiece(e.target.value)}
            className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            {pieces.map((p) => (
              <option key={p.id} value={p.id}>{p.composer} / {p.title}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">音声ファイル</label>
          <div className="border-2 border-dashed border-ink-200 rounded-xl p-8 text-center hover:border-teal-400 hover:bg-teal-50/30 transition-colors cursor-pointer">
            <Mic size={32} className="mx-auto text-ink-400 mb-2" />
            <p className="text-sm text-ink-600 font-medium">録音をアップロード</p>
            <p className="text-xs text-ink-400 mt-1">MP3, WAV, M4A (最大50MB)</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">画像（任意）</label>
          <div className="border-2 border-dashed border-ink-200 rounded-xl p-6 text-center hover:border-teal-400 transition-colors cursor-pointer">
            <ImageIcon size={24} className="mx-auto text-ink-400 mb-1" />
            <p className="text-xs text-ink-400">画像を追加</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">メッセージ</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="練習の感想や、フィードバックしてほしいことなどを書きましょう"
            className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
            rows={4}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">フィードバック希望</label>
          <div className="flex flex-wrap gap-2">
            {allPrefs.map((p) => (
              <button
                key={p}
                onClick={() => togglePref(p)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  prefs.includes(p) ? 'bg-gold-100 text-gold-700 border-2 border-gold-300' : 'bg-white text-ink-600 border-2 border-ink-200 hover:border-ink-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-ink-700">コメント受付</label>
          <button
            onClick={() => setCommentsEnabled(!commentsEnabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${commentsEnabled ? 'bg-teal-600' : 'bg-ink-300'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${commentsEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <button
          onClick={() => navigate('posts')}
          className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors shadow-sm"
        >
          投稿する
        </button>
      </div>
    </div>
  );
}
