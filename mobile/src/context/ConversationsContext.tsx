import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from './AuthContext';

export interface OtherUser {
  id: number;
  full_name: string;
  username: string;
  profile_image: string | null;
  is_online: boolean;
  last_seen: string | null;
}

export interface Conversation {
  id: number;
  updated_at: string;
  other_user: OtherUser;
  last_message: {
    type: string;
    text: string;
    sender_id: number;
    created_at: string;
  } | null;
  unread_count: number;
}

interface ConversationsContextValue {
  conversations: Conversation[];
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (conversationId: number) => void;
}

const ConversationsContext = createContext<ConversationsContextValue | null>(null);

export function ConversationsProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.get<{ conversations: Conversation[] }>('/conversations', token);
      setConversations(data.conversations);
    } catch {
      // keep the current list on failure; next refresh retries
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      setLoading(true);
      return;
    }
    refresh();
  }, [user, refresh]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return undefined;

    const onNewMessage = (payload: {
      conversation_id: number;
      message: {
        message_type: string;
        message_text?: string | null;
        sender_id: number;
        created_at: string;
        sender?: OtherUser;
      };
    }) => {
      setConversations((prev) => {
        const index = prev.findIndex((c) => c.id === payload.conversation_id);
        const isMine = payload.message.sender_id === user.id;
        const lastMessage = {
          type: payload.message.message_type,
          text: payload.message.message_text || '',
          sender_id: payload.message.sender_id,
          created_at: payload.message.created_at,
        };

        if (index === -1) {
          if (payload.message.sender) {
            return [
              {
                id: payload.conversation_id,
                updated_at: payload.message.created_at,
                other_user: payload.message.sender,
                last_message: lastMessage,
                unread_count: isMine ? 0 : 1,
              },
              ...prev,
            ];
          }
          refresh();
          return prev;
        }

        const updated = [...prev];
        const current = updated[index];
        updated[index] = {
          ...current,
          last_message: lastMessage,
          unread_count: isMine ? current.unread_count : current.unread_count + 1,
        };
        updated.unshift(updated.splice(index, 1)[0]);
        return updated;
      });
    };

    const onPresence = (payload: { user_id: number; is_online: boolean }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.other_user.id === payload.user_id
            ? { ...c, other_user: { ...c.other_user, is_online: payload.is_online } }
            : c
        )
      );
    };

    const onSeen = (payload: { conversation_id: number; marked_by_me?: boolean }) => {
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

  const markRead = useCallback((conversationId: number) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
    );
  }, []);

  const value = useMemo(
    () => ({ conversations, loading, refresh, markRead }),
    [conversations, loading, refresh, markRead]
  );

  return <ConversationsContext.Provider value={value}>{children}</ConversationsContext.Provider>;
}

export function useConversations(): ConversationsContextValue {
  const context = useContext(ConversationsContext);
  if (!context) throw new Error('useConversations must be used within ConversationsProvider');
  return context;
}
