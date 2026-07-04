import { useState, useRef, useEffect, useCallback } from "react";

async function nominatimSearch(query) {
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  return res.json();
}

export default function LocationAutocomplete({
  id,
  value,
  onChange,
  onSelect,
  placeholder,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen]               = useState(false);
  const [loading, setLoading]         = useState(false);
  const [activeIdx, setActiveIdx]     = useState(-1);
  const debounceRef  = useRef(null);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const runSearch = useCallback((q) => {
    if (q.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    nominatimSearch(q)
      .then((data) => {
        setSuggestions(data);
        setOpen(data.length > 0);
        setActiveIdx(-1);
      })
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(e) {
    const q = e.target.value;
    onChange(q); // parent clears coords on free-typing
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 420);
  }

  function handleSelect(suggestion) {
    setSuggestions([]);
    setOpen(false);
    onSelect({
      name: suggestion.display_name,
      lat:  parseFloat(suggestion.lat),
      lng:  parseFloat(suggestion.lon),
    });
  }

  function handleKeyDown(e) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Split display_name into primary (first part) and secondary (rest, trimmed)
  function splitName(displayName) {
    const parts = displayName.split(",").map((s) => s.trim());
    const primary   = parts[0];
    const secondary = parts.slice(1, 4).join(", ");
    return { primary, secondary };
  }

  return (
    <div className="loc-autocomplete" ref={containerRef}>
      <div className="loc-input-wrapper">
        <input
          id={id}
          className="dispatch-input loc-input"
          value={value}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        {loading && (
          <span className="loc-spinner" aria-label="Searching" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="loc-dropdown" role="listbox">
          {suggestions.map((s, idx) => {
            const { primary, secondary } = splitName(s.display_name);
            return (
              <li
                key={s.place_id}
                className={`loc-option${idx === activeIdx ? " loc-option-active" : ""}`}
                role="option"
                aria-selected={idx === activeIdx}
                onMouseDown={() => handleSelect(s)}
                onMouseEnter={() => setActiveIdx(idx)}
              >
                <span className="loc-option-icon">📍</span>
                <span className="loc-option-text">
                  <span className="loc-option-primary">{primary}</span>
                  {secondary && (
                    <span className="loc-option-secondary">{secondary}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
