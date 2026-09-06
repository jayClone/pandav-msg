import { useState } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { vi } from "vitest"
import naclLib from "tweetnacl"
import { encodeBase64 } from "tweetnacl-util"
import Chat from "@/pages/Chat"
import cryptoService from "@services/crypto.service.js"
import { SOCKET_EVENTS } from "@constants/socketEvents"

// Chat.jsx talks to three network-ish boundaries directly: the friends API,
// the message service, and the socket client (just getSocket/isSocketConnected
// — connectSocket/disconnectSocket belong to Layoute, not Chat). Everything
// else, including crypto.service, runs for real so encryption/decryption and
// the TOFU key-pinning behavior are exercised end-to-end.
vi.mock("@api/friend.api.js", () => ({
  default: {
    getFriends: vi.fn(),
  },
}))

vi.mock("@services/message.service.js", () => ({
  default: {
    fetchChatHistory: vi.fn(),
    markMessagesAsRead: vi.fn(() => Promise.resolve(true)),
    deleteMessage: vi.fn(() => Promise.resolve(true)),
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
  isSocketConnected: vi.fn(() => true),
}))

const mockNavigate = vi.fn()
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return { ...actual, useNavigate: () => mockNavigate }
})

import friendAPI from "@api/friend.api.js"
import messageService from "@services/message.service.js"

const mockGetFriends = vi.mocked(friendAPI.getFriends)
const mockFetchChatHistory = vi.mocked(messageService.fetchChatHistory)

// tweetnacl directly, purely to synthesize *other* parties' keypairs quickly
// in tests. crypto.service.js only exposes the real (deliberately slow,
// scrypt-backed) password-derived path, which is already covered by
// crypto.service.test.js — these tests care about Chat.jsx's behavior given
// a keypair, not about re-deriving one.
const generateKeypair = () => naclLib.box.keyPair()

// Encrypt `plaintext` as if `sender` were the logged-in user, addressed to
// `recipientUserId` — without disturbing crypto.service's real "me" state,
// which the component under test depends on.
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

// Test harness: Chat.jsx receives `allUsers`/`setAllUsers` as lifted state
// from its parent (Layoute in production) rather than owning it itself, so
// the test wrapper plays that role.
function ChatHarness(props) {
  const [allUsers, setAllUsers] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  return (
    <MemoryRouter>
      <Chat
        currentUserName="Me"
        currentUserId="me-id"
        token="fake-token"
        allUsers={allUsers}
        setAllUsers={setAllUsers}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onChatOpen={() => {}}
        isChatOpen={false}
        {...props}
      />
    </MemoryRouter>
  )
}

const getSocketHandler = (eventName) => {
  const call = mockSocket.on.mock.calls.find(([name]) => name === eventName)
  return call?.[1]
}

describe("Chat", () => {
  let me
  let friend

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    window.localStorage.removeItem("e2ee-pinned-keys")
    mockSocket.on.mockClear()
    mockSocket.emit.mockClear()
    mockSocket.connected = true
    cryptoService.clearAllKeys()
    window.confirm = vi.fn(() => true)

    me = generateKeypair()
    friend = generateKeypair()
    cryptoService.storeMyKeypair("me-id", me.publicKey, me.secretKey)

    mockGetFriends.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            _id: "friend-1",
            name: "Friend One",
            email: "friend@example.com",
            publicKey: encodeBase64(friend.publicKey),
            isOnline: true,
          },
        ],
      },
    })

    mockFetchChatHistory.mockResolvedValue({ messages: [], hasMore: false, nextCursor: null })
  })

  test("fetches and renders the friends list on mount", async () => {
    render(<ChatHarness />)

    expect(await screen.findByText("Friend One")).toBeInTheDocument()
    expect(mockGetFriends).toHaveBeenCalledTimes(1)
  })

  // Regression test: the friend-list row — the only way to open a 1:1
  // chat — was a bare <div onClick>, invisible to the browser's tab order
  // and completely unreachable by keyboard-only or screen-reader users.
  test("a friend list item is keyboard-reachable and opens the chat with Enter", async () => {
    const user = userEvent.setup()
    render(<ChatHarness />)

    const friendName = await screen.findByText("Friend One")
    const friendItem = friendName.closest('[role="button"]')
    expect(friendItem).toBeTruthy()
    expect(friendItem).toHaveAttribute("tabIndex", "0")

    friendItem.focus()
    await user.keyboard("{Enter}")

    await waitFor(() => expect(mockFetchChatHistory).toHaveBeenCalledWith("friend-1"))
  })

  // Guards the fix above: the row's own onKeyDown must not fire for a key
  // event that actually originated on the nested Pin <button> (keydown
  // bubbles), or focusing/activating Pin would incorrectly also open the
  // chat underneath it.
  test("pressing Enter on the nested Pin button does not also open the chat", async () => {
    mockGetFriends.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          { _id: "friend-1", name: "Friend One", email: "friend@example.com", publicKey: encodeBase64(friend.publicKey), isOnline: true },
          { _id: "friend-2", name: "Friend Two", email: "friend2@example.com", publicKey: encodeBase64(generateKeypair().publicKey), isOnline: false },
        ],
      },
    })

    const user = userEvent.setup()
    render(<ChatHarness />)
    await screen.findByText("Friend Two")

    mockFetchChatHistory.mockClear()

    const pinButtons = screen.getAllByTitle("Pin chat")
    // The second friend's pin button (Friend Two hasn't been selected/opened).
    pinButtons[1].focus()
    await user.keyboard("{Enter}")

    expect(mockFetchChatHistory).not.toHaveBeenCalledWith("friend-2")
  })

  test("selecting a friend loads and decrypts chat history", async () => {
    const user = userEvent.setup()
    const encryptedFromFriend = await encryptAs(friend, "friend-1", me.publicKey, "me-id", "hello from friend")

    mockFetchChatHistory.mockResolvedValueOnce({
      messages: [
        {
          _id: "msg-1",
          fromUserId: "friend-1",
          toUserId: "me-id",
          message: encryptedFromFriend,
          isEncrypted: true,
          senderName: "Friend One",
          time: new Date().toISOString(),
          read: true,
        },
      ],
      hasMore: false,
      nextCursor: null,
    })

    render(<ChatHarness />)
    await user.click(await screen.findByText("Friend One"))

    expect(await screen.findByText("hello from friend")).toBeInTheDocument()
  })

  test("sending a message encrypts it and shows an optimistic plaintext bubble", async () => {
    const user = userEvent.setup()
    render(<ChatHarness />)

    await user.click(await screen.findByText("Friend One"))
    await waitFor(() => expect(mockFetchChatHistory).toHaveBeenCalled())

    const input = screen.getByPlaceholderText(/type a message/i)
    await user.type(input, "hi there{Enter}")

    expect(await screen.findByText("hi there")).toBeInTheDocument()

    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.PRIVATE_MESSAGE,
        expect.objectContaining({ toUserId: "friend-1", isEncrypted: true })
      )
    })

    const [, payload] = mockSocket.emit.mock.calls.find(([event]) => event === SOCKET_EVENTS.PRIVATE_MESSAGE)
    expect(payload.message).not.toContain("hi there") // must be ciphertext, not plaintext
  })

  test("regression: out-of-order MESSAGE_SENT acks don't swap real _ids onto the wrong optimistic message", async () => {
    // Two rapid sends before either ack returns, with the acks arriving in
    // reverse order (the second message's DB write finishes first). The old
    // matching logic grabbed whichever "temp_" message was first in the
    // array, so the second ack's real _id landed on the FIRST message.
    // uniqueId-based matching must keep each ack on its own message.
    const user = userEvent.setup()
    render(<ChatHarness />)

    await user.click(await screen.findByText("Friend One"))
    await waitFor(() => expect(mockFetchChatHistory).toHaveBeenCalled())

    const input = screen.getByPlaceholderText(/type a message/i)
    await user.type(input, "first message{Enter}")
    await screen.findByText("first message")
    await user.type(input, "second message{Enter}")
    await screen.findByText("second message")

    const sentCalls = mockSocket.emit.mock.calls.filter(([event]) => event === SOCKET_EVENTS.PRIVATE_MESSAGE)
    expect(sentCalls).toHaveLength(2)
    const firstUniqueId = sentCalls[0][1].uniqueId
    const secondUniqueId = sentCalls[1][1].uniqueId
    expect(firstUniqueId).toBeTruthy()
    expect(secondUniqueId).toBeTruthy()
    expect(firstUniqueId).not.toBe(secondUniqueId)

    const messageSentHandler = getSocketHandler(SOCKET_EVENTS.MESSAGE_SENT)
    expect(messageSentHandler).toBeTypeOf("function")

    // Ack the SECOND message first, then the first — out of order.
    await messageSentHandler({
      _id: "real-second", uniqueId: secondUniqueId,
      fromUserId: "me-id", toUserId: "friend-1", time: new Date().toISOString(),
    })
    await messageSentHandler({
      _id: "real-first", uniqueId: firstUniqueId,
      fromUserId: "me-id", toUserId: "friend-1", time: new Date().toISOString(),
    })

    await screen.findByText("first message")
    await screen.findByText("second message")

    // Messages render in array order, so the delete buttons line up with
    // "first message" then "second message".
    const deleteButtons = screen.getAllByTitle("Delete")
    expect(deleteButtons).toHaveLength(2)

    await user.click(deleteButtons[0])
    expect(mockSocket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.MESSAGE_DELETED,
      expect.objectContaining({ messageId: "real-first" })
    )

    mockSocket.emit.mockClear()
    await user.click(screen.getByTitle("Delete"))
    expect(mockSocket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.MESSAGE_DELETED,
      expect.objectContaining({ messageId: "real-second" })
    )
  })

  // Regression test: nothing in Chat.jsx ever listened for ERROR_MESSAGE,
  // the event every backend socket handler (rate limiting, friend checks,
  // save failures) uses to report a rejected send. A failed send used to
  // leave the optimistic bubble on screen with no signal it never actually
  // reached the server.
  test("a server-side error_message is surfaced to the user", async () => {
    const user = userEvent.setup()
    render(<ChatHarness />)
    await user.click(await screen.findByText("Friend One"))
    await waitFor(() => expect(mockFetchChatHistory).toHaveBeenCalled())

    const errorHandler = getSocketHandler(SOCKET_EVENTS.ERROR_MESSAGE)
    expect(errorHandler).toBeTypeOf("function")

    errorHandler({ message: "Too many messages. Please slow down." })

    expect(await screen.findByText(/too many messages/i)).toBeInTheDocument()
  })

  // Regression test: private-message.handler.js's ERROR_MESSAGE emits
  // didn't include the failed send's uniqueId, so a rejected send left its
  // optimistic bubble on screen forever — still stamped delivered:true —
  // since only a successful MESSAGE_SENT ack ever replaces a temp_
  // message. The banner alone told the user *something* failed, but the
  // UI kept lying about that specific message having gone through.
  test("a server-side error_message with a uniqueId removes the matching optimistic bubble", async () => {
    const user = userEvent.setup()
    render(<ChatHarness />)
    await user.click(await screen.findByText("Friend One"))
    await waitFor(() => expect(mockFetchChatHistory).toHaveBeenCalled())

    const input = screen.getByPlaceholderText(/type a message/i)
    await user.type(input, "this will fail{Enter}")
    await screen.findByText("this will fail")

    const [, payload] = mockSocket.emit.mock.calls.find(([event]) => event === SOCKET_EVENTS.PRIVATE_MESSAGE)
    const uniqueId = payload.uniqueId
    expect(uniqueId).toBeTruthy()

    const errorHandler = getSocketHandler(SOCKET_EVENTS.ERROR_MESSAGE)
    errorHandler({ message: "Failed to save message", uniqueId })

    await waitFor(() => {
      expect(screen.queryByText("this will fail")).not.toBeInTheDocument()
    })
  })

  test("receiving a private message over the socket decrypts and displays it", async () => {
    const user = userEvent.setup()
    render(<ChatHarness />)
    await user.click(await screen.findByText("Friend One"))
    await waitFor(() => expect(mockFetchChatHistory).toHaveBeenCalled())

    const privateMessageHandler = getSocketHandler(SOCKET_EVENTS.PRIVATE_MESSAGE)
    expect(privateMessageHandler).toBeTypeOf("function")

    const incoming = await encryptAs(friend, "friend-1", me.publicKey, "me-id", "live incoming message")

    await privateMessageHandler({
      _id: "live-1",
      fromUserId: "friend-1",
      toUserId: "me-id",
      fromUserName: "Friend One",
      message: incoming,
      isEncrypted: true,
      time: new Date().toISOString(),
    })

    expect(await screen.findByText("live incoming message")).toBeInTheDocument()
  })

  test("shows a security-key-changed warning and clears it once trusted", async () => {
    const user = userEvent.setup()
    render(<ChatHarness />)
    await user.click(await screen.findByText("Friend One"))
    await waitFor(() => expect(mockFetchChatHistory).toHaveBeenCalled())

    const otherKeypair = generateKeypair()
    window.dispatchEvent(
      new CustomEvent(cryptoService.KEY_CHANGED_EVENT, {
        detail: {
          userId: "friend-1",
          oldPublicKey: encodeBase64(friend.publicKey),
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

  test("deleting your own message confirms, emits the delete event, and removes it", async () => {
    const user = userEvent.setup()
    render(<ChatHarness />)
    await user.click(await screen.findByText("Friend One"))
    await waitFor(() => expect(mockFetchChatHistory).toHaveBeenCalled())

    const input = screen.getByPlaceholderText(/type a message/i)
    await user.type(input, "delete me{Enter}")
    await screen.findByText("delete me")

    await user.click(screen.getByTitle("Delete"))

    expect(window.confirm).toHaveBeenCalled()
    expect(mockSocket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.MESSAGE_DELETED,
      expect.objectContaining({ toUserId: "friend-1" })
    )
    await waitFor(() => expect(screen.queryByText("delete me")).not.toBeInTheDocument())
  })

  test("filters the friends list by the debounced search box", async () => {
    const user = userEvent.setup()
    mockGetFriends.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          { _id: "friend-1", name: "Friend One", email: "f1@example.com", publicKey: encodeBase64(friend.publicKey), isOnline: true },
          { _id: "friend-2", name: "Someone Else", email: "f2@example.com", publicKey: encodeBase64(generateKeypair().publicKey), isOnline: false },
        ],
      },
    })

    render(<ChatHarness />)
    await screen.findByText("Friend One")
    expect(screen.getByText("Someone Else")).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/search friends/i), "Friend One")

    await waitFor(() => {
      expect(screen.queryByText("Someone Else")).not.toBeInTheDocument()
    })
    expect(screen.getByText("Friend One")).toBeInTheDocument()
  })
})
