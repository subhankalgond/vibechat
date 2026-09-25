import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api, { apiError } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from './AuthContext';
import { useToast } from '../components/ui/Toast';

const ConversationsContext = createContext(null);

export function ConversationsProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadedOnce = useRef(false);
  const openConversationRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const response = await api.get('/conversations');
      setConversations(response.data.data.conversations);
      setError(null);
    } catch (err) {
      const wrapped = apiError(err);
      setError(wrapped.message);
    } finally {
      setLoading(false);
      loadedOnce.current = true;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      setLoading(true);
      loadedOnce.current = false;
      return;
    }
    refresh();
  }, [user, refresh]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return undefined;

    const onNewMessage = (payload) => {
      setConversations((prev) => {
        const index = prev.findIndex((c) => c.id === payload.conversation_id);
        if (index === -1) {
          // A brand new conversation; refresh to pick it up with member info.
          refresh();
          return prev;
        }
        const updated = [...prev];
        const current = updated[index];
        const isMine = payload.message.is_mine !== undefined
          ? payload.message.is_mine
          : payload.message.sender_id === user.id;
        updated[index] = {
          ...current,
          last_message: {
            type: payload.message.message_type,
            text: payload.message.message_text || '',
            sender_id: payload.message.sender_id,
            created_at: payload.message.created_at,
          },
          unread_count: isMine ? current.unread_count : current.unread_count + 1,
        };
        // Move conversation to top.
        updated.unshift(updated.splice(index, 1)[0]);

        if (!isMine && openConversationRef.current !== payload.conversation_id) {
          const mediaNote =
            payload.message.message_type === 'image'
              ? ' sent a photo'
              : payload.message.message_type === 'video'
              ? ' sent a video'
              : '';
          toast.info(`New message from ${current.other_user.full_name}${mediaNote}`);
        }
        return updated;
      });
    };

    const onPresence = (payload) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.other_user && c.other_user.id === payload.user_id
            ? { ...c, other_user: { ...c.other_user, is_online: payload.is_online } }
            : c
        )
      );
    };

    const onSeen = (payload) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === payload.conversation_id && payload.marked_by_me ? { ...c, unread_count: 0 } : c
        )
      );
    };

    socket.on('message:new', onNewMessage);
    socket.on('user:presence', onPresence);
    socket.on('message:seen', onSeen);
    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('user:presence', onPresence);
      socket.off('message:seen', onSeen);
    };
  }, [user, refresh]);

  const markConversationRead = useCallback((conversationId) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === Number(conversationId) ? { ...c, unread_count: 0 } : c))
    );
  }, []);

  const setOpenConversation = useCallback((conversationId) => {
    openConversationRef.current = conversationId === null ? null : Number(conversationId);
  }, []);

  const removeConversation = useCallback((conversationId) => {
    setConversations((prev) => prev.filter((c) => c.id !== Number(conversationId)));
  }, []);

  const value = useMemo(
    () => ({
      conversations,
      loading,
      error,
      refresh,
      markConversationRead,
      removeConversation,
      setOpenConversation,
    }),
    [conversations, loading, error, refresh, markConversationRead, removeConversation, setOpenConversation]
  );

  return <ConversationsContext.Provider value={value}>{children}</ConversationsContext.Provider>;
}

export function useConversations() {
  const context = useContext(ConversationsContext);
  if (!context) throw new Error('useConversations must be used within ConversationsProvider');
  return context;
}
