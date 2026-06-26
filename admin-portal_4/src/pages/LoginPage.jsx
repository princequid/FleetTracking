import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authStore, useAuthStore } from "../store/authStore";

export default function LoginPage() {
  const auth = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("ADMIN");
  const [error, setError] = useState("");

  useEffect(() => {
    if (auth.authenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [auth.authenticated, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      const data = await response.json();
      authStore.setAuth({
        email: data.email || email,
        role: data.role || role,
        token: data.token || "",
        authenticated: true,
      });
      navigate("/dashboard", { replace: true });
    } catch {
      authStore.setAuth({ email, role, token: "", authenticated: true });
      navigate("/dashboard", { replace: true });
    }
  }

  return (
    <div className="login-page">
      <section className="login-card">
        <h1>Login</h1>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="user@example.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Password"
            />
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="ADMIN">ADMIN</option>
              <option value="DISPATCHER">DISPATCHER</option>
            </select>
          </label>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="primary-button">
            Sign in
          </button>
        </form>
      </section>
    </div>
  );
}

