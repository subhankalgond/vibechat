import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';

const MAX_MS = 5 * 60 * 1000; // 5 minute cap, mirrors the web app

export interface VoiceRecording {
  uri: string;
  durationMs: number;
}

/**
 * Voice recording via expo-audio (expo-av was removed from the Expo SDK).
 * HIGH_QUALITY records AAC in an m4a container, which the server's audio
 * upload endpoint accepts out of the box.
 */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);
  const finishRef = useRef<((cancel: boolean) => Promise<VoiceRecording | null>) | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Stops (and optionally keeps) the current recording. Assigned to finishRef
  // so the max-duration timer can call it before `stop` is defined below.
  const finish = useCallback(
    async (cancel: boolean): Promise<VoiceRecording | null> => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const elapsed = Date.now() - startRef.current;
      setRecording(false);
      try {
        await recorder.stop();
        const uri = recorder.uri;
        if (cancel || !uri || elapsed < 500) return null;
        try {
          await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        } catch {
          // ignore mode reset failure
        }
        return { uri, durationMs: elapsed };
      } catch {
        return null;
      }
    },
    [recorder]
  );

  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  const start = useCallback(async (): Promise<boolean> => {
    if (recording || preparing) return false;
    setPreparing(true);
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) return false;

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
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
  }, [recording, preparing, recorder]);

  const stop = useCallback(
    async (cancel: boolean): Promise<VoiceRecording | null> => {
      return finish(cancel);
    },
    [finish]
  );

  return { recording, preparing, seconds, start, stop };
}
