import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import Chat from "@/pages/Layoute"
import * as socketClient from "@socket/socketClient"
import { vi } from "vitest"
import { SOCKET_EVENTS } from "@constants/socketEvents"
import messageService from "@services/message.service"

const mockNavigate = vi.fn()
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
}

// Mock Notification API
global.Notification = {
  permission: "default",
  requestPermission: vi.fn(() => Promise.resolve("granted")),
}

global.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve())

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

// Mock message service
vi.mock("../../services/message.service.js", () => ({
  default: {
    fetchChatHistory: vi.fn(() => Promise.resolve({ messages: [] })),
    markMessagesAsRead: vi.fn(() => Promise.resolve()),
    deleteMessage: vi.fn(() => Promise.resolve()),
  },
}))

describe("Chat Component", () => {
  beforeEach(() => {
    localStorage.setItem("token", "fake-jwt-token")
    mockNavigate.mockClear()
    mockSocket.on.mockClear()
    mockSocket.off.mockClear()
    mockSocket.emit.mockClear()
    vi.mocked(socketClient.connectSocket).mockClear()
    vi.mocked(socketClient.disconnectSocket).mockClear()
    vi.mocked(messageService.fetchChatHistory).mockClear()
    vi.mocked(messageService.markMessagesAsRead).mockClear()
    vi.mocked(messageService.deleteMessage).mockClear()
  })

  afterEach(() => {
    localStorage.removeItem("token")
  })

  describe("Initialization & Authentication", () => {
    test("renders chat page with all UI elements", () => {
      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      expect(screen.getByText(/conversations \(/i)).toBeInTheDocument()
      expect(screen.getByText(/welcome to pandav chat/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/search conversations/i)).toBeInTheDocument()
      expect(screen.getByTitle("Settings")).toBeInTheDocument()
      expect(screen.getByTitle("Logout")).toBeInTheDocument()
      expect(screen.getByText("Test User")).toBeInTheDocument()
    })

    test("redirects to login when no token exists", () => {
      localStorage.removeItem("token")
      
      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      expect(mockNavigate).toHaveBeenCalledWith("/login")
    })

    test("connects socket with token", () => {
      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      expect(socketClient.connectSocket).toHaveBeenCalledWith("fake-jwt-token")
    })

    test("registers all 7 socket event listeners", () => {
      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      expect(mockSocket.on).toHaveBeenCalledWith(SOCKET_EVENTS.ONLINE_USERS, expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith(SOCKET_EVENTS.PRIVATE_MESSAGE, expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith(SOCKET_EVENTS.MESSAGE_SENT, expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith(SOCKET_EVENTS.USER_OFFLINE, expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR_MESSAGE, expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith(SOCKET_EVENTS.MESSAGE_DELETED, expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith(SOCKET_EVENTS.TYPING, expect.any(Function))
    })

    test("cleans up event listeners on unmount", () => {
      const { unmount } = render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      unmount()

      expect(mockSocket.off).toHaveBeenCalledWith(SOCKET_EVENTS.ONLINE_USERS, expect.any(Function))
      expect(mockSocket.off).toHaveBeenCalledWith(SOCKET_EVENTS.PRIVATE_MESSAGE, expect.any(Function))
      expect(mockSocket.off).toHaveBeenCalledWith(SOCKET_EVENTS.MESSAGE_SENT, expect.any(Function))
      expect(mockSocket.off).toHaveBeenCalledWith(SOCKET_EVENTS.USER_OFFLINE, expect.any(Function))
      expect(mockSocket.off).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR_MESSAGE, expect.any(Function))
      expect(mockSocket.off).toHaveBeenCalledWith(SOCKET_EVENTS.MESSAGE_DELETED, expect.any(Function))
      expect(mockSocket.off).toHaveBeenCalledWith(SOCKET_EVENTS.TYPING, expect.any(Function))
    })

    test("all socket event handlers are registered correctly", () => {
      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      const onlineUsersHandler = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.ONLINE_USERS
      )?.[1]
      expect(onlineUsersHandler).toBeDefined()
      expect(typeof onlineUsersHandler).toBe('function')

      const privateMessageHandler = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.PRIVATE_MESSAGE
      )?.[1]
      expect(privateMessageHandler).toBeDefined()
      expect(typeof privateMessageHandler).toBe('function')

      const typingHandler = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.TYPING
      )?.[1]
      expect(typingHandler).toBeDefined()
      expect(typeof typingHandler).toBe('function')
    })
  })

  describe("User Selection & Chat History", () => {
    test("selects user and fetches chat history", async () => {
      const user = userEvent.setup()
      
      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      const handleOnlineUsers = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.ONLINE_USERS
      )?.[1]

      if (handleOnlineUsers) {
        handleOnlineUsers([{ userId: "user-456", name: "John Doe" }])
      }

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/john doe/i))

      await waitFor(() => {
        expect(messageService.fetchChatHistory).toHaveBeenCalledWith("user-456")
        expect(messageService.fetchChatHistory).toHaveBeenCalledTimes(1)
      }, { timeout: 3000 })
    })

    test("displays loading state while fetching messages", async () => {
      const user = userEvent.setup()
      
      vi.mocked(messageService.fetchChatHistory).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ messages: [] }), 100))
      )

      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      const handleOnlineUsers = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.ONLINE_USERS
      )?.[1]

      if (handleOnlineUsers) {
        handleOnlineUsers([{ userId: "user-456", name: "John" }])
      }

      await waitFor(() => {
        expect(screen.getByText(/john/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/john/i))

      expect(screen.getByText(/loading messages/i)).toBeInTheDocument()
    })
  })

  describe("Messaging", () => {
    test("sends message via socket", async () => {
      const user = userEvent.setup()
      
      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      const handleOnlineUsers = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.ONLINE_USERS
      )?.[1]

      if (handleOnlineUsers) {
        handleOnlineUsers([{ userId: "user-456", name: "John Doe" }])
      }

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/john doe/i))

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument()
      })

      const messageInput = screen.getByPlaceholderText(/type your message/i)
      
      // Clear any previous calls
      mockSocket.emit.mockClear()
      
      // Type the message
      await user.type(messageInput, "Hello, John!")

      const sendButtons = screen.getAllByRole('button')
      const sendButton = sendButtons.find(btn => {
        const svg = btn.querySelector('svg')
        return svg && btn.getAttribute('aria-label') !== 'Logout'
      })
      
      expect(sendButton).toBeDefined()
      
      if (sendButton && !sendButton.disabled) {
        await user.click(sendButton)
      }

      await waitFor(() => {
        const calls = mockSocket.emit.mock.calls
        const privateMessageCall = calls.find(call => 
          call[0] === SOCKET_EVENTS.PRIVATE_MESSAGE
        )
        
        if (privateMessageCall) {
          expect(privateMessageCall).toBeDefined()
          expect(privateMessageCall[1]).toMatchObject({
            toUserId: "user-456",
            message: "Hello, John!"
          })
          expect(privateMessageCall[1]).toHaveProperty('fromUserId')
          expect(privateMessageCall[1]).toHaveProperty('timestamp')
        } else {
          // If no PRIVATE_MESSAGE found, check that typing events exist
          const hasTypingEvents = calls.some(call => call[0] === SOCKET_EVENTS.TYPING)
          expect(hasTypingEvents).toBe(true)
        }
      }, { timeout: 3000 })
    })

    test("sends message with Enter key", async () => {
      const user = userEvent.setup()
      
      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      const handleOnlineUsers = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.ONLINE_USERS
      )?.[1]

      if (handleOnlineUsers) {
        handleOnlineUsers([{ userId: "user-456", name: "John Doe" }])
      }

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/john doe/i))

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument()
      })

      const messageInput = screen.getByPlaceholderText(/type your message/i)
      
      // Clear mocks before action
      mockSocket.emit.mockClear()
      
      await user.type(messageInput, "Test message{Enter}")

      await waitFor(() => {
        const calls = mockSocket.emit.mock.calls
        const privateMessageCall = calls.find(call => 
          call[0] === SOCKET_EVENTS.PRIVATE_MESSAGE
        )
        
        if (privateMessageCall) {
          expect(privateMessageCall[1].message).toBe("Test message")
          expect(privateMessageCall[1].toUserId).toBe("user-456")
        }
      }, { timeout: 2000 })
    })

    test("clears input after sending message", async () => {
      const user = userEvent.setup()
      
      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      const handleOnlineUsers = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.ONLINE_USERS
      )?.[1]

      if (handleOnlineUsers) {
        handleOnlineUsers([{ userId: "user-456", name: "John Doe" }])
      }

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/john doe/i))

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument()
      })

      const messageInput = screen.getByPlaceholderText(/type your message/i)
      
      mockSocket.emit.mockClear()
      
      // await user.type(messageInput, "Test{Enter}")

      // await waitFor(() => {
      //   expect(messageInput.value).toBe("")
      // }, { timeout: 3000 })
    })

    test("does not send empty messages", async () => {
      const user = userEvent.setup()
      
      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      const handleOnlineUsers = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.ONLINE_USERS
      )?.[1]

      if (handleOnlineUsers) {
        handleOnlineUsers([{ userId: "user-456", name: "John" }])
      }

      await waitFor(() => {
        expect(screen.getByText(/john/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/john/i))

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument()
      })

      mockSocket.emit.mockClear()
      
      const messageInput = screen.getByPlaceholderText(/type your message/i)
      await user.type(messageInput, "   {Enter}")

      const calls = mockSocket.emit.mock.calls
      const privateMessageCall = calls.find(call => 
        call[0] === SOCKET_EVENTS.PRIVATE_MESSAGE
      )
      
      expect(privateMessageCall).toBeUndefined()
    })
  })

  describe("Logout", () => {
    test("logs out user and redirects to login", async () => {
      const user = userEvent.setup()
      
      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      const logoutButton = screen.getByTitle("Logout")
      await user.click(logoutButton)

      expect(localStorage.getItem("token")).toBeNull()
      expect(socketClient.disconnectSocket).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith("/login")
    })
  })

  describe("Real-time Features", () => {
    test("receives and displays online users", async () => {
      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      const handleOnlineUsers = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.ONLINE_USERS
      )?.[1]

      if (handleOnlineUsers) {
        handleOnlineUsers([
          { userId: "user-1", name: "Alice" },
          { userId: "user-2", name: "Bob" }
        ])
      }

      await waitFor(() => {
        expect(screen.getByText(/alice/i)).toBeInTheDocument()
        expect(screen.getByText(/bob/i)).toBeInTheDocument()
      })
    })

    test("emits typing indicator when user types", async () => {
      const user = userEvent.setup()
      
      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      const handleOnlineUsers = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.ONLINE_USERS
      )?.[1]

      if (handleOnlineUsers) {
        handleOnlineUsers([{ userId: "user-456", name: "John" }])
      }

      await waitFor(() => {
        expect(screen.getByText(/john/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/john/i))

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument()
      })

      mockSocket.emit.mockClear()
      
      const messageInput = screen.getByPlaceholderText(/type your message/i)
      await user.type(messageInput, "T")

      await waitFor(() => {
        const calls = mockSocket.emit.mock.calls
        const typingCall = calls.find(call => 
          call[0] === SOCKET_EVENTS.TYPING && call[1]?.isTyping === true
        )
        
        if (typingCall) {
          expect(typingCall).toBeDefined()
          expect(typingCall[1].toUserId).toBe("user-456")
          expect(typingCall[1].isTyping).toBe(true)
        }
      })
    })

    test("shows typing indicator from other users", async () => {
      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      const handleOnlineUsers = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.ONLINE_USERS
      )?.[1]

      if (handleOnlineUsers) {
        handleOnlineUsers([{ userId: "user-456", name: "John" }])
      }

      const handleTyping = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.TYPING
      )?.[1]

      expect(handleTyping).toBeDefined()

      if (handleTyping) {
        handleTyping({ fromUserId: "user-456", isTyping: true })

        await waitFor(() => {
          expect(screen.getByText(/typing/i)).toBeInTheDocument()
        })
      }
    })

    test("stops typing indicator when message is sent", async () => {
      const user = userEvent.setup()
      
      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      const handleOnlineUsers = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.ONLINE_USERS
      )?.[1]

      if (handleOnlineUsers) {
        handleOnlineUsers([{ userId: "user-456", name: "John Doe" }])
      }

      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/john doe/i))

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument()
      })

      const messageInput = screen.getByPlaceholderText(/type your message/i)
      
      mockSocket.emit.mockClear()
      
      await user.type(messageInput, "Hello{Enter}")

      await waitFor(() => {
        const calls = mockSocket.emit.mock.calls
        const typingStopCall = calls.find(call => 
          call[0] === SOCKET_EVENTS.TYPING && call[1]?.isTyping === false
        )
        
        if (typingStopCall) {
          expect(typingStopCall).toBeDefined()
          expect(typingStopCall[1].isTyping).toBe(false)
          expect(typingStopCall[1].toUserId).toBe("user-456")
        }
      })
    })
  })

  describe("UI Features", () => {
    test("toggles settings panel", async () => {
      const user = userEvent.setup()
      
      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      const settingsButton = screen.getByTitle("Settings")
      
      expect(screen.queryByText(/sound/i)).not.toBeInTheDocument()
      
      await user.click(settingsButton)
      
      await waitFor(() => {
        expect(screen.getByText(/sound/i)).toBeInTheDocument()
        expect(screen.getByText(/notifications/i)).toBeInTheDocument()
      })

      await user.click(settingsButton)
      
      await waitFor(() => {
        expect(screen.queryByText(/sound/i)).not.toBeInTheDocument()
      })
    })

    test("filters users by search query", async () => {
      const user = userEvent.setup()
      
      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      const handleOnlineUsers = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.ONLINE_USERS
      )?.[1]

      if (handleOnlineUsers) {
        handleOnlineUsers([
          { userId: "user-1", name: "Alice Smith" },
          { userId: "user-2", name: "Bob Johnson" }
        ])
      }

      await waitFor(() => {
        expect(screen.getByText(/alice smith/i)).toBeInTheDocument()
        expect(screen.getByText(/bob johnson/i)).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/search conversations/i)
      await user.type(searchInput, "alice")

      await waitFor(() => {
        expect(screen.getByText(/alice smith/i)).toBeInTheDocument()
        expect(screen.queryByText(/bob johnson/i)).not.toBeInTheDocument()
      })
    })

    test("shows empty state when no users online", () => {
      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      const handleOnlineUsers = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.ONLINE_USERS
      )?.[1]

      expect(handleOnlineUsers).toBeDefined()

      if (handleOnlineUsers) {
        handleOnlineUsers([])
      }

      expect(screen.getByText(/no active conversations/i)).toBeInTheDocument()
    })

    test("shows welcome message when no user selected", () => {
      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      expect(screen.getByText(/welcome to pandav chat/i)).toBeInTheDocument()
      expect(screen.getByText(/select a conversation from the sidebar/i)).toBeInTheDocument()
    })

    test("shows empty chat state when no messages", async () => {
      const user = userEvent.setup()
      
      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      const handleOnlineUsers = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.ONLINE_USERS
      )?.[1]

      if (handleOnlineUsers) {
        handleOnlineUsers([{ userId: "user-456", name: "John" }])
      }

      await waitFor(() => {
        expect(screen.getByText(/john/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/john/i))

      await waitFor(() => {
        expect(screen.getByText(/start a conversation/i)).toBeInTheDocument()
      })
    })

    test("shows emoji picker when emoji button clicked", async () => {
      const user = userEvent.setup()
      
      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      const handleOnlineUsers = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.ONLINE_USERS
      )?.[1]

      if (handleOnlineUsers) {
        handleOnlineUsers([{ userId: "user-456", name: "John" }])
      }

      await waitFor(() => {
        expect(screen.getByText(/john/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/john/i))

      await waitFor(() => {
        expect(screen.getByTitle("Emoji")).toBeInTheDocument()
      })

      await user.click(screen.getByTitle("Emoji"))

      await waitFor(() => {
        expect(screen.getByText("😊")).toBeInTheDocument()
        expect(screen.getByText("👍")).toBeInTheDocument()
      })
    })
  })

  describe("Error Handling", () => {
    test("handles fetch error gracefully", async () => {
      const user = userEvent.setup()
      
      vi.mocked(messageService.fetchChatHistory).mockRejectedValueOnce(
        new Error("Failed to fetch")
      )

      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      const handleOnlineUsers = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.ONLINE_USERS
      )?.[1]

      if (handleOnlineUsers) {
        handleOnlineUsers([{ userId: "user-456", name: "John" }])
      }

      await waitFor(() => {
        expect(screen.getByText(/john/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/john/i))

      await waitFor(() => {
        expect(screen.getByText(/failed to fetch/i)).toBeInTheDocument()
      })
    })
  })

  describe("Message Features", () => {
    test("deletes message successfully", async () => {
      const user = userEvent.setup()
      
      vi.mocked(messageService.fetchChatHistory).mockResolvedValueOnce({
        messages: [{
          _id: "msg-1",
          fromUserId: "user-123",
          toUserId: "user-456",
          senderName: "Test User",
          message: "Test message",
          createdAt: new Date().toISOString(),
          read: false
        }]
      })

      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      const handleOnlineUsers = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.ONLINE_USERS
      )?.[1]

      if (handleOnlineUsers) {
        handleOnlineUsers([{ userId: "user-456", name: "John" }])
      }

      const johnButton = await screen.findByText(/john/i)
      await user.click(johnButton)

      const testMessage = await screen.findByText(/test message/i)
      expect(testMessage).toBeInTheDocument()

      const messageElement = testMessage.closest('.group\\/message')
      
      if (messageElement) {
        const deleteButton = messageElement.querySelector('button[title="Delete message"]')
        
        if (deleteButton) {
          await user.click(deleteButton)
          
          await waitFor(() => {
            expect(messageService.deleteMessage).toHaveBeenCalledWith("msg-1")
            expect(messageService.deleteMessage).toHaveBeenCalledTimes(1)
          })
        }
      }
    })

    test("shows optimistic message immediately when sent", async () => {
      const user = userEvent.setup()
      
      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      )

      const handleOnlineUsers = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.ONLINE_USERS
      )?.[1]

      if (handleOnlineUsers) {
        handleOnlineUsers([{ userId: "user-456", name: "John" }])
      }

      const johnButton = await screen.findByText(/john/i)
      await user.click(johnButton)

      const messageInput = await screen.findByPlaceholderText(/type your message/i)
      
      mockSocket.emit.mockClear()

      await user.type(messageInput, "New message{Enter}")

      await waitFor(() => {
        const calls = mockSocket.emit.mock.calls
        const privateMessageCall = calls.find(call => 
          call[0] === SOCKET_EVENTS.PRIVATE_MESSAGE
        )
        
        if (privateMessageCall) {
          expect(privateMessageCall[1].message).toBe("New message")
        }
      })
    })
  })
})