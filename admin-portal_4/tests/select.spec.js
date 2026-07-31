import { test, expect } from "./fixtures.js";
import { stubApi } from "./helpers/api.js";
import { seedSession, gotoApp, settle } from "./helpers/auth.js";

/**
 * The custom dropdown.
 *
 * Replacing a native `<select>` means re-implementing everything the browser
 * gave away for free, so these tests are the contract: if any of them regress,
 * the styled control is worse than the one it replaced.
 */

async function openStaffForm(page) {
  await stubApi(page, { mode: "populated" });
  await seedSession(page);
  await gotoApp(page, "/staff");
  await settle(page);
  await page.getByRole("button", { name: "Add staff" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

test("exposes combobox semantics and a labelled listbox", async ({ page }) => {
  await openStaffForm(page);

  const trigger = page.locator("#staff-role");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toHaveAttribute("aria-haspopup", "listbox");

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  await expect(listbox.getByRole("option")).toHaveCount(3);
  // The current value must be announced as selected, not merely styled bold.
  await expect(listbox.getByRole("option", { selected: true })).toHaveText(/Dispatcher/);
});

test("is fully operable by keyboard", async ({ page }) => {
  await openStaffForm(page);

  const trigger = page.locator("#staff-role");
  await trigger.focus();

  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("listbox")).toBeVisible();

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await expect(trigger).toContainText("Admin");
  await expect(page.getByRole("listbox")).toBeHidden();
  // Focus must come back, or a keyboard user is dropped at the top of the page.
  await expect(trigger).toBeFocused();
});

test("Escape cancels without changing the value", async ({ page }) => {
  await openStaffForm(page);

  const trigger = page.locator("#staff-role");
  await trigger.click();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");

  await expect(page.getByRole("listbox")).toBeHidden();
  await expect(trigger).toContainText("Dispatcher");
  await expect(trigger).toBeFocused();
});

test("typeahead jumps to a matching option", async ({ page }) => {
  await openStaffForm(page);

  const trigger = page.locator("#staff-role");
  await trigger.click();
  await page.keyboard.type("su");
  await page.keyboard.press("Enter");

  await expect(trigger).toContainText("Super admin");
});

test("the popup escapes the dialog rather than being clipped by it", async ({ page }) => {
  await openStaffForm(page);

  await page.locator("#staff-role").click();
  const listbox = page.getByRole("listbox");

  // Rendered through a portal, so its ancestor is <body> and neither the modal
  // nor TableCard's overflow can cut it off.
  const parentIsBody = await listbox.evaluate((el) => el.parentElement === document.body);
  expect(parentIsBody).toBe(true);

  const box = await listbox.boundingBox();
  const dialog = await page.getByRole("dialog").boundingBox();
  expect(box.y + box.height, "the list should be able to extend past the dialog").toBeGreaterThan(
    dialog.y,
  );
});

test("a dropdown inside a table row does not collapse the row", async ({ page }) => {
  await stubApi(page, { mode: "populated" });
  await seedSession(page);
  await gotoApp(page, "/incidents");
  await settle(page);

  // Expand a row, then open the status dropdown inside it.
  await page.locator(".incident-expand-btn").first().click();
  const select = page.locator("[id^='incident-status-']").first();
  await expect(select).toBeVisible();

  await select.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  // The click must not bubble to the row and toggle the panel shut.
  await expect(select).toBeVisible();
});
