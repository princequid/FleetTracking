import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import api from "../services/api";
import { PORTAL_ROLES, DRIVER_NOT_PERMITTED } from "../constants/roles";
import { EyeIcon, EyeOffIcon } from "../components/common/Icons";

const FEATURES = ["Fleet Tracking", "Cargo Safety", "Real-time Analytics"];

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const role = useAuthStore((state) => state.role);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn) return;

    if (PORTAL_ROLES.includes(role)) {
      navigate("/dashboard", { replace: true });
      return;
    }

    // A driver session persisted from before this gate existed. Drop it here
    // rather than sending them on to /dashboard: the layout guard would bounce
    // them straight back to /login, and the two would redirect at each other
    // forever. Clearing is also the honest outcome — the session is useless in
    // this app, and leaving it in storage means the same loop next visit.
    clearAuth();
    setError(DRIVER_NOT_PERMITTED);
  }, [isLoggedIn, role, navigate, clearAuth]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = { email, password };
      if (mfaRequired) payload.mfaCode = mfaCode;

      const { data } = await api.post("/auth/login", payload);

      if (data.mfaRequired) {
        setMfaRequired(true);
        setLoading(false);
        return;
      }

      // Checked after MFA resolves, so a driver isn't told "wrong portal" while
      // a second factor is still outstanding — that would confirm the password
      // was correct to someone who hasn't finished proving who they are.
      //
      // Deliberately no setAuth: the credentials were valid and the server has
      // issued tokens, but nothing here should hold a session it won't honour.
      // The tokens are simply dropped; they're the same ones the driver gets
      // legitimately in the app, so discarding them costs nothing.
      if (!PORTAL_ROLES.includes(data.role)) {
        setError(DRIVER_NOT_PERMITTED);
        setLoading(false);
        return;
      }

      setAuth({
        userId: data.userId,
        email: data.email || email,
        role: data.role,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Invalid email or password."
      );
      setLoading(false);
    }
  }

  return (
    <div className="login-split">
      <section className="login-left">
        <img src="/images/logo.png" alt="FleetSync" className="login-logo" />
        <div className="login-wordmark">FleetSync</div>
        <div className="login-subtitle">Fleet Management Platform</div>
        <ul className="login-features">
          {FEATURES.map((feature) => (
            <li className="login-feature-item" key={feature}>
              <span className="login-feature-check">
                <CheckIcon />
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="login-right">
        <div className="login-card">
          <h1 className="login-heading">Welcome back</h1>
          <p className="login-subtext">Sign in to your account</p>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label className="login-label" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                className="login-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@fleettrack.com"
                autoComplete="username"
                required
              />
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="login-password">
                Password
              </label>
              <div className="password-input-wrapper">
                <input
                  id="login-password"
                  className="login-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </button>
              </div>
              <Link to="/forgot-password" className="auth-forgot-link">
                Forgot password?
              </Link>
            </div>

            <div className={`login-mfa-wrapper ${mfaRequired ? "login-mfa-visible" : ""}`}>
              <div className="login-field">
                <label className="login-label" htmlFor="login-mfa">
                  6-digit code
                </label>
                <input
                  id="login-mfa"
                  className="login-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="000000"
                />
              </div>
            </div>

            <button className="login-button" type="submit" disabled={loading}>
              {loading ? (
                <span className="login-button-loading">
                  <span className="login-spinner" />
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </button>

            {error && <div className="login-error">{error}</div>}
          </form>
        </div>
      </section>
    </div>
  );
}
