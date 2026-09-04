import { useCallback, useEffect, useState } from 'react';
import Avatar from '@components/Avatar';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  AlertCircle,
} from 'lucide-react';

// A callback ref, not useRef+useEffect: the ring/incoming screen renders no
// <video> tags at all, so the real element only mounts once the call
// reaches "connected" — by which point localStream/remoteStream were
// usually already set and don't change again, so a useEffect keyed on
// [stream] would never re-fire to attach it (this was the black-video bug).
// A callback ref re-runs on every mount AND whenever `stream` changes
// (since its identity is tied to `stream`), so it can't miss either case.
function useStreamRef(stream) {
  return useCallback((node) => {
    if (node) node.srcObject = stream || null;
  }, [stream]);
}

// Global call UI — rendered once from Layoute so an incoming call can be
// caught no matter which page/panel is currently open. `call` is the
// return value of useCall().
export default function CallModal({ call }) {
  const {
    status, peer, localStream, remoteStream, muted, cameraOff, error,
    acceptCall, rejectCall, endCall, toggleMute, toggleCamera,
  } = call;

  const localVideoRef = useStreamRef(localStream);
  const remoteVideoRef = useStreamRef(remoteStream);

  const [showError, setShowError] = useState(false);
  useEffect(() => {
    if (!error) return;
    setShowError(true);
    const timer = setTimeout(() => setShowError(false), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  if (status === 'idle') {
    return showError ? (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow-2xl backdrop-blur-sm">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>{error}</span>
      </div>
    ) : null;
  }

  const isVideo = peer?.callType === 'video';

  if (status === 'outgoing' || status === 'incoming') {
    const isIncoming = status === 'incoming';
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
        <div className="bg-[rgb(var(--bg-secondary))] rounded-2xl shadow-2xl border border-[rgb(var(--border-secondary))] max-w-sm w-full overflow-hidden animate-in fade-in zoom-in duration-300">
          <div className="px-6 py-8 flex flex-col items-center gap-3 text-center">
            <Avatar name={peer?.name} size="lg" />
            <h2 className="text-lg font-bold text-[rgb(var(--text-primary))]">{peer?.name}</h2>
            <p className="text-sm text-[rgb(var(--text-muted))]">
              {isIncoming
                ? `Incoming ${isVideo ? 'video' : 'voice'} call...`
                : `Calling${isVideo ? ' (video)' : ''}...`}
            </p>

            <div className="w-full flex items-center justify-center gap-4 mt-3">
              {isIncoming ? (
                <>
                  <button
                    onClick={rejectCall}
                    aria-label="Decline call"
                    className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </button>
                  <button
                    onClick={acceptCall}
                    aria-label="Accept call"
                    className="w-14 h-14 rounded-full bg-linear-to-r from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-white flex items-center justify-center transition-all shadow-lg glow-green"
                  >
                    {isVideo ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
                  </button>
                </>
              ) : (
                <button
                  onClick={endCall}
                  aria-label="Cancel call"
                  className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // status === 'connected'
  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col">
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {isVideo ? (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute bottom-4 right-4 w-28 sm:w-40 rounded-xl border border-white/20 shadow-2xl object-cover -scale-x-100"
            />
          </>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {/* No visible <video> in an audio-only call, but the remote
                stream still needs a media element attached or its audio
                track never plays. */}
            <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
            <Avatar name={peer?.name} size="lg" />
            <h2 className="text-xl font-bold text-white">{peer?.name}</h2>
            <p className="text-sm text-white/60">Call in progress</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-5 py-6 bg-black/40">
        <button
          onClick={toggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            muted ? 'bg-white text-black' : 'bg-white/15 text-white hover:bg-white/25'
          }`}
        >
          {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {isVideo && (
          <button
            onClick={toggleCamera}
            aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              cameraOff ? 'bg-white text-black' : 'bg-white/15 text-white hover:bg-white/25'
            }`}
          >
            {cameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        )}

        <button
          onClick={endCall}
          aria-label="End call"
          className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
