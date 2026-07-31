import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { EyeIcon, EyeOffIcon, CheckCircleIcon } from "../components/common/Icons";

const FEATURES = ["Fleet Tracking", "Cargo Safety", "Real-time Analytics"];

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// Reached from the "Reset your FleetSync password" email (/reset-password?token=...),
// sent for ADMIN/DISPATCHER/SUPER_ADMIN accounts — drivers get a mobile deep link
// instead (see PasswordResetService.requestReset). Shares the same backend endpoint
// (POST /auth/reset-password) as the mobile app's equivalent screen.
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => navigate("/login", { replace: true }), 1800);
      return () => clearTimeout(t);
    }
  }, [done, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("This link is missing its token — please use the link from your email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword: password });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || "This link is invalid or has expired.");
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
          {done ? (
            <div className="auth-done">
              <div className="auth-done-icon">
                <CheckCircleIcon size={26} />
              </div>
              <h1 className="login-heading">Password updated</h1>
              <p className="login-subtext">Taking you to sign in…</p>
            </div>
          ) : !token ? (
            <div className="auth-done">
              <h1 className="login-heading">Invalid link</h1>
              <p className="login-subtext">
                This reset link is missing its token. Please use the link from your email, or request a new one.
              </p>
              <Link to="/forgot-password" className="auth-back-link">
                Request a new link
              </Link>
            </div>
          ) : (
            <>
              <h1 className="login-heading">Set a new password</h1>
              <p className="login-subtext">Choose a new password for your account.</p>

              <form className="login-form" onSubmit={handleSubmit}>
                <div className="login-field">
                  <label className="login-label" htmlFor="reset-password">
                    New password
                  </label>
                  <div className="password-input-wrapper">
                    <input
                      id="reset-password"
                      className="login-input"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
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
                </div>

                <div className="login-field">
                  <label className="login-label" htmlFor="reset-confirm-password">
                    Confirm new password
                  </label>
                  <input
                    id="reset-confirm-password"
                    className="login-input"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                  />
                </div>

                <button className="login-button" type="submit" disabled={loading}>
                  {loading ? (
                    <span className="login-button-loading">
                      <span className="login-spinner" />
                      Updating…
                    </span>
                  ) : (
                    "Update password"
                  )}
                </button>

                {error && <div className="login-error">{error}</div>}
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
