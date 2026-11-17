import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Compass,
  Feather,
  Hash,
  Home,
  ImagePlus,
  MessageCircle,
  Music,
  Plus,
  RefreshCw,
  Search,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react';
import type {
  AppState,
  MusicAttachment,
  Post,
  TrendingHashtag,
  UserProfile,
} from './types.ts';
import { AudioPlayerCard } from './components/AudioPlayerCard.tsx';
import { Avatar } from './components/Avatar.tsx';
import { CharacterModal } from './components/CharacterModal.tsx';
import { CharactersView } from './components/CharactersView.tsx';
import { MessagesView } from './components/MessagesView.tsx';
import { NotificationsView } from './components/NotificationsView.tsx';
import { PostCard } from './components/PostCard.tsx';
import { ProfileSetupStudio } from './components/ProfileSetupStudio.tsx';
import { ProfileView } from './components/ProfileView.tsx';
import { apiFetch } from './utils/api.ts';
import { readAndResizeImageFile, readFileAsDataUrl } from './utils/image.ts';

type NavSection = 'feed' | 'characters' | 'messages' | 'notifications' | 'profile';
type FeedTab = 'all' | 'following' | 'mentions';

const STORAGE_KEY = 'kith_saved_state_v1';

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const [section, setSection] = useState<NavSection>('feed');
  const [feedTab, setFeedTab] = useState<FeedTab>('all');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('me');
  const [activeThreadId, setActiveThreadId] = useState<string>('group-lounge');

  const [searchQuery, setSearchQuery] = useState('');
  const [hashtagFilter, setHashtagFilter] = useState<string | null>(null);
  const [trendingHashtags, setTrendingHashtags] = useState<TrendingHashtag[]>([]);
  const [analyzingHashtags, setAnalyzingHashtags] = useState(false);
  const [hashtagError, setHashtagError] = useState<string | null>(null);
  const lastAnalyzedSigRef = useRef<string>('');

  // Composer state
  const [composerText, setComposerText] = useState('');
  const [composerTopic, setComposerTopic] = useState('');
  const [composerImage, setComposerImage] = useState('');
  const [musicPanelOpen, setMusicPanelOpen] = useState(false);
  const [musicTitle, setMusicTitle] = useState('');
  const [musicArtist, setMusicArtist] = useState('');
  const [musicAudioUrl, setMusicAudioUrl] = useState('');
  const [uploadingPostAudio, setUploadingPostAudio] = useState(false);
  const [quotePost, setQuotePost] = useState<Post | null>(null);
  const [autoAiReact, setAutoAiReact] = useState(true);
  const [posting, setPosting] = useState(false);
  const [reactingPostIds, setReactingPostIds] = useState<string[]>([]);
  const [pulsing, setPulsing] = useState(false);

  // Modals
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [createCharOpen, setCreateCharOpen] = useState(false);

  // @mention dropdown inside composer
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const postImageInputRef = useRef<HTMLInputElement>(null);
  const postAudioInputRef = useRef<HTMLInputElement>(null);

  const loadInitialState = useCallback(async () => {
    try {
      setLoading(true);
      let data = await apiFetch<AppState>('/api/state');

      // If server restarted cleanly with empty zero-state, restore saved history from browser storage
      if (!data.me.hasProfile && data.posts.length === 0 && data.messages.length === 0) {
        try {
          const savedRaw = localStorage.getItem(STORAGE_KEY);
          if (savedRaw) {
            const parsed = JSON.parse(savedRaw) as AppState;
            if (
              parsed?.me?.hasProfile ||
              (Array.isArray(parsed?.posts) && parsed.posts.length > 0) ||
              (Array.isArray(parsed?.messages) && parsed.messages.length > 0)
            ) {
              data = await apiFetch<AppState>('/api/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed),
              });
            }
          }
        } catch {
          // Ignore corrupted browser cache and proceed with server state
        }
      }

      setState(data);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Unable to connect to server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitialState();
  }, [loadInitialState]);

  useEffect(() => {
    if (!state) return;
    if (state.me.hasProfile || state.posts.length > 0 || state.messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Ignore storage quota errors cleanly
      }
    }
  }, [state]);

  const unreadCount = useMemo(
    () => (state ? state.notifications.filter((n) => !n.read).length : 0),
    [state]
  );

  const myPostsCount = useMemo(
    () => (state ? state.posts.filter((p) => p.authorId === 'me').length : 0),
    [state]
  );

  const myLikesReceived = useMemo(
    () =>
      state
        ? state.posts
            .filter((p) => p.authorId === 'me')
            .reduce((sum, p) => sum + p.likesCount, 0)
        : 0,
    [state]
  );

  const postsSignature = useMemo(
    () =>
      state
        ? state.posts.map((p) => `${p.id}:${p.comments.length}:${p.likesCount}`).join('|')
        : '',
    [state]
  );

  const analyzeTrendingHashtags = useCallback(async () => {
    if (!state || state.posts.length === 0) {
      setTrendingHashtags([]);
      setHashtagError(null);
      return;
    }
    setAnalyzingHashtags(true);
    setHashtagError(null);
    try {
      const data = await apiFetch<{ hashtags: TrendingHashtag[] }>(
        '/api/hashtags/analyze',
        { method: 'POST' }
      );
      setTrendingHashtags(data.hashtags.slice(0, 5));
    } catch (err) {
      setHashtagError(
        err instanceof Error ? err.message : 'Could not analyze trending hashtags.'
      );
    } finally {
      setAnalyzingHashtags(false);
    }
  }, [state]);

  useEffect(() => {
    if (!state || !state.me.hasProfile) return;
    if (state.posts.length === 0) {
      lastAnalyzedSigRef.current = '';
      setTrendingHashtags([]);
      setHashtagError(null);
      return;
    }
    if (postsSignature !== lastAnalyzedSigRef.current) {
      lastAnalyzedSigRef.current = postsSignature;
      void analyzeTrendingHashtags();
    }
  }, [state, postsSignature, analyzeTrendingHashtags]);

  const activeTrendingItem = useMemo(
    () =>
      hashtagFilter
        ? trendingHashtags.find(
            (item) => item.tag.toLowerCase() === hashtagFilter.toLowerCase()
          )
        : undefined,
    [trendingHashtags, hashtagFilter]
  );

  const filteredPosts = useMemo(() => {
    if (!state) return [];
    const analyzedIds = activeTrendingItem ? new Set(activeTrendingItem.postIds) : null;
    const cleanTag = hashtagFilter
      ? hashtagFilter.replace(/^#+/, '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()
      : '';
    const hashtagRegex = cleanTag
      ? new RegExp(`(^|[^a-zA-Z0-9_])${`#${cleanTag}`}\\b`, 'i')
      : null;

    return state.posts.filter((post) => {
      if (feedTab === 'following') {
        if (post.authorId !== 'me' && !state.me.followingIds.includes(post.authorId)) {
          return false;
        }
      } else if (feedTab === 'mentions') {
        const handle = state.me.handle.toLowerCase();
        const inPost = handle && post.content.toLowerCase().includes(handle);
        const inComments =
          handle && post.comments.some((c) => c.content.toLowerCase().includes(handle));
        if (!inPost && !inComments && post.authorId !== 'me') return false;
      }

      if (hashtagFilter && cleanTag) {
        const topicClean = (post.topic ?? '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
        const fullText = [
          post.content,
          post.topic ?? '',
          ...post.comments.map((c) => c.content),
        ].join(' ');
        const matchesLiteral = Boolean(hashtagRegex?.test(fullText));
        const matchesTopic = topicClean === cleanTag;
        const matchesAnalyzed = Boolean(analyzedIds?.has(post.id));
        if (!matchesLiteral && !matchesTopic && !matchesAnalyzed) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const char = state.characters.find((c) => c.id === post.authorId);
        const authorName = post.authorId === 'me' ? state.me.name : char?.name ?? '';
        const matchesPost =
          post.content.toLowerCase().includes(q) ||
          authorName.toLowerCase().includes(q) ||
          (post.topic?.toLowerCase().includes(q) ?? false);
        if (!matchesPost) return false;
      }
      return true;
    });
  }, [state, feedTab, hashtagFilter, activeTrendingItem, searchQuery]);

  // Handlers
  const handleSaveProfile = async (payload: {
    name: string;
    handle: string;
    role: string;
    bio: string;
    location: string;
    avatar: string;
    interests: string[];
    favoriteTrack?: MusicAttachment | null;
  }) => {
    setApiError(null);
    const data = await apiFetch<UserProfile>('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, hasProfile: true }),
    });
    setState((prev) => (prev ? { ...prev, me: data } : prev));
    setEditProfileOpen(false);
  };

  const handleCreateCharacter = async (payload: {
    name: string;
    handle: string;
    role: string;
    bio: string;
    personality: string;
    interests: string[];
    accentColor: string;
    avatar: string;
    autoIntro: boolean;
    followImmediately: boolean;
  }) => {
    setApiError(null);
    const data = await apiFetch<{ state: AppState }>('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setState(data.state);
  };

  const handleToggleFollow = async (characterId: string) => {
    try {
      const data = await apiFetch<{
        followingIds: string[];
        character: AppState['characters'][number];
      }>(`/api/characters/${characterId}/follow`, { method: 'POST' });
      setState((prev) =>
        prev
          ? {
              ...prev,
              me: { ...prev.me, followingIds: data.followingIds },
              characters: prev.characters.map((c) =>
                c.id === characterId ? data.character : c
              ),
            }
          : prev
      );
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Could not update follow status.');
    }
  };

  const handleComposerChange = (value: string) => {
    setComposerText(value);
    const match = value.match(/(?:^|\s)@([a-z0-9._-]*)$/i);
    if (match) {
      setMentionQuery(match[1].toLowerCase());
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (handle: string) => {
    const updated = composerText.replace(/@([a-z0-9._-]*)$/i, `${handle} `);
    setComposerText(updated);
    setMentionQuery(null);
    composerInputRef.current?.focus();
  };

  const handlePostImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readAndResizeImageFile(file, 960);
      setComposerImage(dataUrl);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Unable to process image.');
    } finally {
      e.target.value = '';
    }
  };

  const handlePostAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setApiError('Audio file must be under 15 MB.');
      e.target.value = '';
      return;
    }
    setApiError(null);
    setUploadingPostAudio(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const uploaded = await apiFetch<{ url: string }>('/api/upload-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, fileName: file.name }),
      });
      setMusicAudioUrl(uploaded.url);
      if (!musicTitle.trim()) {
        setMusicTitle(file.name.replace(/\.[^.]+$/, ''));
      }
      setMusicPanelOpen(true);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Could not upload audio file.');
    } finally {
      setUploadingPostAudio(false);
      e.target.value = '';
    }
  };

  const clearPostMusic = () => {
    setMusicTitle('');
    setMusicArtist('');
    setMusicAudioUrl('');
    setMusicPanelOpen(false);
  };

  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasMusic = Boolean(musicTitle.trim() || musicAudioUrl);
    if ((!composerText.trim() && !hasMusic) || posting) return;
    setApiError(null);
    setPosting(true);
    try {
      const musicPayload: MusicAttachment | undefined = hasMusic
        ? {
            title: musicTitle.trim() || 'Shared Track',
            artist: musicArtist.trim() || undefined,
            audioUrl: musicAudioUrl || undefined,
          }
        : undefined;

      const created = await apiFetch<Post>('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content:
            composerText.trim() ||
            (musicPayload ? `Listening to ${musicPayload.title}` : ''),
          topic: composerTopic.trim() || undefined,
          image: composerImage || undefined,
          music: musicPayload,
          quotePostId: quotePost?.id,
        }),
      });

      setState((prev) => (prev ? { ...prev, posts: [created, ...prev.posts] } : prev));
      setComposerText('');
      setComposerTopic('');
      setComposerImage('');
      clearPostMusic();
      setQuotePost(null);
      setMentionQuery(null);

      if (autoAiReact) {
        setReactingPostIds((prev) => [...prev, created.id]);
        try {
          const reactData = await apiFetch<{
            post: Post;
            notifications: AppState['notifications'];
            me?: AppState['me'];
            characters?: AppState['characters'];
          }>(`/api/posts/${created.id}/ai-react`, {
            method: 'POST',
          });
          setState((prev) =>
            prev
              ? {
                  ...prev,
                  posts: prev.posts.map((p) => (p.id === created.id ? reactData.post : p)),
                  notifications: reactData.notifications,
                  me: reactData.me ?? prev.me,
                  characters: reactData.characters ?? prev.characters,
                }
              : prev
          );
        } finally {
          setReactingPostIds((prev) => prev.filter((id) => id !== created.id));
        }
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPosting(false);
    }
  };

  const handlePulseFeed = async () => {
    if (pulsing) return;
    setApiError(null);
    setPulsing(true);
    try {
      const data = await apiFetch<{
        posts: AppState['posts'];
        notifications: AppState['notifications'];
        me?: AppState['me'];
        characters?: AppState['characters'];
      }>('/api/feed/pulse', { method: 'POST' });
      setState((prev) =>
        prev
          ? {
              ...prev,
              posts: data.posts,
              notifications: data.notifications,
              me: data.me ?? prev.me,
              characters: data.characters ?? prev.characters,
            }
          : prev
      );
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to refresh AI activity.');
    } finally {
      setPulsing(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    try {
      const updated = await apiFetch<Post>(`/api/posts/${postId}/like`, { method: 'POST' });
      setState((prev) =>
        prev
          ? { ...prev, posts: prev.posts.map((p) => (p.id === postId ? updated : p)) }
          : prev
      );
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Could not update like.');
    }
  };

  const handleToggleRepost = async (postId: string) => {
    try {
      const updated = await apiFetch<Post>(`/api/posts/${postId}/repost`, { method: 'POST' });
      setState((prev) =>
        prev
          ? { ...prev, posts: prev.posts.map((p) => (p.id === postId ? updated : p)) }
          : prev
      );
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Could not repost.');
    }
  };

  const handleToggleBookmark = async (postId: string) => {
    try {
      const data = await apiFetch<{ bookmarkedPostIds: string[] }>(
        `/api/posts/${postId}/bookmark`,
        { method: 'POST' }
      );
      setState((prev) =>
        prev
          ? { ...prev, me: { ...prev.me, bookmarkedPostIds: data.bookmarkedPostIds } }
          : prev
      );
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Could not update bookmark.');
    }
  };

  const handleAddComment = async (
    postId: string,
    content: string,
    targetCharacterId?: string
  ) => {
    setApiError(null);
    const data = await apiFetch<{ post: Post; comment?: { id: string } }>(
      `/api/posts/${postId}/comments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }
    );
    setState((prev) =>
      prev
        ? { ...prev, posts: prev.posts.map((p) => (p.id === postId ? data.post : p)) }
        : prev
    );

    // Trigger AI character reply in thread
    setReactingPostIds((prev) => [...prev, postId]);
    try {
      const replyData = await apiFetch<{
        post: Post;
        notifications: AppState['notifications'];
        me?: AppState['me'];
        characters?: AppState['characters'];
      }>(`/api/posts/${postId}/ai-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentText: content,
          targetCharacterId,
          userCommentId: data.comment?.id,
        }),
      });
      setState((prev) =>
        prev
          ? {
              ...prev,
              posts: prev.posts.map((p) => (p.id === postId ? replyData.post : p)),
              notifications: replyData.notifications,
              me: replyData.me ?? prev.me,
              characters: replyData.characters ?? prev.characters,
            }
          : prev
      );
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Character reply failed.');
    } finally {
      setReactingPostIds((prev) => prev.filter((id) => id !== postId));
    }
  };

  const handleToggleCommentLike = async (postId: string, commentId: string) => {
    try {
      const updated = await apiFetch<Post>(
        `/api/posts/${postId}/comments/${commentId}/like`,
        { method: 'POST' }
      );
      setState((prev) =>
        prev
          ? { ...prev, posts: prev.posts.map((p) => (p.id === postId ? updated : p)) }
          : prev
      );
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Could not like comment.');
    }
  };

  const handleSummonCharacter = async (postId: string, characterId: string) => {
    setApiError(null);
    try {
      const data = await apiFetch<{
        post: Post;
        notifications: AppState['notifications'];
        me?: AppState['me'];
        characters?: AppState['characters'];
      }>(`/api/posts/${postId}/summon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId }),
      });
      setState((prev) =>
        prev
          ? {
              ...prev,
              posts: prev.posts.map((p) => (p.id === postId ? data.post : p)),
              notifications: data.notifications,
              me: data.me ?? prev.me,
              characters: data.characters ?? prev.characters,
            }
          : prev
      );
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Could not summon character reply.');
    }
  };

  const handleTriggerAiReact = async (postId: string) => {
    setApiError(null);
    setReactingPostIds((prev) => [...prev, postId]);
    try {
      const data = await apiFetch<{
        post: Post;
        notifications: AppState['notifications'];
        me?: AppState['me'];
        characters?: AppState['characters'];
      }>(`/api/posts/${postId}/ai-react`, { method: 'POST' });
      setState((prev) =>
        prev
          ? {
              ...prev,
              posts: prev.posts.map((p) => (p.id === postId ? data.post : p)),
              notifications: data.notifications,
              me: data.me ?? prev.me,
              characters: data.characters ?? prev.characters,
            }
          : prev
      );
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Character reaction failed.');
    } finally {
      setReactingPostIds((prev) => prev.filter((id) => id !== postId));
    }
  };

  const handleCharacterPost = async (characterId: string) => {
    setApiError(null);
    try {
      const data = await apiFetch<{
        post: Post;
        notifications?: AppState['notifications'];
      }>(`/api/characters/${characterId}/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      setState((prev) =>
        prev
          ? {
              ...prev,
              posts: [data.post, ...prev.posts],
              notifications: data.notifications ?? prev.notifications,
            }
          : prev
      );
      setSection('feed');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Could not generate character post.');
    }
  };

  const handleSendMessage = async (threadId: string, content: string) => {
    setApiError(null);
    const optimisticId = `temp-${Date.now()}`;
    setState((prev) =>
      prev
        ? {
            ...prev,
            messages: [
              ...prev.messages,
              {
                id: optimisticId,
                threadId,
                senderId: 'me',
                content,
                createdAt: new Date().toISOString(),
              },
            ],
          }
        : prev
    );

    try {
      const data = await apiFetch<{
        userMsg: AppState['messages'][number];
        aiReplies: AppState['messages'];
      }>(`/api/messages/${threadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      setState((prev) =>
        prev
          ? {
              ...prev,
              messages: [
                ...prev.messages.filter((m) => m.id !== optimisticId),
                data.userMsg,
                ...data.aiReplies,
              ],
            }
          : prev
      );
    } catch (err) {
      setState((prev) =>
        prev
          ? { ...prev, messages: prev.messages.filter((m) => m.id !== optimisticId) }
          : prev
      );
      setApiError(err instanceof Error ? err.message : 'Message delivery failed.');
    }
  };

  const handleNudgeChat = async (threadId: string) => {
    setApiError(null);
    try {
      const data = await apiFetch<{ aiReplies: AppState['messages'] }>(
        `/api/messages/${threadId}/nudge`,
        { method: 'POST' }
      );
      setState((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, ...data.aiReplies],
            }
          : prev
      );
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Could not generate chat message.');
    }
  };

  const handleOpenNotifications = async () => {
    setSection('notifications');
    if (unreadCount > 0) {
      try {
        const updated = await apiFetch<AppState['notifications']>(
          '/api/notifications/read',
          { method: 'POST' }
        );
        setState((prev) => (prev ? { ...prev, notifications: updated } : prev));
      } catch {
        // Non-blocking
      }
    }
  };

  const handleResetAccount = async () => {
    try {
      const fresh = await apiFetch<AppState>('/api/reset', { method: 'POST' });
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore
      }
      setState(fresh);
      setHashtagFilter(null);
      setTrendingHashtags([]);
      setHashtagError(null);
      lastAnalyzedSigRef.current = '';
      setSection('feed');
      setSelectedProfileId('me');
      setEditProfileOpen(false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Could not reset account.');
    }
  };

  const openProfile = (profileId: string) => {
    setSelectedProfileId(profileId);
    setSection('profile');
  };

  const openDirectMessage = (characterId: string) => {
    setActiveThreadId(characterId);
    setSection('messages');
  };

  if (loading || !state) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center">
        <div className="text-sm text-[#6B6B68]">Loading Kith...</div>
      </div>
    );
  }

  // Dedicated Zero-State Profile Creation Studio before entering the feed
  if (!state.me.hasProfile) {
    return (
      <>
        <ProfileSetupStudio
          mode="onboarding"
          initialProfile={state.me}
          characters={state.characters}
          onSaveProfile={handleSaveProfile}
          onOpenAddCharacter={() => setCreateCharOpen(true)}
        />
        <CharacterModal
          open={createCharOpen}
          onClose={() => setCreateCharOpen(false)}
          onCreate={handleCreateCharacter}
        />
      </>
    );
  }

  const mentionMatches =
    mentionQuery !== null
      ? state.characters.filter(
          (c) =>
            c.name.toLowerCase().includes(mentionQuery) ||
            c.handle.toLowerCase().includes(mentionQuery)
        )
      : [];

  const handleSelectHashtag = (tag: string) => {
    const normalized = tag.startsWith('#') ? tag : `#${tag}`;
    setHashtagFilter((prev) =>
      prev && prev.toLowerCase() === normalized.toLowerCase() ? null : normalized
    );
    setSection('feed');
  };

  const postHandlers = {
    onToggleLike: handleToggleLike,
    onToggleRepost: handleToggleRepost,
    onToggleBookmark: handleToggleBookmark,
    onQuotePost: (p: Post) => {
      setQuotePost(p);
      setSection('feed');
      setTimeout(() => composerInputRef.current?.focus(), 50);
    },
    onAddComment: handleAddComment,
    onToggleCommentLike: handleToggleCommentLike,
    onSummonCharacter: handleSummonCharacter,
    onTriggerAiReact: handleTriggerAiReact,
    onSelectProfile: openProfile,
    onSelectHashtag: handleSelectHashtag,
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#141413] pb-16 md:pb-0">
      <div className="max-w-[1260px] mx-auto flex justify-center">
        {/* Left Navigation Rail (Desktop) */}
        <aside className="hidden md:flex flex-col justify-between w-[240px] shrink-0 sticky top-0 h-screen px-4 py-6">
          <div className="space-y-6">
            <div className="px-3">
              <button
                type="button"
                onClick={() => setSection('feed')}
                className="font-display text-2xl font-bold tracking-tight text-[#141413] whitespace-nowrap shrink-0"
              >
                Kith
              </button>
            </div>

            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => setSection('feed')}
                className={`w-full min-h-[44px] px-3 flex items-center gap-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  section === 'feed'
                    ? 'bg-white text-[#141413] border border-[#E7E7E2]'
                    : 'text-[#6B6B68] hover:text-[#141413] hover:bg-white/60'
                }`}
              >
                <Home className="w-4 h-4 shrink-0" />
                <span>Feed</span>
              </button>

              <button
                type="button"
                onClick={() => setSection('characters')}
                className={`w-full min-h-[44px] px-3 flex items-center gap-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  section === 'characters'
                    ? 'bg-white text-[#141413] border border-[#E7E7E2]'
                    : 'text-[#6B6B68] hover:text-[#141413] hover:bg-white/60'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Characters</span>
              </button>

              <button
                type="button"
                onClick={() => setSection('messages')}
                className={`w-full min-h-[44px] px-3 flex items-center gap-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  section === 'messages'
                    ? 'bg-white text-[#141413] border border-[#E7E7E2]'
                    : 'text-[#6B6B68] hover:text-[#141413] hover:bg-white/60'
                }`}
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>Messages</span>
              </button>

              <button
                type="button"
                onClick={handleOpenNotifications}
                className={`w-full min-h-[44px] px-3 flex items-center justify-between rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  section === 'notifications'
                    ? 'bg-white text-[#141413] border border-[#E7E7E2]'
                    : 'text-[#6B6B68] hover:text-[#141413] hover:bg-white/60'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Bell className="w-4 h-4 shrink-0" />
                  <span>Notifications</span>
                </span>
                {unreadCount > 0 && (
                  <span className="font-mono-tabular text-xs font-semibold text-[#4338CA]">
                    {unreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => openProfile('me')}
                className={`w-full min-h-[44px] px-3 flex items-center gap-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  section === 'profile' && selectedProfileId === 'me'
                    ? 'bg-white text-[#141413] border border-[#E7E7E2]'
                    : 'text-[#6B6B68] hover:text-[#141413] hover:bg-white/60'
                }`}
              >
                <User className="w-4 h-4 shrink-0" />
                <span>Profile</span>
              </button>
            </nav>

            <div className="px-1 pt-2 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setSection('feed');
                  setTimeout(() => composerInputRef.current?.focus(), 40);
                }}
                className="w-full min-h-[44px] px-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#4338CA] text-white text-sm font-semibold hover:bg-[#3730A3] transition-colors whitespace-nowrap"
              >
                <Feather className="w-4 h-4" />
                <span>New Post</span>
              </button>
              <button
                type="button"
                onClick={() => setCreateCharOpen(true)}
                className="w-full min-h-[40px] px-4 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E7E7E2] bg-white text-[#141413] text-xs font-medium hover:bg-[#EFECE6]/60 transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Character</span>
              </button>
            </div>
          </div>

          {/* Me Profile Switcher Card */}
          <button
            type="button"
            onClick={() => openProfile('me')}
            className="w-full p-2.5 rounded-xl bg-white border border-[#E7E7E2] hover:border-[#141413]/25 flex items-center gap-3 text-left transition-colors"
          >
            <Avatar src={state.me.avatar} name={state.me.name} accentColor="#141413" size="md" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-[#141413] truncate">{state.me.name}</div>
              <div className="text-[11px] text-[#6B6B68] truncate">{state.me.handle}</div>
            </div>
          </button>
        </aside>

        {/* Center Main Column */}
        <main className="flex-1 max-w-[640px] min-w-0 border-x border-[#E7E7E2] bg-white min-h-screen">
          {/* Global API Error Banner (explicit, never silent) */}
          {apiError && (
            <div className="px-5 py-3 bg-red-50 border-b border-red-200 flex items-center justify-between gap-3 text-xs text-red-800">
              <span>{apiError}</span>
              <button
                type="button"
                onClick={() => setApiError(null)}
                className="p-1 text-red-700 hover:text-red-900"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {section === 'feed' && (
            <div>
              {/* Feed Sticky Header */}
              <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-[#E7E7E2] px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-1 p-1 bg-[#F7F7F5] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setFeedTab('all')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      feedTab === 'all' ? 'bg-white text-[#141413] shadow-xs' : 'text-[#6B6B68]'
                    }`}
                  >
                    All Posts
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedTab('following')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      feedTab === 'following'
                        ? 'bg-white text-[#141413] shadow-xs'
                        : 'text-[#6B6B68]'
                    }`}
                  >
                    Following
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedTab('mentions')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      feedTab === 'mentions'
                        ? 'bg-white text-[#141413] shadow-xs'
                        : 'text-[#6B6B68]'
                    }`}
                  >
                    Mentions
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handlePulseFeed}
                  disabled={pulsing}
                  className="min-h-[36px] px-3 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-[#E7E7E2] bg-white hover:bg-[#F7F7F5] text-[#141413] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${pulsing ? 'animate-spin' : ''}`} />
                  <span>{pulsing ? 'Posting...' : 'AI Activity'}</span>
                </button>
              </div>

              {/* Compact Trending Hashtags strip for < xl viewports */}
              {trendingHashtags.length > 0 && (
                <div className="xl:hidden px-5 py-2.5 border-b border-[#E7E7E2] bg-[#F7F7F5]/60 flex items-center gap-2 overflow-x-auto">
                  <span className="text-[11px] font-semibold text-[#6B6B68] whitespace-nowrap shrink-0">
                    Trending:
                  </span>
                  {trendingHashtags.map((item) => {
                    const isActive =
                      hashtagFilter?.toLowerCase() === item.tag.toLowerCase();
                    return (
                      <button
                        key={item.tag}
                        type="button"
                        onClick={() => handleSelectHashtag(item.tag)}
                        className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap shrink-0 ${
                          isActive
                            ? 'bg-[#4338CA] text-white font-medium'
                            : 'bg-white border border-[#E7E7E2] text-[#141413] hover:border-[#4338CA]'
                        }`}
                      >
                        {item.tag}
                      </button>
                    );
                  })}
                </div>
              )}

              {hashtagFilter && (
                <div className="px-5 py-2.5 bg-[#F7F7F5] border-b border-[#E7E7E2] flex items-center justify-between text-xs">
                  <span className="text-[#6B6B68]">
                    Filtering by hashtag:{' '}
                    <strong className="text-[#141413]">{hashtagFilter}</strong>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span className="font-mono-tabular">
                      {filteredPosts.length} {filteredPosts.length === 1 ? 'post' : 'posts'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setHashtagFilter(null)}
                    className="text-[#4338CA] font-medium hover:underline whitespace-nowrap shrink-0"
                  >
                    Clear filter
                  </button>
                </div>
              )}

              {/* Post Composer */}
              <form onSubmit={handlePublishPost} className="px-5 py-5 border-b border-[#E7E7E2]">
                <div className="flex items-start gap-3.5">
                  <Avatar
                    src={state.me.avatar}
                    name={state.me.name}
                    accentColor="#141413"
                    size="md"
                  />
                  <div className="min-w-0 flex-1 relative">
                    <textarea
                      ref={composerInputRef}
                      value={composerText}
                      onChange={(e) => handleComposerChange(e.target.value)}
                      rows={3}
                      placeholder="Share a thought, ask a question, or @mention a character..."
                      className="w-full text-[15px] leading-relaxed text-[#141413] placeholder:text-[#6B6B68] bg-transparent focus:outline-none resize-none"
                    />

                    {/* @mention Autocomplete */}
                    {mentionQuery !== null && mentionMatches.length > 0 && (
                      <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-[#E7E7E2] rounded-xl shadow-lg py-1.5 z-30">
                        {mentionMatches.slice(0, 5).map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => insertMention(c.handle)}
                            className="w-full px-3 py-2 flex items-center gap-2.5 text-left hover:bg-[#F7F7F5]"
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
                              <div className="text-[11px] text-[#6B6B68] truncate">{c.handle}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Attached Photo Preview */}
                    {composerImage && (
                      <div className="mt-2 relative rounded-xl overflow-hidden border border-[#E7E7E2]">
                        <img
                          src={composerImage}
                          alt="Post upload preview"
                          className="w-full max-h-64 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setComposerImage('')}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black"
                          aria-label="Remove attachment"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Attached Music Track Panel & Preview */}
                    {(musicPanelOpen || musicTitle || musicAudioUrl) && (
                      <div className="mt-3 p-3.5 rounded-xl border border-[#E7E7E2] bg-[#F7F7F5] space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#141413] flex items-center gap-1.5">
                            <Music className="w-3.5 h-3.5 text-[#4338CA]" />
                            Attach Music
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              ref={postAudioInputRef}
                              type="file"
                              accept="audio/*"
                              onChange={handlePostAudioUpload}
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => postAudioInputRef.current?.click()}
                              disabled={uploadingPostAudio}
                              className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-[#E7E7E2] bg-white hover:bg-[#EFECE6]/50 text-[#141413] inline-flex items-center gap-1 whitespace-nowrap"
                            >
                              <Upload className="w-3 h-3" />
                              {uploadingPostAudio ? 'Uploading...' : 'Upload Audio'}
                            </button>
                            <button
                              type="button"
                              onClick={clearPostMusic}
                              className="text-xs text-[#6B6B68] hover:text-[#141413]"
                              aria-label="Remove music"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={musicTitle}
                            onChange={(e) => setMusicTitle(e.target.value)}
                            placeholder="Track title (e.g. Midnight Tape)"
                            className="px-3 py-1.5 text-xs rounded-lg border border-[#E7E7E2] bg-white focus:outline-none focus:border-[#4338CA]"
                          />
                          <input
                            type="text"
                            value={musicArtist}
                            onChange={(e) => setMusicArtist(e.target.value)}
                            placeholder="Artist (optional)"
                            className="px-3 py-1.5 text-xs rounded-lg border border-[#E7E7E2] bg-white focus:outline-none focus:border-[#4338CA]"
                          />
                        </div>

                        {(musicTitle.trim() || musicAudioUrl) && (
                          <AudioPlayerCard
                            compact
                            music={{
                              title: musicTitle.trim() || 'Shared Track',
                              artist: musicArtist.trim() || undefined,
                              audioUrl: musicAudioUrl || undefined,
                            }}
                          />
                        )}
                      </div>
                    )}

                    {/* Quoting Preview */}
                    {quotePost && (
                      <div className="mt-2 p-3 rounded-xl border border-[#E7E7E2] bg-[#F7F7F5] flex items-start justify-between gap-2">
                        <div className="text-xs text-[#141413] line-clamp-2">
                          <span className="font-semibold">Quoting: </span>
                          {quotePost.content}
                        </div>
                        <button
                          type="button"
                          onClick={() => setQuotePost(null)}
                          className="text-[#6B6B68] hover:text-[#141413]"
                          aria-label="Cancel quote"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Composer Toolbar */}
                    <div className="mt-3 pt-3 border-t border-[#E7E7E2] flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={postImageInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handlePostImageUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => postImageInputRef.current?.click()}
                          className="min-h-[36px] px-2.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg text-[#6B6B68] hover:text-[#141413] hover:bg-[#F7F7F5] transition-colors"
                        >
                          <ImagePlus className="w-4 h-4" />
                          <span>Photo</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setMusicPanelOpen((prev) => !prev)}
                          className={`min-h-[36px] px-2.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg transition-colors ${
                            musicPanelOpen || musicTitle || musicAudioUrl
                              ? 'bg-[#4338CA]/10 text-[#4338CA]'
                              : 'text-[#6B6B68] hover:text-[#141413] hover:bg-[#F7F7F5]'
                          }`}
                        >
                          <Music className="w-4 h-4" />
                          <span>Music</span>
                        </button>

                        <input
                          type="text"
                          value={composerTopic}
                          onChange={(e) => setComposerTopic(e.target.value)}
                          placeholder="Topic (optional)"
                          className="w-32 px-2.5 py-1.5 text-xs rounded-lg border border-[#E7E7E2] bg-[#F7F7F5] focus:bg-white focus:outline-none focus:border-[#4338CA]"
                        />

                        <label className="inline-flex items-center gap-1.5 text-xs text-[#6B6B68] cursor-pointer ml-1">
                          <input
                            type="checkbox"
                            checked={autoAiReact}
                            onChange={(e) => setAutoAiReact(e.target.checked)}
                            className="rounded border-[#E7E7E2] text-[#4338CA] focus:ring-[#4338CA]"
                          />
                          <span>Characters reply</span>
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={(!composerText.trim() && !musicTitle.trim() && !musicAudioUrl) || posting}
                        className="min-h-[38px] px-5 text-xs font-semibold rounded-lg bg-[#4338CA] text-white hover:bg-[#3730A3] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
                      >
                        {posting ? 'Posting...' : 'Post'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              {/* Feed Stream or Clean Zero-Post Empty State */}
              {filteredPosts.length === 0 ? (
                <div className="px-6 py-16 text-center max-w-md mx-auto">
                  <div className="w-11 h-11 rounded-full bg-[#F7F7F5] border border-[#E7E7E2] flex items-center justify-center mx-auto text-[#6B6B68]">
                    <Compass className="w-5 h-5" />
                  </div>
                  <h2 className="mt-4 font-display text-base font-semibold text-[#141413]">
                    {state.posts.length === 0 ? 'Your feed starts at zero' : 'No posts match this view'}
                  </h2>
                  <p className="mt-1.5 text-xs text-[#6B6B68] leading-relaxed">
                    {state.posts.length === 0
                      ? 'Publish your first post above to spark replies, likes, and follows—or invite the AI characters in your circle to post first.'
                      : 'Switch tabs or clear your active filters to see all posts.'}
                  </p>
                  {state.posts.length === 0 && (
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                      <button
                        type="button"
                        onClick={handlePulseFeed}
                        disabled={pulsing}
                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#141413] text-white hover:bg-[#2A2A28] disabled:opacity-50 transition-colors"
                      >
                        {pulsing ? 'Generating Posts...' : 'Ask AI Characters to Post First'}
                      </button>
                      <button
                        type="button"
                        onClick={() => composerInputRef.current?.focus()}
                        className="px-4 py-2 text-xs font-medium rounded-lg border border-[#E7E7E2] bg-white hover:bg-[#F7F7F5] text-[#141413] transition-colors"
                      >
                        Write First Post
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                filteredPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    allPosts={state.posts}
                    me={state.me}
                    characters={state.characters}
                    isBookmarked={state.me.bookmarkedPostIds.includes(post.id)}
                    isAiReacting={reactingPostIds.includes(post.id)}
                    {...postHandlers}
                  />
                ))
              )}
            </div>
          )}

          {section === 'characters' && (
            <CharactersView
              characters={state.characters}
              posts={state.posts}
              followingIds={state.me.followingIds}
              onToggleFollow={handleToggleFollow}
              onMessageCharacter={openDirectMessage}
              onCharacterPost={handleCharacterPost}
              onSelectProfile={openProfile}
              onOpenCreateCharacter={() => setCreateCharOpen(true)}
            />
          )}

          {section === 'messages' && (
            <MessagesView
              me={state.me}
              characters={state.characters}
              messages={state.messages}
              activeThreadId={activeThreadId}
              onSelectThread={setActiveThreadId}
              onSendMessage={handleSendMessage}
              onNudgeChat={handleNudgeChat}
            />
          )}

          {section === 'notifications' && (
            <NotificationsView
              notifications={state.notifications}
              characters={state.characters}
              onOpenProfile={openProfile}
              onOpenFeed={() => setSection('feed')}
            />
          )}

          {section === 'profile' && (
            <ProfileView
              profileId={selectedProfileId}
              me={state.me}
              characters={state.characters}
              posts={state.posts}
              onBackToFeed={() => setSection('feed')}
              onEditMe={() => setEditProfileOpen(true)}
              onAddCharacter={() => setCreateCharOpen(true)}
              onToggleFollow={handleToggleFollow}
              onMessageCharacter={openDirectMessage}
              onCharacterPost={handleCharacterPost}
              onResetAccount={handleResetAccount}
              postHandlers={postHandlers}
            />
          )}
        </main>

        {/* Right Discovery & Profile Summary Rail (Desktop xl) */}
        <aside className="hidden xl:block w-[320px] shrink-0 px-6 py-6 space-y-6">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#6B6B68] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (section !== 'feed') setSection('feed');
              }}
              placeholder="Search feed or characters..."
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-[#E7E7E2] bg-white focus:outline-none focus:border-[#4338CA]"
            />
          </div>

          {/* Your Profile Snapshot */}
          <div className="bg-white border border-[#E7E7E2] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#141413]">Your Profile</span>
              <button
                type="button"
                onClick={() => setEditProfileOpen(true)}
                className="text-xs font-medium text-[#4338CA] hover:underline"
              >
                Edit
              </button>
            </div>
            <div className="flex items-center gap-3">
              <Avatar src={state.me.avatar} name={state.me.name} accentColor="#141413" size="md" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[#141413] truncate">{state.me.name}</div>
                <div className="text-xs text-[#6B6B68] truncate">{state.me.handle}</div>
              </div>
            </div>
            {state.me.interests.length > 0 && (
              <div className="mt-3 text-xs text-[#6B6B68] leading-relaxed">
                {state.me.interests.slice(0, 4).join(' · ')}
              </div>
            )}
            <div className="mt-4 pt-3 border-t border-[#E7E7E2] grid grid-cols-4 gap-1 text-center">
              <div>
                <div className="font-mono-tabular text-xs font-semibold text-[#141413]">
                  {myPostsCount}
                </div>
                <div className="text-[10px] text-[#6B6B68]">Posts</div>
              </div>
              <div>
                <div className="font-mono-tabular text-xs font-semibold text-[#141413]">
                  {state.me.followerCharacterIds.length}
                </div>
                <div className="text-[10px] text-[#6B6B68]">Followers</div>
              </div>
              <div>
                <div className="font-mono-tabular text-xs font-semibold text-[#141413]">
                  {state.me.followingIds.length}
                </div>
                <div className="text-[10px] text-[#6B6B68]">Following</div>
              </div>
              <div>
                <div className="font-mono-tabular text-xs font-semibold text-[#141413]">
                  {myLikesReceived}
                </div>
                <div className="text-[10px] text-[#6B6B68]">Likes</div>
              </div>
            </div>
          </div>

          {/* AI Character Circle */}
          <div className="bg-white border border-[#E7E7E2] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xs font-semibold text-[#141413]">
                AI Characters ({state.characters.length})
              </h3>
              <button
                type="button"
                onClick={() => setCreateCharOpen(true)}
                className="text-xs font-medium text-[#4338CA] hover:underline"
              >
                + Add
              </button>
            </div>
            <div className="space-y-3.5">
              {state.characters.slice(0, 6).map((char) => {
                const isFollowing = state.me.followingIds.includes(char.id);
                return (
                  <div key={char.id} className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => openProfile(char.id)}
                      className="shrink-0"
                    >
                      <Avatar
                        src={char.avatar}
                        name={char.name}
                        accentColor={char.accentColor}
                        size="sm"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => openProfile(char.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="text-xs font-semibold text-[#141413] truncate hover:underline">
                        {char.name}
                      </div>
                      <div className="text-[11px] text-[#6B6B68] truncate">{char.role}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleFollow(char.id)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                        isFollowing
                          ? 'bg-[#F7F7F5] text-[#6B6B68] border border-[#E7E7E2]'
                          : 'bg-[#141413] text-white hover:bg-[#2A2A28]'
                      }`}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top 5 Trending Hashtags */}
          <div className="bg-white border border-[#E7E7E2] rounded-2xl p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-[#4338CA] shrink-0" />
                <h3 className="font-display text-xs font-semibold text-[#141413]">
                  Trending Hashtags
                </h3>
              </div>
              {state.posts.length > 0 && (
                <button
                  type="button"
                  onClick={() => void analyzeTrendingHashtags()}
                  disabled={analyzingHashtags}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4338CA] hover:underline disabled:opacity-50 whitespace-nowrap shrink-0"
                  aria-label="Analyze posts for trending hashtags"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${analyzingHashtags ? 'animate-spin' : ''}`}
                  />
                  <span>{analyzingHashtags ? 'Analyzing' : 'Refresh'}</span>
                </button>
              )}
            </div>

            {state.posts.length === 0 ? (
              <p className="text-xs text-[#6B6B68] leading-relaxed">
                Publish or generate posts to surface the top 5 trending hashtags.
              </p>
            ) : analyzingHashtags && trendingHashtags.length === 0 ? (
              <p className="text-xs text-[#6B6B68]">Analyzing existing posts...</p>
            ) : hashtagError && trendingHashtags.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-red-700 leading-relaxed">{hashtagError}</p>
                <button
                  type="button"
                  onClick={() => void analyzeTrendingHashtags()}
                  className="text-xs font-medium text-[#4338CA] hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : trendingHashtags.length === 0 ? (
              <p className="text-xs text-[#6B6B68]">No hashtags surfaced yet.</p>
            ) : (
              <div className="space-y-1">
                {trendingHashtags.map((item, idx) => {
                  const isActive =
                    hashtagFilter?.toLowerCase() === item.tag.toLowerCase();
                  return (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => handleSelectHashtag(item.tag)}
                      className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 -mx-2.5 rounded-lg text-xs text-left transition-colors ${
                        isActive
                          ? 'bg-[#4338CA]/10 text-[#4338CA] font-semibold'
                          : 'text-[#141413] hover:bg-[#F7F7F5]'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="font-mono-tabular text-[11px] text-[#6B6B68] w-3.5 shrink-0">
                          {idx + 1}
                        </span>
                        <span className="truncate">{item.tag}</span>
                      </span>
                      <span className="font-mono-tabular text-[11px] text-[#6B6B68] whitespace-nowrap shrink-0">
                        {item.count} {item.count === 1 ? 'post' : 'posts'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 backdrop-blur-md border-t border-[#E7E7E2] grid grid-cols-5">
        <button
          type="button"
          onClick={() => setSection('feed')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            section === 'feed' ? 'text-[#4338CA]' : 'text-[#6B6B68]'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Feed</span>
        </button>
        <button
          type="button"
          onClick={() => setSection('characters')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            section === 'characters' ? 'text-[#4338CA]' : 'text-[#6B6B68]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Characters</span>
        </button>
        <button
          type="button"
          onClick={() => setSection('messages')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            section === 'messages' ? 'text-[#4338CA]' : 'text-[#6B6B68]'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>Messages</span>
        </button>
        <button
          type="button"
          onClick={handleOpenNotifications}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium relative ${
            section === 'notifications' ? 'text-[#4338CA]' : 'text-[#6B6B68]'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Alerts{unreadCount > 0 ? ` (${unreadCount})` : ''}</span>
        </button>
        <button
          type="button"
          onClick={() => openProfile('me')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            section === 'profile' && selectedProfileId === 'me'
              ? 'text-[#4338CA]'
              : 'text-[#6B6B68]'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Profile</span>
        </button>
      </nav>

      {/* Edit Profile Modal */}
      {editProfileOpen && (
        <ProfileSetupStudio
          mode="edit"
          initialProfile={state.me}
          characters={state.characters}
          onSaveProfile={handleSaveProfile}
          onOpenAddCharacter={() => setCreateCharOpen(true)}
          onCancel={() => setEditProfileOpen(false)}
        />
      )}

      {/* Create Custom AI Character Modal */}
      <CharacterModal
        open={createCharOpen}
        onClose={() => setCreateCharOpen(false)}
        onCreate={handleCreateCharacter}
      />
    </div>
  );
}
