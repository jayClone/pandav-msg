import { vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// --- socket mock: a fake socket that records emits and lets the test
// trigger whatever handler useCall registered for a given event, the same
// way socketClient.test.js fakes socket.io-client. ---
const listeners = {}
const fakeSocket = {
  emit: vi.fn(),
  on: vi.fn((event, cb) => { listeners[event] = cb }),
  off: vi.fn((event) => { delete listeners[event] }),
}

vi.mock('@socket/socketClient.js', () => ({
  getSocket: () => fakeSocket,
  isSocketConnected: () => true,
}))

// --- RTCPeerConnection mock: records the ORDER operations happen in, which
// is exactly what the acceptCall bug was about (addTrack called before
// setRemoteDescription silently breaks one media direction). ---
let pcInstances = []

class FakePeerConnection {
  constructor() {
    this.callLog = []
    this.remoteDescription = null
    this.onicecandidate = null
    this.ontrack = null
    pcInstances.push(this)
  }
  addTrack(track) { this.callLog.push(['addTrack', track]) }
  async setRemoteDescription(desc) {
    this.callLog.push(['setRemoteDescription', desc])
    this.remoteDescription = desc
  }
  async setLocalDescription(desc) { this.callLog.push(['setLocalDescription', desc]) }
  async createOffer() { this.callLog.push(['createOffer']); return { type: 'offer', sdp: 'fake-offer' } }
  async createAnswer() { this.callLog.push(['createAnswer']); return { type: 'answer', sdp: 'fake-answer' } }
  async addIceCandidate(candidate) { this.callLog.push(['addIceCandidate', candidate]) }
  close() { this.callLog.push(['close']) }
}

function fakeTrack() {
  return { stop: vi.fn(), enabled: true }
}

function fakeStream() {
  const tracks = [fakeTrack(), fakeTrack()]
  return {
    getTracks: () => tracks,
    getAudioTracks: () => [tracks[0]],
    getVideoTracks: () => [tracks[1]],
  }
}

beforeEach(() => {
  pcInstances = []
  fakeSocket.emit.mockClear()
  Object.keys(listeners).forEach((k) => delete listeners[k])

  vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
  vi.stubGlobal('RTCSessionDescription', class { constructor(d) { return d } })
  vi.stubGlobal('RTCIceCandidate', class { constructor(c) { return c } })

  // Patch just mediaDevices rather than replacing all of `navigator` —
  // happy-dom's navigator has other properties (userAgent, etc.) that
  // React/testing-library may rely on.
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn(() => Promise.resolve(fakeStream())) },
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useCall', () => {
  test('startCall adds local tracks before creating the offer', async () => {
    const { useCall } = await import('../useCall.js')
    const { result } = renderHook(() => useCall('user-a'))

    await act(async () => {
      await result.current.startCall('user-b', 'Bob', 'video')
    })

    const pc = pcInstances[0]
    const ops = pc.callLog.map((entry) => entry[0])
    const addTrackIndex = ops.indexOf('addTrack')
    const createOfferIndex = ops.indexOf('createOffer')

    expect(addTrackIndex).toBeGreaterThanOrEqual(0)
    expect(addTrackIndex).toBeLessThan(createOfferIndex)
    expect(fakeSocket.emit).toHaveBeenCalledWith('call_offer', expect.objectContaining({ toUserId: 'user-b' }))
    expect(result.current.status).toBe('outgoing')
  })

  // Regression test for the one-directional-audio bug: addTrack was being
  // called before setRemoteDescription on the answering side, which lets
  // the browser create local transceivers with nothing to match against —
  // when the offer is applied afterward, createAnswer() can pair its
  // m-lines with the wrong transceiver and leave one media direction
  // recv-only. setRemoteDescription must come first.
  test('acceptCall applies the remote offer BEFORE adding local tracks', async () => {
    const { useCall } = await import('../useCall.js')
    const { result } = renderHook(() => useCall('user-b'))

    // Simulate an incoming offer from user-a
    act(() => {
      listeners['call_offer']({
        fromUserId: 'user-a',
        fromName: 'Alice',
        offer: { type: 'offer', sdp: 'fake-offer' },
        callType: 'video',
      })
    })
    expect(result.current.status).toBe('incoming')

    await act(async () => {
      await result.current.acceptCall()
    })

    const pc = pcInstances[0]
    const ops = pc.callLog.map((entry) => entry[0])
    const setRemoteIndex = ops.indexOf('setRemoteDescription')
    const addTrackIndex = ops.indexOf('addTrack')

    expect(setRemoteIndex).toBeGreaterThanOrEqual(0)
    expect(addTrackIndex).toBeGreaterThanOrEqual(0)
    expect(setRemoteIndex).toBeLessThan(addTrackIndex)
    expect(result.current.status).toBe('connected')
  })

  test('receiving call_answer applies the remote description and moves the caller to connected', async () => {
    const { useCall } = await import('../useCall.js')
    const { result } = renderHook(() => useCall('user-a'))

    await act(async () => {
      await result.current.startCall('user-b', 'Bob', 'audio')
    })

    await act(async () => {
      await listeners['call_answer']({ fromUserId: 'user-b', answer: { type: 'answer', sdp: 'fake-answer' } })
    })

    await waitFor(() => expect(result.current.status).toBe('connected'))
    const pc = pcInstances[0]
    expect(pc.callLog.some((entry) => entry[0] === 'setRemoteDescription')).toBe(true)
  })

  test('call_end resets state back to idle', async () => {
    const { useCall } = await import('../useCall.js')
    const { result } = renderHook(() => useCall('user-a'))

    await act(async () => {
      await result.current.startCall('user-b', 'Bob', 'audio')
    })

    act(() => {
      listeners['call_end']({ fromUserId: 'user-b' })
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.peer).toBeNull()
  })

  // Regression test for the stuck-ringing-forever bug: an unanswered call
  // used to leave both users permanently "busy" server-side since nothing
  // ever cleared it. The server now emits call_unavailable with
  // reason:'timeout' after the ring window — the caller should surface a
  // "No answer" message distinct from busy/offline, not lump it in with
  // "User is offline".
  test('call_unavailable with reason "timeout" shows a distinct "No answer" message', async () => {
    const { useCall } = await import('../useCall.js')
    const { result } = renderHook(() => useCall('user-a'))

    await act(async () => {
      await result.current.startCall('user-b', 'Bob', 'audio')
    })

    act(() => {
      listeners['call_unavailable']({ toUserId: 'user-b', reason: 'timeout' })
    })

    expect(result.current.error).toBe('No answer')
    expect(result.current.status).toBe('idle')
    expect(result.current.peer).toBeNull()
  })

  // Regression test: handleCallOffer rejects a bad/non-friend call attempt
  // via the generic error_message event, not call_unavailable, and never
  // sets the server's activeCalls entry for it — so the ring-timeout safety
  // net never starts either. Nothing here listened for error_message, so
  // the caller was stuck showing "outgoing" forever with the camera/mic
  // still actively captured.
  test('error_message while a call is outgoing resets to idle and releases the media stream', async () => {
    const { useCall } = await import('../useCall.js')
    const { result } = renderHook(() => useCall('user-a'))

    await act(async () => {
      await result.current.startCall('user-b', 'Bob', 'audio')
    })

    expect(result.current.status).toBe('outgoing')
    const stream = result.current.localStream
    const tracks = stream.getTracks()

    act(() => {
      listeners['error_message']({ message: 'You can only call friends' })
    })

    expect(result.current.error).toBe('You can only call friends')
    expect(result.current.status).toBe('idle')
    expect(result.current.peer).toBeNull()
    expect(result.current.localStream).toBeNull()
    tracks.forEach((track) => expect(track.stop).toHaveBeenCalled())
  })

  // An error_message unrelated to calling (this event isn't call-specific)
  // must not interfere when there's no outgoing call to fail.
  test('error_message while idle is ignored', async () => {
    const { useCall } = await import('../useCall.js')
    const { result } = renderHook(() => useCall('user-a'))

    expect(result.current.status).toBe('idle')

    act(() => {
      listeners['error_message']?.({ message: 'Too many messages. Please slow down.' })
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBe('')
  })
})
