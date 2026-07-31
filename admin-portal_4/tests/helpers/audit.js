import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility auditing on top of axe-core.
 *
 * Scoped to WCAG 2.0/2.1 A and AA — the level this portal targets. Anything
 * outside those tags (best-practice rules, experimental rules) produces noise
 * that drowns the failures that actually matter, so it stays off.
 */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/**
 * Rules excluded from the gate, each for a stated reason. Keep this list short
 * and justified — it is the difference between a useful gate and a rubber stamp.
 */
const EXCLUDED_RULES = [
  // Leaflet injects its own tile/attribution DOM that we don't control, and it
  // trips colour-contrast on the map layer only. Map pages audit their chrome.
  "color-contrast-enhanced",
];

/** Runs axe against the current page and returns the raw results. */
export async function runAxe(page, { include, exclude } = {}) {
  let builder = new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .disableRules(EXCLUDED_RULES);

  if (include) builder = builder.include(include);
  if (exclude) builder = builder.exclude(exclude);

  return builder.analyze();
}

/** Violations at or above the severity we treat as a hard failure. */
export function blockingViolations(results) {
  return results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
}

/**
 * Human-readable violation report. Playwright's default object diff on an axe
 * result is unreadable, so failures attach this instead.
 */
export function formatViolations(violations) {
  if (violations.length === 0) return "No violations.";

  return violations
    .map((v) => {
      const nodes = v.nodes
        .slice(0, 5)
        .map((n) => `      - ${n.target.join(" ")}\n        ${n.failureSummary?.split("\n").join("\n        ")}`)
        .join("\n");
      const more =
        v.nodes.length > 5 ? `\n      … and ${v.nodes.length - 5} more element(s)` : "";
      return `  [${v.impact}] ${v.id} — ${v.help}\n    ${v.helpUrl}\n${nodes}${more}`;
    })
    .join("\n\n");
}

/**
 * Audits a page and attaches the full report to the test regardless of outcome,
 * so a passing run still leaves a record of the moderate/minor findings.
 */
export async function auditPage(page, testInfo, options) {
  const results = await runAxe(page, options);
  const blocking = blockingViolations(results);

  await testInfo.attach("axe-report.txt", {
    body: [
      `URL: ${page.url()}`,
      `Viewport: ${JSON.stringify(page.viewportSize())}`,
      `Passes: ${results.passes.length}  Violations: ${results.violations.length}`,
      "",
      "--- BLOCKING (serious/critical) ---",
      formatViolations(blocking),
      "",
      "--- ALL ---",
      formatViolations(results.violations),
    ].join("\n"),
    contentType: "text/plain",
  });

  return { results, blocking };
}
