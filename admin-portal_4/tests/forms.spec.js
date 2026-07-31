import { test, expect } from "./fixtures.js";
import { stubApi } from "./helpers/api.js";
import { seedSession, gotoApp, settle } from "./helpers/auth.js";

/**
 * Form validation.
 *
 * The behaviours worth pinning are the ones hand-rolled validation usually gets
 * wrong: that an error is *announced* and not merely coloured, that it does not
 * appear while the user is still typing the first character, and that it clears
 * as soon as the field becomes valid rather than on the next submit.
 */

async function openVehicleForm(page) {
  await stubApi(page, { mode: "populated" });
  await seedSession(page);
  await gotoApp(page, "/vehicles");
  await settle(page);
  await page.getByRole("button", { name: "Add vehicle" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

test("an invalid field is announced, not just outlined", async ({ page }) => {
  await openVehicleForm(page);

  const plate = page.locator("#vehicle-plate");
  await expect(plate).not.toHaveAttribute("aria-invalid", "true");

  await page.getByRole("dialog").getByRole("button", { name: /^Add vehicle$/ }).click();

  await expect(plate).toHaveAttribute("aria-invalid", "true");

  // The message must be wired to the input, or a screen reader announces a
  // field with a red border and no reason.
  const describedBy = await plate.getAttribute("aria-describedby");
  expect(describedBy, "invalid input must reference its message").toBeTruthy();
  await expect(page.locator(`#${describedBy}`)).toContainText(/required/i);
});

test("submitting an invalid form moves focus to the first problem", async ({ page }) => {
  await openVehicleForm(page);

  await page.getByRole("dialog").getByRole("button", { name: /^Add vehicle$/ }).click();

  // Otherwise a keyboard user presses submit, nothing appears to happen, and
  // focus is still sitting on the button.
  await expect(page.locator("#vehicle-plate")).toBeFocused();
});

test("errors do not appear while first typing, and clear once corrected", async ({ page }) => {
  await openVehicleForm(page);

  const plate = page.locator("#vehicle-plate");

  await plate.fill("G");
  await expect(plate).not.toHaveAttribute("aria-invalid", "true");

  // Blur with it empty — now it has been engaged with, so it may complain.
  await plate.fill("");
  await plate.blur();
  await expect(plate).toHaveAttribute("aria-invalid", "true");

  // And it must recover on the keystroke that fixes it, not on the next submit.
  await plate.fill("GT-1234-20");
  await expect(plate).not.toHaveAttribute("aria-invalid", "true");
});

test("capacity rejects zero with an explanation", async ({ page }) => {
  await openVehicleForm(page);

  await page.locator("#vehicle-plate").fill("GT-1234-20");
  await page.locator("#vehicle-capacity").fill("0");
  await page.getByRole("dialog").getByRole("button", { name: /^Add vehicle$/ }).click();

  await expect(page.getByText(/Capacity must be greater than zero/i)).toBeVisible();
});

test("the hidden step of the driver wizard is not in the tab order", async ({ page }) => {
  await stubApi(page, { mode: "populated" });
  await seedSession(page);
  await gotoApp(page, "/drivers");
  await settle(page);

  await page.getByRole("button", { name: "Add driver" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // Both panels stay mounted so the slide has something to animate. Step 2 must
  // still be unreachable, or tabbing past "Continue" lands in a form nobody can
  // see.
  const hiddenPanel = page.locator("form.step-panel").nth(1);
  await expect(hiddenPanel).toHaveAttribute("inert", /.*/);
});

test("the driver wizard actually shows step 2", async ({ page }) => {
  await stubApi(page, { mode: "populated" });
  await page.route(/\/auth\/register/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ userId: 42 }) }),
  );
  await seedSession(page);
  await gotoApp(page, "/drivers");
  await settle(page);

  await page.getByRole("button", { name: "Add driver" }).first().click();
  await page.locator("#driver-email").fill("newdriver@fleetsync.test");
  await page.locator("#driver-password").fill("password123");
  await page.getByRole("button", { name: "Continue" }).click();

  const fullName = page.locator("#driver-fullname");
  await expect(fullName).toBeVisible();

  /*
   * The panel rendered blank once because the track — `overflow: hidden`, so a
   * scroll container — got scrolled sideways when focus moved into the panel
   * before it had slid into view. The transform then stacked on top of that
   * scroll and pushed the form ~980px off-screen.
   *
   * `toBeVisible` does not catch it: the element has a box and is not hidden,
   * it is simply somewhere else. So assert the geometry: the field has to sit
   * inside the dialog the user is looking at.
   */
  // Polled, because the panel slides in over ~380ms and `toBeVisible` is
  // satisfied the moment the element has a box — including while it is still
  // travelling. Asserting the geometry once, immediately, measures mid-flight
  // and fails or passes depending on how loaded the machine is.
  await expect
    .poll(
      async () => {
        const field = await fullName.boundingBox();
        const dialog = await page.getByRole("dialog").boundingBox();
        if (!field || !dialog) return false;
        return field.x >= dialog.x && field.x + field.width <= dialog.x + dialog.width + 1;
      },
      { message: "step 2 never settled inside the dialog", timeout: 5_000 },
    )
    .toBe(true);

  // And the track must never have been scrolled at all.
  const scrolled = await page.locator(".step-track").evaluate((el) => el.scrollLeft);
  expect(scrolled, "the panel track should not be scrollable").toBe(0);

  await expect(page.getByRole("button", { name: "Create driver" })).toBeVisible();
});
