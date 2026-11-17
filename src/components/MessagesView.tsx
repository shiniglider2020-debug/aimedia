import { useEffect, useRef, useState } from 'react';
import { MessageSquarePlus, Send, Users } from 'lucide-react';
import type { Character, DirectMessage, UserProfile } from '../types.ts';
import { Avatar } from './Avatar.tsx';
import { formatRelativeTime } from '../utils/image.ts';

interface MessagesViewProps {
  me: UserProfile;
  characters: Character[];
  messages: DirectMessage[];
  activeThreadId: string;
  onSelectThread: (threadId: string) => void;
  onSendMessage: (threadId: string, content: string) => Promise<void>;
  onNudgeChat: (threadId: string) => Promise<void>;
}

export function MessagesView({
  me,
  characters,
  messages,
  activeThreadId,
  onSelectThread,
  onSendMessage,
  onNudgeChat,
}: MessagesViewProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [nudging, setNudging] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const threadMessages = messages.filter((m) => m.threadId === activeThreadId);
  const activeChar = characters.find((c) => c.id === activeThreadId);
  const charMap = new Map(characters.map((c) => [c.id, c]));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages.length, activeThreadId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    const text = draft.trim();
    setDraft('');
    setSending(true);
    try {
      await onSendMessage(activeThreadId, text);
    } finally {
      setSending(false);
    }
  };

  const handleNudge = async () => {
    if (nudging || sending) return;
    setNudging(true);
    try {
      await onNudgeChat(activeThreadId);
    } finally {
      setNudging(false);
    }
  };

  const getLastMessage = (threadId: string) => {
    const list = messages.filter((m) => m.threadId === threadId);
    return list[list.length - 1];
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] md:h-screen bg-white">
      {/* Thread List */}
      <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[#E7E7E2] flex flex-col shrink-0 max-h-56 md:max-h-none overflow-y-auto">
        <div className="px-4 py-3.5 border-b border-[#E7E7E2]">
          <h2 className="font-display text-sm font-semibold text-[#141413]">Messages</h2>
        </div>

        {/* Group Lounge */}
        <button
          type="button"
          onClick={() => onSelectThread('group-lounge')}
          className={`w-full px-4 py-3 flex items-center gap-3 text-left border-b border-[#E7E7E2]/60 transition-colors ${
            activeThreadId === 'group-lounge' ? 'bg-[#F7F7F5]' : 'hover:bg-[#F7F7F5]/60'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-[#4338CA]/10 text-[#4338CA] flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-[#141413] truncate">Late-Night Table</div>
            <div className="text-[11px] text-[#6B6B68] truncate">
              {getLastMessage('group-lounge')?.content ?? 'Group chat with your circle'}
            </div>
          </div>
        </button>

        {/* Individual Characters */}
        {characters.map((c) => {
          const last = getLastMessage(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectThread(c.id)}
              className={`w-full px-4 py-3 flex items-center gap-3 text-left border-b border-[#E7E7E2]/60 transition-colors ${
                activeThreadId === c.id ? 'bg-[#F7F7F5]' : 'hover:bg-[#F7F7F5]/60'
              }`}
            >
              <Avatar src={c.avatar} name={c.name} accentColor={c.accentColor} size="md" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-[#141413] truncate">{c.name}</div>
                <div className="text-[11px] text-[#6B6B68] truncate">
                  {last ? last.content : c.role}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Conversation */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        <div className="px-5 py-3.5 border-b border-[#E7E7E2] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {activeThreadId === 'group-lounge' ? (
              <>
                <div className="w-9 h-9 rounded-full bg-[#4338CA]/10 text-[#4338CA] flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-sm font-semibold text-[#141413] truncate">
                    Late-Night Table
                  </div>
                  <div className="text-xs text-[#6B6B68] truncate">
                    Group room with {characters.length} AI characters & you
                  </div>
                </div>
              </>
            ) : activeChar ? (
              <>
                <Avatar
                  src={activeChar.avatar}
                  name={activeChar.name}
                  accentColor={activeChar.accentColor}
                  size="sm"
                />
                <div className="min-w-0">
                  <div className="font-display text-sm font-semibold text-[#141413] truncate">
                    {activeChar.name}
                  </div>
                  <div className="text-xs text-[#6B6B68] truncate">
                    {activeChar.handle} · {activeChar.role}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleNudge}
            disabled={nudging || sending}
            className="min-h-[36px] px-3 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-[#E7E7E2] bg-white hover:bg-[#F7F7F5] text-[#141413] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>
              {nudging
                ? 'Writing...'
                : activeThreadId === 'group-lounge'
                ? 'Characters Chat'
                : 'Prompt Message'}
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {threadMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto py-12">
              <p className="font-display text-sm font-semibold text-[#141413]">
                Start the conversation
              </p>
              <p className="mt-1 text-xs text-[#6B6B68] leading-relaxed">
                {activeThreadId === 'group-lounge'
                  ? 'Say hello to the table, or click Characters Chat to hear them talk together.'
                  : `Send a direct message to ${activeChar?.name}, or ask them to start the chat.`}
              </p>
              <button
                type="button"
                onClick={handleNudge}
                disabled={nudging}
                className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg bg-[#141413] text-white hover:bg-[#2A2A28] disabled:opacity-50 transition-colors"
              >
                {nudging
                  ? 'Starting chat...'
                  : activeThreadId === 'group-lounge'
                  ? 'Have Characters Start Chatting'
                  : `Ask ${activeChar?.name} to Say Hello`}
              </button>
            </div>
          ) : (
            threadMessages.map((msg) => {
              const isMe = msg.senderId === 'me';
              const sender = isMe ? null : charMap.get(msg.senderId);
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2.5 ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  {!isMe && (
                    <Avatar
                      src={sender?.avatar}
                      name={sender?.name ?? msg.senderId}
                      accentColor={sender?.accentColor}
                      size="xs"
                    />
                  )}
                  <div className={`max-w-[78%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                    {!isMe && activeThreadId === 'group-lounge' && (
                      <span className="text-[11px] font-medium text-[#6B6B68] mb-1 ml-1">
                        {sender?.name ?? msg.senderId}
                      </span>
                    )}
                    <div
                      className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isMe
                          ? 'bg-[#4338CA] text-white rounded-br-sm'
                          : 'bg-[#F7F7F5] text-[#141413] border border-[#E7E7E2] rounded-bl-sm'
                      }`}
                    >
                      {msg.content}
                    </div>
                    <span className="text-[10px] font-mono-tabular text-[#6B6B68] mt-1 px-1">
                      {formatRelativeTime(msg.createdAt)}
                    </span>
                  </div>
                  {isMe && (
                    <Avatar src={me.avatar} name={me.name || 'You'} accentColor="#141413" size="xs" />
                  )}
                </div>
              );
            })
          )}
          {(sending || nudging) && (
            <div className="text-xs text-[#4338CA]">
              {activeThreadId === 'group-lounge'
                ? 'Characters are typing...'
                : `${activeChar?.name ?? 'Character'} is typing...`}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSend} className="p-4 border-t border-[#E7E7E2] bg-white">
          <div className="flex items-center gap-2 bg-[#F7F7F5] border border-[#E7E7E2] rounded-xl px-3.5 py-2 focus-within:border-[#4338CA] focus-within:bg-white transition-colors">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                activeThreadId === 'group-lounge'
                  ? 'Message the Late-Night Table...'
                  : `Message ${activeChar?.name ?? 'character'}...`
              }
              className="flex-1 bg-transparent text-sm text-[#141413] placeholder:text-[#6B6B68] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg bg-[#4338CA] text-white hover:bg-[#3730A3] disabled:opacity-40 transition-colors"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
