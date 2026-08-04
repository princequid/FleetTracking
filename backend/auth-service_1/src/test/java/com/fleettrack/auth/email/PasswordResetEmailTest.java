package com.fleettrack.auth.email;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins what the reset email actually contains.
 *
 * The button was arriving with no link at all: the address was
 * {@code fleettrack://reset-password?token=...}, and mail clients strip href
 * attributes whose scheme they don't recognise, leaving a styled anchor that
 * points nowhere. This asserts the generated HTML carries a real, clickable
 * https URL — the only kind that survives Gmail/Outlook sanitisation.
 */
class PasswordResetEmailTest {

    private static final Pattern HREF = Pattern.compile("<a\\s+href=\"([^\"]*)\"");

    private String hrefIn(String html) {
        Matcher m = HREF.matcher(html);
        return m.find() ? m.group(1) : null;
    }

    @Test
    @DisplayName("driver reset email contains a clickable https link")
    void driverEmailHasHttpsLink() {
        String link = "https://fleetsync-53jj.onrender.com/reset-password?token=abc123";
        String html = EmailTemplates.buildPasswordResetEmail(link, true);

        System.out.println("\n===== DRIVER RESET EMAIL — href =====");
        System.out.println(hrefIn(html));
        System.out.println("=====================================\n");

        assertThat(hrefIn(html))
                .as("the button must carry a real address")
                .isEqualTo(link)
                .startsWith("https://");
    }

    @Test
    @DisplayName("no custom URI scheme survives anywhere in the email")
    void noCustomSchemeAnywhere() {
        String html = EmailTemplates.buildPasswordResetEmail(
                "https://fleetsync-53jj.onrender.com/reset-password?token=abc123", true);

        // A custom scheme anywhere in the markup is the exact regression that made
        // the button dead — mail clients drop the href rather than the whole tag.
        assertThat(html)
                .as("mail clients strip hrefs with unknown schemes")
                .doesNotContain("fleettrack://");
    }

    @Test
    @DisplayName("staff reset email is the same https link, without the app wording")
    void staffEmailHasHttpsLink() {
        String link = "https://fleetsync-53jj.onrender.com/reset-password?token=xyz789";
        String html = EmailTemplates.buildPasswordResetEmail(link, false);

        assertThat(hrefIn(html)).isEqualTo(link);
        assertThat(html).doesNotContain("reopen the FleetSync app");
    }

    @Test
    @DisplayName("token is preserved verbatim in the link")
    void tokenSurvivesIntact() {
        String token = "9f8e7d6c5b4a39281706f5e4d3c2b1a0";
        String link = "https://fleetsync-53jj.onrender.com/reset-password?token=" + token;
        String html = EmailTemplates.buildPasswordResetEmail(link, true);

        assertThat(hrefIn(html)).endsWith("token=" + token);
    }
}
