import { test, expect } from "./fixtures.js";
import { stubApi } from "./helpers/api.js";
import { seedSession, seedTheme, gotoApp, settle } from "./helpers/auth.js";
import { auditPage, formatViolations } from "./helpers/audit.js";

/**
 * The audit surface that only exists once tables have rows.
 *
 * Every other spec in this folder runs against the empty stub, which means the
 * badges, avatars, status chips and row-action buttons inside `<tbody>` are
 * never scanned — they passed by absence, not by merit. Re-running the same
 * checks against populated fixtures found 64 serious contrast violations that
 * the empty-state suite reported as zero.
 *
 * `stubApi(page, { mode: "populated" })` re-registers on top of the auto-applied
 * empty stub from fixtures.js; the last matching route wins.
 */

const TABLE_PAGES = [
  { path: "/trips", label: "Trips" },
  { path: "/drivers", label: "Drivers" },
  { path: "/vehicles", label: "Vehicles" },
  { path: "/incidents", label: "Incidents" },
  { path: "/staff", label: "Staff" },
];

test.describe("populated a11y", () => {
  for (const theme of ["light", "dark"]) {
    for (const { path } of [...TABLE_PAGES, { path: "/dashboard" }]) {
      test(`${path} has no serious or critical violations with data (${theme})`, async ({
        page,
      }, testInfo) => {
        await stubApi(page, { mode: "populated" });
        await seedSession(page);
        await seedTheme(page, theme);
        await gotoApp(page, path);
        await settle(page);

        const { blocking } = await auditPage(page, testInfo);
        expect(blocking, `\n${formatViolations(blocking)}\n`).toEqual([]);
      });
    }
  }
});

test.describe("table rows are operable by keyboard", () => {
  /**
   * A `<tr onClick>` that navigates is a control. axe has no rule for it — it
   * cannot see a React handler — so this is the only thing standing between the
   * portal and six pages of mouse-only navigation (WCAG 2.1.1).
   *
   * The contract: any row whose cursor says "clickable" must also be reachable
   * by Tab and activate on Enter.
   */
  for (const { path } of TABLE_PAGES) {
    test(`${path} rows are focusable and Enter-activated`, async ({ page }) => {
      await stubApi(page, { mode: "populated" });
      await seedSession(page);
      await gotoApp(page, path);
      await settle(page);

      const rows = page.locator("tbody tr");
      await expect(rows.first()).toBeVisible();

      const offenders = await page.evaluate(() =>
        [...document.querySelectorAll("tbody tr")]
          .filter((row) => getComputedStyle(row).cursor === "pointer")
          .filter(
            (row) =>
              row.tabIndex < 0 &&
              row.getAttribute("role") !== "button" &&
              row.getAttribute("role") !== "link",
          )
          .map((row) => row.querySelector("td")?.textContent?.trim().slice(0, 24) ?? "?"),
      );

      expect(
        offenders,
        `rows navigate on click but cannot be reached by keyboard: ${offenders.join(", ")}`,
      ).toEqual([]);
    });
  }

  test("Enter on a focused trip row opens that trip", async ({ page }) => {
    await stubApi(page, { mode: "populated" });
    await seedSession(page);
    await gotoApp(page, "/trips");
    await settle(page);

    const firstRow = page.locator("tbody tr").first();
    await firstRow.focus();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/trips\/\d+/);
  });
});

test.describe("populated layout holds up", () => {
  for (const { path } of TABLE_PAGES) {
    test(`${path} does not scroll the page horizontally with data`, async ({ page }) => {
      await stubApi(page, { mode: "populated" });
      await seedSession(page);
      await gotoApp(page, path);
      await settle(page);

      // A wide table is allowed to scroll *inside* TableCard — that's the
      // documented contract. What must never happen is the document itself
      // overflowing, which is what pushes the nav off-screen on a tablet.
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        if (doc.scrollWidth <= doc.clientWidth) return null;
        const limit = doc.clientWidth;
        const culprits = [...document.querySelectorAll("body *")]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.right > limit + 1;
          })
          .slice(0, 5)
          .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`);
        return { scrollWidth: doc.scrollWidth, clientWidth: limit, culprits };
      });

      expect(
        overflow,
        overflow
          ? `${overflow.scrollWidth}px content in ${overflow.clientWidth}px viewport — ${overflow.culprits.join(", ")}`
          : "",
      ).toBeNull();
    });
  }
});
