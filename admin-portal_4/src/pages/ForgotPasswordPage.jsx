import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { ArrowLeftIcon } from "../components/common/Icons";

const FEATURES = ["Fleet Tracking", "Cargo Safety", "Real-time Analytics"];

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function MailIcon(props) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  );
}

// POST /auth/forgot-password always returns 200 regardless of whether the email is
// registered (so this page can't be used to enumerate accounts), which is why the
// success state below is deliberately non-committal rather than confirming anything.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setSent(true);
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
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
          {sent ? (
            <div className="auth-done">
              <div className="auth-done-icon">
                <MailIcon />
              </div>
              <h1 className="login-heading">Check your email</h1>
              <p className="login-subtext">
                If <strong>{email.trim()}</strong> is registered, we've sent a link to reset your password.
              </p>
              <Link to="/login" className="auth-back-link">
                <ArrowLeftIcon size={14} /> Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <Link to="/login" className="auth-back-link auth-back-link-top">
                <ArrowLeftIcon size={14} /> Back to sign in
              </Link>
              <h1 className="login-heading">Forgot your password?</h1>
              <p className="login-subtext">Enter your email and we'll send you a link to reset it.</p>

              <form className="login-form" onSubmit={handleSubmit}>
                <div className="login-field">
                  <label className="login-label" htmlFor="forgot-email">
                    Email
                  </label>
                  <input
                    id="forgot-email"
                    className="login-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@fleettrack.com"
                    autoComplete="username"
                    required
                  />
                </div>

                <button className="login-button" type="submit" disabled={loading}>
                  {loading ? <span className="login-spinner" /> : "Send reset link"}
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
