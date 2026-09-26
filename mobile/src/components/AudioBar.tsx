import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Audio } from 'expo-av';
import { colors } from '../theme';

interface Props {
  uri: string;
  mine: boolean;
}

/** Small play/pause audio player used for voice messages in the chat. */
export default function AudioBar({ uri, mine }: Props) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  async function toggle() {
    try {
      if (!soundRef.current) {
        setLoading(true);
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { progressUpdateIntervalMillis: 250 },
          (status) => {
            if (status.isLoaded) {
              setPositionMs(status.positionMillis || 0);
              if (status.durationMillis) setDurationMs(status.durationMillis);
              if (status.didJustFinish) {
                setPlaying(false);
                setPositionMs(0);
                sound.getStatusAsync().then((s) => {
                  if (s.isLoaded) sound.setPositionAsync(0).catch(() => {});
                });
              }
            }
          }
        );
        soundRef.current = sound;
        setLoading(false);
        await sound.playAsync();
        setPlaying(true);
        return;
      }

      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) return;
      if (playing) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
      } else {
        const finished =
          status.didJustFinish ||
          (status.durationMillis != null && status.positionMillis >= status.durationMillis);
        if (finished) {
          await soundRef.current.replayAsync();
        } else {
          await soundRef.current.playAsync();
        }
        setPlaying(true);
      }
    } catch {
      setLoading(false);
      setPlaying(false);
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
      <TouchableOpacity onPress={toggle} disabled={loading} style={[styles.playBtn, { borderColor: mine ? 'rgba(255,255,255,0.5)' : colors.border }]}>
        <Text style={[styles.playIcon, { color: mine ? '#ffffff' : colors.primary }]}>
          {loading ? '…' : playing ? '❚❚' : '▶'}
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
