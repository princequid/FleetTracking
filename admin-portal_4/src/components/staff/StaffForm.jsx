import React, { useRef, useState } from "react";
import { createStaff } from "../../services/staffService";
import { EyeIcon, EyeOffIcon } from "../common/Icons";
import Button from "../common/Button";
import FormField from "../common/FormField";
import Select from "../common/Select";
import { useFormValidation, email, minLength } from "../../hooks/useFormValidation";

const VALIDATORS = {
  email,
  password: minLength(8, "Password"),
};

const ROLE_OPTIONS = [
  {
    value: "DISPATCHER",
    label: "Dispatcher",
    description: "Creates and manages trips. No access to staff, reports or incidents.",
  },
  {
    value: "ADMIN",
    label: "Admin",
    description: "Full operational access, including incidents and reports.",
  },
  {
    value: "SUPER_ADMIN",
    label: "Super admin",
    description: "Everything an admin can do, plus staff accounts and deactivating drivers.",
  },
];

// A SUPER_ADMIN can create another SUPER_ADMIN; an ADMIN can only create ADMIN/DISPATCHER
// accounts — mirrors the same restriction the backend enforces (see StaffController).
export default function StaffForm({ currentRole, onComplete, onError }) {
  const formRef = useRef(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { values, errors, setValue, handleBlur, validateAll, focusFirstError } =
    useFormValidation({ email: "", password: "", role: "DISPATCHER" }, VALIDATORS);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validateAll()) {
      // Let the errors render before hunting for the first one.
      requestAnimationFrame(() => focusFirstError(formRef.current));
      return;
    }
    setSubmitting(true);
    try {
      await createStaff({
        email: values.email.trim(),
        password: values.password,
        role: values.role,
      });
      onComplete();
    } catch (err) {
      onError(err.response?.data?.error || "Failed to create account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    /* noValidate hands validation to us rather than the browser: the native
       bubble cannot be styled, is not announced consistently, and disappears on
       the next click — taking the reason with it. */
    <form ref={formRef} onSubmit={handleSubmit} noValidate>
      <FormField label="Email" htmlFor="staff-email" required error={errors.email}>
        {(field) => (
          <input
            {...field}
            type="email"
            autoComplete="off"
            value={values.email}
            onChange={(e) => setValue("email", e.target.value)}
            onBlur={() => handleBlur("email")}
          />
        )}
      </FormField>

      <FormField
        label="Password"
        htmlFor="staff-password"
        required
        hint="At least 8 characters."
        error={errors.password}
      >
        {(field) => (
          <div className="password-input-wrapper">
            <input
              {...field}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={values.password}
              onChange={(e) => setValue("password", e.target.value)}
              onBlur={() => handleBlur("password")}
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

      <FormField label="Role" htmlFor="staff-role">
        {({ className, ...field }) => (
          <Select
            {...field}
            value={values.role}
            onChange={(next) => setValue("role", next)}
            // What each role can do belongs beside the role, not in a hint under
            // the field that only describes whichever one is currently picked.
            options={ROLE_OPTIONS.filter(
              (o) => o.value !== "SUPER_ADMIN" || currentRole === "SUPER_ADMIN",
            )}
          />
        )}
      </FormField>

      <Button type="submit" variant="primary" loading={submitting} className="modal-submit-btn">
        Create account
      </Button>
    </form>
  );
}
