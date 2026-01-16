import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { LoginForm } from "../login-form"
import { login } from "@/api/auth.api"
import { vi } from "vitest"

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════════════════════

// Mock the auth API to prevent actual HTTP calls during testing
vi.mock("@/api/auth.api", () => ({
  login: vi.fn(),
}))

// Mock useNavigate hook to track navigation calls without actually navigating
const mockNavigate = vi.fn()

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 1: UI RENDERING
// ═══════════════════════════════════════════════════════════════════════════════

describe("LoginForm - UI Render Tests", () => {
  // ───────────────────────────────────────────────────────────────────────────
  // SETUP: Before Each Test
  // ───────────────────────────────────────────────────────────────────────────
  // Purpose: Clean state before each test
  // - Clear mocked functions to avoid cross-test contamination
  // - Clear localStorage to start fresh
  // Why: Ensures tests are isolated and don't affect each other
  // ───────────────────────────────────────────────────────────────────────────
  beforeEach(() => {
    mockNavigate.mockClear()
    localStorage.clear()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 1.1: Login Heading Renders
  // ───────────────────────────────────────────────────────────────────────────
  // Description: LoginForm component should display email input field
  // Issue Testing: Component structure - verifies email field is present
  // Expected Behavior: Email placeholder "m@example.com" appears on screen
  // Why It Matters: UX - users need to know where to enter email
  // ───────────────────────────────────────────────────────────────────────────
  test("should render login heading", () => {
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    expect(screen.getByPlaceholderText(/m@example.com/i)).toBeInTheDocument()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 1.2: Form Fields Present
  // ───────────────────────────────────────────────────────────────────────────
  // Description: Both email and password input fields should be rendered
  // Issue Testing: Form completeness - verifies all required inputs exist
  // Expected Elements:
  //   - Email input with placeholder "m@example.com"
  //   - Password input with placeholder "••••••••" (dots for security)
  // Why It Matters: Core UX - users can't login without input fields
  // ───────────────────────────────────────────────────────────────────────────
  test("should render email and password fields", () => {
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    // Verify email field exists
    expect(screen.getByPlaceholderText(/m@example.com/i)).toBeInTheDocument()
    
    // Verify password field exists and is hidden (dots instead of text)
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 1.3: Login Button Present
  // ───────────────────────────────────────────────────────────────────────────
  // Description: Form should have a clickable login button
  // Issue Testing: Form interaction - verifies submission mechanism exists
  // Expected Behavior: Login button is rendered and accessible
  // Why It Matters: Users need button to submit login form
  // ───────────────────────────────────────────────────────────────────────────
  test("should render login button", () => {
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    // Check login button exists by role
    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 2: SUCCESSFUL LOGIN FLOW
// ═══════════════════════════════════════════════════════════════════════════════

describe("LoginForm - Login Success Flow", () => {
  // ───────────────────────────────────────────────────────────────────────────
  // SETUP: Before Each Test
  // ───────────────────────────────────────────────────────────────────────────
  // Purpose: Reset all mocks and state before success tests
  // - Clear login API mock calls
  // - Clear navigation mock calls (critical for testing redirect)
  // - Clear localStorage to start fresh
  // Why: Prevents previous test's mock calls from affecting these tests
  // ───────────────────────────────────────────────────────────────────────────
  beforeEach(() => {
    login.mockClear()
    mockNavigate.mockClear()  // ✅ Clear mock before each test
    localStorage.clear()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 2.1: Token Storage After Login
  // ───────────────────────────────────────────────────────────────────────────
  // Description: After successful login, JWT token should be saved to localStorage
  // Issue Testing: Token persistence - verifies auth token is stored for future requests
  // Test Flow:
  //   1. Mock API to return successful response with token
  //   2. User enters email and password
  //   3. User clicks login button
  //   4. Wait for token to appear in localStorage
  // Expected Behavior: localStorage.getItem("token") returns "fake-jwt-token"
  // Why It Matters: Token must be stored to authenticate future API requests
  // ───────────────────────────────────────────────────────────────────────────
  test("should save token to localStorage when login succeeds", async () => {
    const user = userEvent.setup({ delay: null })

    // Mock the login API to return a successful response with token
    login.mockResolvedValueOnce({
      token: "fake-jwt-token",
    })

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    // User enters email
    await user.type(screen.getByPlaceholderText(/m@example.com/i), "test@example.com")
    
    // User enters password
    await user.type(screen.getByPlaceholderText(/••••••••/i), "password123")
    
    // User clicks login button
    await user.click(screen.getByRole("button", { name: /login/i }))

    // Wait for token to be stored in localStorage
    await waitFor(
      () => {
        expect(localStorage.getItem("token")).toBe("fake-jwt-token")
      },
      { timeout: 3000 }
    )
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 2.2: Success Message Display
  // ───────────────────────────────────────────────────────────────────────────
  // Description: After successful login, success message should appear
  // Issue Testing: User feedback - verifies user sees confirmation of success
  // Test Flow:
  //   1. Mock successful login response
  //   2. User fills in credentials and submits
  //   3. Wait for success message to appear
  // Expected Behavior: "Login successful!" or similar message visible
  // Why It Matters: UX - users need confirmation that login worked
  // ───────────────────────────────────────────────────────────────────────────
  test("should show success message on successful login", async () => {
    const user = userEvent.setup({ delay: null })

    // Mock successful API response
    login.mockResolvedValueOnce({
      token: "fake-jwt-token",
    })

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    // Fill in login credentials
    await user.type(screen.getByPlaceholderText(/m@example.com/i), "test@example.com")
    await user.type(screen.getByPlaceholderText(/••••••••/i), "password123")
    
    // Submit login form
    await user.click(screen.getByRole("button", { name: /login/i }))

    // Verify user is redirected to chat page
    // (This tests that navigation happens on success)
    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/chat")
      },
      { timeout: 3000 }
    )
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 2.3: Navigation After Login Success
  // ───────────────────────────────────────────────────────────────────────────
  // Description: User should be redirected to /chat page after successful login
  // Issue Testing: Post-login flow - verifies user is routed to chat interface
  // Test Flow:
  //   1. Mock successful login
  //   2. User submits credentials
  //   3. Wait for navigation to /chat
  // Expected Behavior: useNavigate("/chat") is called
  // Why It Matters: Core UX - user should go to chat after login succeeds
  // Navigation Flow: Login → Success → Redirect to /chat
  // ───────────────────────────────────────────────────────────────────────────
  test("should navigate to /chat after successful login", async () => {
    const user = userEvent.setup({ delay: null })

    // Mock successful login response with token
    login.mockResolvedValueOnce({
      token: "fake-jwt-token",
    })

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    // User enters credentials
    await user.type(screen.getByPlaceholderText(/m@example.com/i), "test@example.com")
    await user.type(screen.getByPlaceholderText(/••••••••/i), "password123")
    
    // User submits form
    await user.click(screen.getByRole("button", { name: /login/i }))

    // Verify navigation happens to chat page
    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/chat")
      },
      { timeout: 3000 }
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 3: FAILED LOGIN FLOW
// ═══════════════════════════════════════════════════════════════════════════════

describe("LoginForm - Login Fail Flow", () => {
  // ───────────────────────────────────────────────────────────────────────────
  // SETUP: Before Each Test
  // ───────────────────────────────────────────────────────────────────────────
  // Purpose: Clean state for failure scenario tests
  // - Clear login mock to simulate fresh API call
  // - Clear navigate mock to track navigation independently
  // - Clear localStorage to start fresh
  // Why: Failure tests should not be affected by previous test's state
  // ───────────────────────────────────────────────────────────────────────────
  beforeEach(() => {
    login.mockClear()
    mockNavigate.mockClear()  // ✅ Clear mock before each test
    localStorage.clear()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 3.1: Error Message on Failed Login
  // ───────────────────────────────────────────────────────────────────────────
  // Description: When login fails, error message should display to user
  // Issue Testing: Error handling - verifies user sees why login failed
  // Test Flow:
  //   1. Mock login API to return error (e.g., wrong password)
  //   2. User enters incorrect credentials
  //   3. User clicks login
  //   4. Wait for error message "Invalid credentials"
  // Expected Behavior: Error message appears on screen
  // Why It Matters: UX - users need feedback on what went wrong
  // Common Error Scenarios:
  //   - Invalid credentials (wrong email/password combination)
  //   - Account not found
  //   - Account locked
  // ───────────────────────────────────────────────────────────────────────────
  test("should show error message when login fails", async () => {
    const user = userEvent.setup({ delay: null })

    // Mock API to return error response (simulating server rejection)
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

    // User enters email
    await user.type(screen.getByPlaceholderText(/m@example.com/i), "test@example.com")
    
    // User enters wrong password
    await user.type(screen.getByPlaceholderText(/••••••••/i), "wrongpassword")
    
    // User tries to login
    await user.click(screen.getByRole("button", { name: /login/i }))

    // Wait for error message to appear
    await waitFor(
      () => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 3.2: Token NOT Saved on Failed Login
  // ───────────────────────────────────────────────────────────────────────────
  // Description: If login fails, token should NOT be saved to localStorage
  // Issue Testing: Security - prevents unauthorized token storage
  // Test Flow:
  //   1. Mock login to fail with "Invalid credentials"
  //   2. User enters wrong password
  //   3. User submits form
  //   4. Wait for error message
  //   5. Verify localStorage is still empty
  // Expected Behavior: localStorage.getItem("token") returns null
  // Why It Matters: Security - prevents using invalid/non-existent tokens
  // Security Impact: If we saved token on failure, user might be stuck
  //                  unable to access app since token is invalid
  // ───────────────────────────────────────────────────────────────────────────
  test("should NOT save token when login fails", async () => {
    const user = userEvent.setup({ delay: null })

    // Mock API to return error (authentication failed)
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

    // User enters credentials
    await user.type(screen.getByPlaceholderText(/m@example.com/i), "test@example.com")
    await user.type(screen.getByPlaceholderText(/••••••••/i), "wrongpassword")
    
    // User submits
    await user.click(screen.getByRole("button", { name: /login/i }))

    // Wait for error to display
    await waitFor(
      () => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
      },
      { timeout: 3000 }
    )

    // Verify NO token was saved to localStorage
    expect(localStorage.getItem("token")).toBeNull()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 3.3: No Navigation on Failed Login
  // ───────────────────────────────────────────────────────────────────────────
  // Description: User should NOT be redirected if login fails
  // Issue Testing: Error handling - prevents redirect to protected pages on failure
  // Test Flow:
  //   1. Mock failed login
  //   2. Clear navigate mock to track only this test's calls
  //   3. User submits incorrect credentials
  //   4. Wait for error message
  //   5. Verify mockNavigate was NOT called
  // Expected Behavior: mockNavigate is not called (no redirect)
  // Why It Matters: Security + UX - don't let user into app if auth failed
  // Security Impact: Prevents user from accessing /chat page without valid auth
  // UX Impact: User stays on login page to retry with correct credentials
  // ───────────────────────────────────────────────────────────────────────────
  test("should not navigate when login fails", async () => {
    const user = userEvent.setup({ delay: null })

    // ✅ Reset mock BEFORE this test runs
    // (Important: ensures we only track navigation from this specific test)
    mockNavigate.mockClear()

    // Mock login API to return error
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

    // User enters wrong credentials
    await user.type(screen.getByPlaceholderText(/m@example.com/i), "test@example.com")
    await user.type(screen.getByPlaceholderText(/••••••••/i), "wrongpassword")
    
    // User tries to login
    await user.click(screen.getByRole("button", { name: /login/i }))

    // Wait for error message to appear
    await waitFor(
      () => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
      },
      { timeout: 3000 }
    )

    // ✅ Now check that mockNavigate was NOT called
    // (it should have 0 calls from this test - no redirect on failure)
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})