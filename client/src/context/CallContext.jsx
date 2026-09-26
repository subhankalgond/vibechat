import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getSocket } from '../services/socket';
import { createPeerConnection, getLocalMedia, stopStream } from '../services/webrtc';

const CallContext = createContext(null);

let nextCallId = 1;

export function CallProvider({ children }) {
  // Ringing = someone is calling us. Active = we are in a call.
  const [incoming, setIncoming] = useState(null); // { callId, conversationId, callType, sdp, from }
  const [active, setActive] = useState(null); // { callId, callType, peer, role, state }
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const callMetaRef = useRef(null); // { callId, peerId, role, conversationId, callType }
  const seenIncomingRef = useRef(new Set());

  const teardown = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      try {
        pcRef.current.close();
      } catch {
        // already closed
      }
      pcRef.current = null;
    }
    stopStream(localStreamRef.current);
    localStreamRef.current = null;
    pendingCandidatesRef.current = [];
    callMetaRef.current = null;
    setIncoming(null);
    setActive(null);
    setMicOn(true);
    setCamOn(true);
  }, []);

  const endCall = useCallback(
    (reason = 'hangup') => {
      const meta = callMetaRef.current;
      if (meta && meta.peerId != null) {
        const socket = getSocket();
        if (socket) {
          socket.emit('call:end', { to_user_id: meta.peerId, call_id: meta.callId, reason });
        }
      }
      teardown();
    },
    [teardown]
  );

  const buildPeer = useCallback((callType, onTrackCb) => {
    const pc = createPeerConnection({
      onIceCandidate: (candidate) => {
        const meta = callMetaRef.current;
        if (!meta || meta.peerId == null) return;
        getSocket()?.emit('call:ice-candidate', {
          to_user_id: meta.peerId,
          call_id: meta.callId,
          candidate,
        });
      },
      onConnectionState: (state) => {
        setActive((prev) => (prev ? { ...prev, state } : prev));
        if (state === 'failed' || state === 'closed' || state === 'disconnected') {
          // Give ICE a moment to recover before tearing down on transient drops.
          if (state !== 'disconnected') teardown();
        }
      },
    });

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream && onTrackCb) onTrackCb(remoteStream);
    };

    localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
    return pc;
  }, [teardown]);

  // ---------- Caller side ----------
  const startCall = useCallback(
    async (conversationId, peerUser, callType) => {
      if (callMetaRef.current || incoming) {
        return { ok: false, error: 'Already in a call' };
      }
      try {
        const stream = await getLocalMedia(callType);
        localStreamRef.current = stream;
        const callId = `c${Date.now()}_${nextCallId++}`;
        callMetaRef.current = {
          callId,
          peerId: peerUser.id,
          role: 'caller',
          conversationId,
          callType,
        };
        setActive({
          callId,
          callType,
          peer: peerUser,
          role: 'caller',
          state: 'calling',
          localStream: stream,
        });
        setMicOn(true);
        setCamOn(callType === 'video');

        const pc = buildPeer(callType, () => {
          setActive((prev) => (prev ? { ...prev, remoteStream: prev.remoteStream } : prev));
        });

        // Keep remote stream on a ref + force re-render via state patch.
        pc.ontrack = (event) => {
          const [remoteStream] = event.streams;
          if (remoteStream) {
            setActive((prev) => (prev ? { ...prev, remoteStream } : prev));
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const socket = getSocket();
        const ack = await new Promise((resolve) => {
          socket.timeout(10000).emit('call:offer', { conversation_id: conversationId, call_type: callType, sdp: offer.sdp }, (err) => {
            resolve(err ? { success: false, message: 'User is offline' } : { success: true });
          });
        });

        if (!ack.success) {
          teardown();
          return { ok: false, error: ack.message || 'User is offline' };
        }
        return { ok: true };
      } catch (error) {
        teardown();
        return { ok: false, error: error.message || 'Could not start the call' };
      }
    },
    [buildPeer, incoming, teardown]
  );

  // ---------- Callee side ----------
  const acceptCall = useCallback(async () => {
    const invite = incoming;
    if (!invite || callMetaRef.current) return { ok: false, error: 'No call' };
    try {
      const stream = await getLocalMedia(invite.callType);
      localStreamRef.current = stream;
      callMetaRef.current = {
        callId: invite.callId,
        peerId: invite.from.id,
        role: 'callee',
        conversationId: invite.conversationId,
        callType: invite.callType,
      };
      setActive({
        callId: invite.callId,
        callType: invite.callType,
        peer: invite.from,
        role: 'callee',
        state: 'connecting',
        localStream: stream,
      });
      setIncoming(null);
      setMicOn(true);
      setCamOn(invite.callType === 'video');

      const pc = buildPeer(invite.callType);
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteStream) {
          setActive((prev) => (prev ? { ...prev, remoteStream } : prev));
        }
      };

      await pc.setRemoteDescription({ type: 'offer', sdp: invite.sdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Flush ICE candidates that arrived before the answer was ready.
      const pending = pendingCandidatesRef.current;
      pendingCandidatesRef.current = [];
      for (const candidate of pending) {
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          // stale candidate; ignore
        }
      }

      getSocket()?.emit('call:answer', {
        to_user_id: invite.from.id,
        call_id: invite.callId,
        sdp: answer.sdp,
      });
      return { ok: true };
    } catch (error) {
      endCall('failed');
      return { ok: false, error: error.message || 'Could not join the call' };
    }
  }, [buildPeer, endCall, incoming]);

  const rejectCall = useCallback(() => {
    const invite = incoming;
    if (!invite) return;
    getSocket()?.emit('call:reject', { to_user_id: invite.from.id, call_id: invite.callId });
    setIncoming(null);
    seenIncomingRef.current.add(invite.callId);
  }, [incoming]);

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  }, []);

  const toggleCam = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  }, []);

  // ---------- Signaling listeners ----------
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const onIncoming = (payload) => {
      if (!payload || seenIncomingRef.current.has(payload.call_id)) return;
      if (callMetaRef.current) {
        // Busy: auto-reject so the caller hears the decline.
        socket.emit('call:reject', { to_user_id: payload.from.id, call_id: payload.call_id });
        return;
      }
      setIncoming({
        callId: payload.call_id,
        conversationId: payload.conversation_id,
        callType: payload.call_type,
        sdp: payload.sdp,
        from: payload.from,
      });
    };

    const onAnswered = async (payload) => {
      const meta = callMetaRef.current;
      if (!meta || meta.role !== 'caller' || payload.call_id !== meta.callId) return;
      try {
        const pc = pcRef.current;
        if (!pc) return;
        await pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
        const pending = pendingCandidatesRef.current;
        pendingCandidatesRef.current = [];
        for (const candidate of pending) {
          try {
            await pc.addIceCandidate(candidate);
          } catch {
            // ignore stale
          }
        }
      } catch {
        endCall('failed');
      }
    };

    const onIce = (payload) => {
      const meta = callMetaRef.current;
      if (!meta || payload.call_id !== meta.callId) return;
      const candidate = payload.candidate;
      if (!candidate) return;
      const pc = pcRef.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        pc.addIceCandidate(candidate).catch(() => {});
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    const onRejected = (payload) => {
      const meta = callMetaRef.current;
      if (meta && payload.call_id === meta.callId) {
        teardown();
      } else {
        seenIncomingRef.current.add(payload.call_id);
      }
    };

    const onEnded = (payload) => {
      const meta = callMetaRef.current;
      if (meta && payload.call_id === meta.callId) {
        teardown();
      } else {
        seenIncomingRef.current.add(payload.call_id);
        setIncoming((prev) => (prev && prev.callId === payload.call_id ? null : prev));
      }
    };

    socket.on('call:incoming', onIncoming);
    socket.on('call:answered', onAnswered);
    socket.on('call:ice', onIce);
    socket.on('call:rejected', onRejected);
    socket.on('call:ended', onEnded);
    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:answered', onAnswered);
      socket.off('call:ice', onIce);
      socket.off('call:rejected', onRejected);
      socket.off('call:ended', onEnded);
    };
  }, [endCall, teardown]);

  // Hang up if the user logs out (socket gone).
  useEffect(() => {
    if (!getSocket()) teardown();
  }, [teardown]);

  const value = useMemo(
    () => ({
      incoming,
      active,
      micOn,
      camOn,
      startCall,
      acceptCall,
      rejectCall,
      endCall,
      toggleMic,
      toggleCam,
    }),
    [incoming, active, micOn, camOn, startCall, acceptCall, rejectCall, endCall, toggleMic, toggleCam]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used inside CallProvider');
  return ctx;
}
