import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import naclLib from "tweetnacl"
import { encodeBase64 } from "tweetnacl-util"
import GroupChat from "@/pages/GroupChat"
import cryptoService from "@services/crypto.service.js"
import { SOCKET_EVENTS } from "@constants/socketEvents"

// GroupChat.jsx talks to: group.service.js (group CRUD), friend.api.js (for
// the create-group member picker), raw `axios` directly for fetching group
// messages (it bypasses the shared @api/axios.js instance — a pre-existing
// inconsistency, not something introduced by this test), and the socket
// client. crypto.service runs for real so the pairwise-fan-out encryption
// and TOFU key-pinning are exercised end-to-end, same approach as
// chat.test.jsx.
vi.mock("@services/group.service.js", () => ({
  default: {
    getMyGroups: vi.fn(),
    getGroup: vi.fn(),
    createGroup: vi.fn(),
    removeMember: vi.fn(),
    deleteGroup: vi.fn(),
    leaveGroup: vi.fn(),
  },
}))

vi.mock("@api/friend.api.js", () => ({
  default: {
    getFriends: vi.fn(),
  },
}))

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
  },
}))

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connected: true,
}

vi.mock("@socket/socketClient.js", () => ({
  getSocket: vi.fn(() => mockSocket),
}))

import groupService from "@services/group.service.js"
import friendAPI from "@api/friend.api.js"
import axios from "axios"

const mockGetMyGroups = vi.mocked(groupService.getMyGroups)
const mockGetGroup = vi.mocked(groupService.getGroup)
const mockCreateGroup = vi.mocked(groupService.createGroup)
const mockGetFriends = vi.mocked(friendAPI.getFriends)
const mockAxiosGet = vi.mocked(axios.get)

const generateKeypair = () => naclLib.box.keyPair()

// Encrypt `plaintext` as if `sender` were the logged-in user, addressed to
// `recipientUserId`, without disturbing crypto.service's real "me" state.
const encryptAs = async (sender, senderUserId, recipientPublicKey, recipientUserId, plaintext) => {
  const realMe = cryptoService.myUserId
  const realMyKeypair = cryptoService.myKeypair
  const realRecipientKey = cryptoService.getPublicKey(recipientUserId)

  cryptoService.storeMyKeypair(senderUserId, sender.publicKey, sender.secretKey)
  cryptoService.storePublicKey(recipientUserId, recipientPublicKey)
  const ciphertext = await cryptoService.encryptMessage(plaintext, recipientUserId)

  cryptoService.storeMyKeypair(realMe, realMyKeypair.publicKey, realMyKeypair.secretKey)
  if (realRecipientKey) cryptoService.storePublicKey(recipientUserId, realRecipientKey)

  return ciphertext
}

// GroupChat re-registers its GROUP_MESSAGE listener whenever the selected
// group changes (the effect depends on `selectedGroup?.id`), so multiple
// handlers pile up on this on()-only mock over a test's lifetime — the
// first is bound to a stale (pre-selection) closure. Grab the most recent.
const getSocketHandler = (eventName) => {
  const calls = mockSocket.on.mock.calls.filter(([name]) => name === eventName)
  return calls.at(-1)?.[1]
}

// The sidebar also shows a "<sender>: <message>" last-message preview, whose
// sender name lives in a nested <span> — Testing Library's default text
// matcher only looks at an element's own direct text-node children, so the
// preview's trailing text node ends up matching the bare message text too.
// Scope to the actual message bubble (class `leading-relaxed`) to disambiguate.
const findMessageBubble = async (text) => {
  const bubbles = await screen.findAllByText(text)
  const bubble = bubbles.find((el) => el.className.includes("leading-relaxed"))
  expect(bubble).toBeTruthy()
  return bubble
}

const noop = () => {}

describe("GroupChat", () => {
  let me
  let member

  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.removeItem("e2ee-pinned-keys")
    mockSocket.on.mockClear()
    mockSocket.emit.mockClear()
    mockSocket.connected = true
    cryptoService.clearAllKeys()
    window.confirm = vi.fn(() => true)

    me = generateKeypair()
    member = generateKeypair()
    cryptoService.storeMyKeypair("me-id", me.publicKey, me.secretKey)

    mockGetMyGroups.mockResolvedValue([
      { _id: "group-1", name: "Test Group", members: [{ _id: "me-id" }, { _id: "member-1" }], createdAt: new Date().toISOString() },
    ])

    mockGetGroup.mockResolvedValue({
      _id: "group-1",
      name: "Test Group",
      adminId: "me-id",
      adminName: "Me",
      members: [
        { _id: "me-id", name: "Me", publicKey: encodeBase64(me.publicKey) },
        { _id: "member-1", name: "Member One", publicKey: encodeBase64(member.publicKey) },
      ],
    })

    mockAxiosGet.mockResolvedValue({ data: { success: true, data: [], hasMore: false, nextCursor: null } })
    mockGetFriends.mockResolvedValue({ data: { success: true, data: [] } })
  })

  const renderGroupChat = () =>
    render(
      <GroupChat
        sidebarOpen={true}
        setSidebarOpen={noop}
        token="fake-token"
        currentUserName="Me"
        currentUserId="me-id"
        onChatOpen={noop}
        isChatOpen={false}
      />
    )

  test("fetches and renders the groups list on mount", async () => {
    renderGroupChat()

    expect(await screen.findByText("Test Group")).toBeInTheDocument()
    expect(mockGetMyGroups).toHaveBeenCalledTimes(1)
  })

  test("selecting a group loads members and decrypts messages", async () => {
    const user = userEvent.setup()
    const encrypted = await encryptAs(member, "member-1", me.publicKey, "me-id", "hello group")

    mockAxiosGet.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          {
            _id: "msg-1",
            fromUserId: "member-1",
            senderName: "Member One",
            message: encrypted,
            isEncrypted: true,
            time: new Date().toISOString(),
            readBy: [],
          },
        ],
        hasMore: false,
        nextCursor: null,
      },
    })

    renderGroupChat()
    await user.click(await screen.findByText("Test Group"))

    await findMessageBubble("hello group")
    expect(mockGetGroup).toHaveBeenCalledWith("group-1")
  })

  test("sending a group message fans out a separate ciphertext per member", async () => {
    const user = userEvent.setup()
    renderGroupChat()

    await user.click(await screen.findByText("Test Group"))
    await waitFor(() => expect(mockGetGroup).toHaveBeenCalled())

    const input = screen.getByPlaceholderText("Message...")
    await user.type(input, "hi group{Enter}")

    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.GROUP_MESSAGE,
        expect.objectContaining({ groupId: "group-1", isEncrypted: true })
      )
    })

    const [, payload] = mockSocket.emit.mock.calls.find(([event]) => event === SOCKET_EVENTS.GROUP_MESSAGE)
    expect(Object.keys(payload.ciphertexts).sort()).toEqual(["me-id", "member-1"])
    expect(payload.ciphertexts["me-id"]).not.toContain("hi group")
    expect(payload.ciphertexts["member-1"]).not.toContain("hi group")
    // each member gets their own independent ciphertext, not a shared blob
    expect(payload.ciphertexts["me-id"]).not.toEqual(payload.ciphertexts["member-1"])
  })

  test("receiving a live group message decrypts using our own ciphertext entry", async () => {
    const user = userEvent.setup()
    renderGroupChat()
    await user.click(await screen.findByText("Test Group"))
    await waitFor(() => expect(mockGetGroup).toHaveBeenCalled())

    const groupMessageHandler = getSocketHandler(SOCKET_EVENTS.GROUP_MESSAGE)
    expect(groupMessageHandler).toBeTypeOf("function")

    const myCiphertext = await encryptAs(member, "member-1", me.publicKey, "me-id", "live group message")

    await groupMessageHandler({
      _id: "live-1",
      groupId: "group-1",
      fromUserId: "member-1",
      fromUserName: "Member One",
      isEncrypted: true,
      ciphertexts: { "me-id": myCiphertext },
      createdAt: new Date().toISOString(),
    })

    await findMessageBubble("live group message")
  })

  test("shows a security-key-changed warning for a group member and clears it once trusted", async () => {
    const user = userEvent.setup()
    renderGroupChat()
    await user.click(await screen.findByText("Test Group"))
    await waitFor(() => expect(mockGetGroup).toHaveBeenCalled())

    const otherKeypair = generateKeypair()
    window.dispatchEvent(
      new CustomEvent(cryptoService.KEY_CHANGED_EVENT, {
        detail: {
          userId: "member-1",
          oldPublicKey: encodeBase64(member.publicKey),
          newPublicKey: encodeBase64(otherKeypair.publicKey),
        },
      })
    )

    expect(await screen.findByText(/security key changed/i)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /trust new key/i }))

    await waitFor(() => {
      expect(screen.queryByText(/security key changed/i)).not.toBeInTheDocument()
    })
  })

  // Regression test: nothing in GroupChat.jsx ever listened for
  // ERROR_MESSAGE, the event every backend socket handler (rate limiting,
  // membership checks, save failures) uses to report a rejected send. A
  // failed group message send used to leave no signal that it never
  // actually reached the server.
  test("a server-side error_message is surfaced to the user", async () => {
    const user = userEvent.setup()
    renderGroupChat()
    await user.click(await screen.findByText("Test Group"))
    await waitFor(() => expect(mockGetGroup).toHaveBeenCalled())

    const errorHandler = getSocketHandler(SOCKET_EVENTS.ERROR_MESSAGE)
    expect(errorHandler).toBeTypeOf("function")

    errorHandler({ message: "Too many messages. Please slow down." })

    expect(await screen.findByText(/too many messages/i)).toBeInTheDocument()
  })

  test("creates a group with a selected member", async () => {
    const user = userEvent.setup()
    mockGetFriends.mockResolvedValue({
      data: { success: true, data: [{ _id: "friend-1", name: "Friend One", email: "friend@example.com" }] },
    })
    mockCreateGroup.mockResolvedValueOnce({
      _id: "group-2",
      name: "New Group",
      members: [{ _id: "me-id" }, { _id: "friend-1" }],
      createdAt: new Date().toISOString(),
    })

    renderGroupChat()
    await screen.findByText("Test Group")

    await user.click(screen.getByTitle("Create Group"))
    await user.type(screen.getByPlaceholderText("Enter name"), "New Group")
    await user.click(await screen.findByText("Friend One"))
    await user.click(screen.getByRole("button", { name: /^create$/i }))

    await waitFor(() => {
      expect(mockCreateGroup).toHaveBeenCalledWith("New Group", ["friend-1"])
    })
    expect(await screen.findByText("New Group")).toBeInTheDocument()
  })
})
