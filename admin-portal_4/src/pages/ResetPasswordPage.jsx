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

// Reached from the "Reset your FleetSync password" email (/reset-password?token=...).
//
// EVERY role lands here, drivers included — the email can only carry an https link,
// because mail clients don't linkify custom schemes like fleettrack:// (see
// PasswordResetService.requestReset). So this page serves two audiences that finish
// in different places, and it cannot tell them apart from the URL: the token is an
// opaque random string. The role comes back from POST /auth/reset-password.
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  // Same route the mobile app registers (expo `scheme` in mobile/app.json).
  const appDeepLink = token
    ? `fleettrack://reset-password?token=${encodeURIComponent(token)}`
    : null;

  // Where a driver goes once the password is set. The app's root route, not the
  // login screen's file path — `/splash` reads the stored session and picks the
  // right destination, so this keeps working if those screens are ever renamed.
  const appHomeLink = "fleettrack://";

  // Only offer the app handoff where an app could plausibly be installed.
  const isTouchDevice =
    typeof window !== "undefined" &&
    window.matchMedia?.("(hover: none) and (pointer: coarse)").matches;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [isDriver, setIsDriver] = useState(false);

  // Only portal users get bounced to the portal's sign-in. A driver has no portal
  // account, so landing them on /login was a dead end — they'd enter the password
  // they had just set and be rejected, with nothing on screen explaining why.
  useEffect(() => {
    if (done && !isDriver) {
      const t = setTimeout(() => navigate("/login", { replace: true }), 1800);
      return () => clearTimeout(t);
    }
  }, [done, isDriver, navigate]);

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
      const { data } = await api.post("/auth/reset-password", { token, newPassword: password });
      // Defaults to the portal path if the field is absent, so an older backend
      // that doesn't return a role behaves exactly as it did before.
      setIsDriver(data?.role === "DRIVER");
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
              {isDriver ? (
                <>
                  <p className="login-subtext">
                    Open the FleetSync driver app and sign in with your new password.
                  </p>
                  {/* No auto-redirect here on purpose. A deep link can only be
                      followed by a real tap — a browser will not hand off to an
                      app from a timer — and if the app isn't installed, or this
                      was opened on a desktop, the sentence above is still the
                      correct instruction on its own. */}
                  <a className="btn btn-primary btn-block reset-open-app" href={appHomeLink}>
                    Open the FleetSync app
                  </a>
                </>
              ) : (
                <p className="login-subtext">Taking you to sign in…</p>
              )}
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

              {/* Handoff to the driver app.
                  The reset email can only carry an https link — mail clients don't
                  linkify custom schemes like fleettrack://, so a deep link sent
                  directly arrives as dead text. Browsers *do* honour them, so the
                  app handoff has to happen from here. Shown on touch devices only,
                  since it's meaningless on a desktop with no app installed. */}
              {isTouchDevice && (
                <a className="btn btn-secondary btn-block reset-open-app" href={appDeepLink}>
                  Open in the FleetSync app
                </a>
              )}

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
