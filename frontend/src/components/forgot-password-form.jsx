import { useRef, useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import authService from "@services/auth.service.js"
import otpAPI from "@api/otp.api.js"
import OTPVerification from "./OTPVerification"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, Eye, EyeOff, CheckCircle, XCircle, ArrowLeft } from "lucide-react"

export function ForgotPasswordForm({ ...props }) {
  const navigate = useNavigate()

  const [step, setStep] = useState('email')
  const [email, setEmail] = useState("")
  const [form, setForm] = useState({ password: "", confirmPassword: "" })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState("")
  const [error, setError] = useState("")

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [passwordErrors, setPasswordErrors] = useState({
    minLength: false,
    hasUppercase: false,
    hasNumber: false,
    hasSpecial: false,
    passwordMatch: false
  })

  const validatePassword = (password, confirmPassword) => {
    const errors = {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[!@#$%^&*]/.test(password),
      passwordMatch: password === confirmPassword && password.length > 0
    }
    setPasswordErrors(errors)
    return errors
  }

  const isPasswordValid = () => (
    passwordErrors.minLength &&
    passwordErrors.hasUppercase &&
    passwordErrors.hasNumber &&
    passwordErrors.hasSpecial &&
    passwordErrors.passwordMatch
  )

  const handleFormChange = (e) => {
    const { name, value } = e.target
    const newForm = { ...form, [name]: value }
    setForm(newForm)
    setError("")
    validatePassword(newForm.password, newForm.confirmPassword)
  }

  // ✅ STEP 1: send the OTP
  const handleSendOTP = async (e) => {
    e.preventDefault()
    setError("")

    if (!email.trim()) {
      setError("Email is required")
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError("Invalid email format")
      return
    }

    setLoading(true)
    try {
      // Intentionally generic either way — the response can't reveal
      // whether this email actually has an account (see backend audit 05 /
      // otp.controller.js). Always move to the OTP step.
      await otpAPI.sendOTP(email.trim().toLowerCase(), undefined, 'password-reset')
      setStep('otp')
    } catch (err) {
      setError(err.message || "Failed to send OTP")
    } finally {
      setLoading(false)
    }
  }

  // Holds the verified OTP between the 'otp' and 'newPassword' steps —
  // reset-password re-checks it server-side (see resetPassword in
  // auth.Controller.js), it's not just trusted client state.
  const verifiedOtpRef = useRef(null)

  // ✅ STEP 2 -> 3: OTP verified, move to the new-password step
  const handleOTPSuccess = (otpCode) => {
    if (!otpCode) {
      setError('OTP verification failed')
      setStep('otp')
      return
    }
    setForm({ password: "", confirmPassword: "" })
    setPasswordErrors({ minLength: false, hasUppercase: false, hasNumber: false, hasSpecial: false, passwordMatch: false })
    setError("")
    verifiedOtpRef.current = otpCode
    setStep('newPassword')
  }

  const handleBackFromOTP = () => {
    setStep('email')
  }

  // ✅ STEP 3: submit the new password
  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError("")

    if (!isPasswordValid()) {
      setError("Password does not meet all requirements")
      return
    }

    setLoading(true)
    try {
      const response = await authService.resetPassword({
        email,
        otp: verifiedOtpRef.current,
        newPassword: form.password
      })

      if (response.success) {
        setMsg("✅ Password reset! Redirecting to login...")
        setTimeout(() => navigate("/login"), 1500)
      } else {
        setError(response.message || "Password reset failed")
      }
    } catch (err) {
      setError(err.message || "Password reset failed")
    } finally {
      setLoading(false)
    }
  }

  // ✅ OTP STEP
  if (step === 'otp') {
    return (
      <div className="w-full max-w-md mx-auto">
        {error && (
          <div role="alert" className="mb-4 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm flex items-center gap-3">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
        )}
        <OTPVerification
          email={email}
          purpose="password-reset"
          onSuccess={handleOTPSuccess}
          onBack={handleBackFromOTP}
        />
      </div>
    )
  }

  // ✅ NEW PASSWORD STEP
  if (step === 'newPassword') {
    return (
      <div className={cn("flex flex-col gap-6", props.className)}>
        <Card className="w-full max-w-sm mx-auto shadow-2xl border-t-4 border-t-primary bg-card/50 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-3xl font-black tracking-tighter text-center">
              Set a new password
            </CardTitle>
            <CardDescription className="text-center font-medium">
              {msg ? "Almost done..." : "Choose a new password for your account"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {msg && (
              <div role="status" className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="font-medium">{msg}</p>
              </div>
            )}

            {error && !msg && (
              <div role="alert" className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm flex items-center gap-3">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            {!msg && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="........"
                      value={form.password}
                      onChange={handleFormChange}
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                      title={showPassword ? "Hide password" : "Show password"}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {form.password && (
                    <div className="mt-2 p-3 bg-muted/50 rounded-lg space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Password Requirements:</p>
                      {[
                        [passwordErrors.minLength, "At least 8 characters"],
                        [passwordErrors.hasUppercase, "One uppercase letter (A-Z)"],
                        [passwordErrors.hasNumber, "One number (0-9)"],
                        [passwordErrors.hasSpecial, "One special character (!@#$%^&*)"]
                      ].map(([met, label]) => (
                        <div key={label} className="flex items-center gap-2 text-xs">
                          {met ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                          <span className={met ? "text-green-600" : "text-red-600"}>{label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="........"
                      value={form.confirmPassword}
                      onChange={handleFormChange}
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={loading}
                      title={showConfirmPassword ? "Hide password" : "Show password"}
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {form.confirmPassword && (
                    <div className="flex items-center gap-2 text-xs mt-2">
                      {passwordErrors.passwordMatch ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-green-600">Passwords match</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-red-600" />
                          <span className="text-red-600">Passwords do not match</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <Button type="submit" disabled={loading || !isPasswordValid()} className="w-full">
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>

                {/* Recovery path for an OTP that expired while sitting on this
                    step (or any other stale/consumed-OTP failure) — without
                    this there was no way back except reloading the page and
                    restarting from the email step. */}
                <button
                  type="button"
                  onClick={() => {
                    setError("")
                    setStep('otp')
                  }}
                  disabled={loading}
                  className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors w-full"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Code expired or not working? Get a new one
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ✅ EMAIL STEP (default)
  return (
    <div className={cn("flex flex-col gap-6", props.className)}>
      <Card className="w-full max-w-sm mx-auto shadow-2xl border-t-4 border-t-primary bg-card/50 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-6">
          <CardTitle className="text-3xl font-black tracking-tighter text-center">
            Forgot password?
          </CardTitle>
          <CardDescription className="text-center font-medium">
            Enter your email and we'll send you a code to reset it
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error && (
            <div role="alert" className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm flex items-center gap-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSendOTP} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError("")
                }}
                disabled={loading}
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Sending code..." : "Send Reset Code"}
            </Button>
          </form>

          <Link
            to="/login"
            className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
