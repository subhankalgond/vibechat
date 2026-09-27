import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, Search, Users, X } from 'lucide-react';

import api, { apiError } from '../../services/api';
import { useConversations } from '../../hooks/useConversations';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
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
  if (last.type === 'audio') return `${prefix}Voice message`;
  return `${prefix}${last.text}`;
}

function NewGroupModal({ onClose, onCreated }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);

  async function searchUsers(term) {
    setQuery(term);
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const response = await api.get('/users/search', { params: { q: term.trim() } });
      const found = response.data.data.users.filter(
        (u) => !selected.some((s) => s.id === u.id)
      );
      setResults(found.slice(0, 6));
    } catch (err) {
      toast.error(apiError(err).message);
    } finally {
      setSearching(false);
    }
  }

  async function createGroup() {
    if (!name.trim() || selected.length === 0) return;
    setCreating(true);
    try {
      const response = await api.post('/conversations', {
        name: name.trim(),
        member_usernames: selected.map((s) => s.username),
      });
      onCreated(response.data.data.id);
    } catch (err) {
      toast.error(apiError(err).message);
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-pop dark:bg-neutral-900">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">New group</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <label htmlFor="group_name" className="sr-only">Group name</label>
          <input
            id="group_name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            maxLength={80}
            className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {selected.map((user) => (
              <span key={user.id} className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                @{user.username}
                <button type="button" onClick={() => setSelected((prev) => prev.filter((s) => s.id !== user.id))} aria-label={`Remove ${user.username}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <label htmlFor="group_search" className="sr-only">Search members</label>
          <input
            id="group_search"
            type="search"
            value={query}
            onChange={(e) => searchUsers(e.target.value)}
            placeholder="Search people by username..."
            className="mt-3 w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
          {searching && <p className="mt-2 text-xs text-neutral-400">Searching...</p>}
          <ul className="mt-2 divide-y divide-neutral-100 dark:divide-neutral-800">
            {results.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected((prev) => [...prev, user]);
                    setQuery('');
                    setResults([]);
                  }}
                  className="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                >
                  <Avatar user={user} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{user.full_name}</span>
                    <span className="block truncate text-xs text-neutral-500">@{user.username}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">
          <button
            type="button"
            onClick={createGroup}
            disabled={!name.trim() || selected.length === 0 || creating}
            className="w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : `Create group${selected.length ? ` (${selected.length + 1} members)` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Messages() {
  const { conversations, loading, error, refresh } = useConversations();
  const { user } = useAuth();
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState('all');
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const navigate = useNavigate();
  useUnreadTitle(conversations);

  const byTab = useMemo(() => {
    if (tab === 'groups') return conversations.filter((c) => c.type === 'group');
    if (tab === 'direct') return conversations.filter((c) => c.type !== 'group');
    return conversations;
  }, [conversations, tab]);

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return byTab;
    return byTab.filter((c) => {
      const name = c.type === 'group' ? c.name || '' : c.other_user.full_name;
      const username = c.type === 'group' ? '' : c.other_user.username;
      return name.toLowerCase().includes(term) || username.toLowerCase().includes(term);
    });
  }, [byTab, filter]);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-neutral-900">
      <header className="border-b border-neutral-200 px-4 py-4 dark:border-neutral-800 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">Messages</h1>
          <button
            type="button"
            onClick={() => setGroupModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
          >
            <Users size={14} /> New group
          </button>
        </div>
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
        <div className="mt-3 flex gap-1.5">
          {[
            { key: 'all', label: 'All' },
            { key: 'direct', label: 'Direct' },
            { key: 'groups', label: 'Groups' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                tab === item.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
              }`}
            >
              {item.label}
            </button>
          ))}
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
              const isGroup = conversation.type === 'group';
              const other = conversation.other_user;
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/app/messages/${conversation.id}`)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                  >
                    {isGroup ? (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400">
                        <Users size={20} />
                      </span>
                    ) : (
                      <Avatar user={other} size="lg" showPresence />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          {isGroup ? conversation.name || 'Group' : other.full_name}
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
                          {isGroup && conversation.member_count ? (
                            <span className="mr-1 text-xs">({conversation.member_count})</span>
                          ) : null}
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

      {groupModalOpen && (
        <NewGroupModal
          onClose={() => setGroupModalOpen(false)}
          onCreated={(id) => {
            setGroupModalOpen(false);
            refresh();
            navigate(`/app/messages/${id}`);
          }}
        />
      )}
    </div>
  );
}
