import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { ForgotPasswordForm } from "../forgot-password-form"
import { vi } from "vitest"

vi.mock("@api/otp.api.js", () => ({
  default: {
    sendOTP: vi.fn(),
    verifyOTP: vi.fn(),
    resendOTP: vi.fn(),
  },
}))

vi.mock("@services/auth.service.js", () => ({
  default: {
    resetPassword: vi.fn(),
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

const mockSendOTP = vi.mocked(otpAPI.sendOTP)
const mockVerifyOTP = vi.mocked(otpAPI.verifyOTP)
const mockResetPassword = vi.mocked(authService.resetPassword)

const VALID_PASSWORD = "NewPassword123!"

// Typing the 6th digit auto-submits (OTPVerification's handleOTPChange),
// so there's no button left to click by the time all digits are in.
const enterOtpAndVerify = async (user, code = "123456") => {
  const otpInputs = screen.getAllByRole("textbox")
  for (let i = 0; i < otpInputs.length; i++) {
    await user.type(otpInputs[i], code[i])
  }
}

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Email step", () => {
    test("renders the email input and submit button", () => {
      render(
        <MemoryRouter>
          <ForgotPasswordForm />
        </MemoryRouter>
      )

      expect(screen.getByText(/forgot password\?/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText("name@example.com")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /send reset code/i })).toBeInTheDocument()
    })

    test("renders a link back to sign in", () => {
      render(
        <MemoryRouter>
          <ForgotPasswordForm />
        </MemoryRouter>
      )

      const link = screen.getByRole("link", { name: /back to sign in/i })
      expect(link).toHaveAttribute("href", "/login")
    })

    test("requires an email before sending", async () => {
      const user = userEvent.setup()
      render(
        <MemoryRouter>
          <ForgotPasswordForm />
        </MemoryRouter>
      )

      await user.click(screen.getByRole("button", { name: /send reset code/i }))

      expect(await screen.findByText(/email is required/i)).toBeInTheDocument()
      expect(mockSendOTP).not.toHaveBeenCalled()
    })

    test("rejects an email with no domain suffix", async () => {
      const user = userEvent.setup()
      render(
        <MemoryRouter>
          <ForgotPasswordForm />
        </MemoryRouter>
      )

      // Same native type="email" constraint-validation note as
      // Login.test.jsx / signup-form.test.jsx: a value with no "@" at all
      // never reaches this assertion in the first place.
      await user.type(screen.getByPlaceholderText("name@example.com"), "test@example")
      await user.click(screen.getByRole("button", { name: /send reset code/i }))

      expect(await screen.findByText(/invalid email format/i)).toBeInTheDocument()
      expect(mockSendOTP).not.toHaveBeenCalled()
    })

    test("sends the OTP without a name and moves to the OTP step", async () => {
      const user = userEvent.setup()
      mockSendOTP.mockResolvedValueOnce({ success: true })

      render(
        <MemoryRouter>
          <ForgotPasswordForm />
        </MemoryRouter>
      )

      await user.type(screen.getByPlaceholderText("name@example.com"), "test@example.com")
      await user.click(screen.getByRole("button", { name: /send reset code/i }))

      expect(await screen.findByText(/verify email/i)).toBeInTheDocument()
      expect(mockSendOTP).toHaveBeenCalledWith("test@example.com", undefined, "password-reset")
    })

    // The response is intentionally identical whether or not the email has
    // an account (enumeration prevention, see backend otp.controller.js) —
    // the UI always proceeds to the OTP step either way.
    test("moves to the OTP step even for an email with no account", async () => {
      const user = userEvent.setup()
      mockSendOTP.mockResolvedValueOnce({ success: true, message: 'If eligible, an OTP has been sent' })

      render(
        <MemoryRouter>
          <ForgotPasswordForm />
        </MemoryRouter>
      )

      await user.type(screen.getByPlaceholderText("name@example.com"), "nobody@example.com")
      await user.click(screen.getByRole("button", { name: /send reset code/i }))

      expect(await screen.findByText(/verify email/i)).toBeInTheDocument()
    })
  })

  describe("New password step", () => {
    const getToNewPasswordStep = async (user) => {
      mockSendOTP.mockResolvedValueOnce({ success: true })
      mockVerifyOTP.mockResolvedValueOnce({ success: true })

      await user.type(screen.getByPlaceholderText("name@example.com"), "test@example.com")
      await user.click(screen.getByRole("button", { name: /send reset code/i }))
      await screen.findByText(/verify email/i)
      await enterOtpAndVerify(user)
      await screen.findByText(/set a new password/i)
    }

    test("disables submit until the new password meets all requirements", async () => {
      const user = userEvent.setup()
      render(
        <MemoryRouter>
          <ForgotPasswordForm />
        </MemoryRouter>
      )

      await getToNewPasswordStep(user)

      expect(screen.getByRole("button", { name: /reset password/i })).toBeDisabled()

      await user.type(screen.getByLabelText(/^new password$/i), VALID_PASSWORD)
      await user.type(screen.getByLabelText(/confirm new password/i), VALID_PASSWORD)

      expect(screen.getByRole("button", { name: /reset password/i })).toBeEnabled()
    })

    test("shows a live mismatch indicator for non-matching passwords", async () => {
      const user = userEvent.setup()
      render(
        <MemoryRouter>
          <ForgotPasswordForm />
        </MemoryRouter>
      )

      await getToNewPasswordStep(user)

      await user.type(screen.getByLabelText(/^new password$/i), VALID_PASSWORD)
      await user.type(screen.getByLabelText(/confirm new password/i), "Different123!")

      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })

    test("submits the verified OTP and new password, then redirects to login", async () => {
      const user = userEvent.setup()
      mockResetPassword.mockResolvedValueOnce({ success: true, message: "Password reset successful" })

      render(
        <MemoryRouter>
          <ForgotPasswordForm />
        </MemoryRouter>
      )

      await getToNewPasswordStep(user)

      await user.type(screen.getByLabelText(/^new password$/i), VALID_PASSWORD)
      await user.type(screen.getByLabelText(/confirm new password/i), VALID_PASSWORD)
      await user.click(screen.getByRole("button", { name: /reset password/i }))

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith({
          email: "test@example.com",
          otp: "123456",
          newPassword: VALID_PASSWORD,
        })
      })

      await waitFor(
        () => {
          expect(mockNavigate).toHaveBeenCalledWith("/login")
        },
        { timeout: 3000 }
      )
    })

    test("shows the server error and does not redirect on failure", async () => {
      const user = userEvent.setup()
      mockResetPassword.mockRejectedValueOnce({ message: "OTP expired. Please request a new OTP." })

      render(
        <MemoryRouter>
          <ForgotPasswordForm />
        </MemoryRouter>
      )

      await getToNewPasswordStep(user)

      await user.type(screen.getByLabelText(/^new password$/i), VALID_PASSWORD)
      await user.type(screen.getByLabelText(/confirm new password/i), VALID_PASSWORD)
      await user.click(screen.getByRole("button", { name: /reset password/i }))

      expect(await screen.findByText(/otp expired/i)).toBeInTheDocument()
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    // Regression test: there used to be no way back from this step at all
    // (no Back button existed here, unlike the OTP step) — an OTP that
    // expired while sitting on the new-password screen was a dead end
    // requiring a full page reload to recover from.
    test("offers a way back to the OTP step when the reset fails (e.g. an expired OTP)", async () => {
      const user = userEvent.setup()
      mockResetPassword.mockRejectedValueOnce({ message: "OTP expired. Please request a new OTP." })

      render(
        <MemoryRouter>
          <ForgotPasswordForm />
        </MemoryRouter>
      )

      await getToNewPasswordStep(user)

      await user.type(screen.getByLabelText(/^new password$/i), VALID_PASSWORD)
      await user.type(screen.getByLabelText(/confirm new password/i), VALID_PASSWORD)
      await user.click(screen.getByRole("button", { name: /reset password/i }))
      await screen.findByText(/otp expired/i)

      await user.click(screen.getByRole("button", { name: /get a new one/i }))

      expect(await screen.findByText(/verify email/i)).toBeInTheDocument()
    })
  })
})
