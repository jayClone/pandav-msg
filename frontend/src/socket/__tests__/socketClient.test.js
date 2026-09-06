import { vi } from "vitest"

// A minimal fake socket.io-client socket: enough state for `.active` to
// behave the way real socket.io-client does (true while connected or still
// auto-retrying, false once truly disconnected/exhausted).
const createFakeSocket = () => {
  const listeners = {}
  return {
    active: true,
    connected: true,
    // Real socket.io-client stores the `auth` connection option on the
    // Socket instance itself (and re-reads it before every reconnection
    // attempt) — mirror that here so connectSocket's `socket.auth.token = …`
    // has somewhere real to write.
    auth: {},
    on: vi.fn((event, cb) => { listeners[event] = cb }),
    disconnect: vi.fn(function () {
      this.active = false
      this.connected = false
    }),
    _listeners: listeners,
  }
}

const ioMock = vi.fn()
vi.mock("socket.io-client", () => ({
  default: (...args) => ioMock(...args),
}))

describe("socketClient", () => {
  beforeEach(() => {
    vi.resetModules()
    ioMock.mockReset()
  })

  test("connectSocket creates a socket on first call", async () => {
    const fakeSocket = createFakeSocket()
    ioMock.mockReturnValue(fakeSocket)

    const { connectSocket, getSocket } = await import("../socketClient.js")

    const result = connectSocket("token-1")

    expect(ioMock).toHaveBeenCalledTimes(1)
    expect(result).toBe(fakeSocket)
    expect(getSocket()).toBe(fakeSocket)
  })

  // This is the actual bug: Layoute.jsx calls connectSocket() again every
  // time the REST access token rotates (routine — happens on every silent
  // refresh), which used to tear down and rebuild a perfectly healthy
  // socket every single time, showing as a permanent "connecting..."
  // banner and genuinely dropping real-time delivery on each churn.
  test("connectSocket reuses the existing socket instead of reconnecting when called again with a different (rotated) token", async () => {
    const fakeSocket = createFakeSocket()
    ioMock.mockReturnValue(fakeSocket)

    const { connectSocket } = await import("../socketClient.js")

    const first = connectSocket("token-1")
    const second = connectSocket("token-2") // token rotated, socket is still healthy

    expect(ioMock).toHaveBeenCalledTimes(1) // only the first call actually built a socket
    expect(fakeSocket.disconnect).not.toHaveBeenCalled()
    expect(second).toBe(first)
  })

  // Follow-on to the bug above: reusing the live socket instead of
  // rebuilding it is correct, but the rotated token still has to end up
  // somewhere Socket.IO will actually use it. socket.auth.token is what
  // socket.io-client re-reads right before each reconnection attempt — if
  // it's never updated here, a reconnect after the access token's 15-minute
  // expiry (network blip, phone sleep/wake, server restart) keeps retrying
  // with the original, by-then-expired token and permanently fails all 3
  // attempts, silently killing every real-time feature.
  test("connectSocket updates the live socket's auth token so a later reconnect uses the fresh one", async () => {
    const fakeSocket = createFakeSocket()
    ioMock.mockReturnValue(fakeSocket)

    const { connectSocket } = await import("../socketClient.js")

    connectSocket("token-1")
    connectSocket("token-2") // token rotated, socket is still healthy

    expect(fakeSocket.auth.token).toBe("token-2")
  })

  test("connectSocket builds a new socket if the previous one is no longer active (reconnection exhausted)", async () => {
    const firstSocket = createFakeSocket()
    const secondSocket = createFakeSocket()
    ioMock.mockReturnValueOnce(firstSocket).mockReturnValueOnce(secondSocket)

    const { connectSocket } = await import("../socketClient.js")

    connectSocket("token-1")
    firstSocket.active = false // e.g. reconnection attempts exhausted after a real drop

    const result = connectSocket("token-2")

    expect(ioMock).toHaveBeenCalledTimes(2)
    expect(result).toBe(secondSocket)
  })

  test("disconnectSocket tears down and clears the socket, so the next connectSocket call builds a fresh one", async () => {
    const firstSocket = createFakeSocket()
    const secondSocket = createFakeSocket()
    ioMock.mockReturnValueOnce(firstSocket).mockReturnValueOnce(secondSocket)

    const { connectSocket, disconnectSocket, getSocket } = await import("../socketClient.js")

    connectSocket("token-1")
    disconnectSocket()

    expect(firstSocket.disconnect).toHaveBeenCalled()
    expect(getSocket()).toBeNull()

    connectSocket("token-2")
    expect(ioMock).toHaveBeenCalledTimes(2)
  })
})
