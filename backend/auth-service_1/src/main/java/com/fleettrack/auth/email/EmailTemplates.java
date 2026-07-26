package com.fleettrack.auth.email;

/**
 * HTML builders for every transactional email auth-service sends. Inline-styled,
 * table-based markup throughout — email clients don't support external stylesheets
 * or modern layout (flexbox/grid), so this deliberately avoids both.
 */
public final class EmailTemplates {

    private EmailTemplates() {}

    private static final String NAVY_DARK = "#0F2347";
    private static final String TEAL = "#0D9488";
    private static final String TEXT_MUTED = "#6B7280";

    /** Wraps any inner body HTML in the shared FleetSync header/footer shell. */
    public static String wrapInFleetSyncTemplate(String bodyHtml) {
        return "<!DOCTYPE html>"
                + "<html lang=\"en\"><head>"
                + "<meta charset=\"UTF-8\">"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">"
                + "<meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">"
                + "<title>FleetSync</title>"
                + "</head>"
                + "<body style=\"margin:0;padding:0;background-color:#F9FAFB;font-family:Arial,Helvetica,sans-serif;\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#F9FAFB;padding:32px 16px;\">"
                + "<tr><td align=\"center\">"
                + "<table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:480px;width:100%;background-color:#FFFFFF;border-radius:12px;overflow:hidden;\">"
                + "<tr><td style=\"background-color:" + NAVY_DARK + ";padding:24px 32px;\">"
                + "<span style=\"font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;letter-spacing:-0.5px;color:#FFFFFF;\">FleetSync</span>"
                + "</td></tr>"
                + "<tr><td style=\"padding:32px;font-family:Arial,Helvetica,sans-serif;color:#111827;\">"
                + bodyHtml
                + "</td></tr>"
                + "<tr><td style=\"background-color:#F9FAFB;padding:20px 32px;\">"
                + "<span style=\"font-family:Arial,Helvetica,sans-serif;font-size:12px;color:" + TEXT_MUTED + ";\">"
                + "&copy; 2026 FleetSync. This is an automated message."
                + "</span>"
                + "</td></tr>"
                + "</table>"
                + "</td></tr>"
                + "</table>"
                + "</body></html>";
    }

    private static String button(String label, String href) {
        return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:24px 0;\">"
                + "<tr><td style=\"background-color:" + TEAL + ";border-radius:8px;\">"
                + "<a href=\"" + href + "\" style=\"display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;"
                + "font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;\">" + label + "</a>"
                + "</td></tr></table>";
    }

    public static String buildPasswordResetEmail(String resetLink) {
        String body = "<h1 style=\"font-size:20px;margin:0 0 16px;color:#111827;\">Reset your password</h1>"
                + "<p style=\"font-size:14px;line-height:22px;color:#374151;margin:0;\">"
                + "We received a request to reset your FleetSync password. Click the button below to choose a new one."
                + "</p>"
                + button("Reset your password", resetLink)
                + "<p style=\"font-size:12px;line-height:18px;color:" + TEXT_MUTED + ";margin:0;\">"
                + "This link expires in 15 minutes. If you didn't request this, you can safely ignore this email."
                + "</p>";
        return wrapInFleetSyncTemplate(body);
    }

    // No password/reset link here on purpose — the account already has a working
    // password (set by the admin who created it), and the driver sets their own the
    // first time they log in, via the in-app first-login prompt (mustChangePassword).
    // The "set/reset your password" flow+wording is reserved for the genuine
    // forgot-password case (buildPasswordResetEmail above), not account creation.
    public static String buildWelcomeEmail(String name, String role) {
        String body = "<h1 style=\"font-size:20px;margin:0 0 16px;color:#111827;\">Welcome to FleetSync, " + name + "!</h1>"
                + "<p style=\"font-size:14px;line-height:22px;color:#374151;margin:0;\">"
                + "Your account has been created with the <strong>" + role + "</strong> role. "
                + "Open the FleetSync app and sign in with the email and password your administrator gave you — "
                + "you'll be asked to set your own password the first time you log in."
                + "</p>";
        return wrapInFleetSyncTemplate(body);
    }

    public static String buildNewDeviceLoginEmail(String name, String timestamp) {
        String body = "<h1 style=\"font-size:20px;margin:0 0 16px;color:#111827;\">New sign-in to your FleetSync account</h1>"
                + "<p style=\"font-size:14px;line-height:22px;color:#374151;margin:0 0 16px;\">"
                + "Hi " + name + ", we noticed a new sign-in at " + timestamp + ". If this was you, no action is needed."
                + "</p>"
                + "<p style=\"font-size:12px;line-height:18px;color:" + TEXT_MUTED + ";margin:0;\">"
                + "If you don't recognize this activity, contact your administrator immediately."
                + "</p>";
        return wrapInFleetSyncTemplate(body);
    }
}
