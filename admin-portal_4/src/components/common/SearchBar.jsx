import React, { useEffect, useId, useRef, useState } from "react";
import { SearchIcon, XIcon } from "./Icons";

/**
 * Debounced search input.
 *
 * Three pages had hand-rolled this: the same markup, the same 300ms debounce
 * `useEffect`, and the same unlabelled `<input>` with only a placeholder — which
 * is a name that disappears the moment the user types.
 *
 * Owns its own debounce so pages get a single `onChange` with the settled value
 * and no longer keep two pieces of state each. `value` is the immediate text
 * (so typing stays responsive); `onChange` fires on the debounced value.
 *
 * The clear button only renders when there is something to clear, and is a real
 * button so it can be reached by keyboard — a search you can enter but not
 * escape is a trap on a filtered list.
 */
export default function SearchBar({
  placeholder = "Search…",
  onChange,
  delay = 300,
  label = "Search",
  initialValue = "",
  className = "",
}) {
  const [text, setText] = useState(initialValue);
  const inputId = useId();
  // Hold the latest callback in a ref so changing its identity between renders
  // doesn't restart the debounce timer and swallow the keystroke.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const timer = setTimeout(() => onChangeRef.current?.(text.trim()), delay);
    return () => clearTimeout(timer);
  }, [text, delay]);

  return (
    <div className={`search-bar ${className}`.trim()}>
      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>
      <SearchIcon size={16} className="search-bar-icon" />
      <input
        id={inputId}
        type="search"
        className="search-bar-input"
        placeholder={placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {text && (
        <button
          type="button"
          className="search-bar-clear"
          aria-label="Clear search"
          onClick={() => setText("")}
        >
          <XIcon size={14} />
        </button>
      )}
    </div>
  );
}
