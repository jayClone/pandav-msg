import { useState } from "react"
import { useNavigate, Link, useLocation } from "react-router-dom"
import authService from "@/services/auth.service"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info } from "lucide-react"

export function LoginForm({ className, ...props }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: "", password: "" })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState("")
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [failedField, setFailedField] = useState(null)
  const [attemptCount, setAttemptCount] = useState(0)
  const redirectTo = location.state?.from?.pathname || "/chat"

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })

    if (fieldErrors[name]) {
      setFieldErrors({ ...fieldErrors, [name]: "" })
    }

    if (error && name === failedField) {
      setError("")
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!form.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Please enter a valid email address"
    }

    if (!form.password.trim()) {
      newErrors.password = "Password is required"
    } else if (form.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters"
    }

    setFieldErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)
    setMsg("")
    setError("")
    setIsSuccess(false)
    setFailedField(null)
    setAttemptCount((prev) => prev + 1)

    try {
      const response = await authService.login({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      })

      if (!response?.token) {
        throw new Error("No token received from server")
      }

      setMsg(response.message || "Login successful. Redirecting...")
      setIsSuccess(true)
      setAttemptCount(0)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      const status = err?.status || err?.response?.status
      const errorMessage = err?.message || "Login failed"

      switch (status) {
        case 401:
          setError("Invalid email or password")
          if (attemptCount >= 1) {
            setFieldErrors({
              email: "Double-check your email",
              password: "Or your password is incorrect",
            })
          } else {
            setFieldErrors({ password: "Wrong credentials" })
          }
          setFailedField("password")
          break

        case 404:
          setError("No account found with this email")
          setFieldErrors({
            email: "This email is not registered",
            password: "",
          })
          setFailedField("email")
          break

        case 400:
          setError(errorMessage)
          break

        case 403:
          setError("Account is locked. Please try again later.")
          break

        default:
          setError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card
        className={cn(
          "w-full max-w-sm mx-auto shadow-2xl border-t-4 bg-card/50 backdrop-blur-sm transition-all duration-300",
          isSuccess ? "border-t-emerald-500 shadow-emerald-500/20" : "border-t-primary",
          error && !isSuccess ? "border-t-red-500 shadow-red-500/10" : ""
        )}
      >
        <CardHeader className="space-y-1 pb-6">
          <CardTitle className="text-3xl font-black tracking-tighter text-center">
            Welcome back
          </CardTitle>
          <CardDescription className="text-center font-medium">
            {msg ? "Redirecting..." : "Enter your credentials to access your account"}
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4">
          {msg && isSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              <p className="font-medium">{msg}</p>
            </div>
          )}

          {error && !isSuccess && (
            <div className="space-y-3 animate-in fade-in zoom-in-95 duration-300">
              <div className="bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold">Login Failed</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              </div>

              {attemptCount >= 2 && (
                <div className="bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-400 px-4 py-2 rounded-xl text-xs flex items-start gap-2">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Troubleshooting:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Check if your email is spelled correctly</li>
                      <li>Password is case-sensitive</li>
                      <li>Try using "Forgot Password" if needed</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isSuccess && (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className={cn(
                      "text-xs font-bold uppercase tracking-wider",
                      fieldErrors.email ? "text-red-500" : "text-muted-foreground"
                    )}
                  >
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    value={form.email}
                    onChange={handleChange}
                    disabled={loading}
                    className={cn(
                      "h-11 transition-all rounded-xl",
                      fieldErrors.email || (failedField === "email" && error)
                        ? "border-2 border-red-500 focus:ring-red-500/20"
                        : "border border-muted-foreground/20"
                    )}
                    autoComplete="email"
                  />
                  {(fieldErrors.email || (failedField === "email" && error)) && (
                    <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {fieldErrors.email || "This email is not registered"}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className={cn(
                      "text-xs font-bold uppercase tracking-wider",
                      fieldErrors.password ? "text-red-500" : "text-muted-foreground"
                    )}
                  >
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="........"
                      value={form.password}
                      onChange={handleChange}
                      disabled={loading}
                      className={cn(
                        "h-11 pr-10 transition-all rounded-xl",
                        fieldErrors.password || (failedField === "password" && error)
                          ? "border-2 border-red-500 focus:ring-red-500/20"
                          : "border border-muted-foreground/20"
                      )}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {(fieldErrors.password || (failedField === "password" && error)) && (
                    <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {fieldErrors.password || "Password is incorrect"}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 mt-6 font-bold rounded-xl transition-all"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-muted" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">New to Pandav?</span>
                </div>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link to="/register" className="font-bold text-primary hover:underline">
                  Sign up
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
