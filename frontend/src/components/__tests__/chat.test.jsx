import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import Chat from "../../pages/Chat"
import { vi } from "vitest"

const mockNavigate = vi.fn()

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe("Chat Page - If Token Exists", () => {
  beforeEach(() => {
    localStorage.setItem("token", "fake-jwt-token")
    mockNavigate.mockClear()
  })

  afterEach(() => {
    localStorage.removeItem("token")
  })

  test("should show 'Chat Page' heading when token exists", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/chat page/i)
  })

  test("should show logout button when token exists", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument()
  })

  test("should show 'Token saved' message when token exists", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    expect(screen.getByText(/token saved/i)).toBeInTheDocument()
  })
})

describe("Chat Page - If Token Not Exists", () => {
  beforeEach(() => {
    localStorage.removeItem("token")
    mockNavigate.mockClear()
  })

  test("should show 'Not logged in' message when token does not exist", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/not logged in/i)
  })

  test("should show login button when token does not exist", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    expect(screen.getByRole("button", { name: /go to login/i })).toBeInTheDocument()
  })

  test("should NOT show logout button when token does not exist", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    expect(screen.queryByRole("button", { name: /logout/i })).not.toBeInTheDocument()
  })

  test("should NOT show 'Chat Page' heading when token does not exist", () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    expect(screen.queryByText(/chat page/i)).not.toBeInTheDocument()
  })
})

describe("Chat Page - Logout Behavior", () => {
  beforeEach(() => {
    localStorage.setItem("token", "fake-jwt-token")
    mockNavigate.mockClear()
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

    // Verify token exists before logout
    expect(localStorage.getItem("token")).toBe("fake-jwt-token")

    // Click logout button
    await user.click(screen.getByRole("button", { name: /logout/i }))

    // ✅ Check that token is actually removed (not mocking the function)
    expect(localStorage.getItem("token")).toBeNull()
  })

  test("should redirect to /login when logout is clicked", async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    await user.click(screen.getByRole("button", { name: /logout/i }))

    expect(mockNavigate).toHaveBeenCalledWith("/login")
  })

  test("should show 'Not logged in' after logout", async () => {
    const user = userEvent.setup()

    const { rerender } = render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    // Verify Chat Page is visible
    expect(screen.getByText(/chat page/i)).toBeInTheDocument()

    // Click logout
    await user.click(screen.getByRole("button", { name: /logout/i }))

    // Token should be gone
    expect(localStorage.getItem("token")).toBeNull()

    // Re-render component
    rerender(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    )

    // Should show "Not logged in"
    expect(screen.getByText(/not logged in/i)).toBeInTheDocument()
  })
})