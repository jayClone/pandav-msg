import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import apiService from "@/services/api"
import { connectSocket } from "@/socket/socketClient"
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

export function SignupForm({ ...props }) {
  const navigate = useNavigate()
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
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMsg("")
    setError("")

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    try {
      const response = await apiService.auth.register({
        name: form.name,
        email: form.email,
        password: form.password,
      })
      
      const { token, message } = response.data
      setMsg(message || "Account created successfully! Redirecting...")
      
      if (token) {
        localStorage.setItem("token", token)
        connectSocket(token)
        setTimeout(() => navigate("/chat"), 1500)
      } else {
        setTimeout(() => navigate("/"), 2000)
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Registration failed")
    } finally {
      setLoading(false)
    }
  }

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
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="font-medium">{msg}</p>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm flex items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
            <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {!msg && (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2 transform transition-all duration-200 focus-within:translate-x-1">
                <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="John Doe"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="h-11 bg-background/50 focus:bg-background transition-all border-muted-foreground/20 rounded-xl"
                />
              </div>

              <div className="grid gap-2 transform transition-all duration-200 focus-within:translate-x-1">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="h-11 bg-background/50 focus:bg-background transition-all border-muted-foreground/20 rounded-xl"
                />
              </div>

              <div className="grid gap-2 transform transition-all duration-200 focus-within:translate-x-1">
                <Label htmlFor="password" title="Password must be at least 8 characters" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  required
                  className="h-11 bg-background/50 focus:bg-background transition-all border-muted-foreground/20 rounded-xl"
                />
              </div>

              <div className="grid gap-2 transform transition-all duration-200 focus-within:translate-x-1">
                <Label htmlFor="confirm-password" title="Re-enter your password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                  className="h-11 bg-background/50 focus:bg-background transition-all border-muted-foreground/20 rounded-xl"
                />
              </div>

              <Button 
                type="submit" 
                disabled={loading} 
                className="w-full h-11 mt-4 font-bold rounded-xl transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
              >
                {loading ? "Creating account..." : "Register Now"}
              </Button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-muted" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground font-medium">
              Already have an account?{" "}
              <Link 
                to="/login" 
                className="text-primary hover:underline underline-offset-4 font-bold decoration-2 transition-all hover:tracking-tight"
              >
                Sign in
              </Link>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
