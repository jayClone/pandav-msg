import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { SignupForm } from "../signup-form"
import { vi } from "vitest"

// Mock API Service
vi.mock("@/services/api", () => ({
  default: {
    auth: {
      register: vi.fn(),
    },
  },
}))

// Mock Socket Connection
vi.mock("@/socket/socketClient", () => ({
  connectSocket: vi.fn(),
}))

// Import after mocking
import apiService from "@/services/api"
import { connectSocket } from "@/socket/socketClient"

// Get references using vi.mocked()
const mockRegister = vi.mocked(apiService.auth.register)
const mockConnectSocket = vi.mocked(connectSocket)

describe("SignupForm - UI Render Tests", () => {
  test("should render create account heading", () => {
    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )
    expect(screen.getByText(/create account/i)).toBeInTheDocument()
  })

  test("should render all input fields", () => {
    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
  })

  test("should render register button", () => {
    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )
    expect(screen.getByRole("button", { name: /register now/i })).toBeInTheDocument()
  })

  test("should render sign in link", () => {
    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login")
  })

  test("should display correct initial placeholder text", () => {
    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )
    expect(screen.getByPlaceholderText("John Doe")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("name@example.com")).toBeInTheDocument()
  })
})

describe("SignupForm - Register Success Flow", () => {
  beforeEach(() => {
    mockRegister.mockClear()
    mockConnectSocket.mockClear()
    localStorage.clear()
    vi.clearAllTimers()
  })

  test("should show success message when registration succeeds", async () => {
    const user = userEvent.setup()
    mockRegister.mockResolvedValueOnce({
      data: {
        token: "test-token-123",
        message: "Account created successfully! Redirecting...",
      },
    })

    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )

    await user.type(screen.getByLabelText(/full name/i), "John Doe")
    await user.type(screen.getByLabelText(/email/i), "john@example.com")
    await user.type(screen.getByLabelText(/^password$/i), "password123")
    await user.type(screen.getByLabelText(/confirm password/i), "password123")
    await user.click(screen.getByRole("button", { name: /register now/i }))

    await waitFor(() => {
      expect(screen.getByText(/account created successfully/i)).toBeInTheDocument()
    })
  })

  test("should call register API with correct data", async () => {
    const user = userEvent.setup()
    mockRegister.mockResolvedValueOnce({
      data: {
        token: "test-token",
        message: "Account created successfully! Redirecting...",
      },
    })

    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )

    const testName = "John Doe"
    const testEmail = "john@example.com"
    const testPassword = "password123"

    await user.type(screen.getByLabelText(/full name/i), testName)
    await user.type(screen.getByLabelText(/email/i), testEmail)
    await user.type(screen.getByLabelText(/^password$/i), testPassword)
    await user.type(screen.getByLabelText(/confirm password/i), testPassword)
    await user.click(screen.getByRole("button", { name: /register now/i }))

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        name: testName,
        email: testEmail,
        password: testPassword,
      })
    })
  })

  test("should save token to localStorage on successful registration", async () => {
    const user = userEvent.setup()
    const testToken = "test-auth-token-xyz"

    mockRegister.mockResolvedValueOnce({
      data: {
        token: testToken,
        message: "Account created successfully! Redirecting...",
      },
    })

    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )

    await user.type(screen.getByLabelText(/full name/i), "John Doe")
    await user.type(screen.getByLabelText(/email/i), "john@example.com")
    await user.type(screen.getByLabelText(/^password$/i), "password123")
    await user.type(screen.getByLabelText(/confirm password/i), "password123")
    await user.click(screen.getByRole("button", { name: /register now/i }))

    await waitFor(() => {
      expect(screen.getByText(/account created successfully/i)).toBeInTheDocument()
    })

    expect(localStorage.getItem("token")).toBe(testToken)
  })

  test("should connect socket with token on successful registration", async () => {
    const user = userEvent.setup()
    const testToken = "test-socket-token"

    mockRegister.mockResolvedValueOnce({
      data: {
        token: testToken,
        message: "Account created successfully! Redirecting...",
      },
    })

    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )

    await user.type(screen.getByLabelText(/full name/i), "John Doe")
    await user.type(screen.getByLabelText(/email/i), "john@example.com")
    await user.type(screen.getByLabelText(/^password$/i), "password123")
    await user.type(screen.getByLabelText(/confirm password/i), "password123")
    await user.click(screen.getByRole("button", { name: /register now/i }))

    await waitFor(() => {
      expect(mockConnectSocket).toHaveBeenCalledWith(testToken)
    })
  })

  test("should hide form after successful registration", async () => {
    const user = userEvent.setup()
    mockRegister.mockResolvedValueOnce({
      data: {
        token: "test-token",
        message: "Account created successfully! Redirecting...",
      },
    })

    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )

    await user.type(screen.getByLabelText(/full name/i), "John Doe")
    await user.type(screen.getByLabelText(/email/i), "john@example.com")
    await user.type(screen.getByLabelText(/^password$/i), "password123")
    await user.type(screen.getByLabelText(/confirm password/i), "password123")
    await user.click(screen.getByRole("button", { name: /register now/i }))

    await waitFor(() => {
      expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument()
    })
  })

  test("should handle registration without token", async () => {
    const user = userEvent.setup()
    mockRegister.mockResolvedValueOnce({
      data: {
        message: "Registration successful, please verify email",
      },
    })

    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )

    await user.type(screen.getByLabelText(/full name/i), "John Doe")
    await user.type(screen.getByLabelText(/email/i), "john@example.com")
    await user.type(screen.getByLabelText(/^password$/i), "password123")
    await user.type(screen.getByLabelText(/confirm password/i), "password123")
    await user.click(screen.getByRole("button", { name: /register now/i }))

    await waitFor(() => {
      expect(screen.getByText(/registration successful/i)).toBeInTheDocument()
    })

    expect(localStorage.getItem("token")).toBeNull()
    expect(mockConnectSocket).not.toHaveBeenCalled()
  })
})

describe("SignupForm - Register Fail Flow", () => {
  beforeEach(() => {
    mockRegister.mockClear()
    mockConnectSocket.mockClear()
    localStorage.clear()
  })

  test("should show error message when email already exists", async () => {
    const user = userEvent.setup()
    mockRegister.mockRejectedValueOnce({
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

    await user.type(screen.getByLabelText(/full name/i), "John Doe")
    await user.type(screen.getByLabelText(/email/i), "existing@example.com")
    await user.type(screen.getByLabelText(/^password$/i), "password123")
    await user.type(screen.getByLabelText(/confirm password/i), "password123")
    await user.click(screen.getByRole("button", { name: /register now/i }))

    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument()
    })
  })

  test("should show error when passwords do not match", async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )

    await user.type(screen.getByLabelText(/full name/i), "John Doe")
    await user.type(screen.getByLabelText(/email/i), "john@example.com")
    await user.type(screen.getByLabelText(/^password$/i), "password123")
    await user.type(screen.getByLabelText(/confirm password/i), "password456")
    await user.click(screen.getByRole("button", { name: /register now/i }))

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })

    expect(mockRegister).not.toHaveBeenCalled()
  })

  test("should NOT save token when registration fails", async () => {
    const user = userEvent.setup()
    mockRegister.mockRejectedValueOnce({
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

    await user.type(screen.getByLabelText(/full name/i), "John Doe")
    await user.type(screen.getByLabelText(/email/i), "existing@example.com")
    await user.type(screen.getByLabelText(/^password$/i), "password123")
    await user.type(screen.getByLabelText(/confirm password/i), "password123")
    await user.click(screen.getByRole("button", { name: /register now/i }))

    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument()
    })

    expect(localStorage.getItem("token")).toBeNull()
  })

  test("should preserve form data when registration fails", async () => {
    const user = userEvent.setup()
    mockRegister.mockRejectedValueOnce({
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

    const nameInput = screen.getByLabelText(/full name/i)
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/^password$/i)
    const confirmInput = screen.getByLabelText(/confirm password/i)

    await user.type(nameInput, testName)
    await user.type(emailInput, testEmail)
    await user.type(passwordInput, testPassword)
    await user.type(confirmInput, testPassword)
    await user.click(screen.getByRole("button", { name: /register now/i }))

    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument()
    })

    expect(nameInput).toHaveValue(testName)
    expect(emailInput).toHaveValue(testEmail)
    expect(passwordInput).toHaveValue(testPassword)
    expect(confirmInput).toHaveValue(testPassword)
  })

  test("should handle unexpected registration errors", async () => {
    const user = userEvent.setup()
    mockRegister.mockRejectedValueOnce(new Error("Network error"))

    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )

    await user.type(screen.getByLabelText(/full name/i), "John Doe")
    await user.type(screen.getByLabelText(/email/i), "john@example.com")
    await user.type(screen.getByLabelText(/^password$/i), "password123")
    await user.type(screen.getByLabelText(/confirm password/i), "password123")
    await user.click(screen.getByRole("button", { name: /register now/i }))

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })
  })

  test("should show loading state during registration", async () => {
    const user = userEvent.setup()
    mockRegister.mockImplementationOnce(
      () => new Promise((resolve, reject) => {
        setTimeout(() => reject({
          response: {
            data: {
              message: "Server error"
            }
          }
        }), 100)
      })
    )

    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )

    await user.type(screen.getByLabelText(/full name/i), "John Doe")
    await user.type(screen.getByLabelText(/email/i), "john@example.com")
    await user.type(screen.getByLabelText(/^password$/i), "password123")
    await user.type(screen.getByLabelText(/confirm password/i), "password123")

    const registerButton = screen.getByRole("button", { name: /register now/i })
    await user.click(registerButton)

    await waitFor(() => {
      expect(screen.getByText(/creating account\.\.\./i)).toBeInTheDocument()
    })

    const loadingButton = screen.getByRole("button", { name: /creating account\.\.\./i })
    expect(loadingButton).toBeDisabled()
    
    // Wait for the promise to reject so it doesn't affect next test
    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument()
    })
  })

  test("should not call socket connect on failed registration", async () => {
    const user = userEvent.setup()
    
    mockRegister.mockRejectedValueOnce({
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

    await user.type(screen.getByLabelText(/full name/i), "John Doe")
    await user.type(screen.getByLabelText(/email/i), "existing@example.com")
    await user.type(screen.getByLabelText(/^password$/i), "password123")
    await user.type(screen.getByLabelText(/confirm password/i), "password123")
    await user.click(screen.getByRole("button", { name: /register now/i }))

    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument()
    })

    expect(mockConnectSocket).not.toHaveBeenCalled()
  })
})