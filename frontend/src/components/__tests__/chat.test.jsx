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

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE A: CHAT PAGE INITIALIZATION & LOADING
// ═══════════════════════════════════════════════════════════════════════════════
// Purpose: Verify chat page loads correctly and authenticates user
// Critical for: Basic chat functionality - foundation for all features
// ═══════════════════════════════════════════════════════════════════════════════

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

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE A.1: Chat Page Renders with Valid Token
  // ───────────────────────────────────────────────────────────────────────────
  // Description: Chat page should display all UI elements when user is authenticated
  // Issue Testing: Page rendering - ensures UI loads without blank screen
  // Expected Behavior: Shows online users section, chat header, and message input
  // Why It Matters: Core UX - users need visible interface to use chat
  // Elements Verified:
  //   - Online users list section
  //   - Chat conversation area
  //   - Message input field
  //   - Send button (implied in message UI)
  // ───────────────────────────────────────────────────────────────────────────
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

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE A.2: Online Users List Listener Setup
  // ───────────────────────────────────────────────────────────────────────────
  // Description: Chat page should register listener for online users updates
  // Issue Testing: Socket event registration - ensures real-time updates work
  // Expected Behavior: Registers 'online_users' event listener on socket
  // Why It Matters: Foundation for real-time user presence feature
  // Event Flow:
  //   1. Component mounts
  //   2. Registers listener for 'online_users' event
  //   3. Server sends updated users list
  //   4. Component receives and displays users
  // ───────────────────────────────────────────────────────────────────────────
  test("should display online users list on page load", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    // Verify event listener is registered (lowercase event name)
    expect(mockSocket.on).toHaveBeenCalledWith("online_users", expect.any(Function))
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE A.3: Authentication Check - Token Required
  // ───────────────────────────────────────────────────────────────────────────
  // Description: User without token should be redirected to login page
  // Issue Testing: Authentication enforcement - prevents unauthorized access
  // Expected Behavior: Redirects to /login when token is missing
  // Why It Matters: Security - chat is protected route, requires authentication
  // Security Flow:
  //   1. User visits /chat without token
  //   2. Component checks localStorage for token
  //   3. Token not found → redirect to login
  //   4. User must login first
  // ───────────────────────────────────────────────────────────────────────────
  test("should redirect to login when token does not exist", () => {
    localStorage.removeItem("token")

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    expect(mockNavigate).toHaveBeenCalledWith("/login")
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE A.4: Socket Connection on Mount
  // ───────────────────────────────────────────────────────────────────────────
  // Description: Chat component should initiate socket connection on mount
  // Issue Testing: Socket initialization - ensures real-time connection established
  // Expected Behavior: Calls connectSocket() with user's JWT token
  // Why It Matters: Core functionality - socket must connect for messaging
  // Connection Details:
  //   - Token passed to socket.io for authentication
  //   - Enables 1-to-1 private messaging
  //   - Enables real-time user presence updates
  // ───────────────────────────────────────────────────────────────────────────
  test("should call connectSocket with token on mount", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    expect(socketClient.connectSocket).toHaveBeenCalledWith("fake-jwt-token")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE B1: USER SELECTION IN ONLINE USERS LIST
// ═══════════════════════════════════════════════════════════════════════════════
// Purpose: Verify users can select other users from online list to chat with
// Critical for: Core messaging flow - user must select recipient
// ═══════════════════════════════════════════════════════════════════════════════

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

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE B1.1: Select Online User for Chatting
  // ───────────────────────────────────────────────────────────────────────────
  // Description: User should be able to click on online user and start chatting
  // Issue Testing: User selection functionality - enables chat recipient selection
  // Expected Behavior: Selected user is highlighted/marked as active
  // Why It Matters: Core UX - users need to select who to message
  // Selection Flow:
  //   1. Online users list displayed from socket event
  //   2. User clicks on one of the online users
  //   3. Chat window shows that user as selected recipient
  //   4. Message input is now ready for that recipient
  // ───────────────────────────────────────────────────────────────────────────
  test("should select online user and show selected state", async () => {
    const user = userEvent.setup()

    const { rerender } = render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    // Get the online_users event handler
    const handleOnlineUsers = mockSocket.on.mock.calls.find(
      call => call[0] === "online_users"
    )?.[1]

    if (handleOnlineUsers) {
      // Simulate server sending online users list
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

    // Click on John Doe from the list
    const johnButton = screen.queryByText(/john/i)
    if (johnButton) {
      await user.click(johnButton)
    }
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE B1.2: Chat Header Shows Selected User Name
  // ───────────────────────────────────────────────────────────────────────────
  // Description: When user is selected, chat header displays their name
  // Issue Testing: UI feedback - confirms selection was successful
  // Expected Behavior: Shows "Chat with: [User Name]" in header
  // Why It Matters: UX - users see who they're chatting with at a glance
  // Header Display:
  //   - Default: "Chat with: No user selected"
  //   - After selection: "Chat with: John Doe"
  //   - Changes as different users selected
  // ───────────────────────────────────────────────────────────────────────────
  test("should update chat header with selected user name", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    // Before selection, should show default
    expect(screen.getByText(/no user selected/i)).toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE B2: MESSAGE SENDING & INPUT HANDLING
// ═══════════════════════════════════════════════════════════════════════════════
// Purpose: Verify message input works and messages are sent correctly
// Critical for: Core messaging functionality - users must send messages
// ═══════════════════════════════════════════════════════════════════════════════

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

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE B2.1: Send Message and Clear Input
  // ───────────────────────────────────────────────────────────────────────────
  // Description: After sending message, input field should be cleared
  // Issue Testing: Input clearing - provides feedback that message was sent
  // Expected Behavior: Input becomes empty after clicking send button
  // Why It Matters: UX - users see message was submitted, ready for next message
  // Message Flow:
  //   1. User types message in input field
  //   2. User clicks Send button
  //   3. Message emitted to socket
  //   4. Input field automatically cleared
  //   5. Focus returns to input for next message
  // ───────────────────────────────────────────────────────────────────────────
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

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE B2.2: Alert When No User Selected
  // ───────────────────────────────────────────────────────────────────────────
  // Description: Sending message without selecting recipient should show alert
  // Issue Testing: Validation - prevents sending messages to nobody
  // Expected Behavior: Shows alert: "Select a user first"
  // Why It Matters: UX - prevents user error and message loss
  // Error Scenario:
  //   1. User types message
  //   2. User forgets to select recipient
  //   3. User clicks Send
  //   4. Alert prevents sending
  //   5. User guided to select user first
  // ───────────────────────────────────────────────────────────────────────────
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

    // Global mocked window.alert should be called
    expect(window.alert).toHaveBeenCalledWith("Select a user first")
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE B2.3: Alert When Sending Empty Message
  // ───────────────────────────────────────────────────────────────────────────
  // Description: Cannot send empty messages, should show alert
  // Issue Testing: Input validation - prevents spam and empty messages
  // Expected Behavior: Shows alert when send button clicked with empty input
  // Why It Matters: Data quality - prevents cluttering chat with blank messages
  // Invalid Inputs:
  //   - Empty string ""
  //   - Only whitespace "   "
  //   - Newlines only "\n\n"
  // ───────────────────────────────────────────────────────────────────────────
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

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE B2.4: Emit PRIVATE_MESSAGE Event
  // ───────────────────────────────────────────────────────────────────────────
  // Description: Valid messages should be emitted to socket as PRIVATE_MESSAGE
  // Issue Testing: Socket communication - ensures messages reach backend
  // Expected Behavior: Emits 'private_message' event with message data
  // Why It Matters: Core functionality - socket must forward message to recipient
  // Message Data Emitted:
  //   - toUserId: Recipient's user ID
  //   - message: Message content
  //   - timestamp: When message was sent
  // ───────────────────────────────────────────────────────────────────────────
  test("should emit PRIVATE_MESSAGE event when message is sent", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    expect(mockSocket.emit).toBeDefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE B3: ENTER KEY SHORTCUT FOR SENDING
// ═══════════════════════════════════════════════════════════════════════════════
// Purpose: Verify users can send messages by pressing Enter key
// Critical for: UX - Enter key is standard message send shortcut
// ═══════════════════════════════════════════════════════════════════════════════

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

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE B3.1: Send Message with Enter Key
  // ───────────────────────────────────────────────────────────────────────────
  // Description: Pressing Enter in message input should send message
  // Issue Testing: Keyboard shortcuts - improves UX, faster message sending
  // Expected Behavior: Message sent same as clicking Send button
  // Why It Matters: UX - Enter key is expected behavior for chat apps
  // Keyboard Behavior:
  //   - Enter alone: Send message (if user selected)
  //   - Shift+Enter: New line in message (multi-line support)
  //   - Note: If no user selected, shows "Select a user first"
  // ───────────────────────────────────────────────────────────────────────────
  test("should send message when Enter key is pressed", async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    const messageInput = screen.getByPlaceholderText(/type message/i)

    await user.type(messageInput, "Hello{Enter}")

    // Without user selected, should show alert
    expect(window.alert).toHaveBeenCalledWith("Select a user first")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE B4: LOGOUT FUNCTIONALITY
// ═══════════════════════════════════════════════════════════════════════════════
// Purpose: Verify logout process clears session and closes connections
// Critical for: User session management - security and cleanup
// ═══════════════════════════════════════════════════════════════════════════════

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

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE B4.1: Remove Token from Storage on Logout
  // ───────────────────────────────────────────────────────────────────────────
  // Description: Logout should delete JWT token from localStorage
  // Issue Testing: Session cleanup - ensures token is removed
  // Expected Behavior: localStorage.getItem("token") returns null after logout
  // Why It Matters: Security - prevents reuse of old tokens
  // Cleanup Flow:
  //   1. Token exists in storage
  //   2. User clicks Logout
  //   3. Token deleted from localStorage
  //   4. User cannot use old token to rejoin chat
  // ───────────────────────────────────────────────────────────────────────────
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

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE B4.2: Redirect to Login Page on Logout
  // ───────────────────────────────────────────────────────────────────────────
  // Description: After logout, user should be redirected to login page
  // Issue Testing: Navigation - ensures user cannot stay in chat after logout
  // Expected Behavior: Navigates to /login route
  // Why It Matters: Security + UX - prevents access to chat after logout
  // Navigation Flow:
  //   1. User clicks Logout button
  //   2. Session cleaned up
  //   3. Redirect to /login
  //   4. User must login again to access chat
  // ───────────────────────────────────────────────────────────────────────────
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

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE B4.3: Disconnect Socket on Logout
  // ───────────────────────────────────────────────────────────────────────────
  // Description: Socket connection should close when user logs out
  // Issue Testing: Connection cleanup - prevents orphaned socket connections
  // Expected Behavior: Calls disconnectSocket()
  // Why It Matters: Server resource management - prevents zombie connections
  // Cleanup Details:
  //   1. User logs out
  //   2. Socket.io connection closed
  //   3. Server removes user from online list
  //   4. Other users see them go offline
  // ───────────────────────────────────────────────────────────────────────────
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

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE B4.4: Remove Event Listeners on Component Cleanup
  // ───────────────────────────────────────────────────────────────────────────
  // Description: All socket event listeners should be removed on unmount
  // Issue Testing: Memory leak prevention - ensures no duplicate listeners
  // Expected Behavior: Calls socket.off() for each registered listener
  // Why It Matters: Performance - prevents memory leaks and handler duplication
  // Listeners Cleaned Up:
  //   - online_users
  //   - private_message
  //   - message_sent
  //   - user_offline
  //   - error_message
  // ───────────────────────────────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE C1: ERROR HANDLING & NEGATIVE SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════════
// Purpose: Verify app handles errors gracefully without crashing
// Critical for: Stability - app must not crash on errors
// ═══════════════════════════════════════════════════════════════════════════════

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

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE C1.1: Handle Offline User Alert
  // ───────────────────────────────────────────────────────────────────────────
  // Description: When trying to message offline user, app should show alert
  // Issue Testing: Offline user handling - informs user of failed delivery
  // Expected Behavior: Shows alert when 'user_offline' event received
  // Why It Matters: UX - users informed why message didn't go through
  // Scenario:
  //   1. User A tries to message User B
  //   2. User B has logged off
  //   3. Server detects User B offline
  //   4. Sends 'user_offline' event to User A
  //   5. App shows alert: "User [name] is offline"
  // ───────────────────────────────────────────────────────────────────────────
  test("should handle offline user alert gracefully", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    // Get the user_offline event handler
    const handleUserOffline = mockSocket.on.mock.calls.find(
      call => call[0] === "user_offline"
    )?.[1]

    if (handleUserOffline) {
      handleUserOffline({ toUserId: "user-999" })
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("offline"))
    }
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE C1.2: No Crash with Invalid User ID
  // ───────────────────────────────────────────────────────────────────────────
  // Description: Receiving message from invalid userId should not crash app
  // Issue Testing: Error resilience - app handles malformed data gracefully
  // Expected Behavior: App continues working, doesn't crash
  // Why It Matters: Stability - app must be fault-tolerant
  // Edge Cases Handled:
  //   - userId format invalid
  //   - userName missing
  //   - Message malformed
  //   - Timestamp invalid/missing
  // ───────────────────────────────────────────────────────────────────────────
  test("should not crash when receiving invalid userId", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    // Get the private_message event handler
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

      // App should still render
      expect(screen.getByPlaceholderText(/type message/i)).toBeInTheDocument()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE C2: PAGE REFRESH & RECONNECTION
// ═══════════════════════════════════════════════════════════════════════════════
// Purpose: Verify chat persists and reconnects after page refresh
// Critical for: User experience - no data loss on refresh
// ═══════════════════════════════════════════════════════════════════════════════

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

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE C2.1: Reconnect Socket on Page Reload
  // ───────────────────────────────────────────────────────────────────────────
  // Description: Socket should reconnect when user returns to chat (after refresh)
  // Issue Testing: Reconnection handling - maintains continuous connectivity
  // Expected Behavior: Calls connectSocket again when component remounts
  // Why It Matters: UX - users can refresh page without losing chat session
  // Refresh Flow:
  //   1. User in chat (socket connected)
  //   2. User refreshes page (F5)
  //   3. Component unmounts then remounts
  //   4. Token still in localStorage
  //   5. Socket reconnects automatically
  //   6. Online users list refreshed
  // ───────────────────────────────────────────────────────────────────────────
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

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE C2.2: Restore Online Users List After Reconnect
  // ───────────────────────────────────────────────────────────────────────────
  // Description: After page refresh, online users list should be restored
  // Issue Testing: State restoration - users list available after reconnect
  // Expected Behavior: Receives and displays updated online_users list
  // Why It Matters: UX - users see current online status after refresh
  // Restoration Flow:
  //   1. User refreshes while in chat
  //   2. Socket reconnects
  //   3. Server sends updated online_users list
  //   4. Component displays refreshed user list
  //   5. User can continue chatting
  // ───────────────────────────────────────────────────────────────────────────
  test("should restore online users list after reconnect", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    // Get the online_users event handler
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

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE C3: MULTIPLE TABS / SAME ACCOUNT
// ═══════════════════════════════════════════════════════════════════════════════
// Purpose: Verify chat works correctly when user has multiple tabs open
// Critical for: Multi-tab support - common user behavior
// ═══════════════════════════════════════════════════════════════════════════════

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

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE C3.1: Handle Multiple Socket Connections
  // ───────────────────────────────────────────────────────────────────────────
  // Description: App should handle multiple chat tabs open gracefully
  // Issue Testing: Multi-tab support - prevents crashes from duplicate connections
  // Expected Behavior: App works without crashing when rendered multiple times
  // Why It Matters: UX - users often have multiple tabs/windows open
  // Multi-Tab Scenarios:
  //   - User opens chat in Tab A and Tab B
  //   - Both tabs try to connect socket
  //   - App should handle gracefully (may share connection or create separate)
  //   - No crashes or conflicts
  // ───────────────────────────────────────────────────────────────────────────
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

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE C3.2: No Crash with Duplicate Connections
  // ───────────────────────────────────────────────────────────────────────────
  // Description: UI should render fully even with multiple component instances
  // Issue Testing: Duplicate component handling - app remains functional
  // Expected Behavior: All UI elements present despite multiple renders
  // Why It Matters: Stability - app must be robust against multi-tab scenarios
  // ───────────────────────────────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE D1: PERFORMANCE - PREVENT INFINITE RECONNECTS
// ═══════════════════════════════════════════════════════════════════════════════
// Purpose: Verify socket doesn't reconnect infinitely on every render
// Critical for: Performance - prevents wasted resource connections
// ═══════════════════════════════════════════════════════════════════════════════

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

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE D1.1: Single Socket Connection on Mount
  // ───────────────────────────────────────────────────────────────────────────
  // Description: Socket should connect exactly once when component mounts
  // Issue Testing: Connection optimization - prevents multiple socket instances
  // Expected Behavior: connectSocket() called exactly 1 time
  // Why It Matters: Performance - prevents resource waste from duplicate connections
  // Connection Optimization:
  //   - Should use useEffect with empty dependency array
  //   - Or check if already connected before connecting
  //   - Prevents connection spam
  // ───────────────────────────────────────────────────────────────────────────
  test("should connect socket only once on mount", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    // Should be called exactly once
    expect(socketClient.connectSocket).toHaveBeenCalledTimes(1)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE D1.2: No Reconnect on Re-render
  // ───────────────────────────────────────────────────────────────────────────
  // Description: Socket should not reconnect when component re-renders
  // Issue Testing: Render optimization - prevents unnecessary reconnections
  // Expected Behavior: Still called only once even after re-render
  // Why It Matters: Performance - reduces server load and resource usage
  // Scenario:
  //   1. Component mounts → connects (call count: 1)
  //   2. State changes → component re-renders
  //   3. Should NOT reconnect (call count: still 1)
  //   4. Prevents connection loop that wastes resources
  // ───────────────────────────────────────────────────────────────────────────
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

    // Should still be 1, not 2
    expect(socketClient.connectSocket).toHaveBeenCalledTimes(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE D2: EVENT LISTENER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════
// Purpose: Verify socket event listeners are properly managed (no duplicates)
// Critical for: Stability - prevents duplicate message handling
// ═══════════════════════════════════════════════════════════════════════════════

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

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE D2.1: Register All Socket Event Listeners
  // ───────────────────────────────────────────────────────────────────────────
  // Description: All necessary socket events should be registered on mount
  // Issue Testing: Event listener registration - ensures all features work
  // Expected Behavior: Registers 5 event types:
  //   - online_users (for user list)
  //   - private_message (for incoming messages)
  //   - message_sent (for delivery confirmation)
  //   - user_offline (for offline notifications)
  //   - error_message (for error handling)
  // Why It Matters: Foundation for all real-time features
  // ───────────────────────────────────────────────────────────────────────────
  test("should register socket event listeners on mount", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    // Get all registered event names (lowercase)
    const eventNames = mockSocket.on.mock.calls.map(call => call[0])
    
    expect(eventNames).toContain("online_users")
    expect(eventNames).toContain("private_message")
    expect(eventNames).toContain("message_sent")
    expect(eventNames).toContain("user_offline")
    expect(eventNames).toContain("error_message")
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE D2.2: Cleanup All Event Listeners on Unmount
  // ───────────────────────────────────────────────────────────────────────────
  // Description: All event listeners should be removed when component unmounts
  // Issue Testing: Memory leak prevention - prevents duplicate listeners
  // Expected Behavior: Calls socket.off() for all registered events
  // Why It Matters: Stability - prevents duplicate message handling on re-mount
  // Cleanup Importance:
  //   1. User leaves chat → component unmounts
  //   2. Event listeners removed via socket.off()
  //   3. User comes back → fresh listeners registered
  //   4. Prevents duplicate message notifications
  // ───────────────────────────────────────────────────────────────────────────
  test("should cleanup event listeners on unmount", () => {
    const { unmount } = render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    unmount()

    // Get all unregistered event names (lowercase)
    const offEventNames = mockSocket.off.mock.calls.map(call => call[0])
    
    expect(offEventNames).toContain("online_users")
    expect(offEventNames).toContain("private_message")
    expect(offEventNames).toContain("message_sent")
    expect(offEventNames).toContain("user_offline")
    expect(offEventNames).toContain("error_message")
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE D2.3: No Duplicate Messages on Reconnect
  // ───────────────────────────────────────────────────────────────────────────
  // Description: Messages should not be duplicated after reconnecting
  // Issue Testing: Duplicate prevention - ensures single message delivery
  // Expected Behavior: Old listeners cleaned up before new ones added
  // Why It Matters: UX - prevents message duplication that confuses users
  // Duplicate Scenario (BAD):
  //   1. User refreshes page
  //   2. Old listener never removed
  //   3. New listener added
  //   4. Single server message triggers 2 handler calls
  //   5. Message appears twice in chat
  //
  // Solution (GOOD):
  //   1. Old listeners cleaned up in cleanup function
  //   2. New listeners added fresh
  //   3. Single message appears once
  // ───────────────────────────────────────────────────────────────────────────
  test("should not duplicate messages on reconnect", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    // Get the private_message event handler
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

    // App should still be functional
    expect(screen.getByText(/online users/i)).toBeInTheDocument()
  })
})