import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';

import { useAuth } from '../context/AuthContext';
import { useConversations, OtherUser } from '../context/ConversationsContext';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { Avatar } from '../components/ui';
import AudioBar from '../components/AudioBar';
import { useVoiceRecorder, VoiceRecording } from '../hooks/useVoiceRecorder';
import { colors, radius, spacing } from '../theme';

interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  message_type: string;
  message_text: string;
  media_url: string | null;
  created_at: string;
  delivered_at: string | null;
  seen_at: string | null;
  is_mine: boolean;
}

function Ticks({ message }: { message: Message }) {
  if (!message.is_mine) return null;
  if (message.seen_at) {
    return <Text style={styles.tickSeen}>✓✓</Text>;
  }
  if (message.delivered_at) {
    return <Text style={styles.tickDelivered}>✓✓</Text>;
  }
  return <Text style={styles.tickSent}>✓</Text>;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const conversationId: number = route.params.conversationId;
  const initialOther: OtherUser | undefined = route.params.otherUser;

  const { user } = useAuth();
  const { markRead } = useConversations();

  const [otherUser, setOtherUser] = useState<OtherUser | null>(initialOther || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [voiceNote, setVoiceNote] = useState<VoiceRecording | null>(null);
  const voice = useVoiceRecorder();
  const listRef = useRef<FlatList<Message>>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load history + header.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [convo, msgs] = await Promise.all([
          api.get<{ other_user: OtherUser }>(`/conversations/${conversationId}`, user ? undefined : null),
          api.get<{ messages: Message[] }>(`/messages/${conversationId}`, undefined),
        ]);
        if (cancelled) return;
        setOtherUser(convo.other_user);
        setMessages(msgs.messages);
      } catch (error) {
        if (!cancelled) {
          setMessages([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Join room, mark seen, listen for realtime events.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    socket.emit('conversation:join', { conversation_id: conversationId });
    socket.emit('message:seen', { conversation_id: conversationId });
    markRead(conversationId);

    const onNewMessage = (payload: { conversation_id: number; message: Message }) => {
      if (payload.conversation_id !== conversationId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.message.id)) return prev;
        return [...prev, payload.message];
      });
      if (payload.message.sender_id !== user?.id) {
        socket.emit('message:seen', { conversation_id: conversationId });
        markRead(conversationId);
      }
    };

    const onSeen = (payload: { conversation_id: number; message_id: number; seen_at: string }) => {
      if (payload.conversation_id !== conversationId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.message_id && !m.seen_at ? { ...m, seen_at: payload.seen_at } : m
        )
      );
    };

    const onDelivered = (payload: { conversation_id: number; message_id: number; delivered_at: string }) => {
      if (payload.conversation_id !== conversationId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.message_id && !m.delivered_at ? { ...m, delivered_at: payload.delivered_at } : m
        )
      );
    };

    const onTypingStart = (payload: { conversation_id: number; user_id: number }) => {
      if (payload.conversation_id === conversationId && payload.user_id !== user?.id) setTyping(true);
    };
    const onTypingStop = (payload: { conversation_id: number; user_id: number }) => {
      if (payload.conversation_id === conversationId && payload.user_id !== user?.id) setTyping(false);
    };

    socket.on('message:new', onNewMessage);
    socket.on('message:seen', onSeen);
    socket.on('message:delivered', onDelivered);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('message:seen', onSeen);
      socket.off('message:delivered', onDelivered);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
    };
  }, [conversationId, user?.id, markRead]);

  const send = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    try {
      const data = await api.post<{ message: Message }>(
        '/messages',
        { conversation_id: conversationId, message_type: 'text', message_text: trimmed },
        undefined
      );
      setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
      const socket = getSocket();
      if (socket) socket.emit('typing:stop', { conversation_id: conversationId });
    } catch (error) {
      setText(trimmed);
    } finally {
      setSending(false);
    }
  }, [text, sending, conversationId]);

  function handleTextChange(value: string) {
    setText(value);
    const socket = getSocket();
    if (!socket || !value.trim()) return;
    socket.emit('typing:start', { conversation_id: conversationId });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit('typing:stop', { conversation_id: conversationId });
    }, 2500);
  }

  async function sendVoiceNote() {
    if (!voiceNote || sendingVoice) return;
    setSendingVoice(true);
    try {
      const media = await api.upload<{ media_url: string; media_type: string }>(
        '/upload/audio',
        voiceNote.uri,
        'audio',
        `voice-note-${Date.now()}.m4a`,
        'audio/aac'
      );
      const data = await api.post<{ message: Message }>(
        '/messages',
        {
          conversation_id: conversationId,
          message_type: 'audio',
          message_text: '',
          media,
        },
        undefined
      );
      setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
      setVoiceNote(null);
    } catch {
      // keep the note so the user can retry
    } finally {
      setSendingVoice(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>{'‹'}</Text>
        </TouchableOpacity>
        {otherUser ? (
          <View style={styles.headerUser}>
            <Avatar fullName={otherUser.full_name} uri={otherUser.profile_image} size={38} online={otherUser.is_online} />
            <View style={{ flex: 1 }}>
              <Text style={styles.headerName} numberOfLines={1}>{otherUser.full_name}</Text>
              <Text style={[styles.headerStatus, typing && { color: colors.primary }]}>
                {typing ? 'typing...' : otherUser.is_online ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => String(item.id)}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Start the conversation</Text>
            <Text style={styles.emptyText}>Send a message to say hello.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.bubbleRow, item.is_mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
            <View style={[styles.bubble, item.is_mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              {item.message_type === 'audio' && item.media_url ? (
                <AudioBar uri={item.media_url} mine={item.is_mine} />
              ) : (
                <Text style={[styles.bubbleText, item.is_mine && { color: '#ffffff' }]}>
                  {item.message_type === 'text' || !item.message_text
                    ? item.message_text || ''
                    : `${item.message_type === 'image' ? '📷 Photo' : '🎬 Video'}${item.message_text ? `: ${item.message_text}` : ''}`}
                </Text>
              )}
              <View style={styles.metaRow}>
                <Text style={[styles.metaText, item.is_mine && { color: 'rgba(255,255,255,0.7)' }]}>
                  {formatTime(item.created_at)}
                </Text>
                <Ticks message={item} />
              </View>
            </View>
          </View>
        )}
      />

      {typing ? (
        <View style={styles.typingRow}>
          <Text style={styles.typingText}>{otherUser?.full_name || 'They'} is typing...</Text>
        </View>
      ) : null}

      <View style={styles.composer}>
        {voice.recording ? (
          <View style={styles.recordBar}>
            <View style={styles.recordDot} />
            <Text style={styles.recordTime}>
              {Math.floor(voice.seconds / 60)}:{String(voice.seconds % 60).padStart(2, '0')}
            </Text>
            <Text style={styles.recordLabel}>Recording voice note...</Text>
            <TouchableOpacity onPress={() => void voice.stop(true)} style={styles.recordCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.recordCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                const note = await voice.stop(false);
                if (note) setVoiceNote(note);
              }}
              style={styles.recordStop}
            >
              <Text style={styles.recordStopText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : voiceNote ? (
          <View style={styles.recordBar}>
            <Text style={styles.recordLabel}>Voice note ready</Text>
            <TouchableOpacity
              onPress={() => setVoiceNote(null)}
              disabled={sendingVoice}
              style={[styles.recordCancel, sendingVoice && { opacity: 0.4 }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.recordCancelText}>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void sendVoiceNote()}
              disabled={sendingVoice}
              style={[styles.recordStop, sendingVoice && { opacity: 0.6 }]}
            >
              <Text style={styles.recordStopText}>{sendingVoice ? 'Sending...' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TextInput
              value={text}
              onChangeText={handleTextChange}
              placeholder="Type a message..."
              placeholderTextColor={colors.textFaint}
              multiline
              style={styles.input}
            />
            {text.trim() ? (
              <TouchableOpacity
                onPress={send}
                disabled={!text.trim() || sending}
                style={[styles.sendButton, (!text.trim() || sending) && { opacity: 0.4 }]}
              >
                <Text style={styles.sendText}>{'➤'}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={async () => {
                  const ok = await voice.start();
                  if (!ok) {
                    // Permission denied or recorder busy; nothing else to do here.
                  }
                }}
                disabled={voice.preparing || sendingVoice}
                style={[styles.sendButton, (voice.preparing || sendingVoice) && { opacity: 0.4 }]}
              >
                <Text style={styles.sendText}>{'🎙'}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  back: {
    fontSize: 30,
    lineHeight: 34,
    color: colors.primary,
    paddingHorizontal: 6,
  },
  headerUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  headerName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  headerStatus: {
    fontSize: 12,
    color: colors.textMuted,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 8,
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleMine: {
    backgroundColor: colors.bubbleMine,
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: {
    backgroundColor: colors.bubbleTheirs,
    borderBottomLeftRadius: 6,
  },
  bubbleText: {
    fontSize: 15,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontSize: 10,
    color: colors.textFaint,
  },
  tickSent: {
    fontSize: 10,
    color: colors.textFaint,
  },
  tickDelivered: {
    fontSize: 10,
    color: colors.textFaint,
  },
  tickSeen: {
    fontSize: 10,
    color: '#38bdf8',
    fontWeight: '700',
  },
  typingRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 4,
  },
  typingText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 42,
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: colors.text,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    color: '#ffffff',
    fontSize: 16,
  },
  recordBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 42,
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 21,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  recordDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
  },
  recordTime: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ef4444',
    fontVariant: ['tabular-nums'],
  },
  recordLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.textMuted,
  },
  recordCancel: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  recordCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  recordStop: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  recordStopText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 120,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
} as const);
