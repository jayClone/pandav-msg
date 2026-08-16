import { vi } from "vitest"

// A minimal fake socket.io-client socket: enough state for `.active` to
// behave the way real socket.io-client does (true while connected or still
// auto-retrying, false once truly disconnected/exhausted).
const createFakeSocket = () => {
  const listeners = {}
  return {
    active: true,
    connected: true,
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
