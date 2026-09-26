import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';

const MAX_MS = 5 * 60 * 1000; // 5 minute cap, mirrors the web app

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
  },
  web: {
    mimeType: 'audio/webm',
  },
};

export interface VoiceRecording {
  uri: string;
  durationMs: number;
}

/**
 * Voice recording via expo-av. Records AAC in an m4a container, which the
 * server's audio upload endpoint accepts out of the box.
 */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);

  const finishRef = useRef<((cancel: boolean) => Promise<VoiceRecording | null>) | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recRef.current) {
        recRef.current.stopAndUnloadAsync().catch(() => {});
        recRef.current = null;
      }
    };
  }, []);

  // Stops (and optionally keeps) the current recording. Assigned to finishRef
  // so the max-duration timer can call it before `stop` is defined below.
  const finish = useCallback(async (cancel: boolean): Promise<VoiceRecording | null> => {
    const rec = recRef.current;
    if (!rec) return null;
    recRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const elapsed = Date.now() - startRef.current;
    setRecording(false);
    try {
      if (cancel) {
        await rec.stopAndUnloadAsync();
        return null;
      }
      const result = await rec.stopAndUnloadAsync();
      const uri = result?.uri || rec.getURI() || null;
      if (!uri || elapsed < 500) return null;
      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      } catch {
        // ignore mode reset failure
      }
      return { uri, durationMs: elapsed };
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  const start = useCallback(async (): Promise<boolean> => {
    if (recording || preparing) return false;
    setPreparing(true);
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return false;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: rec } = await Audio.Recording.createAsync(
        RECORDING_OPTIONS,
        (status) => {
          if (status.durationMillis != null) {
            setSeconds(Math.floor(status.durationMillis / 1000));
          }
        },
        250
      );
      recRef.current = rec;
      startRef.current = Date.now();
      setSeconds(0);
      setRecording(true);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
        setSeconds(elapsed);
        if (elapsed * 1000 >= MAX_MS && finishRef.current) {
          void finishRef.current(false);
        }
      }, 250);
      return true;
    } catch {
      return false;
    } finally {
      setPreparing(false);
    }
  }, [recording, preparing]);

  const stop = useCallback(
    async (cancel: boolean): Promise<VoiceRecording | null> => {
      return finish(cancel);
    },
    [finish]
  );

  return { recording, preparing, seconds, start, stop };
}
