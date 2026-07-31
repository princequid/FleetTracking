import { test as base } from "@playwright/test";
import { stubApi } from "./helpers/api.js";

/**
 * The `test` every spec in this folder should import — not the one from
 * `@playwright/test` directly.
 *
 * It attaches `stubApi` to the page automatically, because forgetting it means
 * the spec silently fires authenticated requests at the production backend (see
 * helpers/api.js). Making it an auto-applied fixture removes that footgun.
 *
 * A spec that wants a different backend behaviour re-routes on top:
 *
 *     await stubApi(page, { mode: "error" });   // last route registered wins
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await stubApi(page);
    await use(page);
  },
});

export { expect } from "@playwright/test";
