// App config

// Dispatch office phone number for the driver's "Call dispatch" quick action.
// Use full international format, e.g. '+233201234567'.
export const DISPATCH_PHONE = '+233502988681';

// Support inbox for the driver's Help & Support screen "Email support" action.
export const SUPPORT_EMAIL = 'princequarm27@gmail.com';

// Page size sent on every GET /trips call.
//
// The backend paginates with @PageableDefault(size = 50) and returns a bare List with no
// total count, so a request that sends no size is silently truncated at 50 with no way for
// the client to tell. A driver only sees their own trips, so 50 is far off today — but trip
// history accumulates over a driver's whole tenure, and it is the history screen that would
// quietly stop showing older trips first. See docs/AUDIT_REPORT_2026-07-31.md (C-1).
export const TRIP_PAGE_SIZE = 200;
