import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckCircleIcon, AlertTriangleIcon, XIcon } from "./Icons";

const ToastContext = createContext(null);

let _nextId = 0;

const BORDER = {
  success: "var(--color-success)",
  error:   "var(--color-danger)",
  warning: "var(--color-warning)",
  info:    "var(--color-navy)",
};

const PROGRESS_BG = {
  success: "var(--color-success)",
  error:   "var(--color-danger)",
  warning: "var(--color-warning)",
  info:    "var(--color-navy)",
};

function ToastItem({ id, type = "success", title, message, duration = 4000, onDismiss }) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const t = setTimeout(close, duration);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  function close() {
    setClosing(true);
    setTimeout(() => onDismiss(id), 220);
  }

  return (
    <div
      className={`toast-item ${closing ? "toast-item-exit" : "toast-item-enter"}`}
      style={{ borderLeft: `4px solid ${BORDER[type] || BORDER.info}` }}
    >
      <div className="toast-item-body">
        {title && <div className="toast-item-title">{title}</div>}
        {message && <div className="toast-item-message">{message}</div>}
      </div>
      <button className="toast-close" type="button" onClick={close} aria-label="Dismiss">
        <XIcon size={14} />
      </button>
      <div
        className="toast-item-progress"
        style={{
          animationDuration: `${duration}ms`,
          background: PROGRESS_BG[type] || PROGRESS_BG.info,
        }}
      />
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((type, title, message) => {
    const id = ++_nextId;
    setToasts((prev) => [...prev, { id, type, title, message }]);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <ToastItem key={t.id} {...t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
