import React from "react"
import { useNavigate } from "react-router-dom"

export default function Chat() {
  const navigate = useNavigate()

  const token = localStorage.getItem("token")

  const logout = () => {
    localStorage.removeItem("token")
    navigate("/login")
  }

  if (!token) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Not logged in</h2>
        <button onClick={() => navigate("/login")}>Go to Login</button>
      </div>
    )
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Chat Page (V1)</h2>
      <p>Token saved ✅</p>
      <button onClick={logout}>Logout</button>
    </div>
  )
}
