import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { SignupForm } from "../signup-form"
import { registerUser } from "@/api/auth.api"
import { vi } from "vitest"

// Mock the auth API
vi.mock("@/api/auth.api", () => ({
  registerUser: vi.fn(),
}))

// Mock useNavigate
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

describe("SignupForm - UI Render Tests", () => {
  test("should render register heading", () => {
    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )

    expect(screen.getByText(/create an account/i)).toBeInTheDocument()
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

    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument()
  })
})

describe("SignupForm - Register Success Flow", () => {
  test("should show success message when registration succeeds", async () => {
    const user = userEvent.setup()

    // Mock successful registration
    registerUser.mockResolvedValueOnce({
      message: "Registered successfully",
    })

    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    )

    // Fill in form
    await user.type(screen.getByLabelText(/full name/i), "John Doe")
    await user.type(screen.getByLabelText(/email/i), "john@example.com")
    await user.type(screen.getByLabelText(/^password$/i), "password123")
    await user.type(screen.getByLabelText(/confirm password/i), "password123")

    // Submit
    await user.click(screen.getByRole("button", { name: /create account/i }))

    // Check success message appears
    await waitFor(() => {
      expect(screen.getByText(/registered successfully/i)).toBeInTheDocument()
    })
  })
})

describe("SignupForm - Register Fail Flow", () => {
  test("should show error message when email already exists", async () => {
    const user = userEvent.setup()

    // Mock failed registration (duplicate email)
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

    // Fill in form
    await user.type(screen.getByLabelText(/full name/i), "John Doe")
    await user.type(screen.getByLabelText(/email/i), "existing@example.com")
    await user.type(screen.getByLabelText(/^password$/i), "password123")
    await user.type(screen.getByLabelText(/confirm password/i), "password123")

    // Submit
    await user.click(screen.getByRole("button", { name: /create account/i }))

    // Check error message appears
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

    // Fill in with mismatched passwords
    await user.type(screen.getByLabelText(/full name/i), "John Doe")
    await user.type(screen.getByLabelText(/email/i), "john@example.com")
    await user.type(screen.getByLabelText(/^password$/i), "password123")
    await user.type(screen.getByLabelText(/confirm password/i), "password456")

    // Submit
    await user.click(screen.getByRole("button", { name: /create account/i }))

    // Check error message appears
    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })
  })
})