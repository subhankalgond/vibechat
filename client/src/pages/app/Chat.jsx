import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, PhoneCall, Search, Video } from 'lucide-react';
import api, { apiError } from '../../services/api';
import { getSocket } from '../../services/socket';
import { useAuth } from '../../hooks/useAuth';
import { useConversations } from '../../hooks/useConversations';
import { useCall } from '../../context/CallContext';
import { useToast } from '../../hooks/useToast';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import { MessageSkeleton } from '../../components/ui/Skeleton';
import MessageBubble from '../../components/chat/MessageBubble';
import Composer from '../../components/chat/Composer';
import MediaViewer from '../../components/chat/MediaViewer';
import { formatLastSeen } from '../../utils/format';

export default function Chat() {
  const { conversationId: conversationIdParam } = useParams();
  const conversationId = Number(conversationIdParam);
  const { user, setUser } = useAuth();
  const { findConversation, markConversationRead, setOpenConversation } = useConversations();
  const { startCall, active: activeCall, incoming: incomingCall } = useCall();
  const toast = useToast();
  const navigate = useNavigate();

  const [otherUser, setOtherUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [typing, setTyping] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingMedia, setViewingMedia] = useState(null);

  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const atBottomRef = useRef(true);

  const markSeen = useCallback(
    (id) => {
      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit('message:seen', { conversation_id: id });
      }
    },
    []
  );

  // Load conversation header + first page of messages.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMessages([]);
    setHasMore(false);
    setTyping(false);
    setSearchOpen(false);
    setSearchTerm('');

    // Show the cached header instantly when we already know this chat.
    const cached = findConversation(conversationId);
    if (cached) setOtherUser(cached.other_user);

    Promise.all([
      api.get(`/conversations/${conversationId}`),
      api.get(`/messages/${conversationId}`),
    ])
      .then(([conversationRes, messagesRes]) => {
        if (cancelled) return;
        setOtherUser(conversationRes.data.data.other_user);
        const data = messagesRes.data.data;
        setMessages(data.messages);
        setHasMore(data.has_more);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(apiError(err).message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  // Join the socket room, mark seen, and listen for typing.
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !conversationId) return undefined;

    socket.emit('conversation:join', { conversation_id: conversationId });
    if (socket.connected) markSeen(conversationId);
    markConversationRead(conversationId);

    const onConnect = () => markSeen(conversationId);
    const onTypingStart = (payload) => {
      if (payload.conversation_id === conversationId && payload.user_id !== user.id) {
        setTyping(true);
      }
    };
    const onTypingStop = (payload) => {
      if (payload.conversation_id === conversationId && payload.user_id !== user.id) {
        setTyping(false);
      }
    };

    socket.on('connect', onConnect);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    return () => {
      socket.off('connect', onConnect);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
    };
  }, [conversationId, user.id, markSeen, markConversationRead]);

  // Reset unread whenever the chat page is open, and let the context
  // know so it can suppress new-message toasts for this chat.
  useEffect(() => {
    markConversationRead(conversationId);
    setOpenConversation(conversationId);
    return () => setOpenConversation(null);
  }, [conversationId, markConversationRead, setOpenConversation]);

  // Realtime message handlers.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const onNewMessage = (payload) => {
      if (payload.conversation_id !== conversationId) return;
      const incoming = payload.message;
      setMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [...prev, incoming];
      });
      if (!incoming.is_mine) {
        markSeen(conversationId);
        markConversationRead(conversationId);
      }
    };

    const onSeen = (payload) => {
      if (payload.conversation_id !== conversationId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.message_id && !m.seen_at ? { ...m, seen_at: payload.seen_at } : m
        )
      );
    };

    const onDelivered = (payload) => {
      if (payload.conversation_id !== conversationId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.message_id && !m.delivered_at ? { ...m, delivered_at: payload.delivered_at } : m
        )
      );
    };

    const onDeleted = (payload) => {
      if (payload.conversation_id !== conversationId) return;
      if (payload.deleted_by === user.id) {
        setMessages((prev) => prev.filter((m) => m.id !== payload.message_id));
      }
      // If the other user deleted it from their view only, nothing changes here.
    };

    const onPresence = (payload) => {
      const update = (prev) =>
        prev && prev.id === payload.user_id
          ? { ...prev, is_online: payload.is_online, last_seen: payload.last_seen || prev.last_seen }
          : prev;
      setOtherUser(update);
      setUser(update);
    };

    socket.on('message:new', onNewMessage);
    socket.on('message:seen', onSeen);
    socket.on('message:delivered', onDelivered);
    socket.on('message:deleted', onDeleted);
    socket.on('user:presence', onPresence);
    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('message:seen', onSeen);
      socket.off('message:delivered', onDelivered);
      socket.off('message:deleted', onDeleted);
      socket.off('user:presence', onPresence);
    };
  }, [conversationId, user.id, markSeen, markConversationRead, setUser]);

  // A sent message comes back either via socket or via the POST response;
  // appending with an id check makes both orders safe.
  const handleSent = useCallback((message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      return [...prev, message];
    });
  }, []);

  // Auto-scroll on new messages when the user is near the bottom.
  useEffect(() => {
    if (atBottomRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typing]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = distanceFromBottom < 120;
  }

  async function loadOlder() {
    if (loadingOlder || !hasMore || !messages.length) return;
    setLoadingOlder(true);
    const el = scrollRef.current;
    const previousHeight = el ? el.scrollHeight : 0;

    try {
      const oldest = messages[0].created_at;
      const response = await api.get(`/messages/${conversationId}`, {
        params: { before: oldest },
      });
      const data = response.data.data;
      setMessages((prev) => [...data.messages, ...prev]);
      setHasMore(data.has_more);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - previousHeight;
      });
    } catch (err) {
      toast.error(apiError(err).message);
    } finally {
      setLoadingOlder(false);
    }
  }

  async function handleDelete(message) {
    try {
      await api.delete(`/messages/${message.id}`);
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
    } catch (err) {
      toast.error(apiError(err).message);
    }
  }

  const visibleMessages = searchTerm.trim()
    ? messages.filter((m) =>
        m.message_text && m.message_text.toLowerCase().includes(searchTerm.trim().toLowerCase())
      )
    : messages;

  return (
    <div className="flex h-full flex-col bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <header className="flex items-center gap-2 border-b border-neutral-200 bg-white px-2 py-2.5 dark:border-neutral-800 dark:bg-neutral-900 sm:px-4 sm:gap-3">
        <button
          type="button"
          onClick={() => navigate('/app/messages')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          aria-label="Back to messages"
        >
          <ArrowLeft size={20} />
        </button>

        {otherUser ? (
          <button
            type="button"
            onClick={() => navigate(`/app/u/${otherUser.username}`)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <Avatar user={otherUser} size="md" showPresence />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {otherUser.full_name}
              </span>
              <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
                {typing ? (
                  <span className="font-medium text-primary-600 dark:text-primary-400">typing...</span>
                ) : otherUser.is_online ? (
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">Online</span>
                ) : (
                  formatLastSeen(otherUser.last_seen)
                )}
              </span>
            </span>
          </button>
        ) : (
          <div className="flex-1" />
        )}

        <button
          type="button"
          onClick={() => setSearchOpen((prev) => !prev)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          aria-label="Search in conversation"
          title="Search in conversation"
        >
          <Search size={18} />
        </button>
        {otherUser && (
          <>
            <button
              type="button"
              onClick={async () => {
                if (activeCall || incomingCall) return;
                const res = await startCall(conversationId, otherUser, 'audio');
                if (!res.ok) toast.error(res.error);
              }}
              disabled={Boolean(activeCall || incomingCall)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-neutral-800"
              aria-label="Start voice call"
              title="Voice call"
            >
              <PhoneCall size={18} />
            </button>
            <button
              type="button"
              onClick={async () => {
                if (activeCall || incomingCall) return;
                const res = await startCall(conversationId, otherUser, 'video');
                if (!res.ok) toast.error(res.error);
              }}
              disabled={Boolean(activeCall || incomingCall)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-neutral-800"
              aria-label="Start video call"
              title="Video call"
            >
              <Video size={18} />
            </button>
          </>
        )}
      </header>

      {searchOpen && (
        <div className="border-b border-neutral-200 bg-white px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-900 sm:px-4">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search messages in this conversation"
            aria-label="Search messages"
            autoFocus
            className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500"
          />
          {searchTerm.trim() && (
            <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
              {visibleMessages.length} message{visibleMessages.length === 1 ? '' : 's'} found in loaded history
            </p>
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 py-4 sm:px-4">
        {loading ? (
          <MessageSkeleton />
        ) : error ? (
          <EmptyState
            title="Could not open this chat"
            description={error}
            action={
              <button
                type="button"
                onClick={() => navigate('/app/messages')}
                className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                Back to messages
              </button>
            }
          />
        ) : (
          <>
            {hasMore && (
              <div className="mb-4 flex justify-center">
                <button
                  type="button"
                  onClick={loadOlder}
                  disabled={loadingOlder}
                  className="rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                >
                  {loadingOlder ? 'Loading...' : 'Load older messages'}
                </button>
              </div>
            )}

            {visibleMessages.length === 0 ? (
              searchTerm.trim() ? (
                <EmptyState title="No matches" description={`No loaded message matches "${searchTerm.trim()}".`} />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <EmptyState icon={MessageCircle} title="Start the conversation" description="Send a message to say hello." />
                </div>
              )
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-2.5">
                {visibleMessages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    onOpenMedia={setViewingMedia}
                    onDelete={handleDelete}
                  />
                ))}
                {typing && (
                  <div className="flex justify-start">
                    <div
                      className="flex items-center gap-1 rounded-2xl bg-white px-4 py-3 shadow-sm dark:bg-neutral-800"
                      aria-label={`${otherUser ? otherUser.full_name : 'They'} is typing`}
                    >
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:240ms]" />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </>
        )}
      </div>

      <Composer
        conversationId={conversationId}
        disabled={loading || Boolean(error)}
        onMessageSent={handleSent}
        onTypingStart={() => {
          const socket = getSocket();
          if (socket) socket.emit('typing:start', { conversation_id: conversationId });
        }}
        onTypingStop={() => {
          const socket = getSocket();
          if (socket) socket.emit('typing:stop', { conversation_id: conversationId });
        }}
      />

      {viewingMedia && <MediaViewer media={viewingMedia} onClose={() => setViewingMedia(null)} />}
    </div>
  );
}
