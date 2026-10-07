import { useState } from 'react';
import type { Comment } from '../types';
import { users } from '../data';
import Avatar from './Avatar';
import { Heart, MessageCircle, Send } from 'lucide-react';

interface CommentItemProps {
  comment: Comment;
  onUserClick: (userId: string) => void;
  onReply: (parentId: string, text: string) => void;
  onLike: (commentId: string) => void;
  depth?: number;
}

export default function CommentItem({ comment, onUserClick, onReply, onLike, depth = 0 }: CommentItemProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplies, setShowReplies] = useState(true);

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    onReply(comment.id, replyText);
    setReplyText('');
    setShowReplyInput(false);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLike(comment.id);
  };

  return (
    <div className={`flex items-start gap-3 ${depth > 0 ? 'ml-10 mt-3' : ''}`}>
      <Avatar user={comment.user} size="sm" onClick={() => onUserClick(comment.user.id)} />
      <div className="flex-1 min-w-0">
        <div className="bg-ink-50 rounded-2xl px-4 py-2.5">
          <div className="flex items-center gap-2 mb-0.5">
            <p
              className="font-medium text-ink-900 text-sm hover:text-teal-700 transition-colors cursor-pointer"
              onClick={() => onUserClick(comment.user.id)}
            >
              {comment.user.name}
            </p>
            <p className="text-xs text-ink-400">{comment.createdAt}</p>
          </div>
          <p className="text-sm text-ink-700 leading-relaxed">{comment.text}</p>
        </div>
        <div className="flex items-center gap-4 mt-1.5 pl-2">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 text-xs font-medium transition-colors ${comment.liked ? 'text-burgundy-500' : 'text-ink-400 hover:text-burgundy-500'}`}
          >
            <Heart size={13} className={comment.liked ? 'fill-burgundy-500 text-burgundy-500' : ''} />
            {comment.likes > 0 && <span>{comment.likes}</span>}
          </button>
          <button
            onClick={() => setShowReplyInput(!showReplyInput)}
            className="flex items-center gap-1 text-xs font-medium text-ink-400 hover:text-teal-600 transition-colors"
          >
            <MessageCircle size={13} />
            返信
          </button>
        </div>

        {showReplyInput && (
          <form onSubmit={handleSendReply} className="flex gap-2 mt-2">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`${comment.user.name} に返信...`}
              autoFocus
              className="flex-1 px-3 py-2 bg-white border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <button type="submit" className="w-9 h-9 flex-shrink-0 bg-teal-600 text-white rounded-xl flex items-center justify-center hover:bg-teal-700 transition-colors">
              <Send size={15} />
            </button>
          </form>
        )}

        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-1">
            {depth === 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="text-xs text-ink-400 hover:text-teal-600 font-medium pl-2 mb-1"
              >
                {showReplies ? '返信を隠す' : `${comment.replies.length}件の返信を表示`}
              </button>
            )}
            {showReplies && comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                onUserClick={onUserClick}
                onReply={onReply}
                onLike={onLike}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
