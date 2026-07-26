package com.fleettrack.notification.email;

/**
 * HTML builders for every transactional email notification-service sends. Inline-styled,
 * table-based markup throughout — email clients don't support external stylesheets
 * or modern layout (flexbox/grid), so this deliberately avoids both.
 */
public final class EmailTemplates {

    private EmailTemplates() {}

    private static final String NAVY_DARK = "#0F2347";
    private static final String TEAL = "#0D9488";
    private static final String RED = "#DC2626";
    private static final String TEXT_MUTED = "#6B7280";

    /** Wraps any inner body HTML in the shared FleetSync header/footer shell. */
    public static String wrapInFleetSyncTemplate(String bodyHtml) {
        return wrapInFleetSyncTemplate(bodyHtml, NAVY_DARK);
    }

    /**
     * Same shell, with an overridable header band color — the critical incident email
     * uses red instead of navy so it visually stands out as urgent in an inbox.
     */
    public static String wrapInFleetSyncTemplate(String bodyHtml, String headerColor) {
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
                + "<tr><td style=\"background-color:" + headerColor + ";padding:24px 32px;\">"
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

    private static String detailRow(String label, String value) {
        return "<tr>"
                + "<td style=\"padding:6px 0;font-size:13px;color:" + TEXT_MUTED + ";width:110px;vertical-align:top;\">" + label + "</td>"
                + "<td style=\"padding:6px 0;font-size:13px;color:#111827;\">" + value + "</td>"
                + "</tr>";
    }

    public static String buildCriticalIncidentEmail(String incidentId, String tripId, String driverName,
                                                      String incidentType, String description, String timestamp,
                                                      String incidentUrl) {
        String body = "<div style=\"display:inline-block;background-color:#FEE2E2;color:" + RED + ";"
                + "font-size:12px;font-weight:bold;letter-spacing:0.5px;padding:4px 10px;border-radius:6px;margin-bottom:12px;\">"
                + "CRITICAL INCIDENT</div>"
                + "<h1 style=\"font-size:20px;margin:0 0 16px;color:#111827;\">A critical incident was just reported</h1>"
                + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;margin-bottom:8px;\">"
                + detailRow("Incident", "#" + incidentId)
                + detailRow("Trip", tripId != null ? "#" + tripId : "—")
                + detailRow("Driver", driverName)
                + detailRow("Type", incidentType)
                + detailRow("Reported", timestamp)
                + detailRow("Description", description)
                + "</table>"
                + button("View incident", incidentUrl);
        return wrapInFleetSyncTemplate(body, RED);
    }

    private static String statCell(String label, String value, String accentColor) {
        return "<td style=\"width:50%;padding:4px;\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
                + "style=\"background-color:#F9FAFB;border-top:3px solid " + accentColor + ";border-radius:6px;\">"
                + "<tr><td style=\"padding:14px 16px;\">"
                + "<div style=\"font-size:20px;font-weight:bold;color:#111827;\">" + value + "</div>"
                + "<div style=\"font-size:12px;color:" + TEXT_MUTED + ";margin-top:2px;\">" + label + "</div>"
                + "</td></tr></table></td>";
    }

    public static String buildDailySummaryEmail(String deliveries, String onTimeRate, String incidents,
                                                 String activeTrips, String dashboardUrl) {
        String body = "<h1 style=\"font-size:20px;margin:0 0 20px;color:#111827;\">Yesterday's Summary</h1>"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">"
                + "<tr>" + statCell("Deliveries", deliveries, "#3B82F6") + statCell("On-time rate", onTimeRate, "#0D9488") + "</tr>"
                + "<tr>" + statCell("Incidents", incidents, "#DC2626") + statCell("Active trips", activeTrips, "#D97706") + "</tr>"
                + "</table>"
                + button("View full dashboard", dashboardUrl);
        return wrapInFleetSyncTemplate(body);
    }
}
