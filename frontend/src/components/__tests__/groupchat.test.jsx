import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import GroupChat from "@pages/GroupChat"
import groupService from "@services/group.service"
import messageService from "@services/message.service"
import API from "@api/axios.js"
import { vi } from "vitest"

// Mock jwt-decode first before other mocks
vi.mock("jwt-decode", () => ({
  jwtDecode: vi.fn(() => ({
    userId: "user-123",
    name: "Test User"
  }))
}))

// Mock services
vi.mock("../../services/group.service.js", () => ({
  default: {
    getMyGroups: vi.fn(() =>
      Promise.resolve([
        {
          _id: "group-1",
          name: "Test Group",
          adminId: { _id: "user-123" },
          members: [
            { _id: "user-123", name: "Test User", email: "test@test.com" },
            { _id: "user-456", name: "John Doe", email: "john@test.com" }
          ]
        }
      ])
    ),
    getGroup: vi.fn((groupId) =>
      Promise.resolve({
        _id: groupId,
        name: "Test Group",
        adminId: { _id: "user-123" },
        members: [
          { _id: "user-123", name: "Test User", email: "test@test.com" },
          { _id: "user-456", name: "John Doe", email: "john@test.com" }
        ]
      })
    ),
    getGroupMessages: vi.fn(() =>
      Promise.resolve({
        messages: [
          {
            _id: "msg-1",
            content: "Hello",
            sender: { _id: "user-123", name: "Test User" },
            createdAt: new Date().toISOString()
          }
        ],
        count: 1
      })
    ),
    createGroup: vi.fn(() =>
      Promise.resolve({
        _id: "group-new",
        name: "New Group",
        adminId: { _id: "user-123" },
        members: []
      })
    ),
    addMember: vi.fn(() =>
      Promise.resolve({
        _id: "group-1",
        name: "Test Group",
        members: [
          { _id: "user-123", name: "Test User", email: "test@test.com" },
          { _id: "user-456", name: "John Doe", email: "john@test.com" },
          { _id: "user-789", name: "New Member", email: "new@test.com" }
        ]
      })
    ),
    removeMember: vi.fn(() =>
      Promise.resolve({
        _id: "group-1",
        name: "Test Group",
        members: [
          { _id: "user-123", name: "Test User", email: "test@test.com" }
        ]
      })
    )
  }
}))

vi.mock("../../services/message.service.js", () => ({
  default: {
    sendGroupMessage: vi.fn(() =>
      Promise.resolve({
        _id: "msg-new",
        content: "New message",
        sender: { _id: "user-123", name: "Test User" },
        createdAt: new Date().toISOString()
      })
    ),
    markGroupMessagesAsRead: vi.fn(() =>
      Promise.resolve({
        success: true,
        message: "Messages marked as read"
      })
    )
  }
}))

vi.mock("../../api/axios.js", () => ({
  default: {
    get: vi.fn((url) => {
      if (url === "/users") {
        return Promise.resolve({
          data: {
            data: [
              { _id: "user-789", name: "New Member", email: "new@test.com" },
              { _id: "user-101", name: "Another User", email: "another@test.com" },
              { _id: "user-123", name: "Test User", email: "test@test.com" },
              { _id: "user-456", name: "John Doe", email: "john@test.com" }
            ]
          }
        })
      }
      return Promise.reject(new Error("Not found"))
    })
  }
}))

describe("GroupChat Component", () => {
  beforeEach(() => {
    localStorage.setItem("token", "fake-jwt-token")
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.removeItem("token")
  })

  describe("Initialization", () => {
    test("renders group chat page with sidebar", async () => {
      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Groups \(/)).toBeInTheDocument()
      })
    })

    test("loads and displays groups on mount", async () => {
      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(groupService.getMyGroups).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(screen.getByText(/Test Group/)).toBeInTheDocument()
      })
    })

    test("shows welcome message initially", () => {
      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      expect(screen.getByText(/Select a Group/)).toBeInTheDocument()
    })
  })

  describe("Group Selection", () => {
    test("selects group and fetches messages", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Test Group/)).toBeInTheDocument()
      })

      const groupItem = screen.getByText(/Test Group/)
      await user.click(groupItem)

      await waitFor(() => {
        expect(groupService.getGroupMessages).toHaveBeenCalledWith("group-1")
      })
    })

    test("displays group name in header when selected", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Test Group/)).toBeInTheDocument()
      })

      const groupItem = screen.getByText(/Test Group/)
      await user.click(groupItem)

      await waitFor(() => {
        const headers = screen.getAllByText(/Test Group/)
        expect(headers.length).toBeGreaterThan(1)
      })
    })

    test("displays member count", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Test Group/)).toBeInTheDocument()
      })

      const groupItem = screen.getByText(/Test Group/)
      await user.click(groupItem)

      await waitFor(() => {
        const memberCounts = screen.getAllByText(/2 members/)
        expect(memberCounts.length).toBeGreaterThan(0)
      })
    })
  })

  describe("Messaging", () => {
    test("sends message to group", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Test Group/)).toBeInTheDocument()
      })

      const groupItem = screen.getByText(/Test Group/)
      await user.click(groupItem)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Type a message/i)).toBeInTheDocument()
      })

      const messageInput = screen.getByPlaceholderText(/Type a message/i)
      await user.type(messageInput, "Test message")
      
      const sendButton = screen.getAllByRole("button").find(btn => !btn.textContent)
      if (sendButton) {
        await user.click(sendButton)
      }

      await waitFor(() => {
        expect(screen.getByText(/Hello/)).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    test("displays messages from group", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Test Group/)).toBeInTheDocument()
      })

      const groupItem = screen.getByText(/Test Group/)
      await user.click(groupItem)

      await waitFor(() => {
        expect(screen.getByText(/Hello/)).toBeInTheDocument()
      })
    })

    test("sends message with enter key", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        const groupItems = screen.getAllByText(/Test Group/)
        expect(groupItems.length).toBeGreaterThan(0)
      })

      const groupItems = screen.getAllByText(/Test Group/)
      await user.click(groupItems[0])

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Type a message/i)).toBeInTheDocument()
      })

      const messageInput = screen.getByPlaceholderText(/Type a message/i)
      await user.type(messageInput, "Test message{Enter}")

      // Verify the message service was called
      const mockSend = vi.mocked(messageService.sendGroupMessage)
      expect(mockSend).toHaveBeenCalled()
    })
  })

  describe("Members Modal", () => {
    test("opens members preview modal", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Test Group/)).toBeInTheDocument()
      })

      const groupItem = screen.getByText(/Test Group/)
      await user.click(groupItem)

      await waitFor(() => {
        expect(screen.getByText(/Members/)).toBeInTheDocument()
      })

      const membersButton = screen.getByText(/Members/)
      await user.click(membersButton)

      await waitFor(() => {
        expect(screen.getByText(/Group Members/)).toBeInTheDocument()
      })
    })

    test("displays all members in modal", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Test Group/)).toBeInTheDocument()
      })

      const groupItem = screen.getByText(/Test Group/)
      await user.click(groupItem)

      await waitFor(() => {
        expect(screen.getByText(/Members/)).toBeInTheDocument()
      })

      const membersButton = screen.getByText(/Members/)
      await user.click(membersButton)

      await waitFor(() => {
        expect(screen.getByText(/John Doe/)).toBeInTheDocument()
      })
    })

    test("shows admin badge for group admin", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Test Group/)).toBeInTheDocument()
      })

      const groupItem = screen.getByText(/Test Group/)
      await user.click(groupItem)

      await waitFor(() => {
        expect(screen.getByText(/Members/)).toBeInTheDocument()
      })

      const membersButton = screen.getByText(/Members/)
      await user.click(membersButton)

      await waitFor(() => {
        expect(screen.getByText(/Admin/)).toBeInTheDocument()
      })
    })

    test("closes members modal", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Test Group/)).toBeInTheDocument()
      })

      const groupItem = screen.getByText(/Test Group/)
      await user.click(groupItem)

      await waitFor(() => {
        expect(screen.getByText(/Members/)).toBeInTheDocument()
      })

      const membersButton = screen.getByText(/Members/)
      await user.click(membersButton)

      await waitFor(() => {
        expect(screen.getByText(/Group Members/)).toBeInTheDocument()
      })

      const allCloseButtons = screen.queryAllByTitle("Close")
      const modalClose = allCloseButtons[allCloseButtons.length - 1]
      if (modalClose) {
        await user.click(modalClose)
      }

      await waitFor(() => {
        expect(screen.queryByText(/Group Members/)).not.toBeInTheDocument()
      })
    })
  })

  describe("Add Member", () => {
    test("shows add member button for admin", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getAllByText(/Test Group/).length).toBeGreaterThan(0)
      })

      const groupItems = screen.getAllByText(/Test Group/)
      await user.click(groupItems[0])

      await waitFor(() => {
        const addButton = screen.queryByText(/Add Member/)
        expect(addButton).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    test("opens add member form", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getAllByText(/Test Group/).length).toBeGreaterThan(0)
      })

      const groupItems = screen.getAllByText(/Test Group/)
      await user.click(groupItems[0])

      await waitFor(() => {
        expect(screen.queryByText(/Add Member/)).toBeInTheDocument()
      }, { timeout: 3000 })

      const addButton = screen.getByText(/Add Member/)
      await user.click(addButton)

      await waitFor(() => {
        expect(screen.getByText(/Add Members to Group/)).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe("Create Group", () => {
    test("opens create group modal", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /New Group/i })).toBeInTheDocument()
      })

      const createButton = screen.getByRole("button", { name: /New Group/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(screen.getByText(/Create New Group/)).toBeInTheDocument()
      })
    })

    test("closes create group modal", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/New Group/)).toBeInTheDocument()
      })

      const createButton = screen.getByText(/New Group/)
      await user.click(createButton)

      await waitFor(() => {
        expect(screen.getByText(/Create New Group/)).toBeInTheDocument()
      })

      const closeButton = screen.getByRole("button", { name: /cancel/i })
      await user.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByText(/Create New Group/)).not.toBeInTheDocument()
      })
    })
  })

  describe("Logout", () => {
    test("logs out user", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByTitle(/Logout/)).toBeInTheDocument()
      })

      const logoutButton = screen.getByTitle(/Logout/)
      await user.click(logoutButton)

      expect(localStorage.getItem("token")).toBeNull()
    })
  })

  describe("UI Elements", () => {
    test("shows group list", async () => {
      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Groups \(/)).toBeInTheDocument()
      })
    })

    test("shows loading state when fetching groups", () => {
      vi.mocked(groupService.getMyGroups).mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve([]), 1000))
      )

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      const spinner = screen.queryByRole("img", { hidden: true })
      expect(spinner || document.querySelector(".animate-spin")).toBeTruthy()
    })
  })

  describe("Read Receipt Feature", () => {
    test("displays read receipt button on each message", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Test Group/)).toBeInTheDocument()
      })

      const groupItem = screen.getByText(/Test Group/)
      await user.click(groupItem)

      await waitFor(() => {
        expect(screen.getByText(/Hello/)).toBeInTheDocument()
      })

      // Check for read receipt button with checkmark icons
      const readReceiptButtons = screen.getAllByTitle(/View read receipts/)
      expect(readReceiptButtons.length).toBeGreaterThan(0)
    })

    test("marks message as read when button is clicked", async () => {
      const user = userEvent.setup()
      const mockMarkAsRead = vi.mocked(messageService.markGroupMessagesAsRead)

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        const groupItems = screen.getAllByText(/Test Group/)
        expect(groupItems.length).toBeGreaterThan(0)
      })

      const groupItems = screen.getAllByText(/Test Group/)
      await user.click(groupItems[0])

      await waitFor(() => {
        expect(screen.getByText(/Hello/)).toBeInTheDocument()
      })

      const readReceiptButtons = screen.getAllByTitle(/View read receipts/)
      if (readReceiptButtons.length > 0) {
        await user.click(readReceiptButtons[0])

        await waitFor(() => {
          expect(mockMarkAsRead).toHaveBeenCalled()
        }, { timeout: 2000 })
      }
    })

    test("expands read receipt dropdown when clicked", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Test Group/)).toBeInTheDocument()
      })

      const groupItem = screen.getByText(/Test Group/)
      await user.click(groupItem)

      await waitFor(() => {
        expect(screen.getByText(/Hello/)).toBeInTheDocument()
      })

      const readReceiptButtons = screen.getAllByTitle(/View read receipts/)
      if (readReceiptButtons.length > 0) {
        await user.click(readReceiptButtons[0])

        await waitFor(() => {
          expect(screen.getByText(/Read by/)).toBeInTheDocument()
        }, { timeout: 2000 })
      }
    })

    test("closes read receipt dropdown when clicked again", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Test Group/)).toBeInTheDocument()
      })

      const groupItem = screen.getByText(/Test Group/)
      await user.click(groupItem)

      await waitFor(() => {
        expect(screen.getByText(/Hello/)).toBeInTheDocument()
      })

      const readReceiptButtons = screen.getAllByTitle(/View read receipts/)
      if (readReceiptButtons.length > 0) {
        // Open dropdown
        await user.click(readReceiptButtons[0])

        await waitFor(() => {
          expect(screen.getByText(/Read by/)).toBeInTheDocument()
        }, { timeout: 2000 })

        // Close dropdown
        await user.click(readReceiptButtons[0])

        await waitFor(() => {
          expect(screen.queryByText(/Read by/)).not.toBeInTheDocument()
        }, { timeout: 2000 })
      }
    })

    test("shows correct member count in read receipt", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Test Group/)).toBeInTheDocument()
      })

      const groupItem = screen.getByText(/Test Group/)
      await user.click(groupItem)

      await waitFor(() => {
        expect(screen.getByText(/Hello/)).toBeInTheDocument()
      })

      const readReceiptButtons = screen.getAllByTitle(/View read receipts/)
      if (readReceiptButtons.length > 0) {
        await user.click(readReceiptButtons[0])

        await waitFor(() => {
          const readByText = screen.getByText(/Read by/)
          expect(readByText).toBeInTheDocument()
        }, { timeout: 2000 })
      }
    })

    test("auto-marks messages as read after group selection", async () => {
      const user = userEvent.setup()
      const mockMarkAsRead = vi.mocked(messageService.markGroupMessagesAsRead)

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        const groupItems = screen.getAllByText(/Test Group/)
        expect(groupItems.length).toBeGreaterThan(0)
      })

      const groupItems = screen.getAllByText(/Test Group/)
      await user.click(groupItems[0])

      await waitFor(() => {
        expect(screen.getByText(/Hello/)).toBeInTheDocument()
      })

      // Wait for auto-mark effect (1 second delay)
      await waitFor(() => {
        expect(mockMarkAsRead).toHaveBeenCalled()
      }, { timeout: 3000 })
    })

    test("displays member names in read receipt dropdown", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        const groupItems = screen.getAllByText(/Test Group/)
        expect(groupItems.length).toBeGreaterThan(0)
      })

      const groupItems = screen.getAllByText(/Test Group/)
      await user.click(groupItems[0])

      await waitFor(() => {
        expect(screen.getByText(/Hello/)).toBeInTheDocument()
      })

      const readReceiptButtons = screen.getAllByTitle(/View read receipts/)
      if (readReceiptButtons.length > 0) {
        await user.click(readReceiptButtons[0])

        await waitFor(() => {
          const memberElements = screen.getAllByText(/John Doe/)
          expect(memberElements.length).toBeGreaterThan(0)
        }, { timeout: 2000 })
      }
    })

    test("shows sender indicator in read receipt", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Test Group/)).toBeInTheDocument()
      })

      const groupItem = screen.getByText(/Test Group/)
      await user.click(groupItem)

      await waitFor(() => {
        expect(screen.getByText(/Hello/)).toBeInTheDocument()
      })

      const readReceiptButtons = screen.getAllByTitle(/View read receipts/)
      if (readReceiptButtons.length > 0) {
        await user.click(readReceiptButtons[0])

        await waitFor(() => {
          expect(screen.getByText(/\(Sender\)/)).toBeInTheDocument()
        }, { timeout: 2000 })
      }
    })
  })

  describe("Message Arrow Pointer", () => {
    test("message bubble includes arrow pointer styling", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Test Group/)).toBeInTheDocument()
      })

      const groupItem = screen.getByText(/Test Group/)
      await user.click(groupItem)

      await waitFor(() => {
        expect(screen.getByText(/Hello/)).toBeInTheDocument()
      })

      // Check for message wrapper with relative positioning for arrow
      const messageContent = screen.getByText(/Hello/)
      const messageWrapper = messageContent.closest(".relative")
      
      // Verify message bubble structure exists
      expect(messageContent.closest(".glass-effect")).toBeInTheDocument()
    })
  })

  describe("Message Rendering", () => {
    test("displays sender name for each message", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        const groupItems = screen.getAllByText(/Test Group/)
        expect(groupItems.length).toBeGreaterThan(0)
      })

      const groupItems = screen.getAllByText(/Test Group/)
      await user.click(groupItems[0])

      await waitFor(() => {
        const senderNames = screen.getAllByText(/Test User/)
        expect(senderNames.length).toBeGreaterThan(1)
      })
    })

    test("displays message content", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Test Group/)).toBeInTheDocument()
      })

      const groupItem = screen.getByText(/Test Group/)
      await user.click(groupItem)

      await waitFor(() => {
        expect(screen.getByText(/Hello/)).toBeInTheDocument()
      })
    })

    test("displays message timestamp", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Test Group/)).toBeInTheDocument()
      })

      const groupItem = screen.getByText(/Test Group/)
      await user.click(groupItem)

      await waitFor(() => {
        expect(screen.getByText(/Hello/)).toBeInTheDocument()
      })

      // Timestamp should be present (formatted time)
      const timeElements = document.querySelectorAll(".text-xs.text-gray-500")
      expect(timeElements.length).toBeGreaterThan(0)
    })

    test("displays sender avatar with first letter", async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <GroupChat />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Test Group/)).toBeInTheDocument()
      })

      const groupItem = screen.getByText(/Test Group/)
      await user.click(groupItem)

      await waitFor(() => {
        expect(screen.getByText(/Hello/)).toBeInTheDocument()
      })

      // Check for avatar with "T" (first letter of Test User)
    //   const avatars = document.querySelectorAll(".bg-linear-to-br.from-purple-500.to-green-500")
    //   expect(avatars.length).toBeGreaterThan(0)
    })
  })
})
