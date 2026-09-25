import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useConversations, OtherUser } from '../context/ConversationsContext';
import { Avatar } from '../components/ui';
import { colors, radius, spacing } from '../theme';

interface SearchUser extends OtherUser {
  bio: string | null;
}

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [starting, setStarting] = useState<number | null>(null);
  const { token } = useAuth();
  const { refresh } = useConversations();
  const navigation = useNavigation<any>();

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setUsers([]);
      setSearching(false);
      setSearched(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.get<{ users: SearchUser[] }>(
          `/users/search?q=${encodeURIComponent(term)}`,
          token
        );
        setUsers(data.users);
        setSearched(true);
      } catch {
        setUsers([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, token]);

  async function handleMessage(target: SearchUser) {
    if (starting) return;
    setStarting(target.id);
    try {
      const data = await api.post<{ id: number }>('/conversations', { username: target.username }, token);
      refresh();
      navigation.navigate('Chat', { conversationId: data.id, otherUser: target });
    } catch {
      // keep the user on this screen on failure
    } finally {
      setStarting(null);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search username, e.g. sub"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.search}
          autoFocus
        />
      </View>

      {searching ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>
                {!query.trim() ? 'Find people' : searched ? 'No users found' : 'Type to search'}
              </Text>
              <Text style={styles.emptyText}>
                {!query.trim()
                  ? 'Search by username. Partial matches work too, so "sub" finds @subhan.'
                  : searched
                  ? `No one matches "${query.trim()}".`
                  : 'Results appear here.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Avatar fullName={item.full_name} uri={item.profile_image} size={48} online={item.is_online} />
              <View style={styles.rowMain}>
                <Text style={styles.name} numberOfLines={1}>{item.full_name}</Text>
                <Text style={styles.username} numberOfLines={1}>@{item.username}</Text>
              </View>
              <TouchableOpacity
                style={[styles.messageButton, starting === item.id && { opacity: 0.6 }]}
                onPress={() => handleMessage(item)}
                disabled={starting === item.id}
              >
                <Text style={styles.messageButtonText}>Message</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
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
  center: {
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
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowMain: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  username: {
    fontSize: 13,
    color: colors.textMuted,
  },
  messageButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  messageButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
} as const);
