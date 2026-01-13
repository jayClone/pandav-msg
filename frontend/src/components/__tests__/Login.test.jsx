import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { LoginForm } from "../login-form"
import { login } from "@/api/auth.api"
import { vi } from "vitest"

// Mock the auth API
vi.mock("@/api/auth.api", () => ({
  login: vi.fn(),
}))

// Mock useNavigate
const mockNavigate = vi.fn()

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
    login.mockClear()
    mockNavigate.mockClear()  // ✅ Clear mock before each test
    localStorage.clear()
  })

  test("should save token to localStorage when login succeeds", async () => {
    const user = userEvent.setup({ delay: null })

    login.mockResolvedValueOnce({
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

  test("should show success message on successful login", async () => {
    const user = userEvent.setup({ delay: null })

    login.mockResolvedValueOnce({
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
        expect(screen.getByText(/login successful/i)).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
  })

  test("should navigate to /chat after successful login", async () => {
    const user = userEvent.setup({ delay: null })

    login.mockResolvedValueOnce({
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
        expect(mockNavigate).toHaveBeenCalledWith("/chat")
      },
      { timeout: 3000 }
    )
  })
})

describe("LoginForm - Login Fail Flow", () => {
  beforeEach(() => {
    login.mockClear()
    mockNavigate.mockClear()  // ✅ Clear mock before each test
    localStorage.clear()
  })

  test("should show error message when login fails", async () => {
    const user = userEvent.setup({ delay: null })

    login.mockRejectedValueOnce({
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
    const user = userEvent.setup({ delay: null })

    login.mockRejectedValueOnce({
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
    const user = userEvent.setup({ delay: null })

    // ✅ Reset mock BEFORE this test runs
    mockNavigate.mockClear()

    login.mockRejectedValueOnce({
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

    // Wait for error message
    await waitFor(
      () => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
      },
      { timeout: 3000 }
    )

    // ✅ Now check that mockNavigate was NOT called
    // (it should have 0 calls from this test)
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})