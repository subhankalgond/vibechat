// WebRTC helpers for 1-to-1 voice/video calls.
// Signaling travels over the existing authenticated Socket.IO connection;
// media connects browser-to-browser via ICE (STUN for NAT traversal).

export const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

/**
 * Create a peer connection with standard ICE servers.
 * @param {object} handlers { onIceCandidate, onConnectionState }
 */
export function createPeerConnection(handlers = {}) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  pc.onicecandidate = (event) => {
    if (event.candidate && handlers.onIceCandidate) {
      handlers.onIceCandidate(event.candidate);
    }
  };

  pc.onconnectionstatechange = () => {
    if (handlers.onConnectionState) handlers.onConnectionState(pc.connectionState);
  };

  return pc;
}

/**
 * Request local media for a call. Video calls request the camera;
 * voice calls request audio only.
 */
export async function getLocalMedia(callType) {
  const wantVideo = callType === 'video';
  const constraints = {
    audio: { echoCancellation: true, noiseSuppression: true },
    video: wantVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
  };
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    // Video call but camera blocked: fall back to audio-only so the call can continue.
    if (wantVideo) {
      return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
    throw error;
  }
}

/** Stop every track on a media stream (used on teardown). */
export function stopStream(stream) {
  if (stream) stream.getTracks().forEach((track) => track.stop());
}
