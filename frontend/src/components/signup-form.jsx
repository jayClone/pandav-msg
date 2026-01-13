import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { registerUser } from "@/api/auth.api"
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
      const data = await registerUser({
        name: form.name,
        email: form.email,
        password: form.password,
      })
      setMsg(data.message || "Registered successfully")
      setTimeout(() => navigate("/login"), 2000)
    } catch (err) {
      setError(err?.response?.data?.message || "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Enter your information below to create your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {msg && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {msg}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="John Doe"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="m@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating Account..." : "Create Account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
