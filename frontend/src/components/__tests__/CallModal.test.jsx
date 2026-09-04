import { render, screen } from '@testing-library/react'
import CallModal from '../CallModal.jsx'

function fakeStream() {
  // happy-dom's srcObject setter type-checks `instanceof MediaStream`, and
  // happy-dom does provide a real, instantiable MediaStream global — use
  // it rather than a plain object stand-in.
  return new MediaStream()
}

function baseCall(overrides) {
  return {
    status: 'idle',
    peer: null,
    localStream: null,
    remoteStream: null,
    muted: false,
    cameraOff: false,
    error: '',
    acceptCall: () => {},
    rejectCall: () => {},
    endCall: () => {},
    toggleMute: () => {},
    toggleCamera: () => {},
    ...overrides,
  }
}

describe('CallModal', () => {
  // Regression test for the black-video bug: the ring/incoming screen
  // renders no <video> tags, so the real element only mounts once status
  // flips to "connected" — by which point localStream/remoteStream were
  // already set and don't change again. The old useRef+useEffect(deps:
  // [stream]) attachment never re-fired for that already-mounted-later
  // node, leaving srcObject unset (black video) even though the stream
  // itself was fine.
  test('attaches local and remote streams to the video elements once the call transitions from ringing to connected', () => {
    const local = fakeStream()
    const remote = fakeStream()

    const { rerender } = render(
      <CallModal call={baseCall({
        status: 'outgoing',
        peer: { userId: 'user-b', name: 'Bob', callType: 'video' },
        localStream: local,
      })} />
    )

    // No <video> exists yet on the ring screen.
    expect(document.querySelector('video')).toBeNull()

    // Same stream references carry over — this is the exact scenario that
    // broke: the video elements are brand new DOM nodes, but `localStream`
    // didn't change, so a useEffect keyed on it alone would never refire.
    rerender(
      <CallModal call={baseCall({
        status: 'connected',
        peer: { userId: 'user-b', name: 'Bob', callType: 'video' },
        localStream: local,
        remoteStream: remote,
      })} />
    )

    const videos = document.querySelectorAll('video')
    expect(videos.length).toBe(2)
    const srcObjects = Array.from(videos).map((v) => v.srcObject)
    expect(srcObjects).toContain(local)
    expect(srcObjects).toContain(remote)
  })

  test('audio-only calls still attach the remote stream (to a hidden element) so the audio track plays', () => {
    const remote = fakeStream()

    render(
      <CallModal call={baseCall({
        status: 'connected',
        peer: { userId: 'user-b', name: 'Bob', callType: 'audio' },
        remoteStream: remote,
      })} />
    )

    const video = document.querySelector('video')
    expect(video).not.toBeNull()
    expect(video.srcObject).toBe(remote)
  })

  test('renders nothing when idle and no error', () => {
    const { container } = render(<CallModal call={baseCall()} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('shows accept/decline for an incoming call', () => {
    render(
      <CallModal call={baseCall({
        status: 'incoming',
        peer: { userId: 'user-a', name: 'Alice', callType: 'audio' },
      })} />
    )
    expect(screen.getByLabelText('Accept call')).toBeInTheDocument()
    expect(screen.getByLabelText('Decline call')).toBeInTheDocument()
  })
})
