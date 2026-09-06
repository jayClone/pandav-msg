import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import FriendRequestModal from "../FriendRequestModal"

vi.mock("@api/friend.api.js", () => ({
  default: {
    getFriendshipSummary: vi.fn(),
    getSentRequests: vi.fn(),
    sendFriendRequest: vi.fn(),
    rejectFriendRequest: vi.fn(),
    acceptFriendRequest: vi.fn(),
    removeFriend: vi.fn(),
  },
}))

vi.mock("@socket/socketClient.js", () => ({
  getSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
}))

import friendAPI from "@api/friend.api.js"

const mockGetFriendshipSummary = vi.mocked(friendAPI.getFriendshipSummary)

const noop = () => {}

// Regression test: fetchAllData() destructured { users, friends, pending }
// from the /friends/summary response but silently dropped the `sent` field
// the backend already returns — sentRequests only ever got populated as a
// side effect of handleSendRequest's own separate getSentRequests() call.
// That meant: the Sent tab showed 0 on first open even with real pending
// sent requests from a prior session, real-time socket refreshes never
// updated it, and — worst — Cancel's own fetchAllData() refresh never
// removed the just-cancelled request, leaving Contacts unable to show that
// person again and Sent showing a phantom entry.
describe("FriendRequestModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("sentRequests is populated from the initial summary fetch, not only after sending a new request", async () => {
    mockGetFriendshipSummary.mockResolvedValue({
      data: {
        data: {
          users: [],
          friends: [],
          pending: [],
          sent: [
            {
              _id: "req-1",
              senderId: { _id: "me-id", name: "Me" },
              receiverId: { _id: "user-2", name: "User Two" },
            },
          ],
        },
      },
    })

    const user = userEvent.setup()
    render(
      <FriendRequestModal isOpen={true} onClose={noop} token="fake-token" onFriendRemoved={noop} />
    )

    await waitFor(() => expect(mockGetFriendshipSummary).toHaveBeenCalled())

    // The tab button renders two responsive text variants ("Sent" /
    // "Out") as sibling spans — both exist in jsdom (it doesn't evaluate
    // the sm: breakpoint classes that hide one of them), so match loosely.
    await user.click(screen.getByRole("button", { name: /sent/i }))

    expect(await screen.findByText("User Two")).toBeInTheDocument()
    // The regression-prone path: getSentRequests must NOT be the only way
    // this ever gets populated.
    expect(friendAPI.getSentRequests).not.toHaveBeenCalled()
  })

  test("cancelling a sent request removes it from the Sent tab after the refetch", async () => {
    mockGetFriendshipSummary
      .mockResolvedValueOnce({
        data: {
          data: {
            users: [],
            friends: [],
            pending: [],
            sent: [
              {
                _id: "req-1",
                senderId: { _id: "me-id", name: "Me" },
                receiverId: { _id: "user-2", name: "User Two" },
              },
            ],
          },
        },
      })
      .mockResolvedValueOnce({
        data: { data: { users: [], friends: [], pending: [], sent: [] } },
      })

    friendAPI.rejectFriendRequest.mockResolvedValue({ data: { success: true } })

    const user = userEvent.setup()
    render(
      <FriendRequestModal isOpen={true} onClose={noop} token="fake-token" onFriendRemoved={noop} />
    )

    await waitFor(() => expect(mockGetFriendshipSummary).toHaveBeenCalledTimes(1))
    // The tab button renders two responsive text variants ("Sent" /
    // "Out") as sibling spans — both exist in jsdom (it doesn't evaluate
    // the sm: breakpoint classes that hide one of them), so match loosely.
    await user.click(screen.getByRole("button", { name: /sent/i }))
    await screen.findByText("User Two")

    await user.click(screen.getByRole("button", { name: /cancel/i }))

    await waitFor(() => expect(mockGetFriendshipSummary).toHaveBeenCalledTimes(2))
    await waitFor(() => {
      expect(screen.queryByText("User Two")).not.toBeInTheDocument()
    })
  })
})
