import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import type {
  AppState,
  Comment,
  DirectMessage,
  MusicAttachment,
  NotificationItem,
  Post,
  TrendingHashtag,
} from './src/types.ts';
import {
  generateCharacterCommentReply,
  generateCharacterIntroPost,
  generateCharacterSpecificPost,
  generateChatNudge,
  generateDirectMessageReply,
  generateFeedPulse,
  generateGroupLoungeReplies,
  generateReactionsToUserPost,
  generateTrendingHashtags,
} from './server/gemini.ts';
import {
  UPLOADS_DIR,
  loadStore,
  resetStore,
  restoreStore,
  saveStore,
} from './server/store.ts';

const PORT = 3000;
const app = express();
app.use(express.json({ limit: '25mb' }));
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function applyCharacterFollow(
  state: AppState,
  actorCharacterId: string,
  targetId: string
): boolean {
  const actor = state.characters.find((c) => c.id === actorCharacterId);
  if (!actor || actorCharacterId === targetId) return false;

  if (!actor.followingIds.includes(targetId)) {
    actor.followingIds.push(targetId);
  }

  if (targetId === 'me') {
    if (!state.me.followerCharacterIds.includes(actorCharacterId)) {
      state.me.followerCharacterIds.push(actorCharacterId);
      state.notifications.unshift({
        id: makeId('notif'),
        type: 'follow',
        actorId: actorCharacterId,
        snippet: 'Started following your profile.',
        createdAt: new Date().toISOString(),
        read: false,
      });
      return true;
    }
    return false;
  }

  const targetChar = state.characters.find((c) => c.id === targetId);
  if (targetChar && !targetChar.followerCharacterIds.includes(actorCharacterId)) {
    targetChar.followerCharacterIds.push(actorCharacterId);
    targetChar.followersCount =
      (state.me.followingIds.includes(targetChar.id) ? 1 : 0) +
      targetChar.followerCharacterIds.length;
    return true;
  }
  return false;
}

// Get full social state
app.get('/api/state', (_req, res) => {
  const state = loadStore();
  res.json(state);
});

// Create or update "Me" profile
app.patch('/api/me', (req, res) => {
  const state = loadStore();
  const { name, handle, role, bio, location, avatar, interests, favoriteTrack, hasProfile } =
    req.body as Partial<typeof state.me> & { favoriteTrack?: MusicAttachment | null };

  if (typeof name === 'string' && name.trim()) state.me.name = name.trim();
  if (typeof handle === 'string' && handle.trim()) {
    const clean = handle
      .trim()
      .replace(/^@+/, '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '');
    if (clean) state.me.handle = `@${clean}`;
  }
  if (typeof role === 'string') state.me.role = role.trim() || 'Human Member';
  if (typeof bio === 'string') state.me.bio = bio.trim();
  if (typeof location === 'string') state.me.location = location.trim();
  if (typeof avatar === 'string') state.me.avatar = avatar.trim();
  if (Array.isArray(interests)) {
    state.me.interests = interests
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .slice(0, 12);
  }
  if (favoriteTrack === null) {
    state.me.favoriteTrack = undefined;
  } else if (favoriteTrack && typeof favoriteTrack.title === 'string' && favoriteTrack.title.trim()) {
    state.me.favoriteTrack = {
      title: favoriteTrack.title.trim(),
      artist: favoriteTrack.artist?.trim() || undefined,
      audioUrl: favoriteTrack.audioUrl?.trim() || undefined,
    };
  }
  if (typeof hasProfile === 'boolean') {
    state.me.hasProfile = hasProfile;
  } else if (state.me.name && state.me.handle) {
    state.me.hasProfile = true;
  }

  saveStore(state);
  res.json(state.me);
});

// Toggle follow character
app.post('/api/characters/:id/follow', (req, res) => {
  const state = loadStore();
  const char = state.characters.find((c) => c.id === req.params.id);
  if (!char) {
    res.status(404).json({ error: 'Character not found' });
    return;
  }
  const idx = state.me.followingIds.indexOf(char.id);
  if (idx >= 0) {
    state.me.followingIds.splice(idx, 1);
  } else {
    state.me.followingIds.push(char.id);
  }
  char.followersCount =
    (state.me.followingIds.includes(char.id) ? 1 : 0) + char.followerCharacterIds.length;
  saveStore(state);
  res.json({ followingIds: state.me.followingIds, character: char });
});

// Create custom AI character
app.post('/api/characters', async (req, res) => {
  try {
    const state = loadStore();
    const {
      name,
      handle,
      role,
      bio,
      personality,
      interests,
      accentColor,
      avatar,
      introPost,
      autoIntro,
      followImmediately,
    } = req.body as {
      name?: string;
      handle?: string;
      role?: string;
      bio?: string;
      personality?: string;
      interests?: string[];
      accentColor?: string;
      avatar?: string;
      introPost?: string;
      autoIntro?: boolean;
      followImmediately?: boolean;
    };

    if (!name?.trim() || !role?.trim() || !personality?.trim()) {
      res.status(400).json({ error: 'Name, role, and personality are required.' });
      return;
    }

    const cleanHandleBase = (
      handle?.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.')
    ).replace(/^@+/, '');

    const shouldFollow = followImmediately === true;

    const newChar = {
      id: makeId('char'),
      name: name.trim(),
      handle: `@${cleanHandleBase}`,
      role: role.trim(),
      bio: bio?.trim() || personality.trim(),
      personality: personality.trim(),
      interests: Array.isArray(interests) && interests.length > 0 ? interests : ['Conversation'],
      avatar: avatar?.trim() || '',
      accentColor: accentColor || '#4338CA',
      followersCount: shouldFollow ? 1 : 0,
      followingIds: [],
      followerCharacterIds: [],
      isCustom: true,
    };

    state.characters.push(newChar);
    if (shouldFollow && !state.me.followingIds.includes(newChar.id)) {
      state.me.followingIds.push(newChar.id);
    }

    let postContent = introPost?.trim() || '';
    if (!postContent && autoIntro) {
      postContent = await generateCharacterIntroPost(newChar, state.me);
    }

    if (postContent) {
      const post: Post = {
        id: makeId('post'),
        authorId: newChar.id,
        content: postContent,
        topic: newChar.interests[0] || 'Introduction',
        createdAt: new Date().toISOString(),
        likesCount: 0,
        likedByMe: false,
        likedByCharacterIds: [],
        repostedByMe: false,
        repostsCount: 0,
        comments: [],
      };
      state.posts.unshift(post);
    }

    saveStore(state);
    res.status(201).json({ character: newChar, state });
  } catch (err) {
    console.error('Create character error:', err);
    const message = err instanceof Error ? err.message : 'Failed to create character.';
    res.status(502).json({ error: message });
  }
});

// Create a post from "Me"
app.post('/api/posts', (req, res) => {
  const state = loadStore();
  const { content, topic, image, music, quotePostId } = req.body as {
    content?: string;
    topic?: string;
    image?: string;
    music?: MusicAttachment;
    quotePostId?: string;
  };

  if (!content?.trim() && !music?.title?.trim()) {
    res.status(400).json({ error: 'Post content or a music track is required.' });
    return;
  }

  const cleanMusic: MusicAttachment | undefined =
    music && music.title?.trim()
      ? {
          title: music.title.trim(),
          artist: music.artist?.trim() || undefined,
          audioUrl: music.audioUrl?.trim() || undefined,
        }
      : undefined;

  const newPost: Post = {
    id: makeId('post'),
    authorId: 'me',
    content: (content ?? '').trim(),
    topic: topic?.trim() || undefined,
    image: image?.trim() || undefined,
    music: cleanMusic,
    quotePostId: quotePostId?.trim() || undefined,
    createdAt: new Date().toISOString(),
    likesCount: 0,
    likedByMe: false,
    likedByCharacterIds: [],
    repostedByMe: false,
    repostsCount: 0,
    comments: [],
  };

  state.posts.unshift(newPost);
  saveStore(state);
  res.status(201).json(newPost);
});

// Trigger AI character reactions (likes + comments + follows) to any post
app.post('/api/posts/:id/ai-react', async (req, res) => {
  try {
    const state = loadStore();
    const post = state.posts.find((p) => p.id === req.params.id);
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const reactions = await generateReactionsToUserPost({
      post,
      me: state.me,
      characters: state.characters,
      recentPosts: state.posts,
    });

    for (const charId of reactions.likedByCharacterIds) {
      if (!post.likedByCharacterIds.includes(charId)) {
        post.likedByCharacterIds.push(charId);
        post.likesCount += 1;
        if (post.authorId === 'me') {
          state.notifications.unshift({
            id: makeId('notif'),
            type: 'like',
            actorId: charId,
            postId: post.id,
            snippet: `Liked your post: "${post.content.slice(0, 72)}"`,
            createdAt: new Date().toISOString(),
            read: false,
          });
        }
      }
    }

    for (const charId of reactions.followedByCharacterIds) {
      applyCharacterFollow(state, charId, post.authorId);
    }

    for (const item of reactions.comments) {
      const comment: Comment = {
        id: makeId('c'),
        postId: post.id,
        authorId: item.characterId,
        content: item.content.trim(),
        createdAt: new Date().toISOString(),
        likedByMe: false,
        likedByCharacterIds: [],
        likesCount: 0,
      };
      post.comments.push(comment);

      if (post.authorId === 'me') {
        state.notifications.unshift({
          id: makeId('notif'),
          type: 'comment',
          actorId: item.characterId,
          postId: post.id,
          snippet: item.content.trim().slice(0, 90),
          createdAt: new Date().toISOString(),
          read: false,
        });
      }
    }

    saveStore(state);
    res.json({
      post,
      notifications: state.notifications,
      me: state.me,
      characters: state.characters,
    });
  } catch (err) {
    console.error('AI react error:', err);
    const message = err instanceof Error ? err.message : 'Failed to generate AI reactions.';
    res.status(502).json({ error: message });
  }
});

// Summon a specific character to comment (and optionally like/follow) on any post
app.post('/api/posts/:id/summon', async (req, res) => {
  try {
    const state = loadStore();
    const post = state.posts.find((p) => p.id === req.params.id);
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const { characterId } = req.body as { characterId?: string };
    const char = state.characters.find((c) => c.id === characterId);
    if (!char) {
      res.status(404).json({ error: 'Character not found' });
      return;
    }

    const result = await generateCharacterCommentReply({
      post,
      targetCharacter: char,
      me: state.me,
      characters: state.characters,
      triggeringCommentText: `(You were invited by ${state.me.name || 'the user'} to share your perspective on this post.)`,
    });

    const comment: Comment = {
      id: makeId('c'),
      postId: post.id,
      authorId: char.id,
      content: result.replyText,
      createdAt: new Date().toISOString(),
      likedByMe: false,
      likedByCharacterIds: [],
      likesCount: 0,
    };
    post.comments.push(comment);

    if (post.authorId === 'me') {
      state.notifications.unshift({
        id: makeId('notif'),
        type: 'comment',
        actorId: char.id,
        postId: post.id,
        snippet: result.replyText.slice(0, 90),
        createdAt: new Date().toISOString(),
        read: false,
      });
    }

    if (result.shouldFollowUser) {
      applyCharacterFollow(state, char.id, 'me');
    }

    saveStore(state);
    res.json({
      post,
      notifications: state.notifications,
      me: state.me,
      characters: state.characters,
    });
  } catch (err) {
    console.error('Summon error:', err);
    const message = err instanceof Error ? err.message : 'Failed to summon character reply.';
    res.status(502).json({ error: message });
  }
});

// Toggle like on post
app.post('/api/posts/:id/like', (req, res) => {
  const state = loadStore();
  const post = state.posts.find((p) => p.id === req.params.id);
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  post.likedByMe = !post.likedByMe;
  post.likesCount = Math.max(0, post.likesCount + (post.likedByMe ? 1 : -1));
  saveStore(state);
  res.json(post);
});

// Toggle bookmark on post
app.post('/api/posts/:id/bookmark', (req, res) => {
  const state = loadStore();
  const postId = req.params.id;
  const idx = state.me.bookmarkedPostIds.indexOf(postId);
  if (idx >= 0) {
    state.me.bookmarkedPostIds.splice(idx, 1);
  } else {
    state.me.bookmarkedPostIds.push(postId);
  }
  saveStore(state);
  res.json({ bookmarkedPostIds: state.me.bookmarkedPostIds });
});

// Toggle repost
app.post('/api/posts/:id/repost', (req, res) => {
  const state = loadStore();
  const post = state.posts.find((p) => p.id === req.params.id);
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  post.repostedByMe = !post.repostedByMe;
  post.repostsCount = Math.max(0, post.repostsCount + (post.repostedByMe ? 1 : -1));
  saveStore(state);
  res.json(post);
});

// Add user comment to post
app.post('/api/posts/:id/comments', (req, res) => {
  const state = loadStore();
  const post = state.posts.find((p) => p.id === req.params.id);
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  const { content, replyToCommentId } = req.body as {
    content?: string;
    replyToCommentId?: string;
  };
  if (!content?.trim()) {
    res.status(400).json({ error: 'Comment cannot be empty.' });
    return;
  }

  const comment: Comment = {
    id: makeId('c'),
    postId: post.id,
    authorId: 'me',
    content: content.trim(),
    createdAt: new Date().toISOString(),
    likedByMe: false,
    likedByCharacterIds: [],
    likesCount: 0,
    replyToCommentId,
  };
  post.comments.push(comment);
  saveStore(state);
  res.status(201).json({ comment, post });
});

// Generate AI reply (plus optional like on user's comment and follow)
app.post('/api/posts/:id/ai-reply', async (req, res) => {
  try {
    const state = loadStore();
    const post = state.posts.find((p) => p.id === req.params.id);
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const { commentText, targetCharacterId, userCommentId } = req.body as {
      commentText?: string;
      targetCharacterId?: string;
      userCommentId?: string;
    };

    let targetChar = targetCharacterId
      ? state.characters.find((c) => c.id === targetCharacterId)
      : undefined;

    if (!targetChar && commentText) {
      targetChar = state.characters.find((c) =>
        commentText.toLowerCase().includes(c.handle.toLowerCase())
      );
    }
    if (!targetChar && post.authorId !== 'me') {
      targetChar = state.characters.find((c) => c.id === post.authorId);
    }
    if (!targetChar) {
      const lastAiComment = [...post.comments]
        .reverse()
        .find((c) => c.authorId !== 'me');
      if (lastAiComment) {
        targetChar = state.characters.find((c) => c.id === lastAiComment.authorId);
      }
    }
    if (!targetChar) {
      targetChar = state.characters[0];
    }

    const result = await generateCharacterCommentReply({
      post,
      targetCharacter: targetChar,
      me: state.me,
      characters: state.characters,
      triggeringCommentText: commentText || '',
    });

    // Character likes the user's comment if appropriate
    if (result.shouldLikeUserComment) {
      const userComment = userCommentId
        ? post.comments.find((c) => c.id === userCommentId)
        : [...post.comments].reverse().find((c) => c.authorId === 'me');
      if (userComment && !userComment.likedByCharacterIds.includes(targetChar.id)) {
        userComment.likedByCharacterIds.push(targetChar.id);
        userComment.likesCount += 1;
        state.notifications.unshift({
          id: makeId('notif'),
          type: 'like',
          actorId: targetChar.id,
          postId: post.id,
          snippet: `Liked your comment: "${userComment.content.slice(0, 72)}"`,
          createdAt: new Date().toISOString(),
          read: false,
        });
      }
    }

    if (result.shouldFollowUser) {
      applyCharacterFollow(state, targetChar.id, 'me');
    }

    const aiComment: Comment = {
      id: makeId('c'),
      postId: post.id,
      authorId: targetChar.id,
      content: result.replyText,
      createdAt: new Date().toISOString(),
      likedByMe: false,
      likedByCharacterIds: [],
      likesCount: 0,
    };
    post.comments.push(aiComment);

    const notif: NotificationItem = {
      id: makeId('notif'),
      type: 'comment',
      actorId: targetChar.id,
      postId: post.id,
      snippet: result.replyText.slice(0, 90),
      createdAt: new Date().toISOString(),
      read: false,
    };
    state.notifications.unshift(notif);

    saveStore(state);
    res.json({
      post,
      notifications: state.notifications,
      me: state.me,
      characters: state.characters,
    });
  } catch (err) {
    console.error('AI reply error:', err);
    const message = err instanceof Error ? err.message : 'Failed to generate AI reply.';
    res.status(502).json({ error: message });
  }
});

// Toggle like on comment
app.post('/api/posts/:postId/comments/:commentId/like', (req, res) => {
  const state = loadStore();
  const post = state.posts.find((p) => p.id === req.params.postId);
  const comment = post?.comments.find((c) => c.id === req.params.commentId);
  if (!post || !comment) {
    res.status(404).json({ error: 'Comment not found' });
    return;
  }
  comment.likedByMe = !comment.likedByMe;
  comment.likesCount = Math.max(0, comment.likesCount + (comment.likedByMe ? 1 : -1));
  saveStore(state);
  res.json(post);
});

// Generate fresh feed pulse: AI characters post, comment, like posts, like comments, and follow
app.post('/api/feed/pulse', async (_req, res) => {
  try {
    const state = loadStore();
    const pulse = await generateFeedPulse({
      me: state.me,
      characters: state.characters,
      recentPosts: state.posts,
    });

    for (const p of pulse.newPosts) {
      const mentionsMe =
        state.me.handle && p.content.toLowerCase().includes(state.me.handle.toLowerCase());
      const created: Post = {
        id: makeId('post'),
        authorId: p.characterId,
        content: p.content.trim(),
        topic: p.topic.trim(),
        createdAt: new Date().toISOString(),
        likesCount: 0,
        likedByMe: false,
        likedByCharacterIds: [],
        repostedByMe: false,
        repostsCount: 0,
        comments: [],
      };
      state.posts.unshift(created);

      if (mentionsMe) {
        state.notifications.unshift({
          id: makeId('notif'),
          type: 'mention',
          actorId: p.characterId,
          postId: created.id,
          snippet: p.content.trim().slice(0, 90),
          createdAt: new Date().toISOString(),
          read: false,
        });
      }
    }

    for (const l of pulse.newPostLikes) {
      const targetPost = state.posts.find((p) => p.id === l.postId);
      if (
        targetPost &&
        targetPost.authorId !== l.characterId &&
        !targetPost.likedByCharacterIds.includes(l.characterId)
      ) {
        targetPost.likedByCharacterIds.push(l.characterId);
        targetPost.likesCount += 1;
        if (targetPost.authorId === 'me') {
          state.notifications.unshift({
            id: makeId('notif'),
            type: 'like',
            actorId: l.characterId,
            postId: targetPost.id,
            snippet: `Liked your post: "${targetPost.content.slice(0, 72)}"`,
            createdAt: new Date().toISOString(),
            read: false,
          });
        }
      }
    }

    for (const cl of pulse.newCommentLikes) {
      const targetPost = state.posts.find((p) => p.id === cl.postId);
      const targetComment = targetPost?.comments.find((cm) => cm.id === cl.commentId);
      if (
        targetPost &&
        targetComment &&
        targetComment.authorId !== cl.characterId &&
        !targetComment.likedByCharacterIds.includes(cl.characterId)
      ) {
        targetComment.likedByCharacterIds.push(cl.characterId);
        targetComment.likesCount += 1;
        if (targetComment.authorId === 'me') {
          state.notifications.unshift({
            id: makeId('notif'),
            type: 'like',
            actorId: cl.characterId,
            postId: targetPost.id,
            snippet: `Liked your comment: "${targetComment.content.slice(0, 72)}"`,
            createdAt: new Date().toISOString(),
            read: false,
          });
        }
      }
    }

    for (const c of pulse.newComments) {
      const targetPost = state.posts.find((p) => p.id === c.postId);
      if (targetPost) {
        targetPost.comments.push({
          id: makeId('c'),
          postId: targetPost.id,
          authorId: c.characterId,
          content: c.content.trim(),
          createdAt: new Date().toISOString(),
          likedByMe: false,
          likedByCharacterIds: [],
          likesCount: 0,
        });
        if (targetPost.authorId === 'me') {
          state.notifications.unshift({
            id: makeId('notif'),
            type: 'comment',
            actorId: c.characterId,
            postId: targetPost.id,
            snippet: c.content.trim().slice(0, 90),
            createdAt: new Date().toISOString(),
            read: false,
          });
        }
      }
    }

    for (const f of pulse.newFollows) {
      applyCharacterFollow(state, f.actorCharacterId, f.targetId);
    }

    saveStore(state);
    res.json({
      posts: state.posts,
      notifications: state.notifications,
      me: state.me,
      characters: state.characters,
    });
  } catch (err) {
    console.error('Feed pulse error:', err);
    const message = err instanceof Error ? err.message : 'Failed to refresh AI pulse.';
    res.status(502).json({ error: message });
  }
});

// Send DM (1-on-1 or Group Lounge) and receive AI character reply
app.post('/api/messages/:threadId', async (req, res) => {
  try {
    const state = loadStore();
    const { threadId } = req.params;
    const { content } = req.body as { content?: string };
    if (!content?.trim()) {
      res.status(400).json({ error: 'Message cannot be empty.' });
      return;
    }

    const userMsg: DirectMessage = {
      id: makeId('msg'),
      threadId,
      senderId: 'me',
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    state.messages.push(userMsg);
    saveStore(state);

    const history = state.messages.filter((m) => m.threadId === threadId);

    if (threadId === 'group-lounge') {
      const replies = await generateGroupLoungeReplies({
        characters: state.characters,
        me: state.me,
        history: history.slice(0, -1),
        userMessage: content.trim(),
      });
      const added: DirectMessage[] = [];
      for (const r of replies) {
        const aiMsg: DirectMessage = {
          id: makeId('msg'),
          threadId,
          senderId: r.characterId,
          content: r.content.trim(),
          createdAt: new Date().toISOString(),
        };
        state.messages.push(aiMsg);
        added.push(aiMsg);
      }
      saveStore(state);
      res.json({ userMsg, aiReplies: added });
      return;
    }

    const char = state.characters.find((c) => c.id === threadId);
    if (!char) {
      res.status(404).json({ error: 'Character thread not found' });
      return;
    }

    const replyText = await generateDirectMessageReply({
      character: char,
      me: state.me,
      history: history.slice(0, -1),
      recentPosts: state.posts,
      userMessage: content.trim(),
    });

    const aiMsg: DirectMessage = {
      id: makeId('msg'),
      threadId,
      senderId: char.id,
      content: replyText,
      createdAt: new Date().toISOString(),
    };
    state.messages.push(aiMsg);
    saveStore(state);
    res.json({ userMsg, aiReplies: [aiMsg] });
  } catch (err) {
    console.error('DM error:', err);
    const message = err instanceof Error ? err.message : 'Failed to send direct message.';
    res.status(502).json({ error: message });
  }
});

// Have a specific AI character write and publish a post
app.post('/api/characters/:id/post', async (req, res) => {
  try {
    const state = loadStore();
    const char = state.characters.find((c) => c.id === req.params.id);
    if (!char) {
      res.status(404).json({ error: 'Character not found' });
      return;
    }

    const { topicHint } = (req.body ?? {}) as { topicHint?: string };
    const generated = await generateCharacterSpecificPost({
      character: char,
      me: state.me,
      recentPosts: state.posts,
      topicHint: topicHint?.trim(),
    });

    const newPost: Post = {
      id: makeId('post'),
      authorId: char.id,
      content: generated.content,
      topic: generated.topic,
      createdAt: new Date().toISOString(),
      likesCount: 0,
      likedByMe: false,
      likedByCharacterIds: [],
      repostedByMe: false,
      repostsCount: 0,
      comments: [],
    };
    state.posts.unshift(newPost);

    if (
      state.me.handle &&
      generated.content.toLowerCase().includes(state.me.handle.toLowerCase())
    ) {
      state.notifications.unshift({
        id: makeId('notif'),
        type: 'mention',
        actorId: char.id,
        postId: newPost.id,
        snippet: generated.content.slice(0, 90),
        createdAt: new Date().toISOString(),
        read: false,
      });
    }

    saveStore(state);
    res.status(201).json({ post: newPost, notifications: state.notifications });
  } catch (err) {
    console.error('Character post error:', err);
    const message = err instanceof Error ? err.message : 'Failed to generate character post.';
    res.status(502).json({ error: message });
  }
});

// Have character(s) start or continue chatting in a DM or group lounge thread
app.post('/api/messages/:threadId/nudge', async (req, res) => {
  try {
    const state = loadStore();
    const { threadId } = req.params;
    const history = state.messages.filter((m) => m.threadId === threadId);

    const generated = await generateChatNudge({
      threadId,
      characters: state.characters,
      me: state.me,
      history,
    });

    const added: DirectMessage[] = [];
    for (const item of generated) {
      const msg: DirectMessage = {
        id: makeId('msg'),
        threadId,
        senderId: item.senderId,
        content: item.content,
        createdAt: new Date().toISOString(),
      };
      state.messages.push(msg);
      added.push(msg);
    }

    saveStore(state);
    res.json({ aiReplies: added });
  } catch (err) {
    console.error('Chat nudge error:', err);
    const message = err instanceof Error ? err.message : 'Failed to generate chat message.';
    res.status(502).json({ error: message });
  }
});

// Upload an audio track (stored in data/uploads and served at /uploads/...)
app.post('/api/upload-audio', (req, res) => {
  try {
    const { filename, dataUrl } = req.body as { filename?: string; dataUrl?: string };
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      res.status(400).json({ error: 'Valid audio file data is required.' });
      return;
    }
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) {
      res.status(400).json({ error: 'Malformed audio payload.' });
      return;
    }
    const meta = dataUrl.slice(0, commaIdx);
    const base64 = dataUrl.slice(commaIdx + 1);
    const extMatch = filename?.match(/\.([a-z0-9]+)$/i);
    let ext = extMatch ? extMatch[1].toLowerCase() : 'mp3';
    if (!['mp3', 'wav', 'm4a', 'ogg', 'webm', 'aac', 'flac'].includes(ext)) {
      if (meta.includes('wav')) ext = 'wav';
      else if (meta.includes('ogg')) ext = 'ogg';
      else if (meta.includes('webm')) ext = 'webm';
      else if (meta.includes('mp4') || meta.includes('m4a')) ext = 'm4a';
      else ext = 'mp3';
    }
    const fileId = makeId('track');
    const savedName = `${fileId}.${ext}`;
    const dest = path.join(UPLOADS_DIR, savedName);
    fs.writeFileSync(dest, Buffer.from(base64, 'base64'));
    res.status(201).json({ url: `/uploads/${savedName}` });
  } catch (err) {
    console.error('Audio upload error:', err);
    res.status(500).json({ error: 'Failed to save uploaded audio file.' });
  }
});

// Restore state from client backup if server storage started empty
app.post('/api/restore', (req, res) => {
  try {
    const snapshot = req.body as AppState;
    if (!snapshot || !snapshot.me || !Array.isArray(snapshot.characters)) {
      res.status(400).json({ error: 'Invalid state snapshot.' });
      return;
    }
    const restored = restoreStore(snapshot);
    res.json(restored);
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ error: 'Failed to restore saved history.' });
  }
});

// Mark notifications read
app.post('/api/notifications/read', (_req, res) => {
  const state = loadStore();
  for (const n of state.notifications) {
    n.read = true;
  }
  saveStore(state);
  res.json(state.notifications);
});

// Reset account & feed back to zero state
app.post('/api/reset', (_req, res) => {
  const fresh = resetStore();
  res.json(fresh);
});

// Analyze existing posts and return top 5 trending hashtags
app.post('/api/hashtags/analyze', async (_req, res) => {
  try {
    const state = loadStore();
    if (state.posts.length === 0) {
      res.json({ hashtags: [] });
      return;
    }

    const postMap = new Map(state.posts.map((p) => [p.id, p]));
    const combined = new Map<string, { display: string; postIds: Set<string> }>();

    const recordTag = (raw: string, postId: string) => {
      const clean = raw.replace(/^#+/, '').replace(/[^a-zA-Z0-9_]/g, '');
      if (!clean) return;
      const key = clean.toLowerCase();
      const existing = combined.get(key);
      if (existing) {
        existing.postIds.add(postId);
      } else {
        combined.set(key, { display: `#${clean}`, postIds: new Set([postId]) });
      }
    };

    // 1. Deterministic extraction of explicit #hashtags in post copy & comments
    for (const p of state.posts) {
      const texts = [p.content, p.topic ?? '', ...p.comments.map((c) => c.content)].join(' ');
      const matches = texts.match(/#[a-zA-Z0-9_]+/g) ?? [];
      for (const m of matches) {
        recordTag(m, p.id);
      }
    }

    // 2. AI analysis across existing posts for thematic hashtags (non-fatal if model is temporarily busy)
    let aiError: string | null = null;
    try {
      const aiTags = await generateTrendingHashtags({
        posts: state.posts,
        characters: state.characters,
        me: state.me,
      });

      for (const item of aiTags) {
        const clean = item.tag.replace(/^#+/, '').replace(/[^a-zA-Z0-9_]/g, '');
        if (!clean) continue;
        const key = clean.toLowerCase();
        const entry = combined.get(key) ?? {
          display: `#${clean}`,
          postIds: new Set<string>(),
        };

        for (const id of item.postIds) {
          if (postMap.has(id)) entry.postIds.add(id);
        }

        const regex = new RegExp(`(^|[^a-zA-Z0-9_])#${clean}\\b`, 'i');
        for (const p of state.posts) {
          const topicClean = (p.topic ?? '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
          const fullText = [p.content, p.topic ?? '', ...p.comments.map((c) => c.content)].join(' ');
          if (regex.test(fullText) || (topicClean && topicClean === key)) {
            entry.postIds.add(p.id);
          }
        }

        combined.set(key, entry);
      }
    } catch (err) {
      aiError = err instanceof Error ? err.message : 'AI analysis unavailable.';
      console.warn('Gemini hashtag analysis unavailable, using post tag extraction:', aiError);
      // Include normalized post topics as hashtags when AI analysis is temporarily unavailable
      for (const p of state.posts) {
        if (p.topic) {
          const pascalTopic = p.topic
            .trim()
            .split(/\s+/)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join('');
          recordTag(pascalTopic, p.id);
        }
      }
    }

    const engagementOf = (postIds: Set<string>): number => {
      let score = 0;
      for (const id of postIds) {
        const p = postMap.get(id);
        if (p) score += p.likesCount + p.comments.length * 2 + p.repostsCount;
      }
      return score;
    };

    const hashtags: TrendingHashtag[] = Array.from(combined.values())
      .filter((entry) => entry.postIds.size > 0)
      .sort((a, b) => {
        if (b.postIds.size !== a.postIds.size) return b.postIds.size - a.postIds.size;
        return engagementOf(b.postIds) - engagementOf(a.postIds);
      })
      .slice(0, 5)
      .map((entry) => ({
        tag: entry.display,
        count: entry.postIds.size,
        postIds: Array.from(entry.postIds),
      }));

    if (hashtags.length === 0 && aiError) {
      let cleanMsg = 'Could not analyze posts right now. Please try again shortly.';
      try {
        const parsed = JSON.parse(aiError) as { error?: { message?: string } };
        if (parsed?.error?.message) cleanMsg = parsed.error.message;
      } catch {
        cleanMsg = aiError;
      }
      res.status(502).json({ error: cleanMsg });
      return;
    }

    res.json({ hashtags });
  } catch (err) {
    console.error('Analyze hashtags error:', err);
    const message = err instanceof Error ? err.message : 'Failed to analyze trending hashtags.';
    res.status(500).json({ error: message });
  }
});

// Ensure unmatched /api/* routes always return JSON (never HTML <!doctype>)
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Ensure Express middleware errors under /api/* always return JSON
app.use(
  '/api',
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('API error:', err);
    const status =
      typeof (err as { status?: number })?.status === 'number'
        ? (err as { status: number }).status
        : 500;
    const message = err instanceof Error ? err.message : 'Internal server error.';
    res.status(status).json({ error: message });
  }
);

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kith social server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
