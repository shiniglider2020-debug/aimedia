export interface MusicAttachment {
  title: string;
  artist?: string;
  audioUrl?: string;
}

export interface UserProfile {
  id: 'me';
  hasProfile: boolean;
  name: string;
  handle: string;
  role: string;
  bio: string;
  location: string;
  avatar: string;
  interests: string[];
  favoriteTrack?: MusicAttachment;
  followingIds: string[];
  followerCharacterIds: string[];
  bookmarkedPostIds: string[];
}

export interface Character {
  id: string;
  name: string;
  handle: string;
  role: string;
  bio: string;
  personality: string;
  interests: string[];
  avatar: string;
  accentColor: string;
  followersCount: number;
  followingIds: string[];
  followerCharacterIds: string[];
  isCustom?: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: string;
  likedByMe: boolean;
  likedByCharacterIds: string[];
  likesCount: number;
  replyToCommentId?: string;
}

export interface Post {
  id: string;
  authorId: string;
  content: string;
  image?: string;
  music?: MusicAttachment;
  topic?: string;
  createdAt: string;
  likesCount: number;
  likedByMe: boolean;
  likedByCharacterIds: string[];
  repostedByMe: boolean;
  repostsCount: number;
  quotePostId?: string;
  comments: Comment[];
}

export interface DirectMessage {
  id: string;
  threadId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export type NotificationType = 'comment' | 'like' | 'mention' | 'follow';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  actorId: string;
  postId?: string;
  snippet?: string;
  createdAt: string;
  read: boolean;
}

export interface TrendingHashtag {
  tag: string;
  count: number;
  postIds: string[];
}

export interface AppState {
  me: UserProfile;
  characters: Character[];
  posts: Post[];
  messages: DirectMessage[];
  notifications: NotificationItem[];
}
