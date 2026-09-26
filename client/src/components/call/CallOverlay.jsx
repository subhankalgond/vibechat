import { useEffect, useRef } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { useCall } from '../../context/CallContext';

function Avatar({ user, size = 96 }) {
  if (user && user.profile_image) {
    return (
      <img
        src={user.profile_image}
        alt={user.full_name || user.username}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const initial = ((user && (user.full_name || user.username)) || '?').charAt(0).toUpperCase();
  return (
    <span
      className="flex items-center justify-center rounded-full bg-primary-600 font-semibold text-white"
      style={{ width: size, height: size, fontSize: size / 2.4 }}
    >
      {initial}
    </span>
  );
}

function RoundButton({ onClick, label, danger, active = true, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
        danger
          ? 'bg-red-500 text-white hover:bg-red-600'
          : active
            ? 'bg-white/15 text-white hover:bg-white/25'
            : 'bg-white text-neutral-900'
      }`}
    >
      {children}
    </button>
  );
}

export default function CallOverlay() {
  const { incoming, active, micOn, camOn, acceptCall, rejectCall, endCall, toggleMic, toggleCam } = useCall();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localAudioRef = useRef(null);

  const call = active;
  const isVideo = call && call.callType === 'video';

  // Keep <video> elements in sync with their streams (re-runs when streams change).
  useEffect(() => {
    if (remoteVideoRef.current && call && call.remoteStream) {
      if (remoteVideoRef.current.srcObject !== call.remoteStream) {
        remoteVideoRef.current.srcObject = call.remoteStream;
      }
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [call]);

  useEffect(() => {
    if (localVideoRef.current && call && call.localStream && isVideo) {
      if (localVideoRef.current.srcObject !== call.localStream) {
        localVideoRef.current.srcObject = call.localStream;
      }
      localVideoRef.current.play().catch(() => {});
    }
  }, [call, isVideo]);

  if (!incoming && !call) return null;

  // ---------- Incoming ring ----------
  if (incoming && !call) {
    const name = incoming.from.full_name || incoming.from.username;
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-neutral-950/95 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary-500/30" aria-hidden="true" />
            <Avatar user={incoming.from} size={104} />
          </div>
          <p className="mt-2 text-xl font-semibold text-white">{name}</p>
          <p className="flex items-center gap-2 text-sm text-neutral-300">
            {incoming.callType === 'video' ? <Video size={15} /> : <Phone size={15} />}
            Incoming {incoming.callType} call...
          </p>
          <div className="mt-8 flex items-center gap-10">
            <button
              type="button"
              onClick={rejectCall}
              aria-label="Decline call"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-600"
            >
              <PhoneOff size={22} />
            </button>
            <button
              type="button"
              onClick={() => acceptCall()}
              aria-label="Accept call"
              className="flex h-14 w-14 animate-bounce items-center justify-center rounded-full bg-green-500 text-white transition hover:bg-green-600"
            >
              <Phone size={22} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Active call ----------
  const stateLabel =
    call.state === 'calling'
      ? 'Ringing...'
      : call.state === 'connecting'
        ? 'Connecting...'
        : call.state === 'connected'
          ? isVideo
            ? 'Video call'
            : 'Voice call'
          : call.state === 'disconnected'
            ? 'Reconnecting...'
            : 'Call';

  return (
    <div className="fixed inset-0 z-[100] bg-neutral-950 text-white">
      {/* Remote media: full-screen video on video calls; hidden sink that still plays audio on voice calls */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={isVideo ? 'absolute inset-0 h-full w-full bg-black object-cover' : 'hidden'}
      />

      {/* Voice-call backdrop with avatar */}
      {!isVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-neutral-900 to-neutral-950">
          <Avatar user={call.peer} size={128} />
          <p className="text-2xl font-semibold">{call.peer.full_name || call.peer.username}</p>
          <p className="text-sm text-neutral-400">{stateLabel}</p>
        </div>
      )}

      {/* Header for video calls */}
      {isVideo && (
        <div className="absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-sm backdrop-blur">
          {call.peer.full_name || call.peer.username} · {stateLabel}
        </div>
      )}

      {/* Local camera preview (picture-in-picture) */}
      {isVideo && <video ref={localVideoRef} autoPlay muted playsInline className="absolute right-4 top-4 z-10 h-32 w-24 rounded-xl border border-white/20 bg-black object-cover shadow-lg sm:h-48 sm:w-36" />}

      {/* Controls */}
      <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 items-center gap-5">
        <RoundButton onClick={toggleMic} label={micOn ? 'Mute microphone' : 'Unmute microphone'} active={micOn}>
          {micOn ? <Mic size={20} /> : <MicOff size={20} />}
        </RoundButton>

        {isVideo && (
          <RoundButton onClick={toggleCam} label={camOn ? 'Turn camera off' : 'Turn camera on'} active={camOn}>
            {camOn ? <Video size={20} /> : <VideoOff size={20} />}
          </RoundButton>
        )}

        <RoundButton onClick={() => endCall('hangup')} label="End call" danger>
          <PhoneOff size={22} />
        </RoundButton>
      </div>

      {/* Error / failure notice */}
      {call.state === 'failed' && (
        <div className="absolute top-16 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-red-500/90 px-4 py-2 text-sm">
          Call failed
        </div>
      )}
    </div>
  );
}
