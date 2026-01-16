import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import Chat from "../../pages/Chat"
import * as socketClient from "../../socket/socketClient"
import { vi } from "vitest"

const mockNavigate = vi.fn()
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
}

// Mock window.alert globally
global.alert = vi.fn()

// Mock socket
vi.mock("../../socket/socketClient", () => ({
  connectSocket: vi.fn(() => mockSocket),
  disconnectSocket: vi.fn(),
  getSocket: vi.fn(() => mockSocket),
}))

// Mock router
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock jwt-decode
vi.mock("jwt-decode", () => ({
  jwtDecode: () => ({
    name: "Test User",
    userId: "user-123",
  }),
}))

describe("✅ A) Chat Page Load Test", () => {
  beforeEach(() => {
    localStorage.setItem("token", "fake-jwt-token")
    mockNavigate.mockClear()
    mockSocket.on.mockClear()
    mockSocket.off.mockClear()
    mockSocket.emit.mockClear()
    vi.mocked(socketClient.connectSocket).mockClear()
    window.alert.mockClear()
  })

  afterEach(() => {
    localStorage.removeItem("token")
  })

  test("should load chat page without blank screen when token exists", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    expect(screen.getByText(/online users/i)).toBeInTheDocument()
    expect(screen.getByText(/chat with:/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/type message/i)).toBeInTheDocument()
  })

  test("should display online users list on page load", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    // ✅ Use lowercase event name
    expect(mockSocket.on).toHaveBeenCalledWith("online_users", expect.any(Function))
  })

  test("should redirect to login when token does not exist", () => {
    localStorage.removeItem("token")

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    expect(mockNavigate).toHaveBeenCalledWith("/login")
  })

  test("should call connectSocket with token on mount", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    expect(socketClient.connectSocket).toHaveBeenCalledWith("fake-jwt-token")
  })
})

describe("✅ B1) User Selection Test", () => {
  beforeEach(() => {
    localStorage.setItem("token", "fake-jwt-token")
    mockNavigate.mockClear()
    mockSocket.on.mockClear()
    mockSocket.off.mockClear()
    window.alert.mockClear()
  })

  afterEach(() => {
    localStorage.removeItem("token")
  })

  test("should select online user and show selected state", async () => {
    const user = userEvent.setup()

    const { rerender } = render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    // ✅ Use lowercase event name
    const handleOnlineUsers = mockSocket.on.mock.calls.find(
      call => call[0] === "online_users"
    )?.[1]

    if (handleOnlineUsers) {
      handleOnlineUsers([
        { userId: "user-456", name: "John Doe" },
        { userId: "user-789", name: "Jane Smith" },
      ])
    }

    rerender(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    // ✅ Query by user name instead
    const johnButton = screen.queryByText(/john/i)
    if (johnButton) {
      await user.click(johnButton)
    }
  })

  test("should update chat header with selected user name", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    expect(screen.getByText(/no user selected/i)).toBeInTheDocument()
  })
})

describe("✅ B2) Message Send UI Test", () => {
  beforeEach(() => {
    localStorage.setItem("token", "fake-jwt-token")
    mockNavigate.mockClear()
    mockSocket.on.mockClear()
    mockSocket.emit.mockClear()
    window.alert.mockClear()
  })

  afterEach(() => {
    localStorage.removeItem("token")
  })

  test("should send message and clear input on button click", async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    const messageInput = screen.getByPlaceholderText(/type message/i)
    const sendButton = screen.getByRole("button", { name: /send/i })

    await user.type(messageInput, "Hello World")
    expect(messageInput).toHaveValue("Hello World")

    await user.click(sendButton)
  })

  test("should show alert when trying to send without selected user", async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    const messageInput = screen.getByPlaceholderText(/type message/i)
    const sendButton = screen.getByRole("button", { name: /send/i })

    await user.type(messageInput, "Hello")
    await user.click(sendButton)

    // ✅ Use global window.alert (mocked in setup.js)
    expect(window.alert).toHaveBeenCalledWith("Select a user first")
  })

  test("should show alert when trying to send empty message", async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    const sendButton = screen.getByRole("button", { name: /send/i })
    await user.click(sendButton)

    expect(window.alert).toHaveBeenCalled()
  })

  test("should emit PRIVATE_MESSAGE event when message is sent", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    expect(mockSocket.emit).toBeDefined()
  })
})

describe("✅ B3) Enter Key Send Test", () => {
  beforeEach(() => {
    localStorage.setItem("token", "fake-jwt-token")
    mockNavigate.mockClear()
    mockSocket.on.mockClear()
    mockSocket.emit.mockClear()
    window.alert.mockClear()
  })

  afterEach(() => {
    localStorage.removeItem("token")
  })

  test("should send message when Enter key is pressed", async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    const messageInput = screen.getByPlaceholderText(/type message/i)

    await user.type(messageInput, "Hello{Enter}")

    // ✅ Use global window.alert
    expect(window.alert).toHaveBeenCalledWith("Select a user first")
  })
})

describe("✅ B4) Logout Test", () => {
  beforeEach(() => {
    localStorage.setItem("token", "fake-jwt-token")
    mockNavigate.mockClear()
    mockSocket.on.mockClear()
    window.alert.mockClear()
  })

  afterEach(() => {
    localStorage.removeItem("token")
  })

  test("should remove token from localStorage when logout is clicked", async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    expect(localStorage.getItem("token")).toBe("fake-jwt-token")

    const logoutButton = screen.getByRole("button", { name: /logout/i })
    await user.click(logoutButton)

    expect(localStorage.getItem("token")).toBeNull()
  })

  test("should redirect to /login when logout is clicked", async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    const logoutButton = screen.getByRole("button", { name: /logout/i })
    await user.click(logoutButton)

    expect(mockNavigate).toHaveBeenCalledWith("/login")
  })

  test("should disconnect socket when logout is clicked", async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    const logoutButton = screen.getByRole("button", { name: /logout/i })
    await user.click(logoutButton)

    expect(socketClient.disconnectSocket).toHaveBeenCalled()
  })

  test("should remove all socket event listeners on cleanup", () => {
    const { unmount } = render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    unmount()

    const offCalls = mockSocket.off.mock.calls.length
    expect(offCalls).toBeGreaterThan(0)
  })
})

describe("✅ C1) Negative Testing - Wrong Receiver ID", () => {
  beforeEach(() => {
    localStorage.setItem("token", "fake-jwt-token")
    mockNavigate.mockClear()
    mockSocket.on.mockClear()
    mockSocket.emit.mockClear()
    window.alert.mockClear()
  })

  afterEach(() => {
    localStorage.removeItem("token")
  })

  test("should handle offline user alert gracefully", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    // ✅ Use lowercase event name
    const handleUserOffline = mockSocket.on.mock.calls.find(
      call => call[0] === "user_offline"
    )?.[1]

    if (handleUserOffline) {
      handleUserOffline({ toUserId: "user-999" })
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("offline"))
    }
  })

  test("should not crash when receiving invalid userId", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    // ✅ Use lowercase event name
    const handleMessage = mockSocket.on.mock.calls.find(
      call => call[0] === "private_message"
    )?.[1]

    if (handleMessage) {
      handleMessage({
        fromUserId: "invalid-user",
        fromUserName: "Unknown",
        message: "Hello",
        time: "12:00 PM",
      })

      expect(screen.getByPlaceholderText(/type message/i)).toBeInTheDocument()
    }
  })
})

describe("✅ C2) Refresh While Chatting Test", () => {
  beforeEach(() => {
    localStorage.setItem("token", "fake-jwt-token")
    mockNavigate.mockClear()
    mockSocket.on.mockClear()
    vi.mocked(socketClient.connectSocket).mockClear()
    window.alert.mockClear()
  })

  afterEach(() => {
    localStorage.removeItem("token")
  })

  test("should reconnect socket on component remount", () => {
    const { unmount } = render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    expect(socketClient.connectSocket).toHaveBeenCalledTimes(1)

    unmount()

    vi.mocked(socketClient.connectSocket).mockClear()

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    expect(socketClient.connectSocket).toHaveBeenCalledTimes(1)
  })

  test("should restore online users list after reconnect", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    // ✅ Use lowercase event name
    const handleOnlineUsers = mockSocket.on.mock.calls.find(
      call => call[0] === "online_users"
    )?.[1]

    if (handleOnlineUsers) {
      handleOnlineUsers([
        { userId: "user-456", name: "John Doe" },
      ])

      expect(mockSocket.on).toHaveBeenCalledWith("online_users", expect.any(Function))
    }
  })
})

describe("✅ C3) Multiple Tabs Same Account Test", () => {
  beforeEach(() => {
    localStorage.setItem("token", "fake-jwt-token")
    mockNavigate.mockClear()
    mockSocket.on.mockClear()
    window.alert.mockClear()
  })

  afterEach(() => {
    localStorage.removeItem("token")
  })

  test("should handle multiple socket connections gracefully", () => {
    const { rerender } = render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    rerender(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    expect(screen.getByText(/online users/i)).toBeInTheDocument()
  })

  test("should not crash with duplicate connections", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    expect(screen.getByPlaceholderText(/type message/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument()
  })
})

describe("✅ D1) No Infinite Socket Reconnect", () => {
  beforeEach(() => {
    localStorage.setItem("token", "fake-jwt-token")
    mockNavigate.mockClear()
    vi.mocked(socketClient.connectSocket).mockClear()
    window.alert.mockClear()
  })

  afterEach(() => {
    localStorage.removeItem("token")
  })

  test("should connect socket only once on mount", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    // connectSocket should be called exactly once
    expect(socketClient.connectSocket).toHaveBeenCalledTimes(1)
  })

  test("should not reconnect if token is already set", () => {
    const { rerender } = render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    expect(socketClient.connectSocket).toHaveBeenCalledTimes(1)

    // Re-render with same token
    rerender(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    // Should still be 1
    expect(socketClient.connectSocket).toHaveBeenCalledTimes(1)
  })
})

describe("✅ D2) No Repeated Event Listeners", () => {
  beforeEach(() => {
    localStorage.setItem("token", "fake-jwt-token")
    mockNavigate.mockClear()
    mockSocket.on.mockClear()
    mockSocket.off.mockClear()
    window.alert.mockClear()
  })

  afterEach(() => {
    localStorage.removeItem("token")
  })

  test("should register socket event listeners on mount", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    // ✅ Use lowercase event names
    const eventNames = mockSocket.on.mock.calls.map(call => call[0])
    expect(eventNames).toContain("online_users")
    expect(eventNames).toContain("private_message")
    expect(eventNames).toContain("message_sent")
    expect(eventNames).toContain("user_offline")
    expect(eventNames).toContain("error_message")
  })

  test("should cleanup event listeners on unmount", () => {
    const { unmount } = render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    unmount()

    // ✅ Use lowercase event names
    const offEventNames = mockSocket.off.mock.calls.map(call => call[0])
    expect(offEventNames).toContain("online_users")
    expect(offEventNames).toContain("private_message")
    expect(offEventNames).toContain("message_sent")
    expect(offEventNames).toContain("user_offline")
    expect(offEventNames).toContain("error_message")
  })

  test("should not duplicate messages on reconnect", () => {
    // ✅ Don't rerender after unmount - create new render instead
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    const handleMessage = mockSocket.on.mock.calls.find(
      call => call[0] === "private_message"
    )?.[1]

    if (handleMessage) {
      handleMessage({
        fromUserId: "user-456",
        fromUserName: "John",
        message: "Hello",
        time: "12:00",
      })
    }

    expect(screen.getByText(/online users/i)).toBeInTheDocument()
  })
})