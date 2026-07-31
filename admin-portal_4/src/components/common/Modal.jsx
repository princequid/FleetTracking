import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { XIcon } from "./Icons";

const SIZE_MAP = { sm: 400, md: 540, lg: 720 };

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ isOpen, onClose, title, children, size = "md" }) {
  const [closing, setClosing] = useState(false);
  const cardRef = useRef(null);
  const restoreRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (isOpen) setClosing(false);
  }, [isOpen]);

  const requestClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 200);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, requestClose]);

  // Focus management. Without this, keyboard users tab straight out of the dialog
  // into the page behind it, and screen readers keep announcing that background —
  // which made every destructive confirmation ("Cancel Trip", "Deactivate Driver")
  // effectively unusable assistively.
  useEffect(() => {
    if (!isOpen) return undefined;

    restoreRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const first = cardRef.current?.querySelector(FOCUSABLE);
    (first || cardRef.current)?.focus?.();

    return () => {
      document.body.style.overflow = previousOverflow;
      // Return focus to whatever opened the dialog, so the user doesn't land
      // back at the top of the document.
      restoreRef.current?.focus?.();
    };
  }, [isOpen]);

  function handleCardKeyDown(event) {
    if (event.key !== "Tab") return;
    const nodes = Array.from(cardRef.current?.querySelectorAll(FOCUSABLE) || []).filter(
      (el) => el.offsetParent !== null
    );
    if (!nodes.length) return;

    const first = nodes[0];
    const last = nodes[nodes.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className={`modal-overlay ${closing ? "modal-overlay-closing" : ""}`}
      onClick={requestClose}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`modal-card ${closing ? "modal-card-closing" : ""}`}
        style={{ width: SIZE_MAP[size] || SIZE_MAP.md }}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleCardKeyDown}
      >
        <div className="modal-header">
          <h2 className="modal-title" id={titleId}>
            {title}
          </h2>
          <button
            className="modal-close-btn"
            type="button"
            onClick={requestClose}
            aria-label="Close"
          >
            <XIcon size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
