import { useCallback, useRef, useState } from "react";

/**
 * Minimal form validation.
 *
 * Deliberately not a form library: the portal has four short forms, and pulling
 * in react-hook-form or formik to serve them would add a dependency larger than
 * the code it replaces.
 *
 * The timing rule is the part that matters, and it is the thing hand-rolled
 * validation usually gets wrong. A field validates:
 *
 *   - **on blur**, once the user has finished with it;
 *   - **on every keystroke thereafter**, but only once it has already been
 *     blurred or the form has been submitted.
 *
 * So nobody is told their email is invalid while they are still typing the
 * first character, and once they know it is wrong the message clears the moment
 * they fix it rather than making them submit again to find out.
 *
 * `validate` is a plain object of `field -> (value, values) => string | null`.
 */
export function useFormValidation(initialValues, validators) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const submittedRef = useRef(false);

  const runField = useCallback(
    (name, nextValues) => validators[name]?.(nextValues[name], nextValues) ?? null,
    [validators],
  );

  const setValue = useCallback(
    (name, value) => {
      setValues((prev) => {
        const next = { ...prev, [name]: value };
        // Only re-validate a field the user has already engaged with.
        if (touched[name] || submittedRef.current) {
          setErrors((prevErrors) => ({ ...prevErrors, [name]: runField(name, next) }));
        }
        return next;
      });
    },
    [touched, runField],
  );

  const handleBlur = useCallback(
    (name) => {
      setTouched((prev) => ({ ...prev, [name]: true }));
      setErrors((prev) => ({ ...prev, [name]: runField(name, values) }));
    },
    [values, runField],
  );

  /** Validates everything. Returns true when the form may be submitted. */
  const validateAll = useCallback(() => {
    submittedRef.current = true;
    const next = {};
    Object.keys(validators).forEach((name) => {
      next[name] = runField(name, values);
    });
    setErrors(next);
    setTouched(Object.fromEntries(Object.keys(validators).map((k) => [k, true])));
    return Object.values(next).every((e) => !e);
  }, [validators, values, runField]);

  /**
   * Moves focus to the first field with an error.
   *
   * Without this a keyboard or screen-reader user submits, focus stays on the
   * button, and the messages appear somewhere above with no indication that
   * anything happened at all.
   */
  const focusFirstError = useCallback((formEl) => {
    const invalid = formEl?.querySelector("[aria-invalid='true']");
    // `preventScroll`, then scroll deliberately. Letting focus do the scrolling
    // lets it move *any* scrollable ancestor — including a horizontal one like
    // the driver wizard's panel track, which is not a thing the user should
    // ever see move. `scrollIntoView` on the block axis only does what was
    // actually wanted: bring the field into view vertically.
    invalid?.focus?.({ preventScroll: true });
    invalid?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    return Boolean(invalid);
  }, []);

  const reset = useCallback(() => {
    submittedRef.current = false;
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return { values, errors, touched, setValue, handleBlur, validateAll, focusFirstError, reset };
}

/* ── Reusable validators ──────────────────────────────────────────────────────
   Messages say what to do, not merely what is wrong: "Enter a valid email
   address" rather than "Invalid email". */

export const required = (label) => (value) =>
  String(value ?? "").trim() ? null : `${label} is required`;

export const email = (value) => {
  const v = String(value ?? "").trim();
  if (!v) return "Email address is required";
  // Intentionally loose. Strict RFC-shaped patterns reject addresses that are
  // perfectly deliverable; the server is the real authority here.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : "Enter a valid email address";
};

export const minLength = (n, label) => (value) => {
  const v = String(value ?? "");
  if (!v) return `${label} is required`;
  return v.length >= n ? null : `${label} must be at least ${n} characters`;
};

export const positiveNumber = (label) => (value) => {
  const v = String(value ?? "").trim();
  if (!v) return `${label} is required`;
  const n = Number(v);
  if (!Number.isFinite(n)) return `${label} must be a number`;
  return n > 0 ? null : `${label} must be greater than zero`;
};
