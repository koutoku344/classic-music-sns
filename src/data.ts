import type { User, Post, PracticeRecord, Recruitment, Notification, ConversationSummary, Performance, Piece } from './types';

export const pieces: Piece[] = [
  { id: 'p1', composer: 'J.S. Bach', title: 'Partita No.2 Sinfonia', status: 'practicing' },
  { id: 'p2', composer: 'F. Chopin', title: 'Etude Op.10-4', status: 'practicing' },
  { id: 'p3', composer: 'L. v. Beethoven', title: 'Sonata Op.13 "Pathétique"', status: 'repertoire' },
  { id: 'p4', composer: 'C. Debussy', title: 'Clair de Lune', status: 'repertoire' },
  { id: 'p5', composer: 'F. Schubert', title: 'Impromptu Op.90-3', status: 'performed' },
  { id: 'p6', composer: 'W.A. Mozart', title: 'Sonata K.545', status: 'performed' },
  { id: 'p7', composer: 'J. Brahms', title: 'Intermezzo Op.117-1', status: 'practicing' },
  { id: 'p8', composer: 'F. Liszt', title: 'Consolation No.3', status: 'repertoire' },
];

export const users: User[] = [
  {
    id: 'u1', name: '山田 美咲', avatarUrl: 'https://images.pexels.com/photos/8272858/pexels-photo-8272858.jpeg?auto=compress&cs=tinysrgb&h=200&w=200&fit=crop',
    instrument: 'Piano', region: '東京', bio: 'クラシックピアノを再開して3年目。バッハとショパンを中心に練習中です。',
    followers: 124, following: 58, isFollowing: false,
    feedbackPrefs: ['感想歓迎', 'Advice歓迎'],
  },
  {
    id: 'u2', name: '佐藤 健一', avatarUrl: 'https://images.pexels.com/photos/35681211/pexels-photo-35681211.jpeg?auto=compress&cs=tinysrgb&h=200&w=200&fit=crop',
    instrument: 'Piano', region: '大阪', bio: '40代からピアノを始めました。ベートーヴェンが好きです。',
    followers: 89, following: 42, isFollowing: true,
    feedbackPrefs: ['厳しめAdvice歓迎'],
  },
  {
    id: 'u3', name: '鈴木 由紀', avatarUrl: 'https://images.pexels.com/photos/14587417/pexels-photo-14587417.jpeg?auto=compress&cs=tinysrgb&h=200&w=200&fit=crop',
    instrument: 'Violin', region: '神奈川', bio: 'アマチュアオーケストラ所属。アンサンブル仲間を探しています。',
    followers: 203, following: 71, isFollowing: true,
    feedbackPrefs: ['感想歓迎'],
  },
  {
    id: 'u4', name: '田中 誠', avatarUrl: 'https://images.pexels.com/photos/6942776/pexels-photo-6942776.jpeg?auto=compress&cs=tinysrgb&h=200&w=200&fit=crop',
    instrument: 'Cello', region: '京都', bio: 'チェロ歴15年。室内楽が好きです。',
    followers: 156, following: 34, isFollowing: false,
    feedbackPrefs: ['Advice歓迎', '厳しめAdvice歓迎'],
  },
  {
    id: 'me', name: 'あなた', avatarUrl: 'https://images.pexels.com/photos/7562139/pexels-photo-7562139.jpeg?auto=compress&cs=tinysrgb&h=200&w=200&fit=crop',
    instrument: 'Piano', region: '東京', bio: 'クラシックピアノを趣味として楽しんでいます。',
    followers: 32, following: 45, isFollowing: false,
    feedbackPrefs: ['感想歓迎', 'Advice歓迎'],
  },
];

const u1 = users[0], u2 = users[1], u3 = users[2], u4 = users[3];
const me = users[4];

export const posts: Post[] = [
  {
    id: 'post1', user: u1, piece: pieces[0],
    body: '中間部のテンポ維持を練習しています。同じ曲を弾いた方がいればアドバイスが欲しいです。',
    audioTitle: 'Partita No.2 Sinfonia', audioDuration: '7:10',
    imageUrl: 'https://images.pexels.com/photos/6647870/pexels-photo-6647870.jpeg?auto=compress&cs=tinysrgb&h=600&w=940',
    feedbackPrefs: ['感想歓迎', 'Advice歓迎'],
    likes: 24, liked: false,
    comments: [
      { id: 'c1', user: u2, text: 'テンポ感が素晴らしいです！中間部の左手をもっと意識するとさらに良くなるかも。', createdAt: '2時間前' },
    ],
    timestampComments: [
      { id: 'tc1', user: u2, timestamp: '2:35', text: 'ここからのフレーズがとても良かったです' },
    ],
    commentsEnabled: true, createdAt: '3時間前',
  },
  {
    id: 'post2', user: u3, piece: pieces[5],
    body: 'モーツァルトのソナタを弾いてみました。軽やかに弾くのが難しいですね。',
    audioTitle: 'Sonata K.545 1st mov.', audioDuration: '5:32',
    feedbackPrefs: ['感想歓迎'],
    likes: 41, liked: true,
    comments: [],
    timestampComments: [],
    commentsEnabled: true, createdAt: '5時間前',
  },
  {
    id: 'post3', user: u2, piece: pieces[2],
    body: 'Pathétiqueの第1楽章を録音しました。まだ粒が揃わない部分がありますが、フィードバックお願いします。',
    audioTitle: 'Pathétique 1st mov.', audioDuration: '8:45',
    imageUrl: 'https://images.pexels.com/photos/4231581/pexels-photo-4231581.jpeg?auto=compress&cs=tinysrgb&h=600&w=940',
    feedbackPrefs: ['厳しめAdvice歓迎'],
    likes: 18, liked: false,
    comments: [
      { id: 'c2', user: u1, text: '堂々とした演奏ですね！展開部の緊張感が伝わってきます。', createdAt: '1日前' },
      { id: 'c3', user: u4, text: '冒頭の和音の重さをもっと整えるとさらに説得力が増すと思います。', createdAt: '1日前' },
    ],
    timestampComments: [
      { id: 'tc2', user: u1, timestamp: '3:10', text: 'ここのクレッシェンドが効果的です' },
    ],
    commentsEnabled: true, createdAt: '1日前',
  },
  {
    id: 'post4', user: u4, piece: pieces[3],
    body: 'ドビュッシーの月光をゆっくり弾いてみました。ペダルの使い方を色々試しています。',
    audioTitle: 'Clair de Lune', audioDuration: '6:20',
    feedbackPrefs: ['感想歓迎', 'Advice歓迎'],
    likes: 33, liked: true,
    comments: [],
    timestampComments: [],
    commentsEnabled: false, createdAt: '2日前',
  },
];

export const practiceRecords: PracticeRecord[] = [
  {
    id: 'pr1', date: '2026/09/30',
    entries: [
      { piece: pieces[0], minutes: 60, comment: 'Sinfonia後半を中心に練習。テンポを落として確認した。' },
      { piece: pieces[1], minutes: 60, comment: '右手のテンポを重点的に練習。' },
    ],
  },
  {
    id: 'pr2', date: '2026/09/29',
    entries: [
      { piece: pieces[0], minutes: 45, comment: '前半の指回りを丁寧に。' },
    ],
  },
  {
    id: 'pr3', date: '2026/09/27',
    entries: [
      { piece: pieces[0], minutes: 30, comment: '通しで弾いてみた。中間部でつまずく。' },
      { piece: pieces[6], minutes: 40, comment: '初見からゆっくり。美しい曲。' },
    ],
  },
];

export const recruitments: Recruitment[] = [
  {
    id: 'r1', user: u3, piece: pieces[2], instrument: 'Piano', region: '神奈川',
    level: '中級', purpose: 'アンサンブル',
    description: 'ベートーヴェンの室内楽を一緒に演奏できる方を探しています。月1回程度の合わせを予定しています。',
    status: 'open', applicants: 3, createdAt: '2日前',
  },
  {
    id: 'r2', user: u4, piece: pieces[7], instrument: 'Violin', region: '京都',
    level: '上級', purpose: '発表会',
    description: '来春の発表会に向けて、ヴァイオリンとピアノのデュオを組みたいです。リストのConsolationを予定しています。',
    status: 'open', applicants: 7, createdAt: '3日前',
  },
  {
    id: 'r3', user: u2, piece: pieces[0], instrument: 'Violin', region: '大阪',
    level: '中級', purpose: '趣味で合わせ',
    description: 'バッハのパルティータを一緒に楽しめる方、楽器問わず歓迎です。気軽にお声がけください。',
    status: 'open', applicants: 1, createdAt: '5日前',
  },
];

export const notifications: Notification[] = [
  { id: 'n1', type: 'like', user: u1, text: 'があなたの投稿にLikeしました', createdAt: '1時間前', read: false },
  { id: 'n2', type: 'comment', user: u2, text: 'があなたの投稿にコメントしました', createdAt: '3時間前', read: false },
  { id: 'n3', type: 'follow', user: u3, text: 'があなたをフォローしました', createdAt: '5時間前', read: false },
  { id: 'n4', type: 'recruit', user: u4, text: 'があなたの募集に応募しました', createdAt: '1日前', read: true },
  { id: 'n5', type: 'comment', user: u1, text: 'があなたの演奏にTimestamp Commentを追加しました', createdAt: '2日前', read: true },
];

export const conversations: ConversationSummary[] = [
  { id: 'conv1', user: u1, lastMessage: 'アドバイスありがとうございます！早速試してみます', lastUpdated: '30分前', unread: true },
  { id: 'conv2', user: u3, lastMessage: '次回の合わせの日程を相談したいです', lastUpdated: '2時間前', unread: true },
  { id: 'conv3', user: u4, lastMessage: '楽譜を送りました、確認お願いします', lastUpdated: '昨日', unread: false },
];

export const myPerformances: Performance[] = [
  { id: 'perf1', piece: pieces[0], date: '2026/09/28', audioTitle: 'Partita No.2 Sinforia', audioDuration: '7:05', isPublic: true },
  { id: 'perf2', piece: pieces[2], date: '2026/09/15', audioTitle: 'Pathétique 1st mov.', audioDuration: '8:30', isPublic: true },
  { id: 'perf3', piece: pieces[3], date: '2026/08/20', audioTitle: 'Clair de Lune', audioDuration: '6:10', isPublic: false },
  { id: 'perf4', piece: pieces[0], date: '2026/08/10', audioTitle: 'Partita No.2 Sinfonia (旧録)', audioDuration: '7:20', isPublic: false },
];

export const practiceByPiece = [
  { piece: pieces[0], records: [
    { date: '9/30', minutes: 60 }, { date: '9/29', minutes: 45 }, { date: '9/27', minutes: 30 },
  ], total: 135 },
  { piece: pieces[1], records: [
    { date: '9/30', minutes: 60 }, { date: '9/28', minutes: 40 },
  ], total: 100 },
  { piece: pieces[6], records: [
    { date: '9/27', minutes: 40 },
  ], total: 40 },
];

export { me };
