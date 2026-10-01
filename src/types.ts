export type ScreenName =
  | 'landing' | 'auth' | 'posts' | 'postDetail' | 'createPost'
  | 'practice' | 'practiceDetail' | 'createPractice'
  | 'recruitment' | 'recruitmentDetail' | 'createRecruitment'
  | 'search' | 'messages' | 'conversation'
  | 'userProfile' | 'myPage' | 'repertoire' | 'performanceHistory' | 'subscription' | 'notifications' | 'settings'
  | 'accountSettings' | 'terms' | 'privacy' | 'help';

export interface Piece {
  id: string;
  composer: string;
  title: string;
  status: 'practicing' | 'repertoire' | 'performed';
}

export interface User {
  id: string;
  name: string;
  avatarUrl: string;
  instrument: string;
  region: string;
  bio: string;
  followers: number;
  following: number;
  isFollowing: boolean;
  feedbackPrefs: string[];
}

export interface TimestampComment {
  id: string;
  user: User;
  timestamp: string;
  text: string;
}

export interface Comment {
  id: string;
  user: User;
  text: string;
  createdAt: string;
}

export interface Post {
  id: string;
  user: User;
  piece: Piece;
  body: string;
  audioTitle: string;
  audioDuration: string;
  imageUrl?: string;
  feedbackPrefs: string[];
  likes: number;
  liked: boolean;
  comments: Comment[];
  timestampComments: TimestampComment[];
  commentsEnabled: boolean;
  createdAt: string;
}

export interface PracticeEntry {
  piece: Piece;
  minutes: number;
  comment: string;
}

export interface PracticeRecord {
  id: string;
  date: string;
  entries: PracticeEntry[];
}

export interface Recruitment {
  id: string;
  user: User;
  piece: Piece;
  instrument: string;
  region: string;
  level: string;
  purpose: string;
  description: string;
  status: 'open' | 'closed';
  applicants: number;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'recruit' | 'message';
  user: User;
  text: string;
  createdAt: string;
  read: boolean;
}

export interface ConversationSummary {
  id: string;
  user: User;
  lastMessage: string;
  lastUpdated: string;
  unread: boolean;
}

export interface Performance {
  id: string;
  piece: Piece;
  date: string;
  audioTitle: string;
  audioDuration: string;
  isPublic: boolean;
}
