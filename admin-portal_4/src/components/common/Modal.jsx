import React, { useEffect, useState } from "react";
import { XIcon } from "./Icons";

const SIZE_MAP = { sm: 400, md: 540, lg: 720 };

export default function Modal({ isOpen, onClose, title, children, size = "md" }) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (isOpen) setClosing(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event) {
      if (event.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function requestClose() {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 200);
  }

  if (!isOpen) return null;

  return (
    <div
      className={`modal-overlay ${closing ? "modal-overlay-closing" : ""}`}
      onClick={requestClose}
    >
      <div
        className={`modal-card ${closing ? "modal-card-closing" : ""}`}
        style={{ width: SIZE_MAP[size] || SIZE_MAP.md }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
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
