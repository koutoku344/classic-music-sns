import type { ScreenName } from '../types';
import { myPerformances } from '../data';
import AudioPlayer from '../components/AudioPlayer';
import { ArrowLeft, Award, Music2, Lock, Globe } from 'lucide-react';

interface PerformanceHistoryProps {
  navigate: (s: ScreenName) => void;
}

export default function PerformanceHistory({ navigate }: PerformanceHistoryProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('myPage')} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> マイページ
      </button>

      <h1 className="font-serif text-2xl font-bold text-ink-900 flex items-center gap-2 mb-6">
        <Award size={22} className="text-teal-600" /> 演奏履歴
      </h1>

      <div className="space-y-4">
        {myPerformances.map((perf) => (
          <div key={perf.id} className="bg-white rounded-2xl border border-ink-100 p-5 animate-slide-up">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                  <Music2 size={18} className="text-teal-600" />
                </div>
                <div>
                  <p className="font-medium text-ink-900 text-sm">
                    <span className="italic text-ink-500">{perf.piece.composer}</span> / {perf.piece.title}
                  </p>
                  <p className="text-xs text-ink-400 mt-0.5">{perf.date}</p>
                </div>
              </div>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${perf.isPublic ? 'bg-sage-100 text-sage-700' : 'bg-ink-100 text-ink-500'}`}>
                {perf.isPublic ? <Globe size={12} /> : <Lock size={12} />}
                {perf.isPublic ? '公開' : '非公開'}
              </span>
            </div>
            <AudioPlayer title={perf.audioTitle} duration={perf.audioDuration} compact />
          </div>
        ))}
      </div>
    </div>
  );
}
