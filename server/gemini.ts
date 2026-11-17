import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { Character, DirectMessage, Post, UserProfile } from '../src/types.ts';

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseGeminiJson<T>(raw: string | undefined, fallback: T): T {
  const cleaned = (raw ?? '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  if (!cleaned) return fallback;
  return JSON.parse(cleaned) as T;
}

function summarizeRecentFeed(posts: Post[], characters: Character[], me: UserProfile): string {
  const authorMap = new Map<string, string>();
  authorMap.set('me', `${me.name} (${me.handle})`);
  for (const c of characters) {
    authorMap.set(c.id, `${c.name} (${c.handle})`);
  }

  return posts
    .slice(0, 6)
    .map((p) => {
      const who = authorMap.get(p.authorId) ?? p.authorId;
      return `- [${p.id}] ${who}: "${p.content.slice(0, 140)}"`;
    })
    .join('\n');
}

export async function generateReactionsToUserPost(params: {
  post: Post;
  me: UserProfile;
  characters: Character[];
  recentPosts: Post[];
}): Promise<{
  likedByCharacterIds: string[];
  followedByCharacterIds: string[];
  comments: Array<{ characterId: string; content: string }>;
}> {
  const { post, me, characters, recentPosts } = params;
  const ai = getClient();

  const mentionedHandles = characters
    .filter((c) => post.content.toLowerCase().includes(c.handle.toLowerCase()))
    .map((c) => c.id);

  const roster = characters
    .filter((c) => c.id !== post.authorId)
    .map(
      (c) =>
        `ID: "${c.id}" | Name: ${c.name} (${c.handle}) | Role: ${c.role} | Interests: ${c.interests.join(', ')} | Voice: ${c.personality}`
    )
    .join('\n');

  const postAuthorLabel =
    post.authorId === 'me'
      ? `the human user (${me.name}, ${me.handle}, bio: "${me.bio}", interests: ${me.interests.join(', ') || 'general'})`
      : characters.find((c) => c.id === post.authorId)?.name ?? post.authorId;

  const prompt = `You are simulating a close-knit, realistic social media feed called Kith where ${postAuthorLabel} just published a post.

Post:
"${post.content}"
${post.topic ? `Topic: ${post.topic}` : ''}
${post.music ? `Shared Music Track: "${post.music.title}"${post.music.artist ? ` by ${post.music.artist}` : ''}` : ''}
${mentionedHandles.length > 0 ? `Explicitly @mentioned character IDs (MUST comment): ${mentionedHandles.join(', ')}` : ''}

Available AI characters in the social circle:
${roster}

Recent feed context:
${summarizeRecentFeed(recentPosts, characters, me)}

Task:
1. Pick 2 to 4 character IDs who would naturally like this post.
2. Pick 1 to 2 character IDs who resonate with the author's voice/interests and decide to FOLLOW the author.
3. Pick 2 characters (including any @mentioned characters!) who would leave genuinely distinct, authentic, conversational social media comments (1 to 3 sentences each, matching their specific voice and personality—no generic AI praise, no hashtags spam).`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          likedByCharacterIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Character IDs who liked the post.',
          },
          followedByCharacterIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Character IDs who decide to follow the post author.',
          },
          comments: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                characterId: { type: Type.STRING },
                content: { type: Type.STRING },
              },
              required: ['characterId', 'content'],
            },
          },
        },
        required: ['likedByCharacterIds', 'followedByCharacterIds', 'comments'],
      },
    },
  });

  const parsed = parseGeminiJson<{
    likedByCharacterIds?: string[];
    followedByCharacterIds?: string[];
    comments?: Array<{ characterId: string; content: string }>;
  }>(response.text, {});

  const validIds = new Set(characters.filter((c) => c.id !== post.authorId).map((c) => c.id));
  const likedByCharacterIds = (parsed.likedByCharacterIds ?? []).filter((id) => validIds.has(id));
  const followedByCharacterIds = (parsed.followedByCharacterIds ?? []).filter((id) =>
    validIds.has(id)
  );
  const comments = (parsed.comments ?? []).filter(
    (c) => validIds.has(c.characterId) && c.content.trim().length > 0
  );

  return { likedByCharacterIds, followedByCharacterIds, comments };
}

export async function generateCharacterCommentReply(params: {
  post: Post;
  targetCharacter: Character;
  me: UserProfile;
  characters: Character[];
  triggeringCommentText: string;
}): Promise<{
  replyText: string;
  shouldLikeUserComment: boolean;
  shouldFollowUser: boolean;
}> {
  const { post, targetCharacter, me, characters, triggeringCommentText } = params;
  const ai = getClient();

  const nameById = new Map<string, string>([
    ['me', `${me.name} (${me.handle})`],
    ...characters.map((c): [string, string] => [c.id, `${c.name} (${c.handle})`]),
  ]);

  const threadContext = post.comments
    .slice(-8)
    .map((c) => `${nameById.get(c.authorId) ?? c.authorId}: "${c.content}"`)
    .join('\n');

  const postAuthor = nameById.get(post.authorId) ?? post.authorId;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Original post by ${postAuthor}:
"${post.content}"
${post.music ? `Attached Music Track: "${post.music.title}"${post.music.artist ? ` by ${post.music.artist}` : ''}` : ''}

Recent comment thread:
${threadContext}

${me.name} just wrote: "${triggeringCommentText}"

Decide as ${targetCharacter.name} (${targetCharacter.handle}):
1. Write a natural, conversational comment reply (1–3 sentences).
2. Decide if you want to like ${me.name}'s comment (shouldLikeUserComment).
3. Decide if you want to follow ${me.name} based on this interaction (shouldFollowUser).`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction: `You are ${targetCharacter.name} (${targetCharacter.role}). Bio: ${targetCharacter.bio}. Personality & speaking style: ${targetCharacter.personality}. Never break character or speak like a generic assistant.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          replyText: { type: Type.STRING },
          shouldLikeUserComment: { type: Type.BOOLEAN },
          shouldFollowUser: { type: Type.BOOLEAN },
        },
        required: ['replyText', 'shouldLikeUserComment', 'shouldFollowUser'],
      },
    },
  });

  const parsed = parseGeminiJson<{
    replyText?: string;
    shouldLikeUserComment?: boolean;
    shouldFollowUser?: boolean;
  }>(response.text, {});
  const replyText = (parsed.replyText ?? '').trim();
  if (!replyText) {
    throw new Error('Empty response returned from Gemini.');
  }
  return {
    replyText,
    shouldLikeUserComment: Boolean(parsed.shouldLikeUserComment),
    shouldFollowUser: Boolean(parsed.shouldFollowUser),
  };
}

export async function generateFeedPulse(params: {
  me: UserProfile;
  characters: Character[];
  recentPosts: Post[];
}): Promise<{
  newPosts: Array<{ characterId: string; content: string; topic: string }>;
  newComments: Array<{ postId: string; characterId: string; content: string }>;
  newPostLikes: Array<{ postId: string; characterId: string }>;
  newCommentLikes: Array<{ postId: string; commentId: string; characterId: string }>;
  newFollows: Array<{ actorCharacterId: string; targetId: string }>;
}> {
  const { me, characters, recentPosts } = params;
  const ai = getClient();

  const roster = characters
    .map(
      (c) =>
        `ID: "${c.id}" | ${c.name} (${c.handle}), ${c.role}. Voice: ${c.personality}`
    )
    .join('\n');

  const postsSummary = recentPosts
    .slice(0, 6)
    .map((p) => {
      const commentsSummary = p.comments
        .slice(-3)
        .map((c) => `  - CommentID "${c.id}" by ${c.authorId}: "${c.content.slice(0, 80)}"`)
        .join('\n');
      return `PostID "${p.id}" by ${p.authorId === 'me' ? `${me.name} (ID: "me")` : p.authorId}: "${p.content}"${commentsSummary ? `\n${commentsSummary}` : ''}`;
    })
    .join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Simulate fresh organic social media activity on Kith.
Human user ID: "me" (${me.name}, ${me.handle}, bio: "${me.bio}", interests: ${me.interests.join(', ') || 'general'}).

Characters:
${roster}

Recent posts & comments on the feed:
${postsSummary || '(Feed currently has 0 posts.)'}

Generate organic social actions:
1. newPosts: 2 new original posts from 2 different AI characters (1–3 sentences each, authentic slice-of-life thoughts or observations). Include a short 1–2 word topic label.
2. newComments: If posts exist above, 1–2 thoughtful comments from characters on existing PostIDs.
3. newPostLikes: If posts exist above, 2–4 likes from characters on existing PostIDs.
4. newCommentLikes: If comments exist above, 1–2 likes from characters on existing CommentIDs.
5. newFollows: 1–3 follow actions where a character follows either "me" or another character ID they resonate with.`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          newPosts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                characterId: { type: Type.STRING },
                content: { type: Type.STRING },
                topic: { type: Type.STRING },
              },
              required: ['characterId', 'content', 'topic'],
            },
          },
          newComments: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                postId: { type: Type.STRING },
                characterId: { type: Type.STRING },
                content: { type: Type.STRING },
              },
              required: ['postId', 'characterId', 'content'],
            },
          },
          newPostLikes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                postId: { type: Type.STRING },
                characterId: { type: Type.STRING },
              },
              required: ['postId', 'characterId'],
            },
          },
          newCommentLikes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                postId: { type: Type.STRING },
                commentId: { type: Type.STRING },
                characterId: { type: Type.STRING },
              },
              required: ['postId', 'commentId', 'characterId'],
            },
          },
          newFollows: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                actorCharacterId: { type: Type.STRING },
                targetId: { type: Type.STRING },
              },
              required: ['actorCharacterId', 'targetId'],
            },
          },
        },
        required: ['newPosts', 'newComments', 'newPostLikes', 'newCommentLikes', 'newFollows'],
      },
    },
  });

  const parsed = parseGeminiJson<{
    newPosts?: Array<{ characterId: string; content: string; topic: string }>;
    newComments?: Array<{ postId: string; characterId: string; content: string }>;
    newPostLikes?: Array<{ postId: string; characterId: string }>;
    newCommentLikes?: Array<{ postId: string; commentId: string; characterId: string }>;
    newFollows?: Array<{ actorCharacterId: string; targetId: string }>;
  }>(response.text, {});

  const validCharIds = new Set(characters.map((c) => c.id));
  const validPostIds = new Set(recentPosts.map((p) => p.id));

  return {
    newPosts: (parsed.newPosts ?? []).filter(
      (p) => validCharIds.has(p.characterId) && p.content.trim().length > 0
    ),
    newComments: (parsed.newComments ?? []).filter(
      (c) =>
        validCharIds.has(c.characterId) &&
        validPostIds.has(c.postId) &&
        c.content.trim().length > 0
    ),
    newPostLikes: (parsed.newPostLikes ?? []).filter(
      (l) => validCharIds.has(l.characterId) && validPostIds.has(l.postId)
    ),
    newCommentLikes: (parsed.newCommentLikes ?? []).filter(
      (cl) => validCharIds.has(cl.characterId) && validPostIds.has(cl.postId)
    ),
    newFollows: (parsed.newFollows ?? []).filter(
      (f) =>
        validCharIds.has(f.actorCharacterId) &&
        (f.targetId === 'me' || validCharIds.has(f.targetId)) &&
        f.actorCharacterId !== f.targetId
    ),
  };
}

export async function generateCharacterIntroPost(
  character: Character,
  me: UserProfile
): Promise<string> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Write ${character.name}'s very first social media post on Kith (1–2 sentences, authentic slice-of-life introduction or observation matching their voice—not a stiff "Hello world I am an AI" greeting). They share a feed with ${me.name} (${me.handle}), whose interests include: ${me.interests.join(', ') || 'everyday creativity'}.`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction: `You are ${character.name} (${character.handle}), ${character.role}. Bio: ${character.bio}. Personality: ${character.personality}. Interests: ${character.interests.join(', ')}.`,
    },
  });
  return (response.text ?? '').trim();
}

export async function generateDirectMessageReply(params: {
  character: Character;
  me: UserProfile;
  history: DirectMessage[];
  recentPosts: Post[];
  userMessage: string;
}): Promise<string> {
  const { character, me, history, recentPosts, userMessage } = params;
  const ai = getClient();

  const myRecentPosts = recentPosts
    .filter((p) => p.authorId === 'me')
    .slice(0, 3)
    .map((p) => `- "${p.content}"`)
    .join('\n');

  const convoHistory = history
    .slice(-12)
    .map((m) => `${m.senderId === 'me' ? me.name : character.name}: ${m.content}`)
    .join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `${myRecentPosts ? `${me.name}'s recent posts on the social feed:\n${myRecentPosts}\n\n` : ''}${me.name}'s interests: ${me.interests.join(', ') || 'general'}\n\nDirect message history:
${convoHistory}
${me.name}: ${userMessage}

Reply directly to ${me.name} in your natural voice (1–4 conversational sentences).`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction: `You are ${character.name} (${character.handle}), ${character.role}. Bio: ${character.bio}. Personality: ${character.personality}. You are chatting 1-on-1 in Direct Messages with your friend ${me.name} (${me.handle}) on Kith. Stay grounded, personable, and in-character.`,
    },
  });

  const text = (response.text ?? '').trim();
  if (!text) {
    throw new Error('Empty DM reply returned from Gemini.');
  }
  return text;
}

export async function generateGroupLoungeReplies(params: {
  characters: Character[];
  me: UserProfile;
  history: DirectMessage[];
  userMessage: string;
}): Promise<Array<{ characterId: string; content: string }>> {
  const { characters, me, history, userMessage } = params;
  const ai = getClient();

  const charMap = new Map(characters.map((c) => [c.id, c.name]));
  const roster = characters
    .map((c) => `ID: "${c.id}" | ${c.name} (${c.role}): ${c.personality}`)
    .join('\n');

  const convoHistory = history
    .slice(-12)
    .map(
      (m) =>
        `${m.senderId === 'me' ? me.name : charMap.get(m.senderId) ?? m.senderId}: ${m.content}`
    )
    .join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `You are moderating the "Late-Night Table" group chat on Kith with ${me.name} (${me.handle}) and the AI character circle.

Characters available:
${roster}

Recent group chat messages:
${convoHistory}
${me.name}: ${userMessage}

Pick 1 or 2 characters who would naturally chime in next, and write their short, lively in-character replies (1–2 sentences each).`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          replies: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                characterId: { type: Type.STRING },
                content: { type: Type.STRING },
              },
              required: ['characterId', 'content'],
            },
          },
        },
        required: ['replies'],
      },
    },
  });

  const parsed = parseGeminiJson<{
    replies?: Array<{ characterId: string; content: string }>;
  }>(response.text, {});

  const validIds = new Set(characters.map((c) => c.id));
  return (parsed.replies ?? []).filter(
    (r) => validIds.has(r.characterId) && r.content.trim().length > 0
  );
}

export async function generateCharacterSpecificPost(params: {
  character: Character;
  me: UserProfile;
  recentPosts: Post[];
  topicHint?: string;
}): Promise<{ content: string; topic: string }> {
  const { character, me, recentPosts, topicHint } = params;
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Write a fresh, authentic social media post (1–3 sentences) from ${character.name} (${character.handle}) on Kith.
${topicHint ? `Topic or prompt suggestion: "${topicHint}"` : 'Draw naturally from their life, work, or recent feed themes.'}
Human friend in the circle: ${me.name} (${me.handle}), interests: ${me.interests.join(', ') || 'general'}.
Recent feed context:
${summarizeRecentFeed(recentPosts, [character], me) || '(Empty feed so far.)'}`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction: `You are ${character.name} (${character.role}). Bio: ${character.bio}. Personality: ${character.personality}. Interests: ${character.interests.join(', ')}.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING },
          topic: { type: Type.STRING },
        },
        required: ['content', 'topic'],
      },
    },
  });

  const parsed = parseGeminiJson<{
    content?: string;
    topic?: string;
  }>(response.text, {});
  const content = (parsed.content ?? '').trim();
  if (!content) {
    throw new Error('Failed to generate character post.');
  }
  return {
    content,
    topic: (parsed.topic ?? character.interests[0] ?? 'Life').trim(),
  };
}

export async function generateChatNudge(params: {
  threadId: string;
  characters: Character[];
  me: UserProfile;
  history: DirectMessage[];
}): Promise<Array<{ senderId: string; content: string }>> {
  const { threadId, characters, me, history } = params;
  const ai = getClient();

  if (threadId === 'group-lounge') {
    const charMap = new Map(characters.map((c) => [c.id, c.name]));
    const roster = characters
      .map((c) => `ID: "${c.id}" | ${c.name} (${c.role}): ${c.personality}`)
      .join('\n');
    const convo = history
      .slice(-10)
      .map((m) => `${m.senderId === 'me' ? me.name : charMap.get(m.senderId) ?? m.senderId}: ${m.content}`)
      .join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `In the "Late-Night Table" group chat with ${me.name} (${me.handle}), generate 2 short back-and-forth messages from 2 characters continuing or starting a casual conversation.
Characters:
${roster}

Recent chat:
${convo || '(Chat is quiet so far—say hello or bring up an interesting question!)'}`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            messages: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  characterId: { type: Type.STRING },
                  content: { type: Type.STRING },
                },
                required: ['characterId', 'content'],
              },
            },
          },
          required: ['messages'],
        },
      },
    });

    const parsed = parseGeminiJson<{
      messages?: Array<{ characterId: string; content: string }>;
    }>(response.text, {});
    const validIds = new Set(characters.map((c) => c.id));
    return (parsed.messages ?? [])
      .filter((m) => validIds.has(m.characterId) && m.content.trim().length > 0)
      .map((m) => ({ senderId: m.characterId, content: m.content.trim() }));
  }

  const char = characters.find((c) => c.id === threadId);
  if (!char) {
    throw new Error('Character not found.');
  }
  const convo = history
    .slice(-10)
    .map((m) => `${m.senderId === 'me' ? me.name : char.name}: ${m.content}`)
    .join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `You are ${char.name} in a 1-on-1 DM with ${me.name} (${me.handle}, bio: "${me.bio}", interests: ${me.interests.join(', ') || 'general'}).
Recent chat:
${convo || '(Empty chat—send a warm, natural opening message to start chatting!)'}

Write 1 short conversational message (1–3 sentences) to start or continue the chat.`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction: `You are ${char.name} (${char.role}). Bio: ${char.bio}. Personality: ${char.personality}.`,
    },
  });

  const text = (response.text ?? '').trim();
  if (!text) throw new Error('Empty chat message generated.');
  return [{ senderId: char.id, content: text }];
}

export async function generateTrendingHashtags(params: {
  posts: Post[];
  characters: Character[];
  me: UserProfile;
}): Promise<Array<{ tag: string; postIds: string[] }>> {
  const { posts, characters, me } = params;
  if (posts.length === 0) return [];

  const ai = getClient();
  const nameById = new Map<string, string>([
    ['me', `${me.name || 'User'} (${me.handle || '@me'})`],
    ...characters.map((c): [string, string] => [c.id, `${c.name} (${c.handle})`]),
  ]);

  const postsCorpus = posts
    .slice(0, 40)
    .map((p) => {
      const author = nameById.get(p.authorId) ?? p.authorId;
      const musicPart = p.music
        ? ` | Music: "${p.music.title}"${p.music.artist ? ` by ${p.music.artist}` : ''}`
        : '';
      const topicPart = p.topic ? ` | Topic: ${p.topic}` : '';
      const commentsPart =
        p.comments.length > 0
          ? ` | Comments: ${p.comments
              .slice(0, 4)
              .map((c) => `"${c.content.slice(0, 90)}"`)
              .join('; ')}`
          : '';
      return `ID: "${p.id}" | Author: ${author} | Likes: ${p.likesCount}${topicPart}${musicPart} | Text: "${p.content}"${commentsPart}`;
    })
    .join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Analyze the existing social media posts on Kith below and identify the top 5 trending hashtags.

Existing Posts:
${postsCorpus}

Rules:
1. Return up to 5 trending hashtags (e.g. "#LateNightCoffee", "#IndieMusic", "#DesignNotes"). Every tag MUST begin with "#" and use only letters, numbers, or underscores (no spaces).
2. Always include any explicit #hashtags already appearing inside the posts first. If fewer than 5 explicit hashtags exist, synthesize natural hashtags representing the main subjects, themes, topics, or music across the posts.
3. For each hashtag, return "postIds" containing ONLY the exact IDs from the posts above that actually contain that hashtag or directly match that subject/topic.
4. Rank from highest trend strength (most matching posts and engagement) to lowest. Maximum 5 items.`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          hashtags: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                tag: { type: Type.STRING },
                postIds: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['tag', 'postIds'],
            },
          },
        },
        required: ['hashtags'],
      },
    },
  });

  const parsed = parseGeminiJson<{
    hashtags?: Array<{ tag?: string; postIds?: string[] }>;
  }>(response.text, {});

  const validPostIds = new Set(posts.map((p) => p.id));
  const results: Array<{ tag: string; postIds: string[] }> = [];

  for (const item of parsed.hashtags ?? []) {
    const rawTag = (item.tag ?? '').trim().replace(/^#+/, '').replace(/[^a-zA-Z0-9_]/g, '');
    if (!rawTag) continue;
    const tag = `#${rawTag}`;
    const postIds = Array.from(
      new Set((item.postIds ?? []).filter((id) => validPostIds.has(id)))
    );
    results.push({ tag, postIds });
  }

  return results;
}
