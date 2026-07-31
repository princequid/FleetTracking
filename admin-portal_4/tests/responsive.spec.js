import { test, expect } from "./fixtures.js";
import { seedSession, gotoApp, settle } from "./helpers/auth.js";

/**
 * Responsive layout checks.
 *
 * Runs once per viewport project (desktop / tablet / mobile), so a failure names
 * the breakpoint that broke. The assertion that catches the most real bugs is the
 * horizontal-overflow one: wide tables and fixed-width cards are what actually
 * break this portal on small screens.
 */

const PAGES = [
  { path: "/login", auth: false },
  { path: "/dashboard", auth: true },
  { path: "/trips", auth: true },
  { path: "/drivers", auth: true },
  { path: "/vehicles", auth: true },
  { path: "/reports", auth: true },
];

for (const { path, auth } of PAGES) {
  test(`${path} does not scroll horizontally`, async ({ page }) => {
    if (auth) await seedSession(page);
    await gotoApp(page, path);

    // Let async page content and any chart/table land before measuring.
    await settle(page);

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      if (doc.scrollWidth <= doc.clientWidth) return null;

      // Name the widest offending element so the failure is actionable rather
      // than just "the page is too wide".
      const limit = doc.clientWidth;
      const culprits = [...document.querySelectorAll("body *")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.right > limit + 1;
        })
        .slice(0, 5)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ").join(".") : ""} (right: ${Math.round(r.right)}px)`;
        });

      return { scrollWidth: doc.scrollWidth, clientWidth: limit, culprits };
    });

    expect(
      overflow,
      overflow
        ? `Horizontal overflow: ${overflow.scrollWidth}px content in ${overflow.clientWidth}px viewport.\nWidest offenders:\n  ${overflow.culprits.join("\n  ")}`
        : "",
    ).toBeNull();
  });
}

/**
 * The width at and below which index.css switches the sidebar to off-canvas.
 * Keep in sync with the `@media (max-width: 768px)` block.
 */
const OFF_CANVAS_MAX = 768;

test.describe("navigation adapts to viewport", () => {
  test("sidebar rail is positioned correctly for the viewport", async ({ page }, testInfo) => {
    await seedSession(page);
    await gotoApp(page, "/dashboard");

    const sidebar = page.getByRole("complementary", { name: "Main navigation" });
    const width = page.viewportSize().width;
    const box = await sidebar.boundingBox();
    expect(box, "sidebar has no layout box at all").not.toBeNull();

    if (width <= OFF_CANVAS_MAX) {
      // Off-canvas is done with `transform: translateX(-100%)`, which Playwright
      // still reports as "visible" — it has a box and isn't display:none. So
      // position, not visibility, is what has to be asserted here.
      expect(
        box.x + box.width,
        `closed off-canvas rail should sit off-screen, but its right edge is at ${Math.round(box.x + box.width)}px`,
      ).toBeLessThanOrEqual(1);
    } else {
      await expect(sidebar).toBeVisible();
      expect(box.x, "inline rail should be flush to the left edge").toBe(0);

      // The rail's width is a token (`--sidebar-width`, narrowed at ≤1024px), so
      // asserting a literal would just duplicate CSS. The invariant that actually
      // matters is that the rail exactly fills the shell's first grid column —
      // if those drift, the rail either overlaps the content or leaves a gap.
      const column = await page
        .locator(".app-shell")
        .evaluate((el) => parseFloat(getComputedStyle(el).gridTemplateColumns.split(" ")[0]));

      expect(
        Math.round(box.width),
        `rail (${Math.round(box.width)}px) should fill the shell's first grid column (${Math.round(column)}px)`,
      ).toBe(Math.round(column));
    }
  });

  test("hamburger reveals the off-canvas rail", async ({ page }) => {
    test.skip(
      page.viewportSize().width > OFF_CANVAS_MAX,
      "hamburger only applies below the off-canvas breakpoint",
    );

    await seedSession(page);
    await gotoApp(page, "/dashboard");

    const sidebar = page.getByRole("complementary", { name: "Main navigation" });
    await page.locator("button.navbar-hamburger").click();

    // Once open it must actually occupy screen space, not just toggle a class.
    await expect
      .poll(
        async () => {
          const box = await sidebar.boundingBox();
          return box ? Math.round(box.x) : null;
        },
        { timeout: 3_000 },
      )
      .toBe(0);

    // And the backdrop must appear, or there's no way to dismiss it by tapping out.
    await expect(page.locator(".sidebar-backdrop")).toBeVisible();
  });
});

/**
 * Tap-target sizing.
 *
 * The gate is WCAG 2.5.8 (AA, 24×24) because AA is the level this portal
 * targets. The 44px figure everyone quotes is Apple HIG / WCAG 2.5.5 AAA — worth
 * knowing about, so anything between 24 and 44 is attached as an advisory rather
 * than failing the run.
 */
test("tap targets meet WCAG 2.5.8 (24px) on mobile", async ({ page }, testInfo) => {
  test.skip(page.viewportSize().width > OFF_CANVAS_MAX, "touch-viewport check");

  await gotoApp(page, "/login");

  const measured = await page.evaluate(() => {
    const describe = (el) => {
      const r = el.getBoundingClientRect();
      const label =
        el.getAttribute("aria-label") ??
        el.getAttribute("type") ??
        el.textContent?.trim().slice(0, 24) ??
        "";
      return {
        desc: `${el.tagName.toLowerCase()}[${label}]`,
        h: Math.round(r.height),
        w: Math.round(r.width),
      };
    };

    const targets = [...document.querySelectorAll("button, a, input, select, [role='button']")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        // Inline links inside running text are explicitly exempt from 2.5.8.
        if (el.tagName === "A" && el.closest("p")) return false;
        return true;
      })
      .map(describe);

    return {
      failing: targets.filter((t) => t.h < 24 || t.w < 24),
      advisory: targets.filter((t) => (t.h >= 24 && t.h < 44) || (t.w >= 24 && t.w < 44)),
    };
  });

  await testInfo.attach("tap-targets-under-44px.txt", {
    body:
      measured.advisory.length === 0
        ? "None."
        : measured.advisory.map((t) => `${t.desc} ${t.w}×${t.h}px`).join("\n"),
    contentType: "text/plain",
  });

  expect(
    measured.failing,
    `Below the 24px AA minimum:\n  ${measured.failing.map((t) => `${t.desc} ${t.w}×${t.h}px`).join("\n  ")}`,
  ).toEqual([]);
});
