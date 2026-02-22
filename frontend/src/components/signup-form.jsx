import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import authService from "@services/auth.service.js"
import otpAPI from "@api/otp.api.js"
import OTPVerification from "./OTPVerification"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, Loader, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react"

export function SignupForm({ ...props }) {
  const navigate = useNavigate()
  
  const [step, setStep] = useState('form')
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState("")
  const [error, setError] = useState("")
  
  // ✅ Password visibility state
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // ✅ PASSWORD VALIDATION STATE
  const [passwordErrors, setPasswordErrors] = useState({
    minLength: false,
    hasUppercase: false,
    hasNumber: false,
    hasSpecial: false,
    passwordMatch: false
  })

  // ✅ VALIDATE PASSWORD IN REAL-TIME
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

  const handleChange = (e) => {
    const { name, value } = e.target
    const newForm = { ...form, [name]: value }
    setForm(newForm)
    setError("")

    // ✅ VALIDATE ON CHANGE
    if (name === 'password' || name === 'confirmPassword') {
      validatePassword(newForm.password, newForm.confirmPassword)
    }
  }

  // ✅ CHECK IF ALL PASSWORD REQUIREMENTS MET
  const isPasswordValid = () => {
    return (
      passwordErrors.minLength &&
      passwordErrors.hasUppercase &&
      passwordErrors.hasNumber &&
      passwordErrors.hasSpecial &&
      passwordErrors.passwordMatch
    )
  }

  const handleSendOTP = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    // ✅ FRONTEND VALIDATION BEFORE BACKEND CALL
    if (!form.name.trim()) {
      setError("Full name is required")
      setLoading(false)
      return
    }

    if (!form.email.trim()) {
      setError("Email is required")
      setLoading(false)
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.email)) {
      setError("Invalid email format")
      setLoading(false)
      return
    }

    // ✅ VALIDATE PASSWORD BEFORE SENDING OTP
    if (!form.password) {
      setError("Password is required")
      setLoading(false)
      return
    }

    if (!isPasswordValid()) {
      setError("Password does not meet all requirements")
      setLoading(false)
      return
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    try {
      const response = await otpAPI.sendOTP(form.email, form.name, 'registration')

      if (response.success) {
        setStep('otp')
      } else {
        setError(response.message || "Failed to send OTP")
      }
    } catch (err) {
      setError(err.message || "Failed to send OTP")
    } finally {
      setLoading(false)
    }
  }

  const handleOTPSuccess = async (otpCode) => {
    
    if (!otpCode) {
      setError('OTP verification failed');
      setStep('otp');
      return;
    }

    setLoading(true)
    setError("")

    try {
      const response = await authService.register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        otp: otpCode
      })

      if (response.success || response.token) {
        setMsg("✅ Account created! Redirecting...")
        setTimeout(() => navigate("/login"), 1500)
      } else {
        setError(response.message || "Registration failed")
        setStep('otp')
      }
    } catch (err) {
      setError(err.message || "Registration failed")
      setStep('otp')
    } finally {
      setLoading(false)
    }
  }

  const handleBackFromOTP = () => {
    setStep('form')
  }

  // ✅ FORM STEP
  if (step === 'form') {
    return (
      <Card className="w-full max-w-sm mx-auto shadow-2xl border-t-4 border-t-primary bg-card/50 backdrop-blur-sm" {...props}>
        <CardHeader className="space-y-1 pb-6">
          <CardTitle className="text-3xl font-black tracking-tighter text-center bg-linear-to-br from-primary to-primary/60 bg-clip-text text-transparent">
            Create account
          </CardTitle>
          <CardDescription className="text-center font-medium">
            {msg ? "Starting your journey..." : "Enter your details to get started"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {msg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="font-medium">{msg}</p>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm flex items-center gap-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          {!msg && (
            <>
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="John Doe"
                    value={form.name}
                    onChange={handleChange}
                    disabled={loading}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    value={form.email}
                    onChange={handleChange}
                    disabled={loading}
                    required
                  />
                </div>

                {/* ✅ PASSWORD FIELD WITH TOGGLE */}
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={form.password}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      disabled={loading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* ✅ PASSWORD REQUIREMENTS CHECKLIST */}
                  {form.password && (
                    <div className="mt-2 p-3 bg-muted/50 rounded-lg space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Password Requirements:</p>
                      
                      <div className="flex items-center gap-2 text-xs">
                        {passwordErrors.minLength ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className={passwordErrors.minLength ? "text-green-600" : "text-red-600"}>
                          At least 8 characters
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        {passwordErrors.hasUppercase ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className={passwordErrors.hasUppercase ? "text-green-600" : "text-red-600"}>
                          One uppercase letter (A-Z)
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        {passwordErrors.hasNumber ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className={passwordErrors.hasNumber ? "text-green-600" : "text-red-600"}>
                          One number (0-9)
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        {passwordErrors.hasSpecial ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className={passwordErrors.hasSpecial ? "text-green-600" : "text-red-600"}>
                          One special character (!@#$%^&*)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ✅ CONFIRM PASSWORD FIELD WITH TOGGLE */}
                <div className="grid gap-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={form.confirmPassword}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      disabled={loading}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* ✅ PASSWORD MATCH INDICATOR */}
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

                <Button 
                  type="submit" 
                  disabled={loading || !isPasswordValid()} 
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin mr-2" />
                      Sending code...
                    </>
                  ) : (
                    "Continue with Email Verification"
                  )}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-primary hover:underline font-bold">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  // ✅ OTP VERIFICATION STEP
  if (step === 'otp') {
    return (
      <OTPVerification
        email={form.email}
        name={form.name}
        purpose="registration"
        onSuccess={handleOTPSuccess}
        onBack={handleBackFromOTP}
      />
    )
  }
}
