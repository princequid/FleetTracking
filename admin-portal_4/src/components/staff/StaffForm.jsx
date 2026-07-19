import React, { useState } from "react";
import { createStaff } from "../../services/staffService";
import { EyeIcon, EyeOffIcon } from "../common/Icons";
import Button from "../common/Button";

// A SUPER_ADMIN can create another SUPER_ADMIN; an ADMIN can only create ADMIN/DISPATCHER
// accounts — mirrors the same restriction the backend enforces (see StaffController).
export default function StaffForm({ currentRole, onComplete, onError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("DISPATCHER");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await createStaff({ email, password, role });
      onComplete();
    } catch (err) {
      onError(err.response?.data?.error || "Failed to create account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="dispatch-field">
        <label className="dispatch-label" htmlFor="staff-email">
          Email
        </label>
        <input
          id="staff-email"
          className="dispatch-input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div className="dispatch-field">
        <label className="dispatch-label" htmlFor="staff-password">
          Password
        </label>
        <div className="password-input-wrapper">
          <input
            id="staff-password"
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
        <label className="dispatch-label" htmlFor="staff-role">
          Role
        </label>
        <select
          id="staff-role"
          className="dispatch-input"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        >
          <option value="DISPATCHER">Dispatcher</option>
          <option value="ADMIN">Admin</option>
          {currentRole === "SUPER_ADMIN" && <option value="SUPER_ADMIN">Super Admin</option>}
        </select>
      </div>
      <Button type="submit" variant="primary" loading={submitting} className="modal-submit-btn">
        Create Account
      </Button>
    </form>
  );
}
