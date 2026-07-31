import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon, CheckIcon } from "./Icons";

/**
 * A styled dropdown.
 *
 * A native `<select>` can be styled down to its closed state and no further —
 * the popup list is drawn by the operating system, so the option rows cannot
 * take the portal's type scale, surface tokens or dark mode. That was the one
 * control in the product that still looked like the OS rather than like
 * FleetSync, and in dark mode it opened as a white list.
 *
 * So this is a real listbox. Which means re-implementing what the native
 * control gave us for free, and the list below is the contract — dropping any
 * of it makes this worse than the `<select>` it replaces:
 *
 *   - `role="combobox"` trigger + `role="listbox"` popup + `role="option"` rows,
 *     with `aria-activedescendant` tracking the highlighted row so a screen
 *     reader follows arrow keys without focus actually leaving the trigger.
 *   - Full keyboard model: ↑/↓ move, Home/End jump, Enter/Space commit, Esc
 *     cancels and restores focus, Tab commits and moves on.
 *   - Typeahead — typing "de" jumps to "Delivered", as the native control does.
 *   - Focus returns to the trigger on close, always.
 *
 * Rendered through a portal because these appear inside `TableCard`, which is
 * `overflow: hidden` on desktop and a scroll container on mobile; an in-flow
 * popup gets clipped by both. Position is recomputed on scroll and resize, and
 * the list flips above the trigger when there isn't room below.
 */
export default function Select({
  value,
  onChange,
  options, // [{ value, label, description?, disabled? }]
  id,
  placeholder = "Select…",
  disabled = false,
  invalid = false,
  "aria-describedby": describedBy,
  className = "",
}) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const listId = `${selectId}-listbox`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [rect, setRect] = useState(null);

  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const typeaheadRef = useRef({ query: "", timer: null });

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const position = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    // 280px is the list's max-height; flip up when the space below can't hold
    // it but the space above can.
    const flip = spaceBelow < 280 && r.top > spaceBelow;
    setRect({ left: r.left, width: r.width, top: r.bottom + 4, bottom: window.innerHeight - r.top + 4, flip });
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    position();
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    return () => {
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
    };
  }, [open, position]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(e) {
      if (triggerRef.current?.contains(e.target) || listRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Keep the highlighted row scrolled into view as the arrows move through a
  // list taller than the popup.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function openList() {
    if (disabled) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function closeList({ restoreFocus = true } = {}) {
    setOpen(false);
    setActiveIndex(-1);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function commit(index) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    closeList();
  }

  function step(delta) {
    if (!options.length) return;
    let next = activeIndex;
    // Skip disabled rows rather than landing on something that can't be chosen.
    for (let i = 0; i < options.length; i += 1) {
      next = (next + delta + options.length) % options.length;
      if (!options[next].disabled) break;
    }
    setActiveIndex(next);
  }

  function handleTypeahead(char) {
    const state = typeaheadRef.current;
    clearTimeout(state.timer);
    state.query += char.toLowerCase();
    state.timer = setTimeout(() => {
      state.query = "";
    }, 600);

    const match = options.findIndex(
      (o) => !o.disabled && o.label.toLowerCase().startsWith(state.query),
    );
    if (match >= 0) {
      setActiveIndex(match);
      if (!open) onChange(options[match].value);
    }
  }

  function onKeyDown(event) {
    const { key } = event;

    if (!open) {
      if (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ") {
        event.preventDefault();
        openList();
        return;
      }
      if (key.length === 1 && /\S/.test(key)) {
        event.preventDefault();
        handleTypeahead(key);
      }
      return;
    }

    switch (key) {
      case "ArrowDown":
        event.preventDefault();
        step(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        step(-1);
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(options.findIndex((o) => !o.disabled));
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(activeIndex);
        break;
      case "Escape":
        event.preventDefault();
        // Stop the key reaching Modal's window-level Escape handler. Without
        // this, dismissing an open dropdown also closed the dialog around it
        // and threw away everything the user had typed into the form.
        // `stopImmediatePropagation` on the native event, because that listener
        // is bound to `window` — above where React's own delegation sits.
        event.nativeEvent.stopImmediatePropagation();
        closeList();
        break;
      case "Tab":
        // Commit and let focus move on, matching the native control.
        commit(activeIndex);
        break;
      default:
        if (key.length === 1 && /\S/.test(key)) {
          event.preventDefault();
          handleTypeahead(key);
        }
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={selectId}
        className={`select-trigger${invalid ? " input-error" : ""} ${className}`.trim()}
        role="combobox"
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={open && activeIndex >= 0 ? `${selectId}-opt-${activeIndex}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={onKeyDown}
      >
        <span className={`select-value${selected ? "" : " is-placeholder"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDownIcon size={16} className="select-chevron" />
      </button>

      {open &&
        rect &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-labelledby={selectId}
            className="select-list"
            style={{
              position: "fixed",
              left: rect.left,
              width: rect.width,
              ...(rect.flip ? { bottom: rect.bottom } : { top: rect.top }),
            }}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  id={`${selectId}-opt-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  className={[
                    "select-option",
                    index === activeIndex ? "is-active" : "",
                    isSelected ? "is-selected" : "",
                    option.disabled ? "is-disabled" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  // Pointer down rather than click: click fires after the
                  // outside-pointerdown handler has already closed the list.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(index);
                  }}
                  onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                >
                  <span className="select-option-body">
                    <span className="select-option-label">{option.label}</span>
                    {option.description && (
                      <span className="select-option-description">{option.description}</span>
                    )}
                  </span>
                  {isSelected && <CheckIcon size={15} className="select-option-check" />}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </>
  );
}
