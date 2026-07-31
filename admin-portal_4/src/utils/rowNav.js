/**
 * Makes a table row that navigates on click also work from the keyboard.
 *
 * Six tables in this portal put `onClick` on a bare `<tr>`. That is a control
 * with no way to reach it: not focusable, no key handler, so keyboard and
 * switch users could not open a trip, driver, vehicle, incident or staff record
 * from any list — WCAG 2.1.1. axe never caught it, because axe cannot see a
 * React handler on a `<tr>`, and the audit suite only ever rendered empty
 * tables anyway.
 *
 * Deliberately does NOT set `role="button"`. That would strip the row of its
 * `role="row"` and detach every cell from the table's structure, trading one
 * accessibility failure for a worse one. A focusable `<tr>` keeps table
 * semantics and still activates on Enter/Space.
 *
 * Space is intercepted on keydown because its default action scrolls the page,
 * which would move the list out from under the user before the row activates.
 *
 * @param {() => void} onActivate  what a click or Enter/Space should do
 * @param {{ label?: string }} [options]  accessible name for the row's action
 */
export function rowNavProps(onActivate, { label } = {}) {
  return {
    tabIndex: 0,
    "aria-label": label,
    onClick: onActivate,
    onKeyDown: (event) => {
      // Ignore keys that bubbled up from a control inside the row — the kebab
      // menu and the Deactivate button own their own Enter/Space.
      if (event.target !== event.currentTarget) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate();
      }
    },
  };
}
