import React, { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, TouchableOpacity, View } from 'react-native';

import ChatsScreen from '../screens/ChatsScreen';
import SearchScreen from '../screens/SearchScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors, spacing } from '../theme';
import { useConversations } from '../context/ConversationsContext';

type TabKey = 'Chats' | 'Search' | 'Profile';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'Chats', label: 'Chats' },
  { key: 'Search', label: 'Search' },
  { key: 'Profile', label: 'Profile' },
];

function TabContent({ tab }: { tab: TabKey }) {
  if (tab === 'Search') return <SearchScreen />;
  if (tab === 'Profile') return <ProfileScreen />;
  return <ChatsScreen />;
}

/**
 * A minimal custom bottom tab bar. Avoids adding a full tab library while
 * keeping the three top-level destinations: Chats, Search, Profile.
 */
export function createBottomTabHelper() {
  return function BottomTabs() {
    const [tab, setTab] = useState<TabKey>('Chats');
    const { conversations } = useConversations();
    const unreadTotal = conversations.reduce((sum, c) => sum + c.unread_count, 0);

    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1 }}>
          <TabContent tab={tab} />
        </View>
        <View style={tabStyles.bar}>
          {TABS.map((entry) => {
            const active = entry.key === tab;
            return (
              <TouchableOpacity
                key={entry.key}
                style={tabStyles.tab}
                onPress={() => setTab(entry.key)}
              >
                <View style={{ alignItems: 'center' }}>
                  <Text style={[tabStyles.label, active && tabStyles.labelActive]}>
                    {entry.label}
                  </Text>
                  {entry.key === 'Chats' && unreadTotal > 0 ? (
                    <View style={tabStyles.dot} />
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };
}

const tabStyles = {
  bar: {
    flexDirection: 'row' as const,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    paddingVertical: 10,
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },
  tab: {
    flex: 1,
    alignItems: 'center' as const,
    paddingVertical: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.primary,
  },
  dot: {
    position: 'absolute' as const,
    top: -2,
    right: -10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
};
