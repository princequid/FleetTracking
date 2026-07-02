import React, { useState } from "react";
import { registerUser } from "../../services/authService";
import { createDriverProfile } from "../../services/driverService";
import { EyeIcon, EyeOffIcon, CheckCircleIcon } from "../common/Icons";
import Button from "../common/Button";

export default function DriverForm({ onComplete, onError }) {
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [licenceNo, setLicenceNo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleStep1Submit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await registerUser({ email, password, role: "DRIVER" });
      setUserId(result.userId);
      setStep(2);
    } catch (err) {
      onError(err.response?.data?.error || "Failed to create account.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStep2Submit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await createDriverProfile({ userId, fullName, phone, licenceNo });
      onComplete();
    } catch (err) {
      onError(err.response?.data?.error || "Failed to create driver profile.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="driver-form">
      <div className="step-indicator">
        <div className={`step-dot ${step > 1 ? "step-dot-complete" : "step-dot-active"}`}>
          {step > 1 ? <CheckCircleIcon size={14} /> : "1"}
        </div>
        <span className="step-label">Account</span>
        <div className={`step-connector ${step > 1 ? "step-connector-complete" : ""}`} />
        <div className={`step-dot ${step === 2 ? "step-dot-active" : ""}`}>2</div>
        <span className="step-label">Profile</span>
      </div>

      <div className="step-track">
        <div
          className="step-panel-wrapper"
          style={{ transform: `translateX(-${(step - 1) * 50}%)` }}
        >
          <form className="step-panel" onSubmit={handleStep1Submit}>
            <div className="dispatch-field">
              <label className="dispatch-label" htmlFor="driver-email">
                Email
              </label>
              <input
                id="driver-email"
                className="dispatch-input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="dispatch-field">
              <label className="dispatch-label" htmlFor="driver-password">
                Password
              </label>
              <div className="password-input-wrapper">
                <input
                  id="driver-password"
                  className="dispatch-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
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
            <div className="dispatch-field">
              <label className="dispatch-label">Role</label>
              <input className="dispatch-input" value="DRIVER" disabled readOnly />
            </div>
            <Button type="submit" variant="primary" loading={submitting} className="modal-submit-btn">
              Continue
            </Button>
          </form>

          <form className="step-panel" onSubmit={handleStep2Submit}>
            <div className="dispatch-field">
              <label className="dispatch-label" htmlFor="driver-fullname">
                Full Name
              </label>
              <input
                id="driver-fullname"
                className="dispatch-input"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </div>
            <div className="dispatch-field">
              <label className="dispatch-label" htmlFor="driver-phone">
                Phone Number
              </label>
              <input
                id="driver-phone"
                className="dispatch-input"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
            <div className="dispatch-field">
              <label className="dispatch-label" htmlFor="driver-licence">
                Licence Number
              </label>
              <input
                id="driver-licence"
                className="dispatch-input"
                value={licenceNo}
                onChange={(event) => setLicenceNo(event.target.value)}
              />
            </div>
            <Button type="submit" variant="primary" loading={submitting} className="modal-submit-btn">
              Create Driver
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
