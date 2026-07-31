import React, { useRef, useState } from "react";
import { registerUser } from "../../services/authService";
import { createDriverProfile } from "../../services/driverService";
import { EyeIcon, EyeOffIcon, CheckCircleIcon } from "../common/Icons";
import Button from "../common/Button";
import FormField from "../common/FormField";
import { useFormValidation, email, minLength, required } from "../../hooks/useFormValidation";

const ACCOUNT_VALIDATORS = {
  email,
  password: minLength(8, "Password"),
};

const PROFILE_VALIDATORS = {
  fullName: required("Full name"),
};

export default function DriverForm({ onComplete, onError }) {
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const step1Ref = useRef(null);
  const step2Ref = useRef(null);

  const account = useFormValidation({ email: "", password: "" }, ACCOUNT_VALIDATORS);
  const profile = useFormValidation(
    { fullName: "", phone: "", licenceNo: "" },
    PROFILE_VALIDATORS,
  );

  async function handleStep1Submit(event) {
    event.preventDefault();
    if (!account.validateAll()) {
      requestAnimationFrame(() => account.focusFirstError(step1Ref.current));
      return;
    }
    setSubmitting(true);
    try {
      const result = await registerUser({
        email: account.values.email.trim(),
        password: account.values.password,
        role: "DRIVER",
      });
      setUserId(result.userId);
      setStep(2);
      // Move focus into the panel that just slid in. Without this, focus stays
      // on a button that has travelled off-screen, and a keyboard user has to
      // tab blindly through the form they just left to reach the new one.
      //
      // `preventScroll` because the panel is mid-slide when this runs: the
      // default focus behaviour scrolls ancestors to reveal the target, and the
      // target is still off to the right. See `.step-track` for the rest.
      requestAnimationFrame(() =>
        step2Ref.current?.querySelector("input")?.focus({ preventScroll: true }),
      );
    } catch (err) {
      onError(err.response?.data?.error || "Failed to create account.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStep2Submit(event) {
    event.preventDefault();
    if (!profile.validateAll()) {
      requestAnimationFrame(() => profile.focusFirstError(step2Ref.current));
      return;
    }
    setSubmitting(true);
    try {
      await createDriverProfile({
        userId,
        fullName: profile.values.fullName.trim(),
        phone: profile.values.phone.trim(),
        licenceNo: profile.values.licenceNo.trim(),
      });
      onComplete();
    } catch (err) {
      onError(err.response?.data?.error || "Failed to create driver profile.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="driver-form">
      {/* The step indicator is the progress state of a two-part task, so it is
          announced as one rather than as two decorative dots. */}
      <div className="step-indicator" role="group" aria-label={`Step ${step} of 2`}>
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
          {/* `inert` on the panel that has slid off-screen.
              Both panels stay mounted so the slide has something to animate, but
              without this the hidden step's inputs are still in the tab order
              and still announced — a keyboard user tabbing past "Continue"
              landed in a form they cannot see. */}
          <form
            ref={step1Ref}
            className="step-panel"
            onSubmit={handleStep1Submit}
            noValidate
            inert={step !== 1}
            aria-hidden={step !== 1 || undefined}
          >
            <FormField label="Email" htmlFor="driver-email" required error={account.errors.email}>
              {(field) => (
                <input
                  {...field}
                  type="email"
                  autoComplete="off"
                  value={account.values.email}
                  onChange={(e) => account.setValue("email", e.target.value)}
                  onBlur={() => account.handleBlur("email")}
                />
              )}
            </FormField>

            <FormField
              label="Password"
              htmlFor="driver-password"
              required
              hint="At least 8 characters. The driver can change this later."
              error={account.errors.password}
            >
              {(field) => (
                <div className="password-input-wrapper">
                  <input
                    {...field}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={account.values.password}
                    onChange={(e) => account.setValue("password", e.target.value)}
                    onBlur={() => account.handleBlur("password")}
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
              )}
            </FormField>

            <FormField label="Role" htmlFor="driver-role">
              {(field) => <input {...field} value="Driver" disabled readOnly />}
            </FormField>

            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              className="modal-submit-btn"
            >
              Continue
            </Button>
          </form>

          <form
            ref={step2Ref}
            className="step-panel"
            onSubmit={handleStep2Submit}
            noValidate
            inert={step !== 2}
            aria-hidden={step !== 2 || undefined}
          >
            <FormField
              label="Full name"
              htmlFor="driver-fullname"
              required
              error={profile.errors.fullName}
            >
              {(field) => (
                <input
                  {...field}
                  value={profile.values.fullName}
                  onChange={(e) => profile.setValue("fullName", e.target.value)}
                  onBlur={() => profile.handleBlur("fullName")}
                />
              )}
            </FormField>

            <FormField label="Phone number" htmlFor="driver-phone" hint="Optional.">
              {(field) => (
                <input
                  {...field}
                  type="tel"
                  value={profile.values.phone}
                  onChange={(e) => profile.setValue("phone", e.target.value)}
                />
              )}
            </FormField>

            <FormField label="Licence number" htmlFor="driver-licence" hint="Optional.">
              {(field) => (
                <input
                  {...field}
                  value={profile.values.licenceNo}
                  onChange={(e) => profile.setValue("licenceNo", e.target.value)}
                />
              )}
            </FormField>

            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              className="modal-submit-btn"
            >
              Create driver
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
