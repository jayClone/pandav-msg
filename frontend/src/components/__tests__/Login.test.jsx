import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { LoginForm } from "../login-form"
import { vi } from "vitest"

// Mock the real dependency boundaries LoginForm talks to: the auth service
// (network) and the crypto service (E2EE keypair derivation). We do NOT mock
// @/utils/authStorage — it's exercised for real (real localStorage + a
// mocked jwt-decode) so getAuthUser() behaves like it does in production.
vi.mock("@/services/auth.service", () => ({
  default: {
    login: vi.fn(),
  },
}))

vi.mock("@/services/crypto.service", () => ({
  default: {
    deriveKeypairFromPassword: vi.fn(),
    storeMyKeypair: vi.fn(),
  },
}))

vi.mock("jwt-decode", () => ({
  jwtDecode: () => ({
    userId: "user-123",
    email: "test@example.com",
    name: "Test User",
    exp: Math.floor(Date.now() / 1000) + 3600,
  }),
}))

const mockNavigate = vi.fn()
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

import authService from "@/services/auth.service"
import cryptoService from "@/services/crypto.service"

const mockLogin = vi.mocked(authService.login)
const mockDeriveKeypair = vi.mocked(cryptoService.deriveKeypairFromPassword)
const mockStoreMyKeypair = vi.mocked(cryptoService.storeMyKeypair)

const fakeKeypair = {
  publicKey: new Uint8Array([1, 2, 3, 4]),
  secretKey: new Uint8Array([5, 6, 7, 8]),
}

// Successful login, as authService.login would resolve it — and, matching
// the real service's contract, persisting a token so getAuthUser() (which
// is NOT mocked) can see it.
const mockLoginSuccess = (overrides = {}) => {
  mockLogin.mockImplementationOnce(async () => {
    localStorage.setItem("token", "fake-jwt-token")
    return { token: "fake-jwt-token", message: "Login successful", ...overrides }
  })
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockDeriveKeypair.mockResolvedValue(fakeKeypair)
  })

  describe("UI Render Tests", () => {
    test("renders email and password fields", () => {
      render(
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      )

      expect(screen.getByPlaceholderText("name@example.com")).toBeInTheDocument()
      expect(screen.getByPlaceholderText("........")).toBeInTheDocument()
    })

    test("renders the Sign In button", () => {
      render(
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      )

      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument()
    })

    test("renders a sign up link to /register", () => {
      render(
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      )

      const link = screen.getByRole("link", { name: /sign up/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute("href", "/register")
    })

    test("renders a forgot-password link to /forgot-password", () => {
      render(
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      )

      const link = screen.getByRole("link", { name: /forgot password\?/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute("href", "/forgot-password")
    })
  })

  describe("Client-side validation", () => {
    test("shows required-field errors and does not call the API", async () => {
      const user = userEvent.setup()
      render(
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      )

      await user.click(screen.getByRole("button", { name: /sign in/i }))

      expect(await screen.findByText(/email is required/i)).toBeInTheDocument()
      expect(screen.getByText(/password is required/i)).toBeInTheDocument()
      expect(mockLogin).not.toHaveBeenCalled()
    })

    test("rejects an email that has no domain suffix", async () => {
      const user = userEvent.setup()
      render(
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      )

      // Note: "not-an-email" (no "@" at all) never reaches this assertion —
      // happy-dom enforces native type="email" constraint validation and
      // blocks the submit event before React's onSubmit runs, same as a
      // real browser would. "test@example" clears that native check (it
      // has an "@") but still fails the app's own stricter regex, which
      // requires a dot after the "@" — that's the path this test covers.
      await user.type(screen.getByPlaceholderText("name@example.com"), "test@example")
      await user.type(screen.getByPlaceholderText("........"), "password123")
      await user.click(screen.getByRole("button", { name: /sign in/i }))

      expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument()
      expect(mockLogin).not.toHaveBeenCalled()
    })

    test("rejects a password shorter than 6 characters", async () => {
      const user = userEvent.setup()
      render(
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      )

      await user.type(screen.getByPlaceholderText("name@example.com"), "test@example.com")
      await user.type(screen.getByPlaceholderText("........"), "abc")
      await user.click(screen.getByRole("button", { name: /sign in/i }))

      expect(await screen.findByText(/password must be at least 6 characters/i)).toBeInTheDocument()
      expect(mockLogin).not.toHaveBeenCalled()
    })
  })

  describe("Successful login", () => {
    test("calls authService.login with trimmed/lowercased email and the derived public key", async () => {
      const user = userEvent.setup()
      mockLoginSuccess()

      render(
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      )

      await user.type(screen.getByPlaceholderText("name@example.com"), "  Test@Example.com  ")
      await user.type(screen.getByPlaceholderText("........"), "password123")
      await user.click(screen.getByRole("button", { name: /sign in/i }))

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: "test@example.com",
          password: "password123",
          publicKey: expect.any(String),
        })
      })

      expect(mockDeriveKeypair).toHaveBeenCalledWith("test@example.com", "password123")
    })

    test("stores the derived keypair under the logged-in user's id", async () => {
      const user = userEvent.setup()
      mockLoginSuccess()

      render(
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      )

      await user.type(screen.getByPlaceholderText("name@example.com"), "test@example.com")
      await user.type(screen.getByPlaceholderText("........"), "password123")
      await user.click(screen.getByRole("button", { name: /sign in/i }))

      await waitFor(() => {
        expect(mockStoreMyKeypair).toHaveBeenCalledWith(
          "user-123",
          fakeKeypair.publicKey,
          fakeKeypair.secretKey
        )
      })
    })

    test("navigates to /chat after a successful login", async () => {
      const user = userEvent.setup()
      mockLoginSuccess()

      render(
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      )

      await user.type(screen.getByPlaceholderText("name@example.com"), "test@example.com")
      await user.type(screen.getByPlaceholderText("........"), "password123")
      await user.click(screen.getByRole("button", { name: /sign in/i }))

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/chat", { replace: true })
      })
    })
  })

  describe("Failed login", () => {
    test("shows 'Invalid email or password' on a 401", async () => {
      const user = userEvent.setup()
      mockLogin.mockRejectedValueOnce({ status: 401, message: "Unauthorized" })

      render(
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      )

      await user.type(screen.getByPlaceholderText("name@example.com"), "test@example.com")
      await user.type(screen.getByPlaceholderText("........"), "wrongpassword")
      await user.click(screen.getByRole("button", { name: /sign in/i }))

      expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument()
      expect(mockNavigate).not.toHaveBeenCalled()
      expect(localStorage.getItem("token")).toBeNull()
    })

    test("shows the server message on a 400", async () => {
      const user = userEvent.setup()
      mockLogin.mockRejectedValueOnce({ status: 400, message: "OTP required" })

      render(
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      )

      await user.type(screen.getByPlaceholderText("name@example.com"), "test@example.com")
      await user.type(screen.getByPlaceholderText("........"), "password123")
      await user.click(screen.getByRole("button", { name: /sign in/i }))

      expect(await screen.findByText(/otp required/i)).toBeInTheDocument()
    })

    // The backend only ever returns 401 (enumeration-safe, both for a
    // missing account and a wrong password), 400 (e.g. OTP required), or a
    // genuine server error for /auth/login — never 404 or 403. Any other
    // status the switch doesn't special-case should still surface the
    // server's own message via the default branch rather than going blank.
    test("falls back to the server's own message for a status the switch doesn't special-case", async () => {
      const user = userEvent.setup()
      mockLogin.mockRejectedValueOnce({ status: 503, message: "Service temporarily unavailable" })

      render(
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      )

      await user.type(screen.getByPlaceholderText("name@example.com"), "test@example.com")
      await user.type(screen.getByPlaceholderText("........"), "password123")
      await user.click(screen.getByRole("button", { name: /sign in/i }))

      expect(await screen.findByText(/service temporarily unavailable/i)).toBeInTheDocument()
    })
  })
})
