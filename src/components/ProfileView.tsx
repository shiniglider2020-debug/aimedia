import { useState } from 'react';
import { ArrowLeft, Feather, MapPin, MessageCircle, Pencil, Plus, RotateCcw } from 'lucide-react';
import type { Character, Post, UserProfile } from '../types.ts';
import { AudioPlayerCard } from './AudioPlayerCard.tsx';
import { Avatar } from './Avatar.tsx';
import { PostCard } from './PostCard.tsx';

interface ProfileViewProps {
  profileId: string;
  me: UserProfile;
  characters: Character[];
  posts: Post[];
  onBackToFeed: () => void;
  onEditMe: () => void;
  onAddCharacter: () => void;
  onToggleFollow: (characterId: string) => void;
  onMessageCharacter: (characterId: string) => void;
  onCharacterPost: (characterId: string) => Promise<void>;
  onResetAccount: () => void;
  postHandlers: {
    onToggleLike: (postId: string) => void;
    onToggleRepost: (postId: string) => void;
    onToggleBookmark: (postId: string) => void;
    onQuotePost: (post: Post) => void;
    onAddComment: (
      postId: string,
      content: string,
      targetCharacterId?: string
    ) => Promise<void>;
    onToggleCommentLike: (postId: string, commentId: string) => void;
    onSummonCharacter: (postId: string, characterId: string) => Promise<void>;
    onTriggerAiReact: (postId: string) => Promise<void>;
    onSelectProfile: (profileId: string) => void;
    onSelectHashtag?: (tag: string) => void;
  };
}

export function ProfileView({
  profileId,
  me,
  characters,
  posts,
  onBackToFeed,
  onEditMe,
  onAddCharacter,
  onToggleFollow,
  onMessageCharacter,
  onCharacterPost,
  onResetAccount,
  postHandlers,
}: ProfileViewProps) {
  const [tab, setTab] = useState<'posts' | 'likes' | 'bookmarks' | 'followers' | 'following'>(
    'posts'
  );
  const [askingPost, setAskingPost] = useState(false);

  const isMe = profileId === 'me';
  const character = !isMe ? characters.find((c) => c.id === profileId) : undefined;

  if (!isMe && !character) {
    return (
      <div className="p-8 text-center bg-white min-h-screen">
        <p className="text-sm text-[#6B6B68]">Profile not found.</p>
        <button
          type="button"
          onClick={onBackToFeed}
          className="mt-4 px-4 py-2 text-xs font-medium rounded-lg bg-[#141413] text-white"
        >
          Back to Feed
        </button>
      </div>
    );
  }

  const charMap = new Map(characters.map((c) => [c.id, c]));
  const authoredPosts = posts.filter((p) => p.authorId === profileId);
  const likesReceived = authoredPosts.reduce((sum, p) => sum + p.likesCount, 0);
  const likedPosts = posts.filter((p) =>
    isMe ? p.likedByMe : p.likedByCharacterIds.includes(profileId)
  );
  const bookmarkedPosts = isMe
    ? posts.filter((p) => me.bookmarkedPostIds.includes(p.id))
    : [];

  const followerIds = isMe
    ? me.followerCharacterIds
    : [
        ...(me.followingIds.includes(profileId) ? ['me'] : []),
        ...(character!.followerCharacterIds ?? []),
      ];

  const followingListIds = isMe ? me.followingIds : character!.followingIds ?? [];

  const isFollowingChar = !isMe && me.followingIds.includes(profileId);

  const handleAskCharPost = async () => {
    if (!character || askingPost) return;
    setAskingPost(true);
    try {
      await onCharacterPost(character.id);
    } finally {
      setAskingPost(false);
    }
  };

  const renderPersonRow = (personId: string) => {
    if (personId === 'me') {
      return (
        <button
          key="me"
          type="button"
          onClick={() => postHandlers.onSelectProfile('me')}
          className="w-full px-5 py-4 flex items-center gap-3.5 text-left hover:bg-[#F7F7F5]/60 transition-colors"
        >
          <Avatar src={me.avatar} name={me.name} accentColor="#141413" size="md" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[#141413] truncate">{me.name}</div>
            <div className="text-xs text-[#6B6B68] truncate">
              {me.handle} · {me.role}
            </div>
          </div>
        </button>
      );
    }
    const c = charMap.get(personId);
    if (!c) return null;
    return (
      <div key={c.id} className="px-5 py-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => postHandlers.onSelectProfile(c.id)}
          className="flex items-center gap-3.5 text-left min-w-0 flex-1"
        >
          <Avatar src={c.avatar} name={c.name} accentColor={c.accentColor} size="md" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[#141413] truncate hover:underline">
              {c.name}
            </div>
            <div className="text-xs text-[#6B6B68] truncate">
              {c.handle} · {c.role}
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onToggleFollow(c.id)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 ${
            me.followingIds.includes(c.id)
              ? 'border border-[#E7E7E2] bg-[#F7F7F5] text-[#141413]'
              : 'bg-[#141413] text-white'
          }`}
        >
          {me.followingIds.includes(c.id) ? 'Following' : 'Follow'}
        </button>
      </div>
    );
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Header Bar */}
      <div className="px-5 py-3.5 border-b border-[#E7E7E2] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToFeed}
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#6B6B68] hover:text-[#141413] hover:bg-[#F7F7F5]"
            aria-label="Back to feed"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="font-display text-base font-bold text-[#141413] truncate">
              {isMe ? me.name || 'Your Profile' : character!.name}
            </h1>
            <div className="text-xs font-mono-tabular text-[#6B6B68]">
              {authoredPosts.length} {authoredPosts.length === 1 ? 'post' : 'posts'}
            </div>
          </div>
        </div>

        {isMe && (
          <button
            type="button"
            onClick={onResetAccount}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E7E7E2] text-[#6B6B68] hover:text-[#141413] hover:bg-[#F7F7F5] transition-colors whitespace-nowrap shrink-0"
            title="Reset profile and clear all posts back to zero"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Zero
          </button>
        )}
      </div>

      {/* Profile Identity Header */}
      <div className="px-5 py-6 border-b border-[#E7E7E2]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <Avatar
            src={isMe ? me.avatar : character!.avatar}
            name={isMe ? me.name || 'You' : character!.name}
            accentColor={isMe ? '#141413' : character!.accentColor}
            size="xl"
          />

          <div className="flex flex-wrap items-center gap-2">
            {isMe ? (
              <>
                <button
                  type="button"
                  onClick={onEditMe}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-[#E7E7E2] bg-white hover:bg-[#F7F7F5] text-[#141413] transition-colors whitespace-nowrap shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Profile
                </button>
                <button
                  type="button"
                  onClick={onAddCharacter}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#4338CA] text-white hover:bg-[#3730A3] transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Character
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleAskCharPost}
                  disabled={askingPost}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#E7E7E2] bg-white hover:bg-[#F7F7F5] text-[#141413] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <Feather className="w-3.5 h-3.5" />
                  {askingPost ? 'Writing...' : 'Ask to Post'}
                </button>
                <button
                  type="button"
                  onClick={() => onMessageCharacter(character!.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-[#E7E7E2] bg-white hover:bg-[#F7F7F5] text-[#141413] transition-colors whitespace-nowrap shrink-0"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Chat
                </button>
                <button
                  type="button"
                  onClick={() => onToggleFollow(character!.id)}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    isFollowingChar
                      ? 'border border-[#E7E7E2] bg-[#F7F7F5] text-[#141413]'
                      : 'bg-[#141413] text-white hover:bg-[#2A2A28]'
                  }`}
                >
                  {isFollowingChar ? 'Following' : 'Follow'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-4">
          <h2 className="font-display text-xl font-bold text-[#141413]">
            {isMe ? me.name : character!.name}
          </h2>
          <div className="text-xs text-[#6B6B68] mt-0.5">
            {isMe ? me.handle : character!.handle} · {isMe ? me.role : character!.role}
          </div>
        </div>

        {(isMe ? me.bio : character!.bio) && (
          <p className="mt-3 text-sm text-[#141413] leading-relaxed max-w-xl">
            {isMe ? me.bio : character!.bio}
          </p>
        )}

        {isMe && me.location && (
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-[#6B6B68]">
            <MapPin className="w-3.5 h-3.5" />
            <span>{me.location}</span>
          </div>
        )}

        {(isMe ? me.interests : character!.interests).length > 0 && (
          <div className="mt-3 text-xs text-[#6B6B68]">
            <span className="font-medium text-[#141413]">Interests: </span>
            {(isMe ? me.interests : character!.interests).join(' · ')}
          </div>
        )}

        {isMe && me.favoriteTrack && (
          <div className="mt-4 max-w-md">
            <AudioPlayerCard music={me.favoriteTrack} compact />
          </div>
        )}

        {/* Tabular Stats Row */}
        <div className="mt-5 pt-4 border-t border-[#E7E7E2] flex flex-wrap items-center gap-6 text-xs">
          <button type="button" onClick={() => setTab('posts')} className="hover:underline">
            <span className="font-mono-tabular font-semibold text-sm text-[#141413]">
              {authoredPosts.length}
            </span>{' '}
            <span className="text-[#6B6B68]">Posts</span>
          </button>
          <button type="button" onClick={() => setTab('followers')} className="hover:underline">
            <span className="font-mono-tabular font-semibold text-sm text-[#141413]">
              {followerIds.length}
            </span>{' '}
            <span className="text-[#6B6B68]">Followers</span>
          </button>
          <button type="button" onClick={() => setTab('following')} className="hover:underline">
            <span className="font-mono-tabular font-semibold text-sm text-[#141413]">
              {followingListIds.length}
            </span>{' '}
            <span className="text-[#6B6B68]">Following</span>
          </button>
          <div>
            <span className="font-mono-tabular font-semibold text-sm text-[#141413]">
              {likesReceived}
            </span>{' '}
            <span className="text-[#6B6B68]">Likes Received</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 border-b border-[#E7E7E2] flex items-center gap-5 overflow-x-auto">
        <button
          type="button"
          onClick={() => setTab('posts')}
          className={`py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
            tab === 'posts'
              ? 'border-[#4338CA] text-[#141413]'
              : 'border-transparent text-[#6B6B68] hover:text-[#141413]'
          }`}
        >
          Posts
        </button>
        <button
          type="button"
          onClick={() => setTab('likes')}
          className={`py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
            tab === 'likes'
              ? 'border-[#4338CA] text-[#141413]'
              : 'border-transparent text-[#6B6B68] hover:text-[#141413]'
          }`}
        >
          Likes
        </button>
        <button
          type="button"
          onClick={() => setTab('followers')}
          className={`py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
            tab === 'followers'
              ? 'border-[#4338CA] text-[#141413]'
              : 'border-transparent text-[#6B6B68] hover:text-[#141413]'
          }`}
        >
          Followers ({followerIds.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('following')}
          className={`py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
            tab === 'following'
              ? 'border-[#4338CA] text-[#141413]'
              : 'border-transparent text-[#6B6B68] hover:text-[#141413]'
          }`}
        >
          Following ({followingListIds.length})
        </button>
        {isMe && (
          <button
            type="button"
            onClick={() => setTab('bookmarks')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              tab === 'bookmarks'
                ? 'border-[#4338CA] text-[#141413]'
                : 'border-transparent text-[#6B6B68] hover:text-[#141413]'
            }`}
          >
            Bookmarks ({me.bookmarkedPostIds.length})
          </button>
        )}
      </div>

      {/* Content */}
      {tab === 'followers' ? (
        followerIds.length === 0 ? (
          <div className="px-6 py-16 text-center text-xs text-[#6B6B68]">
            No followers yet.
          </div>
        ) : (
          <div className="divide-y divide-[#E7E7E2]">{followerIds.map(renderPersonRow)}</div>
        )
      ) : tab === 'following' ? (
        followingListIds.length === 0 ? (
          <div className="px-6 py-16 text-center text-xs text-[#6B6B68]">
            Not following anyone yet.
          </div>
        ) : (
          <div className="divide-y divide-[#E7E7E2]">{followingListIds.map(renderPersonRow)}</div>
        )
      ) : (
        (() => {
          const visiblePosts =
            tab === 'posts' ? authoredPosts : tab === 'likes' ? likedPosts : bookmarkedPosts;
          if (visiblePosts.length === 0) {
            return (
              <div className="px-6 py-16 text-center">
                <p className="font-display text-sm font-semibold text-[#141413]">
                  {tab === 'posts'
                    ? 'No posts yet'
                    : tab === 'likes'
                    ? 'No likes yet'
                    : 'No saved posts yet'}
                </p>
                <p className="text-xs text-[#6B6B68] mt-1 max-w-xs mx-auto leading-relaxed">
                  {isMe && tab === 'posts'
                    ? 'Publish your first post from the home feed—AI characters will read it, like, follow, and reply.'
                    : 'Activity will appear here as conversations unfold.'}
                </p>
              </div>
            );
          }
          return visiblePosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              allPosts={posts}
              me={me}
              characters={characters}
              isBookmarked={me.bookmarkedPostIds.includes(post.id)}
              {...postHandlers}
            />
          ));
        })()
      )}
    </div>
  );
}
