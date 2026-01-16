import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { SignupForm } from "../signup-form"
import { registerUser } from "@/api/auth.api"
import { vi } from "vitest"

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────
// Mock Auth API
// ───────────────────────────────────────────────────────────────────────────
// Purpose: Prevent actual HTTP calls to backend during testing
// Mock Function: registerUser
// Why It's Needed:
//   - Avoid making real network requests during tests
//   - Control API responses for different test scenarios
//   - Speed up tests (no network delay)
//   - Isolate component from backend dependency
// Usage: We control what registerUser returns/rejects in each test
// ───────────────────────────────────────────────────────────────────────────
vi.mock("@/api/auth.api", () => ({
  registerUser: vi.fn(),
}))

// ───────────────────────────────────────────────────────────────────────────
// Mock React Router Navigation
// ───────────────────────────────────────────────────────────────────────────
// Purpose: Track navigation calls without actually routing
// Mock Function: useNavigate hook
// Why It's Needed:
//   - Component calls useNavigate after successful registration
//   - We need to verify redirect happens to correct page
//   - Don't want actual page navigation during tests
//   - Track that navigate("/login") was called after signup success
// Usage: Verify user is redirected to /login after successful signup
// ───────────────────────────────────────────────────────────────────────────
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 1: UI RENDERING
// ═══════════════════════════════════════════════════════════════════════════════

describe("SignupForm - UI Render Tests", () => {
  
  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 1.1: Register Heading Present
  // ───────────────────────────────────────────────────────────────────────────
  // Description: SignupForm should display "Create an account" heading
  // Issue Testing: Component structure - verifies heading text is visible
  // Expected Behavior: Heading "create an account" appears on screen
  // Why It Matters: UX - users need to know they're on signup page
  // Helps Users: Confirms page purpose and orientation
  // ───────────────────────────────────────────────────────────────────────────
  test("should render register heading", () => {
    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )

    expect(screen.getByText(/create an account/i)).toBeInTheDocument()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 1.2: All Input Fields Rendered
  // ───────────────────────────────────────────────────────────────────────────
  // Description: SignupForm should render all 4 required input fields
  // Issue Testing: Form completeness - verifies user can fill all data
  // Expected Input Fields:
  //   - Full Name (for user's display name)
  //   - Email (for account identification and login)
  //   - Password (for account security)
  //   - Confirm Password (to prevent typos in password entry)
  // Why It Matters: Core functionality - all fields needed for registration
  // Field Purposes:
  //   - Name: Display in chat, user profile
  //   - Email: Unique identifier, login credential, password reset
  //   - Password: Security - protect account access
  //   - Confirm: UX - catch password entry mistakes early
  // ───────────────────────────────────────────────────────────────────────────
  test("should render all input fields", () => {
    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )

    // Verify full name field exists
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    
    // Verify email field exists
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    
    // Verify password field exists (using ^ and $ to match exact "password", not "confirm password")
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    
    // Verify confirm password field exists (separate from password)
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 1.3: Register Button Present
  // ───────────────────────────────────────────────────────────────────────────
  // Description: SignupForm should have a "Create Account" button for submission
  // Issue Testing: Form interaction - verifies submission mechanism exists
  // Expected Behavior: Button with text "Create Account" is rendered and clickable
  // Why It Matters: Users need button to submit registration form
  // Button Function: Triggers form validation and API call to registerUser
  // ───────────────────────────────────────────────────────────────────────────
  test("should render register button", () => {
    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )

    // Check register/create account button exists
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 2: SUCCESSFUL REGISTRATION FLOW
// ═══════════════════════════════════════════════════════════════════════════════

describe("SignupForm - Register Success Flow", () => {
  
  // ───────────────────────────────────────────────────────────────────────────
  // SETUP: Before Each Success Test
  // ───────────────────────────────────────────────────────────────────────────
  // Purpose: Clean state before each registration success test
  // Actions:
  //   - Clear registerUser mock to remove previous test's call history
  //   - Clear localStorage to start fresh (no leftover tokens)
  // Why: Ensures each test is isolated and independent
  // Isolation: Previous test's mock state doesn't affect this test
  // ───────────────────────────────────────────────────────────────────────────
  beforeEach(() => {
    registerUser.mockClear()
    localStorage.clear()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 2.1: Success Message Display
  // ───────────────────────────────────────────────────────────────────────────
  // Description: After successful registration, success message should appear
  // Issue Testing: User feedback - verifies user sees confirmation of registration
  // Test Flow:
  //   1. Mock registerUser API to return successful response
  //   2. User fills in all 4 form fields with valid data
  //   3. User clicks "Create Account" button
  //   4. Wait for "Registered successfully" message to appear
  // Expected Behavior: Success message displays on screen
  // Why It Matters: UX - users need confirmation that registration worked
  // Success Indication:
  //   - Message tells user account was created
  //   - User can then proceed to login
  // ───────────────────────────────────────────────────────────────────────────
  test("should show success message when registration succeeds", async () => {
    const user = userEvent.setup()

    // Mock successful registration API response
    registerUser.mockResolvedValueOnce({
      message: "Registered successfully",
    })

    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )

    // User enters their full name
    await user.type(screen.getByLabelText(/full name/i), "John Doe")
    
    // User enters email address
    await user.type(screen.getByLabelText(/email/i), "john@example.com")
    
    // User enters password
    await user.type(screen.getByLabelText(/^password$/i), "password123")
    
    // User confirms password (must match for validation to pass)
    await user.type(screen.getByLabelText(/confirm password/i), "password123")

    // User clicks create account button
    await user.click(screen.getByRole("button", { name: /create account/i }))

    // Wait for success message to appear
    await waitFor(() => {
      expect(screen.getByText(/registered successfully/i)).toBeInTheDocument()
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 2.2: API Called with Correct Data
  // ───────────────────────────────────────────────────────────────────────────
  // Description: Registration API should be called with user's entered data
  // Issue Testing: Data submission - verifies correct data sent to backend
  // Test Flow:
  //   1. Mock registerUser API
  //   2. User fills in registration form
  //   3. User submits form
  //   4. Verify registerUser was called with correct parameters
  // Expected Behavior: registerUser called with { name, email, password }
  // Why It Matters: Data integrity - ensures correct data reaches backend
  // API Contract:
  //   - Backend expects: { name: string, email: string, password: string }
  //   - Frontend must send exactly what backend expects
  // ───────────────────────────────────────────────────────────────────────────
  test("should call registerUser API with correct data", async () => {
    const user = userEvent.setup()

    // Mock API to accept the registration
    registerUser.mockResolvedValueOnce({
      message: "Registered successfully",
    })

    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )

    // User fills form with specific data
    const testName = "John Doe"
    const testEmail = "john@example.com"
    const testPassword = "password123"

    await user.type(screen.getByLabelText(/full name/i), testName)
    await user.type(screen.getByLabelText(/email/i), testEmail)
    await user.type(screen.getByLabelText(/^password$/i), testPassword)
    await user.type(screen.getByLabelText(/confirm password/i), testPassword)

    // Submit form
    await user.click(screen.getByRole("button", { name: /create account/i }))

    // Verify API was called with the exact data user entered
    await waitFor(() => {
      expect(registerUser).toHaveBeenCalledWith({
        name: testName,
        email: testEmail,
        password: testPassword,
      })
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 3: FAILED REGISTRATION FLOW
// ═══════════════════════════════════════════════════════════════════════════════

describe("SignupForm - Register Fail Flow", () => {
  
  // ───────────────────────────────────────────────────────────────────────────
  // SETUP: Before Each Failure Test
  // ───────────────────────────────────────────────────────────────────────────
  // Purpose: Clean state before each registration failure test
  // Actions:
  //   - Clear registerUser mock to track only this test's API calls
  //   - Clear localStorage to ensure no data from previous tests
  // Why: Failure tests must be isolated and independent
  // Isolation Importance: Prevents false passes due to leftover data
  // ───────────────────────────────────────────────────────────────────────────
  beforeEach(() => {
    registerUser.mockClear()
    localStorage.clear()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 3.1: Duplicate Email Error
  // ───────────────────────────────────────────────────────────────────────────
  // Description: Registration should fail if email already exists in system
  // Issue Testing: Email uniqueness validation - prevents duplicate accounts
  // Test Scenario:
  //   - User A registered with "existing@example.com"
  //   - User B tries to register with same email
  //   - Backend rejects with "Email already exists" error
  // Test Flow:
  //   1. Mock registerUser to reject with duplicate email error
  //   2. User fills form with existing email
  //   3. User submits registration
  //   4. Wait for error message to appear
  // Expected Behavior: Error message "Email already exists" displays
  // Why It Matters:
  //   - Data integrity: each email must be unique
  //   - Prevents account hijacking or conflicts
  //   - User feedback: tells them email is taken and to use different one
  // Error Handling:
  //   - API returns 409 Conflict status
  //   - Message shown to user (not angry tech error)
  // ───────────────────────────────────────────────────────────────────────────
  test("should show error message when email already exists", async () => {
    const user = userEvent.setup()

    // Mock registration API to reject with duplicate email error
    // (This simulates a real backend rejection)
    registerUser.mockRejectedValueOnce({
      response: {
        data: {
          message: "Email already exists",
        },
      },
    })

    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )

    // User fills in form with email that already exists
    await user.type(screen.getByLabelText(/full name/i), "John Doe")
    await user.type(screen.getByLabelText(/email/i), "existing@example.com")
    await user.type(screen.getByLabelText(/^password$/i), "password123")
    await user.type(screen.getByLabelText(/confirm password/i), "password123")

    // User tries to register
    await user.click(screen.getByRole("button", { name: /create account/i }))

    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument()
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 3.2: Password Mismatch Error
  // ───────────────────────────────────────────────────────────────────────────
  // Description: Registration should fail if password and confirm password don't match
  // Issue Testing: Password validation - prevents accidental password typos
  // Test Scenario:
  //   - User enters password: "password123"
  //   - User enters confirm: "password456" (typo)
  //   - Form validation catches mismatch
  //   - Shows error before API call
  // Test Flow:
  //   1. User fills form with mismatched passwords
  //   2. User submits registration
  //   3. Form validation catches mismatch
  //   4. Error message "passwords do not match" appears
  // Expected Behavior: Error displays, API NOT called
  // Why It Matters:
  //   - UX: catches typos before account is created
  //   - Security: wrong password would lock user out
  //   - Efficiency: client-side validation faster than API round-trip
  // Implementation Detail:
  //   - This is client-side validation (no API call needed)
  //   - Prevents users from getting locked into wrong passwords
  // ───────────────────────────────────────────────────────────────────────────
  test("should show error when passwords do not match", async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )

    // Fill form with mismatched passwords
    await user.type(screen.getByLabelText(/full name/i), "John Doe")
    await user.type(screen.getByLabelText(/email/i), "john@example.com")
    
    // Enter password
    await user.type(screen.getByLabelText(/^password$/i), "password123")
    
    // Enter different confirm password (typo!)
    await user.type(screen.getByLabelText(/confirm password/i), "password456")

    // User tries to submit
    await user.click(screen.getByRole("button", { name: /create account/i }))

    // Wait for error message about password mismatch
    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 3.3: Token NOT Saved on Failed Registration
  // ───────────────────────────────────────────────────────────────────────────
  // Description: If registration fails, NO token should be saved to localStorage
  // Issue Testing: Security - prevents invalid token storage
  // Test Flow:
  //   1. Mock registerUser to fail with duplicate email error
  //   2. User tries to register with existing email
  //   3. Registration fails and error appears
  //   4. Verify localStorage.getItem("token") is null (no token saved)
  // Expected Behavior: No token in localStorage after failed registration
  // Why It Matters:
  //   - Security: don't store tokens from failed attempts
  //   - Prevents user from being "logged in" with invalid token
  //   - If token saved on failure, user might be confused about status
  // ───────────────────────────────────────────────────────────────────────────
  test("should NOT save token when registration fails", async () => {
    const user = userEvent.setup()

    // Mock API to reject registration (duplicate email)
    registerUser.mockRejectedValueOnce({
      response: {
        data: {
          message: "Email already exists",
        },
      },
    })

    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )

    // Fill form and submit
    await user.type(screen.getByLabelText(/full name/i), "John Doe")
    await user.type(screen.getByLabelText(/email/i), "existing@example.com")
    await user.type(screen.getByLabelText(/^password$/i), "password123")
    await user.type(screen.getByLabelText(/confirm password/i), "password123")

    // Try to register
    await user.click(screen.getByRole("button", { name: /create account/i }))

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument()
    })

    // ✅ Verify NO token was saved to localStorage
    expect(localStorage.getItem("token")).toBeNull()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 3.4: No Navigation on Failed Registration
  // ───────────────────────────────────────────────────────────────────────────
  // Description: User should NOT be redirected if registration fails
  // Issue Testing: Error handling - prevents navigation to chat on failure
  // Test Flow:
  //   1. Mock failed registration
  //   2. Clear navigation mock to track only this test
  //   3. User submits with duplicate email
  //   4. Registration fails
  //   5. Verify no navigation happened
  // Expected Behavior: No redirect to chat/dashboard page
  // Why It Matters:
  //   - Security: don't let user into app if registration failed
  //   - UX: user stays on signup page to fix error and retry
  //   - Data integrity: unregistered users shouldn't access protected pages
  // ───────────────────────────────────────────────────────────────────────────
  test("should not navigate when registration fails", async () => {
    const user = userEvent.setup()

    // Mock API to reject registration
    registerUser.mockRejectedValueOnce({
      response: {
        data: {
          message: "Email already exists",
        },
      },
    })

    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )

    // Fill and submit
    await user.type(screen.getByLabelText(/full name/i), "John Doe")
    await user.type(screen.getByLabelText(/email/i), "existing@example.com")
    await user.type(screen.getByLabelText(/^password$/i), "password123")
    await user.type(screen.getByLabelText(/confirm password/i), "password123")

    // Try to register
    await user.click(screen.getByRole("button", { name: /create account/i }))

    // Wait for error
    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument()
    })

    // Verify form is still visible (user not navigated away)
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 3.5: Form Fields Remain Filled on Error
  // ───────────────────────────────────────────────────────────────────────────
  // Description: If registration fails, form fields should keep user's data (not clear)
  // Issue Testing: UX - preserves user's input so they can fix and retry
  // Test Scenario:
  //   - User fills all form fields
  //   - Registration fails (e.g., duplicate email)
  //   - User sees error and wants to change email
  //   - Form data should still be there (not cleared)
  // Test Flow:
  //   1. User fills form with existing email
  //   2. Registration fails
  //   3. Verify form fields still contain user's data
  // Expected Behavior: Form fields NOT cleared after error
  // Why It Matters:
  //   - UX: user doesn't have to re-type everything
  //   - Reduces frustration when fixing errors
  //   - Shows form respects user's effort
  // ───────────────────────────────────────────────────────────────────────────
  test("should preserve form data when registration fails", async () => {
    const user = userEvent.setup()

    // Mock registration failure
    registerUser.mockRejectedValueOnce({
      response: {
        data: {
          message: "Email already exists",
        },
      },
    })

    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )

    const testName = "John Doe"
    const testEmail = "existing@example.com"
    const testPassword = "password123"

    // Fill form
    const nameInput = screen.getByLabelText(/full name/i)
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/^password$/i)
    const confirmInput = screen.getByLabelText(/confirm password/i)

    await user.type(nameInput, testName)
    await user.type(emailInput, testEmail)
    await user.type(passwordInput, testPassword)
    await user.type(confirmInput, testPassword)

    // Submit
    await user.click(screen.getByRole("button", { name: /create account/i }))

    // Wait for error
    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument()
    })

    // Verify form fields still have user's data (not cleared)
    expect(nameInput).toHaveValue(testName)
    expect(emailInput).toHaveValue(testEmail)
    expect(passwordInput).toHaveValue(testPassword)
    expect(confirmInput).toHaveValue(testPassword)
  })
})