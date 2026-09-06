import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { SignupForm } from "../signup-form"
import { vi } from "vitest"

// Registration is now a two-step flow: fill the form -> send an OTP -> enter
// the OTP (rendered by the real OTPVerification component, not mocked, so
// these tests exercise the actual handoff between the two) -> register.
vi.mock("@api/otp.api.js", () => ({
  default: {
    sendOTP: vi.fn(),
    verifyOTP: vi.fn(),
    resendOTP: vi.fn(),
  },
}))

vi.mock("@services/auth.service.js", () => ({
  default: {
    register: vi.fn(),
  },
}))

vi.mock("@services/crypto.service.js", () => ({
  default: {
    deriveKeypairFromPassword: vi.fn(),
  },
}))

const mockNavigate = vi.fn()
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

import otpAPI from "@api/otp.api.js"
import authService from "@services/auth.service.js"
import cryptoService from "@services/crypto.service.js"

const mockSendOTP = vi.mocked(otpAPI.sendOTP)
const mockVerifyOTP = vi.mocked(otpAPI.verifyOTP)
const mockRegister = vi.mocked(authService.register)
const mockDeriveKeypair = vi.mocked(cryptoService.deriveKeypairFromPassword)

const fakeKeypair = {
  publicKey: new Uint8Array([1, 2, 3, 4]),
  secretKey: new Uint8Array([5, 6, 7, 8]),
}

// A password that satisfies every client-side rule (8+ chars, uppercase,
// number, special char) — the "Continue" button stays disabled until this
// is true, so most tests need a valid one even when they're not testing
// password rules themselves.
const VALID_PASSWORD = "Password123!"

const fillForm = async (user, overrides = {}) => {
  const data = {
    name: "John Doe",
    email: "john@example.com",
    password: VALID_PASSWORD,
    confirmPassword: VALID_PASSWORD,
    ...overrides,
  }

  if (data.name) await user.type(screen.getByLabelText(/full name/i), data.name)
  if (data.email) await user.type(screen.getByLabelText(/^email$/i), data.email)
  if (data.password) await user.type(screen.getByLabelText(/^password$/i), data.password)
  if (data.confirmPassword) await user.type(screen.getByLabelText(/^confirm password$/i), data.confirmPassword)
}

const submitForm = async (user) => {
  await user.click(screen.getByRole("button", { name: /continue with email verification/i }))
}

// Typing the 6th digit auto-submits (OTPVerification's handleOTPChange),
// so there's no button left to click by the time all digits are in.
const enterOtpAndVerify = async (user, code = "123456") => {
  const otpInputs = screen.getAllByRole("textbox")
  for (let i = 0; i < otpInputs.length; i++) {
    await user.type(otpInputs[i], code[i])
  }
}

describe("SignupForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockDeriveKeypair.mockResolvedValue(fakeKeypair)
  })

  describe("UI Render Tests", () => {
    test("renders the create-account heading", () => {
      render(
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      )
      expect(screen.getByText(/create account/i)).toBeInTheDocument()
    })

    test("renders all input fields", () => {
      render(
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      )
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^confirm password$/i)).toBeInTheDocument()
    })

    test("renders a sign in link to /login", () => {
      render(
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      )
      const link = screen.getByRole("link", { name: /sign in/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute("href", "/login")
    })

    test("the submit button starts disabled until the password meets all requirements", async () => {
      const user = userEvent.setup()
      render(
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      )

      expect(screen.getByRole("button", { name: /continue with email verification/i })).toBeDisabled()

      await fillForm(user)

      expect(screen.getByRole("button", { name: /continue with email verification/i })).toBeEnabled()
    })

    test("shows a live 'passwords do not match' indicator", async () => {
      const user = userEvent.setup()
      render(
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      )

      await user.type(screen.getByLabelText(/^password$/i), VALID_PASSWORD)
      await user.type(screen.getByLabelText(/^confirm password$/i), "Different123!")

      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /continue with email verification/i })).toBeDisabled()
    })
  })

  describe("Form-step validation", () => {
    // NOTE: name/email/password/confirm-password all carry the native HTML
    // `required` attribute, and email is `type="email"`. That means an
    // empty name or email is blocked by the browser's own constraint
    // validation *before* the submit event (and therefore handleSendOTP's
    // "Full name is required" / "Email is required" branches) ever fires —
    // in happy-dom here, and identically in a real browser. So those two
    // specific JS message branches are currently dead code in production
    // too; what's actually testable/guaranteed is that submission doesn't
    // proceed, which is what these assert.
    test("does not send an OTP when the name is empty", async () => {
      const user = userEvent.setup()
      render(
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      )

      await fillForm(user, { name: "" })
      await submitForm(user)

      expect(mockSendOTP).not.toHaveBeenCalled()
    })

    test("does not send an OTP when the email is empty", async () => {
      const user = userEvent.setup()
      render(
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      )

      await fillForm(user, { email: "" })
      await submitForm(user)

      expect(mockSendOTP).not.toHaveBeenCalled()
    })

    test("rejects an email with no domain suffix", async () => {
      const user = userEvent.setup()
      render(
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      )

      // Same native-constraint-validation note as Login.test.jsx: this
      // input is type="email", so a value with no "@" at all never reaches
      // React's onSubmit in the first place (happy-dom blocks it, like a
      // real browser). "john@example" clears that native check but still
      // fails the app's own stricter regex.
      await fillForm(user, { email: "john@example" })
      await submitForm(user)

      expect(await screen.findByText(/invalid email format/i)).toBeInTheDocument()
      expect(mockSendOTP).not.toHaveBeenCalled()
    })
  })

  describe("OTP step", () => {
    test("moves to the OTP screen after a successful send", async () => {
      const user = userEvent.setup()
      mockSendOTP.mockResolvedValueOnce({ success: true })

      render(
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      )

      await fillForm(user)
      await submitForm(user)

      expect(await screen.findByText(/verify email/i)).toBeInTheDocument()
      expect(screen.getByText("john@example.com")).toBeInTheDocument()
      expect(mockSendOTP).toHaveBeenCalledWith("john@example.com", "John Doe", "registration")
    })

    test("shows an error and stays on the form when sending the OTP fails", async () => {
      const user = userEvent.setup()
      mockSendOTP.mockRejectedValueOnce({ message: "Too many requests" })

      render(
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      )

      await fillForm(user)
      await submitForm(user)

      expect(await screen.findByText(/too many requests/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    })

    test("shows an error on an invalid OTP and does not register", async () => {
      const user = userEvent.setup()
      mockSendOTP.mockResolvedValueOnce({ success: true })
      mockVerifyOTP.mockResolvedValueOnce({ success: false, message: "Invalid OTP" })

      render(
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      )

      await fillForm(user)
      await submitForm(user)
      await screen.findByText(/verify email/i)
      await enterOtpAndVerify(user)

      expect(await screen.findByText(/invalid otp/i)).toBeInTheDocument()
      expect(mockRegister).not.toHaveBeenCalled()
    })
  })

  describe("Registration after OTP verification", () => {
    test("registers with the derived public key and navigates to /login", async () => {
      const user = userEvent.setup()
      mockSendOTP.mockResolvedValueOnce({ success: true })
      mockVerifyOTP.mockResolvedValueOnce({ success: true })
      mockRegister.mockResolvedValueOnce({ success: true, token: "test-token" })

      render(
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      )

      await fillForm(user)
      await submitForm(user)
      await screen.findByText(/verify email/i)
      await enterOtpAndVerify(user, "654321")

      await waitFor(() => {
        expect(mockDeriveKeypair).toHaveBeenCalledWith("john@example.com", VALID_PASSWORD)
      })

      expect(mockRegister).toHaveBeenCalledWith({
        name: "John Doe",
        email: "john@example.com",
        password: VALID_PASSWORD,
        otp: "654321",
        publicKey: expect.any(String),
      })

      // Registration success schedules navigate("/login") ~1.5s later.
      await waitFor(
        () => {
          expect(mockNavigate).toHaveBeenCalledWith("/login")
        },
        { timeout: 3000 }
      )
    })

    test("shows the error and does not navigate if registration fails after OTP verification", async () => {
      const user = userEvent.setup()
      mockSendOTP.mockResolvedValueOnce({ success: true })
      mockVerifyOTP.mockResolvedValueOnce({ success: true })
      mockRegister.mockRejectedValueOnce({ message: "Email already exists" })

      render(
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      )

      await fillForm(user)
      await submitForm(user)
      await screen.findByText(/verify email/i)
      await enterOtpAndVerify(user)

      // Registration fails *after* a successful OTP verify — OTPVerification's
      // own error state only covers OTP-verify failures, so SignupForm shows
      // this one itself, above the (still-rendered) OTP screen.
      expect(await screen.findByText(/email already exists/i)).toBeInTheDocument()
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    // Regression test: OTPVerification used to stay mounted showing its own
    // "Verified!" success state (every box disabled) when registration
    // failed afterward — a dead end with no way to retry. SignupForm now
    // forces it to remount (via a key bump) so the boxes come back usable.
    test("lets the user try again after a post-verification registration failure, instead of leaving the OTP screen frozen", async () => {
      const user = userEvent.setup()
      mockSendOTP.mockResolvedValue({ success: true })
      mockVerifyOTP
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true })
      mockRegister
        .mockRejectedValueOnce({ message: "Email already exists" })
        .mockResolvedValueOnce({ success: true, token: "test-token" })

      render(
        <MemoryRouter>
          <SignupForm />
        </MemoryRouter>
      )

      await fillForm(user)
      await submitForm(user)
      await screen.findByText(/verify email/i)
      await enterOtpAndVerify(user, "111111")
      await screen.findByText(/email already exists/i)

      const otpInputs = screen.getAllByRole("textbox")
      expect(otpInputs[0]).not.toBeDisabled()

      await enterOtpAndVerify(user, "222222")

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/login")
      }, { timeout: 3000 })
    })
  })
})
