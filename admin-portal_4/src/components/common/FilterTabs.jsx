import React, { useLayoutEffect, useRef, useState } from "react";

export default function FilterTabs({ tabs, active, counts = {}, onChange }) {
  const containerRef = useRef(null);
  const [rect, setRect] = useState({ width: 0, height: 0, left: 0, top: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeEl = container.querySelector(`[data-tab="${active}"]`);
    if (activeEl) {
      setRect({
        width: activeEl.offsetWidth,
        height: activeEl.offsetHeight,
        left: activeEl.offsetLeft,
        top: activeEl.offsetTop,
      });
    }
  }, [active, tabs]);

  return (
    <div className="filter-tabs" ref={containerRef}>
      <div
        className="filter-tab-indicator"
        style={{
          width: rect.width,
          height: rect.height,
          transform: `translate(${rect.left}px, ${rect.top}px)`,
        }}
      />
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          data-tab={tab}
          className={`filter-tab ${active === tab ? "filter-tab-active" : ""}`}
          onClick={() => onChange(tab)}
        >
          {tab}
          <span className="filter-tab-count">{counts[tab] || 0}</span>
        </button>
      ))}
    </div>
  );
}
