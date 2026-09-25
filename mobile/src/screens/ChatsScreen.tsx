import React, { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useConversations, Conversation } from '../context/ConversationsContext';
import { useAuth } from '../context/AuthContext';
import { Avatar, UnreadBadge } from '../components/ui';
import { colors, radius, spacing } from '../theme';

function previewText(conversation: Conversation, currentUserId: number): string {
  const last = conversation.last_message;
  if (!last) return 'No messages yet';
  const prefix = last.sender_id === currentUserId ? 'You: ' : '';
  if (last.type === 'image') return `${prefix}Photo`;
  if (last.type === 'video') return `${prefix}Video`;
  return `${prefix}${last.text}`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ChatsScreen() {
  const { conversations, loading, refresh } = useConversations();
  const { user } = useAuth();
  const [filter, setFilter] = useState('');
  const navigation = useNavigation<any>();

  const filtered = conversations.filter((c) => {
    const term = filter.trim().toLowerCase();
    if (!term) return true;
    return (
      c.other_user.username.toLowerCase().includes(term) ||
      c.other_user.full_name.toLowerCase().includes(term)
    );
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
        <TextInput
          value={filter}
          onChangeText={setFilter}
          placeholder="Filter conversations"
          placeholderTextColor={colors.textFaint}
          style={styles.search}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.textMuted} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyText}>
              Search for someone by username and start your first conversation.
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('Search')}>
              <Text style={styles.emptyButtonText}>Find people</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('Chat', { conversationId: item.id, otherUser: item.other_user })}
          >
            <Avatar fullName={item.other_user.full_name} uri={item.other_user.profile_image} size={50} online={item.other_user.is_online} />
            <View style={styles.rowMain}>
              <View style={styles.rowTop}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.other_user.full_name}
                </Text>
                {item.last_message ? (
                  <Text style={styles.time}>{formatTime(item.last_message.created_at)}</Text>
                ) : null}
              </View>
              <View style={styles.rowBottom}>
                <Text
                  style={[styles.preview, item.unread_count > 0 && styles.previewUnread]}
                  numberOfLines={1}
                >
                  {previewText(item, user?.id ?? 0)}
                </Text>
                <UnreadBadge count={item.unread_count} />
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
  },
  search: {
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 78,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    gap: spacing.md,
  },
  rowMain: {
    flex: 1,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  time: {
    fontSize: 12,
    color: colors.textFaint,
  },
  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  preview: {
    fontSize: 14,
    color: colors.textMuted,
    flex: 1,
  },
  previewUnread: {
    color: colors.text,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 18,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
} as const);
