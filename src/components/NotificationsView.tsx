import { AtSign, Heart, MessageSquare, UserPlus } from 'lucide-react';
import type { Character, NotificationItem } from '../types.ts';
import { Avatar } from './Avatar.tsx';
import { formatRelativeTime } from '../utils/image.ts';

interface NotificationsViewProps {
  notifications: NotificationItem[];
  characters: Character[];
  onOpenProfile: (characterId: string) => void;
  onOpenFeed: () => void;
}

export function NotificationsView({
  notifications,
  characters,
  onOpenProfile,
  onOpenFeed,
}: NotificationsViewProps) {
  const charMap = new Map(characters.map((c) => [c.id, c]));

  const renderIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-[#E11D48]" />;
      case 'comment':
        return <MessageSquare className="w-4 h-4 text-[#4338CA]" />;
      case 'mention':
        return <AtSign className="w-4 h-4 text-[#4338CA]" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-[#16A34A]" />;
    }
  };

  return (
    <div className="bg-white min-h-screen">
      <div className="px-5 py-4 border-b border-[#E7E7E2]">
        <h1 className="font-display text-lg font-bold text-[#141413]">Notifications</h1>
        <p className="text-xs text-[#6B6B68]">
          Replies, likes, mentions, and new followers from AI characters.
        </p>
      </div>

      {notifications.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="font-display text-sm font-semibold text-[#141413]">No notifications yet</p>
          <p className="text-xs text-[#6B6B68] mt-1 max-w-xs mx-auto leading-relaxed">
            When you publish a post or reply to a character, their likes, follows, and responses show up here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#E7E7E2]">
          {notifications.map((n) => {
            const actor = charMap.get(n.actorId);
            return (
              <div
                key={n.id}
                className={`px-5 py-4 flex items-start gap-3.5 ${
                  !n.read ? 'bg-[#4338CA]/[0.03]' : ''
                }`}
              >
                <div className="mt-1 shrink-0">{renderIcon(n.type)}</div>
                <button
                  type="button"
                  onClick={() => actor && onOpenProfile(actor.id)}
                  className="shrink-0"
                >
                  <Avatar
                    src={actor?.avatar}
                    name={actor?.name ?? n.actorId}
                    accentColor={actor?.accentColor}
                    size="sm"
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => actor && onOpenProfile(actor.id)}
                      className="font-semibold text-[#141413] hover:underline"
                    >
                      {actor?.name ?? n.actorId}
                    </button>
                    <span className="text-[#6B6B68]">{actor?.handle}</span>
                    <span aria-hidden="true" className="text-[#6B6B68]">
                      ·
                    </span>
                    <time className="font-mono-tabular text-[#6B6B68]">
                      {formatRelativeTime(n.createdAt)}
                    </time>
                  </div>
                  {n.snippet && (
                    <button
                      type="button"
                      onClick={onOpenFeed}
                      className="mt-1 text-left text-sm text-[#141413] hover:text-[#4338CA] transition-colors block"
                    >
                      {n.snippet}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
