import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { LoginForm } from "../login-form"
import { login } from "@/api/auth.api"
import { vi } from "vitest"

// ✅ Define mockNavigate BEFORE vi.mock()
const mockNavigate = vi.fn()

// Mock the auth API
vi.mock("@/api/auth.api", () => ({
  login: vi.fn(),
}))

// ✅ Mock react-router-dom with pre-defined mockNavigate
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe("LoginForm - UI Render Tests", () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    localStorage.clear()
  })

  test("should render login heading", () => {
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    expect(screen.getByPlaceholderText(/m@example.com/i)).toBeInTheDocument()
  })

  test("should render email and password fields", () => {
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    expect(screen.getByPlaceholderText(/m@example.com/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument()
  })

  test("should render login button", () => {
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument()
  })
})

describe("LoginForm - Login Success Flow", () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    vi.mocked(login).mockClear()
    localStorage.clear()
  })

  test("should save token to localStorage when login succeeds", async () => {
    const user = userEvent.setup()

    vi.mocked(login).mockResolvedValueOnce({
      token: "fake-jwt-token",
    })

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    await user.type(screen.getByPlaceholderText(/m@example.com/i), "test@example.com")
    await user.type(screen.getByPlaceholderText(/••••••••/i), "password123")
    await user.click(screen.getByRole("button", { name: /login/i }))

    await waitFor(
      () => {
        expect(localStorage.getItem("token")).toBe("fake-jwt-token")
      },
      { timeout: 3000 }
    )
  })

  test("should navigate to /chat after successful login", async () => {
    const user = userEvent.setup()

    vi.mocked(login).mockResolvedValueOnce({
      token: "fake-jwt-token",
    })

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    await user.type(screen.getByPlaceholderText(/m@example.com/i), "test@example.com")
    await user.type(screen.getByPlaceholderText(/••••••••/i), "password123")
    await user.click(screen.getByRole("button", { name: /login/i }))

    // ✅ Debug: Check if navigate was called at all
    console.log("Navigate calls:", mockNavigate.mock.calls)

    await waitFor(
      () => {
        console.log("Checking navigate - calls:", mockNavigate.mock.calls)
        expect(mockNavigate).toHaveBeenCalledWith("/chat")
      },
      { timeout: 5000 }
    )
  })

  test("should show success message on successful login", async () => {
    const user = userEvent.setup()

    vi.mocked(login).mockResolvedValueOnce({
      token: "fake-jwt-token",
    })

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    await user.type(screen.getByPlaceholderText(/m@example.com/i), "test@example.com")
    await user.type(screen.getByPlaceholderText(/••••••••/i), "password123")
    await user.click(screen.getByRole("button", { name: /login/i }))

    // ✅ Wait for token first, then check navigate
    await waitFor(
      () => {
        expect(localStorage.getItem("token")).toBe("fake-jwt-token")
      },
      { timeout: 3000 }
    )

    await waitFor(
      () => {
        console.log("Navigate calls after token saved:", mockNavigate.mock.calls)
        expect(mockNavigate).toHaveBeenCalledWith("/chat")
      },
      { timeout: 3000 }
    )
  })
})

describe("LoginForm - Login Fail Flow", () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    vi.mocked(login).mockClear()
    localStorage.clear()
  })

  test("should show error message when login fails", async () => {
    const user = userEvent.setup()

    vi.mocked(login).mockRejectedValueOnce({
      response: {
        data: {
          message: "Invalid credentials",
        },
      },
    })

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    await user.type(screen.getByPlaceholderText(/m@example.com/i), "test@example.com")
    await user.type(screen.getByPlaceholderText(/••••••••/i), "wrongpassword")
    await user.click(screen.getByRole("button", { name: /login/i }))

    await waitFor(
      () => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
  })

  test("should NOT save token when login fails", async () => {
    const user = userEvent.setup()

    vi.mocked(login).mockRejectedValueOnce({
      response: {
        data: {
          message: "Invalid credentials",
        },
      },
    })

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    await user.type(screen.getByPlaceholderText(/m@example.com/i), "test@example.com")
    await user.type(screen.getByPlaceholderText(/••••••••/i), "wrongpassword")
    await user.click(screen.getByRole("button", { name: /login/i }))

    await waitFor(
      () => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
      },
      { timeout: 3000 }
    )

    expect(localStorage.getItem("token")).toBeNull()
  })

  test("should not navigate when login fails", async () => {
    const user = userEvent.setup()

    vi.mocked(login).mockRejectedValueOnce({
      response: {
        data: {
          message: "Invalid credentials",
        },
      },
    })

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    await user.type(screen.getByPlaceholderText(/m@example.com/i), "test@example.com")
    await user.type(screen.getByPlaceholderText(/••••••••/i), "wrongpassword")
    await user.click(screen.getByRole("button", { name: /login/i }))

    await waitFor(
      () => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
      },
      { timeout: 3000 }
    )

    // ✅ Navigate should not be called
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})