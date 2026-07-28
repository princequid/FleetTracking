import { useEffect, useState } from "react";

/**
 * Resolves CSS custom properties to concrete colour strings.
 *
 * Recharts writes colours out as SVG *presentation attributes* (stroke="…",
 * fill="…"), and `var()` is not reliably honoured there across browsers — it
 * works in Chrome/Firefox but has historically failed in Safari, rendering
 * black. So charts read the computed value here instead of passing the token
 * through, and re-resolve when the theme flips.
 *
 * @param {string[]} names e.g. ["--success-500", "--warning-500"]
 * @returns {Record<string,string>} keyed by the token name, minus the leading --
 */
export default function useCssVars(names) {
  const key = names.join(",");

  const read = () => {
    if (typeof window === "undefined") return {};
    const styles = getComputedStyle(document.documentElement);
    const out = {};
    names.forEach((name) => {
      out[name.replace(/^--/, "")] = styles.getPropertyValue(name).trim();
    });
    return out;
  };

  const [vars, setVars] = useState(read);

  useEffect(() => {
    setVars(read());

    // The theme toggle swaps data-theme on <html>; re-read once that lands.
    const observer = new MutationObserver(() => setVars(read()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
    // `key` is the stable stringified identity of `names`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return vars;
}
