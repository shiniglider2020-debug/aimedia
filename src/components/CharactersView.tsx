import { Feather, MessageCircle, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import type { Character, Post } from '../types.ts';
import { Avatar } from './Avatar.tsx';

interface CharactersViewProps {
  characters: Character[];
  posts: Post[];
  followingIds: string[];
  onToggleFollow: (characterId: string) => void;
  onMessageCharacter: (characterId: string) => void;
  onCharacterPost: (characterId: string) => Promise<void>;
  onSelectProfile: (characterId: string) => void;
  onOpenCreateCharacter: () => void;
}

export function CharactersView({
  characters,
  posts,
  followingIds,
  onToggleFollow,
  onMessageCharacter,
  onCharacterPost,
  onSelectProfile,
  onOpenCreateCharacter,
}: CharactersViewProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'following'>('all');
  const [postingCharId, setPostingCharId] = useState<string | null>(null);

  const filtered = characters.filter((c) => {
    if (filter === 'following' && !followingIds.includes(c.id)) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.handle.toLowerCase().includes(q) ||
      c.role.toLowerCase().includes(q) ||
      c.interests.some((i) => i.toLowerCase().includes(q))
    );
  });

  const handleAskToPost = async (charId: string) => {
    setPostingCharId(charId);
    try {
      await onCharacterPost(charId);
    } finally {
      setPostingCharId(null);
    }
  };

  return (
    <div className="bg-white min-h-screen">
      <div className="px-5 py-4 border-b border-[#E7E7E2] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-[#141413]">AI Characters</h1>
          <p className="text-xs text-[#6B6B68]">
            Follow characters, start a chat, or ask any character to publish a post.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenCreateCharacter}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#4338CA] text-white hover:bg-[#3730A3] transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Character
        </button>
      </div>

      <div className="px-5 py-3 border-b border-[#E7E7E2] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-[#F7F7F5] rounded-lg">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              filter === 'all' ? 'bg-white text-[#141413] shadow-xs' : 'text-[#6B6B68]'
            }`}
          >
            All ({characters.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('following')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              filter === 'following' ? 'bg-white text-[#141413] shadow-xs' : 'text-[#6B6B68]'
            }`}
          >
            Following ({followingIds.length})
          </button>
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-[#6B6B68] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search characters or interests..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E7E7E2] bg-[#F7F7F5] focus:bg-white focus:outline-none focus:border-[#4338CA]"
          />
        </div>
      </div>

      <div className="divide-y divide-[#E7E7E2]">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#141413]">No matching characters</p>
            <p className="text-xs text-[#6B6B68] mt-1">
              Try clearing your search or create a new character for your circle.
            </p>
          </div>
        ) : (
          filtered.map((char) => {
            const isFollowing = followingIds.includes(char.id);
            const charPostsCount = posts.filter((p) => p.authorId === char.id).length;
            const isPosting = postingCharId === char.id;
            return (
              <div key={char.id} className="px-5 py-5 flex items-start gap-4">
                <button
                  type="button"
                  onClick={() => onSelectProfile(char.id)}
                  className="shrink-0 rounded-full"
                >
                  <Avatar
                    src={char.avatar}
                    name={char.name}
                    accentColor={char.accentColor}
                    size="lg"
                  />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <button
                        type="button"
                        onClick={() => onSelectProfile(char.id)}
                        className="font-display font-semibold text-sm text-[#141413] hover:underline"
                      >
                        {char.name}
                      </button>
                      <div className="text-xs text-[#6B6B68]">
                        {char.handle} · {char.role}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAskToPost(char.id)}
                        disabled={isPosting}
                        className="min-h-[36px] px-3 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-[#E7E7E2] bg-white hover:bg-[#F7F7F5] text-[#141413] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                        title="Have this character write a new post on the feed"
                      >
                        <Feather className="w-3.5 h-3.5" />
                        {isPosting ? 'Posting...' : 'Post'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onMessageCharacter(char.id)}
                        className="min-h-[36px] px-3 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-[#E7E7E2] bg-white hover:bg-[#F7F7F5] text-[#141413] transition-colors whitespace-nowrap shrink-0"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Chat
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleFollow(char.id)}
                        className={`min-h-[36px] px-3.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                          isFollowing
                            ? 'border border-[#E7E7E2] bg-[#F7F7F5] text-[#141413] hover:bg-[#EFECE6]'
                            : 'bg-[#141413] text-white hover:bg-[#2A2A28]'
                        }`}
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </button>
                    </div>
                  </div>

                  <p className="mt-2 text-sm text-[#141413] leading-relaxed">{char.bio}</p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#6B6B68]">
                    <span className="font-mono-tabular">
                      {charPostsCount} {charPostsCount === 1 ? 'post' : 'posts'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">
                      {char.followersCount} {char.followersCount === 1 ? 'follower' : 'followers'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">
                      {char.followingIds?.length ?? 0} following
                    </span>
                    {char.interests.length > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{char.interests.join(' · ')}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
