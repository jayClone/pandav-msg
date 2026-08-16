import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import FriendRequestModal from "@/pages/FriendRequestModal"

vi.mock("@api/friend.api.js", () => ({
  default: {
    getFriendshipSummary: vi.fn(),
    getSentRequests: vi.fn(),
    sendFriendRequest: vi.fn(),
    acceptFriendRequest: vi.fn(),
    rejectFriendRequest: vi.fn(),
    removeFriend: vi.fn(),
  },
}))

import friendAPI from "@api/friend.api.js"

const mockGetSummary = vi.mocked(friendAPI.getFriendshipSummary)
const mockGetSentRequests = vi.mocked(friendAPI.getSentRequests)
const mockSendFriendRequest = vi.mocked(friendAPI.sendFriendRequest)
const mockAcceptFriendRequest = vi.mocked(friendAPI.acceptFriendRequest)
const mockRejectFriendRequest = vi.mocked(friendAPI.rejectFriendRequest)
const mockRemoveFriend = vi.mocked(friendAPI.removeFriend)

const summaryResponse = ({ users = [], friends = [], pending = [] } = {}) => ({
  data: { data: { users, friends, pending } },
})

const sentRequestsResponse = (requests = []) => ({
  data: { data: requests },
})

const defaultSummary = () =>
  summaryResponse({
    users: [
      { _id: "u-contact-1", name: "Alice Contact" },
      { _id: "u-contact-2", name: "Bob Contact" },
    ],
    friends: [{ _id: "u-friend-1", name: "Charlie Friend" }],
    pending: [
      { _id: "req-1", senderId: { _id: "u-sender-1", name: "Dana Sender" } },
    ],
  })

describe("FriendRequestModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSummary.mockResolvedValue(defaultSummary())
    mockGetSentRequests.mockResolvedValue(sentRequestsResponse())
    window.confirm = vi.fn(() => true)
  })

  test("renders nothing when isOpen is false", () => {
    const { container } = render(
      <FriendRequestModal isOpen={false} onClose={vi.fn()} token="tok" />
    )
    expect(container).toBeEmptyDOMElement()
    expect(mockGetSummary).not.toHaveBeenCalled()
  })

  test("fetches the friendship summary when opened", async () => {
    render(<FriendRequestModal isOpen={true} onClose={vi.fn()} token="tok" />)

    await waitFor(() => expect(mockGetSummary).toHaveBeenCalledTimes(1))
    expect(await screen.findByText("Alice Contact")).toBeInTheDocument()
  })

  test("Contacts tab lists non-friend users with an Add Friend button", async () => {
    render(<FriendRequestModal isOpen={true} onClose={vi.fn()} token="tok" />)

    expect(await screen.findByText("Alice Contact")).toBeInTheDocument()
    expect(screen.getByText("Bob Contact")).toBeInTheDocument()
    // The existing friend should not show up under Contacts
    expect(screen.queryByText("Charlie Friend")).not.toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /as a friend$/i })).toHaveLength(2)
  })

  test("sending a friend request calls the API and refreshes sent requests", async () => {
    const user = userEvent.setup()
    let resolveSend
    mockSendFriendRequest.mockReturnValueOnce(
      new Promise((resolve) => { resolveSend = resolve })
    )

    render(<FriendRequestModal isOpen={true} onClose={vi.fn()} token="tok" />)
    await screen.findByText("Alice Contact")

    const [firstAddButton] = screen.getAllByRole("button", { name: /as a friend$/i })
    await user.click(firstAddButton)

    expect(mockSendFriendRequest).toHaveBeenCalledWith("u-contact-1")

    resolveSend({})
    await waitFor(() => expect(mockGetSentRequests).toHaveBeenCalled())
  })

  test("Friends tab shows current friends with a Remove button", async () => {
    const user = userEvent.setup()
    render(<FriendRequestModal isOpen={true} onClose={vi.fn()} token="tok" />)
    await screen.findByText("Alice Contact")

    await user.click(screen.getByRole("button", { name: /^friends/i }))

    expect(await screen.findByText("Charlie Friend")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument()
  })

  test("removing a friend confirms, calls the API, and updates the list", async () => {
    const user = userEvent.setup()
    const onFriendRemoved = vi.fn()
    mockRemoveFriend.mockResolvedValueOnce({})

    render(
      <FriendRequestModal
        isOpen={true}
        onClose={vi.fn()}
        token="tok"
        onFriendRemoved={onFriendRemoved}
      />
    )
    await screen.findByText("Alice Contact")
    await user.click(screen.getByRole("button", { name: /^friends/i }))
    await screen.findByText("Charlie Friend")

    await user.click(screen.getByRole("button", { name: /remove/i }))

    expect(window.confirm).toHaveBeenCalled()
    await waitFor(() => expect(mockRemoveFriend).toHaveBeenCalledWith("u-friend-1"))
    await waitFor(() => expect(screen.queryByText("Charlie Friend")).not.toBeInTheDocument())
    expect(onFriendRemoved).toHaveBeenCalledWith("u-friend-1")
  })

  test("removing a friend does nothing if the confirm dialog is declined", async () => {
    const user = userEvent.setup()
    window.confirm.mockReturnValueOnce(false)

    render(<FriendRequestModal isOpen={true} onClose={vi.fn()} token="tok" />)
    await screen.findByText("Alice Contact")
    await user.click(screen.getByRole("button", { name: /^friends/i }))
    await screen.findByText("Charlie Friend")

    await user.click(screen.getByRole("button", { name: /remove/i }))

    expect(mockRemoveFriend).not.toHaveBeenCalled()
    expect(screen.getByText("Charlie Friend")).toBeInTheDocument()
  })

  test("Received tab accepts a pending request and refetches", async () => {
    const user = userEvent.setup()
    mockAcceptFriendRequest.mockResolvedValueOnce({})

    render(<FriendRequestModal isOpen={true} onClose={vi.fn()} token="tok" />)
    await screen.findByText("Alice Contact")

    await user.click(screen.getByRole("button", { name: /received/i }))
    expect(await screen.findByText("Dana Sender")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /accept/i }))

    expect(mockAcceptFriendRequest).toHaveBeenCalledWith("req-1")
    await waitFor(() => expect(mockGetSummary).toHaveBeenCalledTimes(2))
  })

  test("Received tab rejects a pending request", async () => {
    const user = userEvent.setup()
    mockRejectFriendRequest.mockResolvedValueOnce({})

    render(<FriendRequestModal isOpen={true} onClose={vi.fn()} token="tok" />)
    await screen.findByText("Alice Contact")

    await user.click(screen.getByRole("button", { name: /received/i }))
    await screen.findByText("Dana Sender")

    await user.click(screen.getByRole("button", { name: /reject/i }))

    expect(mockRejectFriendRequest).toHaveBeenCalledWith("req-1")
  })

  test("Sent tab lists requests the user has sent and can cancel them", async () => {
    const user = userEvent.setup()
    mockSendFriendRequest.mockResolvedValueOnce({})
    mockGetSentRequests.mockResolvedValueOnce(
      sentRequestsResponse([
        { _id: "req-2", senderId: { _id: "me", name: "Me" }, receiverId: { _id: "u-contact-1", name: "Alice Contact" } },
      ])
    )
    mockRejectFriendRequest.mockResolvedValueOnce({})

    render(<FriendRequestModal isOpen={true} onClose={vi.fn()} token="tok" />)
    await screen.findByText("Alice Contact")

    const [firstAddButton] = screen.getAllByRole("button", { name: /as a friend$/i })
    await user.click(firstAddButton)
    await waitFor(() => expect(mockGetSentRequests).toHaveBeenCalled())

    await user.click(screen.getByRole("button", { name: /sent/i }))
    expect(await screen.findByText("Alice Contact")).toBeInTheDocument()
    expect(screen.getByText(/pending response/i)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /cancel/i }))
    expect(mockRejectFriendRequest).toHaveBeenCalledWith("req-2")
  })

  test("filters the visible list by the search box", async () => {
    const user = userEvent.setup()
    render(<FriendRequestModal isOpen={true} onClose={vi.fn()} token="tok" />)
    await screen.findByText("Alice Contact")

    await user.type(screen.getByPlaceholderText(/search by name/i), "Bob")

    expect(screen.queryByText("Alice Contact")).not.toBeInTheDocument()
    expect(screen.getByText("Bob Contact")).toBeInTheDocument()
  })

  test("shows an error banner when the summary fetch fails", async () => {
    mockGetSummary.mockRejectedValueOnce({ message: "Network error" })

    render(<FriendRequestModal isOpen={true} onClose={vi.fn()} token="tok" />)

    expect(await screen.findByText(/network error/i)).toBeInTheDocument()
  })

  test("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<FriendRequestModal isOpen={true} onClose={onClose} token="tok" />)
    await screen.findByText("Alice Contact")

    await user.click(screen.getByRole("button", { name: /close/i }))

    expect(onClose).toHaveBeenCalled()
  })

  test("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<FriendRequestModal isOpen={true} onClose={onClose} token="tok" />)
    await screen.findByText("Alice Contact")

    await user.keyboard("{Escape}")

    expect(onClose).toHaveBeenCalled()
  })
})
