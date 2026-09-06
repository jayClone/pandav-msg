import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket, isSocketConnected } from '@socket/socketClient.js';
import { SOCKET_EVENTS } from '@constants/socketEvents.js';

// Public STUN only — resolves most direct connections. Callers behind
// symmetric NATs/restrictive firewalls will fail to connect without a TURN
// server, which isn't set up yet (no infra for it in this project).
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// Drives 1:1 voice/video calling. Mirrors this codebase's existing socket
// pattern (see Chat.jsx's registerListeners effect): signaling messages are
// relayed by the server (call.handler.js) but all WebRTC state — the
// RTCPeerConnection, local/remote media — lives entirely client-side.
export function useCall(currentUserId) {
  const [status, setStatus] = useState('idle'); // idle | outgoing | incoming | connected
  const [peer, setPeer] = useState(null); // { userId, name, callType }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState('');

  const pcRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setLocalStream((stream) => {
      stream?.getTracks().forEach((track) => track.stop());
      return null;
    });
    setRemoteStream(null);
    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];
    setMuted(false);
    setCameraOff(false);
  }, []);

  const createPeerConnection = useCallback((toUserId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        getSocket()?.emit(SOCKET_EVENTS.CALL_ICE_CANDIDATE, {
          toUserId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    pcRef.current = pc;
    return pc;
  }, []);

  const startCall = useCallback(async (toUserId, toName, callType) => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video',
      });
      setLocalStream(stream);

      const pc = createPeerConnection(toUserId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      getSocket()?.emit(SOCKET_EVENTS.CALL_OFFER, { toUserId, offer, callType });

      setPeer({ userId: toUserId, name: toName, callType });
      setStatus('outgoing');
    } catch (err) {
      setError(err.message || 'Could not access camera/microphone');
      cleanup();
    }
  }, [createPeerConnection, cleanup]);

  const acceptCall = useCallback(async () => {
    const pending = pendingOfferRef.current;
    if (!pending) return;

    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: pending.callType === 'video',
      });
      setLocalStream(stream);

      const pc = createPeerConnection(pending.fromUserId);

      // Order matters: setRemoteDescription MUST happen before addTrack
      // here. addTrack-before-setRemoteDescription makes the browser
      // create fresh local transceivers with no offer to match against;
      // when the offer is applied afterward, createAnswer() can pair its
      // m-lines with the wrong transceiver, leaving one media direction
      // silently recv-only (the exact "they hear me but I can't hear
      // them" bug). Applying the offer first lets addTrack correctly
      // reuse the transceivers the offer already implied.
      await pc.setRemoteDescription(new RTCSessionDescription(pending.offer));
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      getSocket()?.emit(SOCKET_EVENTS.CALL_ANSWER, { toUserId: pending.fromUserId, answer });
      setStatus('connected');
    } catch (err) {
      setError(err.message || 'Could not access camera/microphone');
      getSocket()?.emit(SOCKET_EVENTS.CALL_REJECT, { toUserId: pending.fromUserId });
      cleanup();
      setStatus('idle');
      setPeer(null);
    }
  }, [createPeerConnection, cleanup]);

  const rejectCall = useCallback(() => {
    if (peer) {
      getSocket()?.emit(SOCKET_EVENTS.CALL_REJECT, { toUserId: peer.userId });
    }
    cleanup();
    setStatus('idle');
    setPeer(null);
  }, [peer, cleanup]);

  const endCall = useCallback(() => {
    if (peer) {
      getSocket()?.emit(SOCKET_EVENTS.CALL_END, { toUserId: peer.userId });
    }
    cleanup();
    setStatus('idle');
    setPeer(null);
  }, [peer, cleanup]);

  const toggleMute = useCallback(() => {
    setLocalStream((stream) => {
      stream?.getAudioTracks().forEach((track) => { track.enabled = !track.enabled; });
      return stream;
    });
    setMuted((prev) => !prev);
  }, []);

  const toggleCamera = useCallback(() => {
    setLocalStream((stream) => {
      stream?.getVideoTracks().forEach((track) => { track.enabled = !track.enabled; });
      return stream;
    });
    setCameraOff((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    let socketInitInterval;

    const registerListeners = (socket) => {
      const onOffer = ({ fromUserId, fromName, offer, callType }) => {
        // Already on a call (or the race window where our own outgoing
        // offer crossed with theirs) — decline politely instead of
        // silently dropping it.
        if (status !== 'idle') {
          socket.emit(SOCKET_EVENTS.CALL_REJECT, { toUserId: fromUserId });
          return;
        }
        pendingOfferRef.current = { fromUserId, offer, callType };
        setPeer({ userId: fromUserId, name: fromName, callType });
        setStatus('incoming');
      };

      const onAnswer = async ({ answer }) => {
        const pc = pcRef.current;
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        for (const candidate of pendingCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidatesRef.current = [];
        setStatus('connected');
      };

      const onIceCandidate = async ({ candidate }) => {
        const pc = pcRef.current;
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          pendingCandidatesRef.current.push(candidate);
        }
      };

      const onReject = () => {
        setError('Call declined');
        cleanup();
        setStatus('idle');
        setPeer(null);
      };

      const onEnd = () => {
        cleanup();
        setStatus('idle');
        setPeer(null);
      };

      const onUnavailable = ({ reason }) => {
        setError(
          reason === 'busy' ? 'User is busy'
            : reason === 'timeout' ? 'No answer'
              : 'User is offline'
        );
        cleanup();
        setStatus('idle');
        setPeer(null);
      };

      socket.on(SOCKET_EVENTS.CALL_OFFER, onOffer);
      socket.on(SOCKET_EVENTS.CALL_ANSWER, onAnswer);
      socket.on(SOCKET_EVENTS.CALL_ICE_CANDIDATE, onIceCandidate);
      socket.on(SOCKET_EVENTS.CALL_REJECT, onReject);
      socket.on(SOCKET_EVENTS.CALL_END, onEnd);
      socket.on(SOCKET_EVENTS.CALL_UNAVAILABLE, onUnavailable);

      return () => {
        socket.off(SOCKET_EVENTS.CALL_OFFER, onOffer);
        socket.off(SOCKET_EVENTS.CALL_ANSWER, onAnswer);
        socket.off(SOCKET_EVENTS.CALL_ICE_CANDIDATE, onIceCandidate);
        socket.off(SOCKET_EVENTS.CALL_REJECT, onReject);
        socket.off(SOCKET_EVENTS.CALL_END, onEnd);
        socket.off(SOCKET_EVENTS.CALL_UNAVAILABLE, onUnavailable);
      };
    };

    let unregister;
    const socket = getSocket();
    if (socket && isSocketConnected()) {
      unregister = registerListeners(socket);
    } else {
      socketInitInterval = setInterval(() => {
        const s = getSocket();
        if (s) {
          clearInterval(socketInitInterval);
          unregister = registerListeners(s);
        }
      }, 300);
    }

    return () => {
      clearInterval(socketInitInterval);
      unregister?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, status, cleanup]);

  return {
    status,
    peer,
    localStream,
    remoteStream,
    muted,
    cameraOff,
    error,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  };
}
