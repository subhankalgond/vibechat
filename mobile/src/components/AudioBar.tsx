import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { colors } from '../theme';

interface Props {
  uri: string;
  mine: boolean;
}

/** Small play/pause audio player used for voice messages in the chat. */
export default function AudioBar({ uri, mine }: Props) {
  const player = useAudioPlayer({ uri }, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  const playing = status.playing;
  const positionMs = (status.currentTime || 0) * 1000;
  const durationMs = (status.duration || 0) * 1000;

  useEffect(() => {
    return () => {
      try {
        player.release();
      } catch {
        // already released
      }
    };
  }, [player]);

  async function toggle() {
    try {
      await setAudioModeAsync({ playsInSilentMode: true });
      if (playing) {
        player.pause();
        return;
      }
      if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration)) {
        player.seekTo(0);
      }
      player.play();
    } catch {
      // playback errors are non-fatal for the UI
    }
  }

  function fmt(ms: number): string {
    const total = Math.floor(ms / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  const progress = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
  const accent = mine ? '#ffffff' : colors.primary;

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={toggle}
        style={[styles.playBtn, { borderColor: mine ? 'rgba(255,255,255,0.5)' : colors.border }]}
      >
        <Text style={[styles.playIcon, { color: mine ? '#ffffff' : colors.primary }]}>
          {playing ? '❚❚' : '▶'}
        </Text>
      </TouchableOpacity>

      <View style={styles.trackWrap}>
        <View style={[styles.track, { backgroundColor: mine ? 'rgba(255,255,255,0.25)' : colors.border }]}>
          <View style={[styles.fill, { backgroundColor: accent, width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={[styles.time, { color: mine ? 'rgba(255,255,255,0.8)' : colors.textMuted }]}>
          {fmt(durationMs || 0)}
</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 4,
    minWidth: 200,
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 13,
    fontWeight: '700',
  },
  trackWrap: {
    flex: 1,
    flexDirection: 'row',
  alignItems: 'center',
    gap: 8,
  },
  track: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  time: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
});
