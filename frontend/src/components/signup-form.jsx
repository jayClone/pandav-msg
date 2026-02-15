import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import authService from "@services/auth.service.js"
import otpAPI from "@api/otp.api.js"
import OTPVerification from "./OTPVerification"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, Loader } from "lucide-react"

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

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError("")
  }

  const handleSendOTP = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")

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

    if (!form.password) {
      setError("Password is required")
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

  // ✅ FIX: Properly receive OTP param and log it
  const handleOTPSuccess = async (otpCode) => {
    console.log('✅ [SIGNUP] OTP Success with code:', otpCode);
    
    if (!otpCode) {
      setError('OTP verification failed');
      setStep('otp');
      return;
    }

    setLoading(true)
    setError("")

    try {
      const response = await authService.register({
        name: form.name,
        email: form.email,
        password: form.password,
        otp: otpCode  // ✅ PASS THE OTP
      })

      if (response.success || response.token) {
        setMsg("✅ Account created! Redirecting...")
        setTimeout(() => navigate("/login"), 1500)
      } else {
        setError(response.message || "Registration failed")
        setStep('otp')
      }
    } catch (err) {
      console.error('❌ Registration error:', err);
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

                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleChange}
                    disabled={loading}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    name="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    disabled={loading}
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={loading} 
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
  return (
    <OTPVerification
      email={form.email}
      name={form.name}
      purpose="registration"
      onSuccess={handleOTPSuccess}  // ✅ PASS CALLBACK
      onBack={handleBackFromOTP}
    />
  )
}
