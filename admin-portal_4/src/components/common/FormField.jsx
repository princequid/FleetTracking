import React, { useId } from "react";
import { AlertCircleIcon } from "./Icons";

/**
 * A labelled form control with room for a hint and an error.
 *
 * The stylesheet has carried `.field-error`, `.field-hint` and `.input-error`
 * for a long time and nothing ever used them: every form in the portal relied
 * on native `required` / `minLength` and a toast when the server said no. That
 * leaves three gaps this closes.
 *
 *   - **Nothing was ever announced.** A red border is invisible to a screen
 *     reader. `aria-invalid` plus `aria-describedby` pointing at the message is
 *     what actually communicates the failure.
 *   - **Red alone was the whole message.** Colour is not an error explanation,
 *     and it is not available to every user. The message says what to fix.
 *   - **The browser's own bubble is not styleable and not translatable.** It
 *     also vanishes on the next interaction, so the user loses the reason.
 *
 * `error` renders and takes over `aria-describedby` from `hint` — a field that
 * has both should announce the problem, not the advice.
 *
 * Render-prop shaped: the caller supplies the actual control, because a text
 * input, a select and a password field with a reveal button share the label
 * and message treatment but nothing else.
 */
export default function FormField({
  label,
  hint,
  error,
  required = false,
  children,
  htmlFor,
}) {
  const generatedId = useId();
  const id = htmlFor || generatedId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={`dispatch-field${error ? " has-error" : ""}`}>
      <label className="dispatch-label" htmlFor={id}>
        {label}
        {required && (
          <span className="field-required" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children({
        id,
        "aria-invalid": error ? "true" : undefined,
        "aria-describedby": describedBy,
        className: `dispatch-input${error ? " input-error" : ""}`,
      })}

      {/* The hint stays in the DOM when an error replaces it visually, so the
          field never loses its guidance mid-correction. */}
      {hint && !error && (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      )}

      {error && (
        <p className="field-error" id={errorId}>
          <AlertCircleIcon size={14} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
