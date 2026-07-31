import { test, expect } from "./fixtures.js";
import { stubApi } from "./helpers/api.js";
import { seedSession, gotoApp, settle } from "./helpers/auth.js";

/**
 * Bulk actions.
 *
 * These are destructive and they are not atomic — `runBulk` issues one request
 * per record — so the things worth pinning down are the guards, not the happy
 * path: that a settled trip cannot be selected, that selection cannot survive a
 * filter change, and that nothing is cancelled without a confirmation step.
 */

async function setup(page) {
  await stubApi(page, { mode: "populated" });
  await seedSession(page);
  await gotoApp(page, "/trips");
  await settle(page);
}

test.describe("selection", () => {
  test("settled trips cannot be selected", async ({ page }) => {
    await setup(page);

    // The fixture cycles statuses, so every page holds some DELIVERED and
    // CANCELLED trips — neither can be cancelled again.
    const disabled = page.locator("tbody .row-checkbox[disabled]");
    expect(await disabled.count(), "expected some non-cancellable rows").toBeGreaterThan(0);

    for (const box of await disabled.all()) {
      await expect(box).toHaveAttribute("title", /can no longer be cancelled/);
    }
  });

  test("select-all only takes the selectable rows on this page", async ({ page }) => {
    await setup(page);

    const selectableCount = await page.locator("tbody .row-checkbox:not([disabled])").count();
    await page.locator("thead .row-checkbox").check();

    await expect(page.locator(".bulk-bar-count")).toContainText(String(selectableCount));

    // Crucially not all 24 fixture trips — a select-all that reaches across
    // pagination is how someone cancels the whole fleet by accident.
    const total = 24;
    expect(selectableCount).toBeLessThan(total);
  });

  test("changing a filter drops rows that are no longer visible", async ({ page }) => {
    await setup(page);

    await page.locator("thead .row-checkbox").check();
    await expect(page.locator(".bulk-bar")).toBeVisible();

    await page.getByRole("button", { name: /^Delivered/ }).click();
    await settle(page);

    // Delivered trips are not cancellable, so nothing in the new view is
    // selectable and the bar must be gone rather than still claiming a count.
    await expect(page.locator(".bulk-bar")).toBeHidden();
  });
});

test.describe("confirmation", () => {
  test("bulk cancel asks first and can be backed out of", async ({ page }) => {
    await setup(page);

    const cancelCalls = [];
    await page.route(/\/trips\/\d+\/cancel/, (route) => {
      cancelCalls.push(route.request().url());
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.locator("thead .row-checkbox").check();
    await page.getByRole("button", { name: /Cancel trips?$/ }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("cannot be undone");

    await dialog.getByRole("button", { name: /Keep trips?/ }).click();
    await expect(dialog).toBeHidden();

    expect(cancelCalls, "backing out must not have cancelled anything").toEqual([]);
  });

  test("confirming cancels exactly the selected trips", async ({ page }) => {
    await setup(page);

    const cancelled = [];
    await page.route(/\/trips\/(\d+)\/cancel/, (route) => {
      cancelled.push(route.request().url().match(/trips\/(\d+)\/cancel/)[1]);
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    const firstSelectable = page.locator("tbody .row-checkbox:not([disabled])").first();
    await firstSelectable.check();
    await expect(page.locator(".bulk-bar-count")).toContainText("1");

    await page.getByRole("button", { name: /Cancel trip$/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Cancel 1 trip/ }).click();

    await expect.poll(() => cancelled.length, { timeout: 10_000 }).toBe(1);
    await expect(page.locator(".bulk-bar")).toBeHidden();
  });

  test("a partial failure is reported as partial, not as success", async ({ page }) => {
    await setup(page);

    // Half the cancels fail. The operator must not be told it all worked.
    let n = 0;
    await page.route(/\/trips\/\d+\/cancel/, (route) => {
      n += 1;
      return n % 2 === 0
        ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
        : route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.locator("thead .row-checkbox").check();
    await page.getByRole("button", { name: /Cancel trips?$/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^Cancel \d+ trips?/ }).click();

    const toast = page.locator(".toast-item").first();
    await expect(toast).toBeVisible({ timeout: 15_000 });
    await expect(toast).toContainText(/could not be updated/);
  });
});
