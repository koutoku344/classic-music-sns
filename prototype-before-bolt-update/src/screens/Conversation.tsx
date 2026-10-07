import { useState } from 'react';
import type { ScreenName } from '../types';
import { conversations, users } from '../data';
import Avatar from '../components/Avatar';
import { ArrowLeft, Send, Phone, Video, MoreVertical } from 'lucide-react';

interface ConversationProps {
  conversationId: string;
  navigate: (s: ScreenName) => void;
}

interface Msg { id: string; text: string; fromMe: boolean; time: string; }

const initialMessages: Msg[] = [
  { id: 'm1', text: 'こんにちは！先日の投稿のアドバイス、とても参考になりました', fromMe: false, time: '14:30' },
  { id: 'm2', text: 'そう言っていただけて嬉しいです！中間部の練習、頑張ってみます', fromMe: true, time: '14:35' },
  { id: 'm3', text: 'アドバイスありがとうございます！早速試してみます', fromMe: false, time: '15:10' },
];

export default function Conversation({ conversationId, navigate }: ConversationProps) {
  const conv = conversations.find((c) => c.id === conversationId) || conversations[0];
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [draft, setDraft] = useState('');

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setMessages([...messages, { id: `m${Date.now()}`, text: draft, fromMe: true, time: 'たった今' }]);
    setDraft('');
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex flex-col" style={{ minHeight: 'calc(100vh - 4rem - 4rem)' }}>
      <div className="flex items-center gap-3 pb-4 border-b border-ink-100">
        <button onClick={() => navigate('messages')} className="text-ink-600 hover:text-ink-900">
          <ArrowLeft size={20} />
        </button>
        <Avatar user={conv.user} size="md" onClick={() => navigate('userProfile', { id: conv.user.id })} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-ink-900 text-sm">{conv.user.name}</p>
          <p className="text-xs text-ink-400">{conv.user.instrument} · {conv.user.region}</p>
        </div>
        <button className="w-9 h-9 flex items-center justify-center text-ink-500 hover:bg-ink-50 rounded-lg">
          <Phone size={18} />
        </button>
        <button className="w-9 h-9 flex items-center justify-center text-ink-500 hover:bg-ink-50 rounded-lg">
          <MoreVertical size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'} animate-slide-up`}>
            {!m.fromMe && <Avatar user={conv.user} size="sm" />}
            <div className={`max-w-[75%] ml-2 ${m.fromMe ? 'ml-0 mr-0' : ''}`}>
              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                m.fromMe ? 'bg-teal-600 text-white rounded-br-md' : 'bg-white border border-ink-100 text-ink-800 rounded-bl-md ml-2'
              }`}>
                {m.text}
              </div>
              <p className={`text-xs text-ink-400 mt-1 ${m.fromMe ? 'text-right' : 'ml-2'}`}>{m.time}</p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={send} className="flex gap-2 pt-3 border-t border-ink-100">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="メッセージを入力..."
          className="flex-1 px-4 py-3 bg-white border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        <button type="submit" className="w-12 h-12 flex-shrink-0 bg-teal-600 text-white rounded-xl flex items-center justify-center hover:bg-teal-700 transition-colors">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
