/**
 * Who may see what in this portal.
 *
 * These lists live here rather than in `main.jsx` because both the router and
 * the login page need the same answer, and two copies of a role list is the
 * exact failure this guards against — a route that admits someone the login
 * screen turned away is worse than having no gate at all.
 *
 * Client-side only, and deliberately so: the services are the real boundary and
 * enforce their own rules on `X-User-Role` (see VehicleController's role lists
 * for the pattern). Everything here is defence in depth plus a straight answer
 * for the user about why they can't get in.
 */

/**
 * Roles the portal is built for. DRIVER is absent on purpose.
 *
 * A driver's credentials are valid — `/auth/login` is shared with the mobile
 * app and doesn't gate on role — but nothing here works for them: every staff
 * endpoint rejects a DRIVER token, so they used to reach a full admin shell
 * where each page rendered its error state. That reads as broken software
 * rather than as a permission boundary. Their app is the driver app.
 */
export const PORTAL_ROLES = ["ADMIN", "SUPER_ADMIN", "DISPATCHER"];

/** Routes hidden from DISPATCHER in the sidebar — incidents, reports, staff. */
export const STAFF_ROLES = ["ADMIN", "SUPER_ADMIN"];

/** Staff administration. Same membership as STAFF_ROLES, different reason. */
export const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

/** Shown to a driver who tries to sign in here, and on the login screen only. */
export const DRIVER_NOT_PERMITTED =
  "This portal is for dispatch and admin staff. Please sign in using the FleetSync driver app.";
