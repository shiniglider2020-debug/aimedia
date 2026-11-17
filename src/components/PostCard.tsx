import { useState } from 'react';
import {
  AtSign,
  Bookmark,
  Heart,
  ImageOff,
  MessageSquare,
  Repeat2,
  Send,
  UserPlus,
  Users,
} from 'lucide-react';
import type { Character, Post, UserProfile } from '../types.ts';
import { AudioPlayerCard } from './AudioPlayerCard.tsx';
import { Avatar } from './Avatar.tsx';
import { formatRelativeTime } from '../utils/image.ts';

interface PostCardProps {
  post: Post;
  allPosts: Post[];
  me: UserProfile;
  characters: Character[];
  isBookmarked: boolean;
  isAiReacting?: boolean;
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
}

export function PostCard({
  post,
  allPosts,
  me,
  characters,
  isBookmarked,
  isAiReacting = false,
  onToggleLike,
  onToggleRepost,
  onToggleBookmark,
  onQuotePost,
  onAddComment,
  onToggleCommentLike,
  onSummonCharacter,
  onTriggerAiReact,
  onSelectProfile,
  onSelectHashtag,
}: PostCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(post.comments.length > 0);
  const [commentText, setCommentText] = useState('');
  const [replyTargetId, setReplyTargetId] = useState<string | undefined>(undefined);
  const [sendingComment, setSendingComment] = useState(false);
  const [summonOpen, setSummonOpen] = useState(false);
  const [summoningId, setSummoningId] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const charMap = new Map(characters.map((c) => [c.id, c]));

  const resolveAuthor = (authorId: string) => {
    if (authorId === 'me') {
      return {
        id: 'me',
        name: me.name || 'You',
        handle: me.handle || '@you',
        role: me.role || 'Human Member',
        avatar: me.avatar,
        accentColor: '#141413',
      };
    }
    const c = charMap.get(authorId);
    return {
      id: authorId,
      name: c?.name ?? authorId,
      handle: c?.handle ?? `@${authorId}`,
      role: c?.role ?? 'AI Character',
      avatar: c?.avatar ?? '',
      accentColor: c?.accentColor ?? '#4338CA',
    };
  };

  const author = resolveAuthor(post.authorId);
  const quotedPost = post.quotePostId
    ? allPosts.find((p) => p.id === post.quotePostId)
    : undefined;
  const quotedAuthor = quotedPost ? resolveAuthor(quotedPost.authorId) : undefined;

  const renderContentWithMentions = (text: string) => {
    const parts = text.split(/(@[a-z0-9._-]+|#[a-z0-9_]+)/gi);
    return parts.map((part, idx) => {
      if (part.startsWith('@')) {
        const matchedChar = characters.find(
          (c) => c.handle.toLowerCase() === part.toLowerCase()
        );
        const isMe = me.handle.toLowerCase() === part.toLowerCase();
        if (matchedChar || isMe) {
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectProfile(isMe ? 'me' : matchedChar!.id)}
              className="text-[#4338CA] font-medium hover:underline"
            >
              {part}
            </button>
          );
        }
      }
      if (part.startsWith('#') && part.length > 1 && onSelectHashtag) {
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectHashtag(part)}
            className="text-[#4338CA] font-medium hover:underline"
          >
            {part}
          </button>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      await onAddComment(post.id, commentText.trim(), replyTargetId);
      setCommentText('');
      setReplyTargetId(undefined);
      setCommentsOpen(true);
    } finally {
      setSendingComment(false);
    }
  };

  const handleSummon = async (characterId: string) => {
    setSummonOpen(false);
    setSummoningId(characterId);
    setCommentsOpen(true);
    try {
      await onSummonCharacter(post.id, characterId);
    } finally {
      setSummoningId(null);
    }
  };

  const likedNames = post.likedByCharacterIds
    .map((id) => charMap.get(id)?.name)
    .filter(Boolean) as string[];

  return (
    <article className="px-5 py-5 border-b border-[#E7E7E2] bg-white">
      <div className="flex items-start gap-3.5">
        <button
          type="button"
          onClick={() => onSelectProfile(author.id)}
          className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-[#4338CA]"
          aria-label={`View ${author.name}'s profile`}
        >
          <Avatar
            src={author.avatar}
            name={author.name}
            accentColor={author.accentColor}
            size="md"
          />
        </button>

        <div className="min-w-0 flex-1">
          {/* Unboxed Metadata Row */}
          <div className="flex items-baseline flex-wrap gap-x-1.5 gap-y-0.5 text-xs text-[#6B6B68]">
            <button
              type="button"
              onClick={() => onSelectProfile(author.id)}
              className="font-display font-semibold text-sm text-[#141413] hover:underline truncate"
            >
              {author.name}
            </button>
            <span className="truncate">{author.handle}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{author.role}</span>
            <span aria-hidden="true">·</span>
            <time className="font-mono-tabular whitespace-nowrap shrink-0">
              {formatRelativeTime(post.createdAt)}
            </time>
            {post.topic && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#4338CA] font-medium whitespace-nowrap">
                  {post.topic}
                </span>
              </>
            )}
          </div>

          {/* Post Copy */}
          <div className="mt-2 text-[15px] leading-[1.6] text-[#141413] whitespace-pre-wrap break-words">
            {renderContentWithMentions(post.content)}
          </div>

          {/* Optional Image */}
          {post.image && (
            <div className="mt-3 rounded-xl overflow-hidden border border-[#E7E7E2] bg-[#F7F7F5]">
              {!imgFailed ? (
                <img
                  src={post.image}
                  alt={`Attachment from ${author.name}`}
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="w-full max-h-[380px] object-cover block"
                />
              ) : (
                <div className="h-44 flex flex-col items-center justify-center gap-2 text-xs text-[#6B6B68]">
                  <ImageOff className="w-5 h-5" />
                  <span>Image attachment unavailable</span>
                </div>
              )}
            </div>
          )}

          {/* Optional Music Track */}
          {post.music && (
            <div className="mt-3">
              <AudioPlayerCard music={post.music} />
            </div>
          )}

          {/* Optional Quoted Post */}
          {quotedPost && quotedAuthor && (
            <div className="mt-3 p-3.5 rounded-xl border border-[#E7E7E2] bg-[#F7F7F5]">
              <div className="flex items-center gap-2 text-xs text-[#6B6B68]">
                <Avatar
                  src={quotedAuthor.avatar}
                  name={quotedAuthor.name}
                  accentColor={quotedAuthor.accentColor}
                  size="xs"
                />
                <span className="font-semibold text-[#141413]">{quotedAuthor.name}</span>
                <span>{quotedAuthor.handle}</span>
              </div>
              <p className="mt-1.5 text-xs text-[#141413] leading-relaxed line-clamp-3">
                {quotedPost.content}
              </p>
            </div>
          )}

          {/* Liked by character names (unboxed inline attribution) */}
          {likedNames.length > 0 && (
            <div className="mt-2.5 text-xs text-[#6B6B68]">
              Liked by {likedNames.slice(0, 3).join(', ')}
              {likedNames.length > 3 ? ` +${likedNames.length - 3} more` : ''}
            </div>
          )}

          {/* Action Bar */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => onToggleLike(post.id)}
                className={`min-h-[40px] px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  post.likedByMe
                    ? 'text-[#E11D48] bg-[#E11D48]/8'
                    : 'text-[#6B6B68] hover:text-[#141413] hover:bg-[#F7F7F5]'
                }`}
                aria-label="Like post"
              >
                <Heart className={`w-4 h-4 ${post.likedByMe ? 'fill-current' : ''}`} />
                <span className="font-mono-tabular">{post.likesCount}</span>
              </button>

              <button
                type="button"
                onClick={() => setCommentsOpen((v) => !v)}
                className={`min-h-[40px] px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  commentsOpen
                    ? 'text-[#4338CA] bg-[#4338CA]/8'
                    : 'text-[#6B6B68] hover:text-[#141413] hover:bg-[#F7F7F5]'
                }`}
                aria-label="Toggle comments"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="font-mono-tabular">{post.comments.length}</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleRepost(post.id)}
                className={`min-h-[40px] px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  post.repostedByMe
                    ? 'text-[#16A34A] bg-[#16A34A]/8'
                    : 'text-[#6B6B68] hover:text-[#141413] hover:bg-[#F7F7F5]'
                }`}
                aria-label="Repost"
              >
                <Repeat2 className="w-4 h-4" />
                <span className="font-mono-tabular">{post.repostsCount}</span>
              </button>

              <button
                type="button"
                onClick={() => onQuotePost(post)}
                className="min-h-[40px] px-2.5 inline-flex items-center gap-1 rounded-lg text-xs font-medium text-[#6B6B68] hover:text-[#141413] hover:bg-[#F7F7F5] transition-colors whitespace-nowrap shrink-0"
              >
                Quote
              </button>

              {/* Summon Character Picker */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSummonOpen((v) => !v)}
                  className="min-h-[40px] px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-[#6B6B68] hover:text-[#4338CA] hover:bg-[#4338CA]/8 transition-colors whitespace-nowrap shrink-0"
                  title="Invite an AI character to reply"
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Invite Reply</span>
                </button>

                {summonOpen && (
                  <div className="absolute left-0 bottom-full mb-1.5 w-60 bg-white border border-[#E7E7E2] rounded-xl shadow-lg py-1.5 z-20">
                    <div className="px-3 py-1.5 text-[11px] font-medium text-[#6B6B68] border-b border-[#E7E7E2]">
                      Ask a character to reply
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {characters.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSummon(c.id)}
                          className="w-full px-3 py-2 flex items-center gap-2.5 text-left hover:bg-[#F7F7F5] transition-colors"
                        >
                          <Avatar
                            src={c.avatar}
                            name={c.name}
                            accentColor={c.accentColor}
                            size="xs"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-[#141413] truncate">
                              {c.name}
                            </div>
                            <div className="text-[11px] text-[#6B6B68] truncate">{c.role}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => onTriggerAiReact(post.id)}
                disabled={isAiReacting}
                className="min-h-[40px] px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-[#6B6B68] hover:text-[#4338CA] hover:bg-[#4338CA]/8 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                title="Let AI characters like, follow, or comment on this post"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">React</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => onToggleBookmark(post.id)}
              className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg transition-colors ${
                isBookmarked
                  ? 'text-[#4338CA] bg-[#4338CA]/8'
                  : 'text-[#6B6B68] hover:text-[#141413] hover:bg-[#F7F7F5]'
              }`}
              aria-label="Bookmark post"
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Live AI Reacting / Summoning State */}
          {(isAiReacting || summoningId) && (
            <div className="mt-3 text-xs text-[#4338CA]">
              {summoningId
                ? `${charMap.get(summoningId)?.name ?? 'Character'} is writing a reply...`
                : 'Characters in your circle are reading and responding...'}
            </div>
          )}

          {/* Comments Thread */}
          {commentsOpen && (
            <div className="mt-4 pt-3 border-t border-[#E7E7E2] space-y-3.5">
              {post.comments.map((comment) => {
                const cAuthor = resolveAuthor(comment.authorId);
                return (
                  <div key={comment.id} className="flex items-start gap-2.5">
                    <button
                      type="button"
                      onClick={() => onSelectProfile(cAuthor.id)}
                      className="shrink-0 mt-0.5"
                    >
                      <Avatar
                        src={cAuthor.avatar}
                        name={cAuthor.name}
                        accentColor={cAuthor.accentColor}
                        size="sm"
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline flex-wrap gap-x-1.5 text-xs text-[#6B6B68]">
                        <button
                          type="button"
                          onClick={() => onSelectProfile(cAuthor.id)}
                          className="font-semibold text-[#141413] hover:underline"
                        >
                          {cAuthor.name}
                        </button>
                        <span>{cAuthor.handle}</span>
                        <span aria-hidden="true">·</span>
                        <time className="font-mono-tabular">
                          {formatRelativeTime(comment.createdAt)}
                        </time>
                      </div>
                      <p className="mt-1 text-sm text-[#141413] leading-relaxed">
                        {renderContentWithMentions(comment.content)}
                      </p>
                      {comment.likedByCharacterIds && comment.likedByCharacterIds.length > 0 && (
                        <div className="mt-1 text-[11px] text-[#6B6B68]">
                          Liked by{' '}
                          {comment.likedByCharacterIds
                            .map((id) => charMap.get(id)?.name ?? id)
                            .join(', ')}
                        </div>
                      )}
                      <div className="mt-1 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => onToggleCommentLike(post.id, comment.id)}
                          className={`inline-flex items-center gap-1 text-xs py-1 ${
                            comment.likedByMe
                              ? 'text-[#E11D48] font-medium'
                              : 'text-[#6B6B68] hover:text-[#141413]'
                          }`}
                        >
                          <Heart
                            className={`w-3.5 h-3.5 ${comment.likedByMe ? 'fill-current' : ''}`}
                          />
                          <span className="font-mono-tabular">{comment.likesCount}</span>
                        </button>
                        {comment.authorId !== 'me' && (
                          <button
                            type="button"
                            onClick={() => {
                              setReplyTargetId(comment.authorId);
                              setCommentText(`${cAuthor.handle} `);
                            }}
                            className="inline-flex items-center gap-1 text-xs text-[#6B6B68] hover:text-[#4338CA] py-1"
                          >
                            <AtSign className="w-3 h-3" />
                            Reply
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add Comment Form */}
              <form onSubmit={handleCommentSubmit} className="flex items-center gap-2.5 pt-1">
                <Avatar
                  src={me.avatar}
                  name={me.name || 'You'}
                  accentColor="#141413"
                  size="sm"
                />
                <div className="flex-1 flex items-center gap-2 bg-[#F7F7F5] border border-[#E7E7E2] rounded-xl px-3 py-1.5 focus-within:border-[#4338CA] focus-within:bg-white transition-colors">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={
                      post.authorId === 'me'
                        ? 'Add a note or @mention a character...'
                        : `Reply to ${author.name}...`
                    }
                    className="flex-1 bg-transparent text-sm text-[#141413] placeholder:text-[#6B6B68] focus:outline-none py-1"
                  />
                  <button
                    type="submit"
                    disabled={!commentText.trim() || sendingComment}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#4338CA] hover:bg-[#4338CA]/10 disabled:opacity-40 transition-colors"
                    aria-label="Send reply"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
