import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, Search } from 'lucide-react';

import { useConversations } from '../../hooks/useConversations';
import { useAuth } from '../../hooks/useAuth';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import { ChatListSkeleton } from '../../components/ui/Skeleton';
import { formatChatListTime } from '../../utils/format';
import { useUnreadTitle } from '../../hooks/useUnreadTitle';

function previewText(conversation, currentUserId) {
  const last = conversation.last_message;
  if (!last) return 'No messages yet';
  const isMine = last.sender_id === currentUserId;
  const prefix = isMine ? 'You: ' : '';
  if (last.type === 'image') return `${prefix}Photo`;
  if (last.type === 'video') return `${prefix}Video`;
  return `${prefix}${last.text}`;
}

export default function Messages() {
  const { conversations, loading, error, refresh } = useConversations();
  const { user } = useAuth();
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();
  useUnreadTitle(conversations);

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter(
      (c) =>
        c.other_user.username.toLowerCase().includes(term) ||
        c.other_user.full_name.toLowerCase().includes(term)
    );
  }, [conversations, filter]);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-neutral-900">
      <header className="border-b border-neutral-200 px-4 py-4 dark:border-neutral-800 sm:px-6">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">Messages</h1>
        <div className="relative mt-3">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter conversations"
            aria-label="Filter conversations"
            className="w-full rounded-xl border border-neutral-300 bg-neutral-50 py-2.5 pl-10 pr-3 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <ChatListSkeleton />
        ) : error ? (
          <EmptyState
            icon={MessageCircle}
            title="Could not load chats"
            description={error}
            action={
              <button
                type="button"
                onClick={refresh}
                className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                Try again
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          conversations.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="No conversations yet"
              description="Search for someone by username and start your first conversation."
              action={
                <Link
                  to="/app/search"
                  className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                >
                  Find people
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={Search}
              title="No matches"
              description={`No conversation matches "${filter}".`}
            />
          )
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {filtered.map((conversation) => {
              const other = conversation.other_user;
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/app/messages/${conversation.id}`)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                  >
                    <Avatar user={other} size="lg" showPresence />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          {other.full_name}
                        </span>
                        {conversation.last_message && (
                          <span className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">
                            {formatChatListTime(conversation.last_message.created_at)}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <span
                          className={`truncate text-sm ${
                            conversation.unread_count > 0
                              ? 'font-semibold text-neutral-800 dark:text-neutral-100'
                              : 'text-neutral-500 dark:text-neutral-400'
                          }`}
                        >
                          {previewText(conversation, user.id)}
                        </span>
                        {conversation.unread_count > 0 && (
                          <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[11px] font-bold text-white">
                            {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
