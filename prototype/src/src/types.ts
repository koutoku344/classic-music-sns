export type ScreenName =
  | 'landing' | 'auth' | 'community' | 'postDetail' | 'createPost'
  | 'practice' | 'practiceDetail' | 'createPractice'
  | 'recruitmentDetail' | 'createRecruitment'
  | 'recording' | 'search' | 'messages' | 'conversation'
  | 'userProfile' | 'myPage' | 'repertoire' | 'performanceHistory' | 'subscription' | 'notifications' | 'settings'
  | 'accountSettings' | 'terms' | 'privacy' | 'help' | 'addRepertoire';

export interface Piece {
  id: string;
  composer: string;
  title: string;
  status: 'practicing' | 'repertoire' | 'performed';
}

export type TrophyType = 'expression' | 'exploration' | 'connection';
export type TrophyRank = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface Trophy {
  type: TrophyType;
  rank: TrophyRank;
  progress: string;
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
  trophies: Trophy[];
}

export interface TimestampComment {
  id: string;
  user: User;
  timestamp: string;
  text: string;
  likes: number;
  liked: boolean;
  replies?: TimestampComment[];
}

export interface Comment {
  id: string;
  user: User;
  text: string;
  createdAt: string;
  likes: number;
  liked: boolean;
  replies?: Comment[];
}

export interface Post {
  id: string;
  user: User;
  piece: Piece;
  body: string;
  audioTitle?: string;
  audioDuration?: string;
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
  audioTitle?: string;
  audioDuration?: string;
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
