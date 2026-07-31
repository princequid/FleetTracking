package com.fleettrack.gateway.filter;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regression guard for the rate-limit bypass.
 *
 * The filter took the LEFT-most X-Forwarded-For entry, which is entirely
 * client-controlled. XFF is append-only — each proxy adds the address it received
 * the request from — so the left-most value is whatever the attacker sent, and a
 * fresh random value per request created a brand-new counter bucket every time.
 * The 10-per-minute limit on /auth/login was therefore unlimited in practice.
 *
 * The right-most entry is the one written by our own trusted proxy and is the
 * only value a client cannot forge.
 */
class LoginRateLimitFilterTest {

    private final LoginRateLimitFilter filter = new LoginRateLimitFilter();

    /** Exercises the private resolver directly — it is the whole security property. */
    private String resolve(String forwardedFor) {
        MockServerHttpRequest.BaseBuilder<?> builder =
                MockServerHttpRequest.get("/auth/login").remoteAddress(
                        new java.net.InetSocketAddress("203.0.113.9", 1234));
        if (forwardedFor != null) {
            builder = MockServerHttpRequest.get("/auth/login")
                    .remoteAddress(new java.net.InetSocketAddress("203.0.113.9", 1234))
                    .header("X-Forwarded-For", forwardedFor);
        }
        MockServerWebExchange exchange = MockServerWebExchange.from(builder.build());
        return ReflectionTestUtils.invokeMethod(filter, "clientIp", exchange);
    }

    @Test
    @DisplayName("takes the right-most XFF hop, not the client-controlled left-most")
    void takesRightMostHop() {
        // Attacker sent "1.2.3.4"; our proxy appended the real client "198.51.100.7".
        assertThat(resolve("1.2.3.4, 198.51.100.7"))
                .as("the left-most value is attacker-controlled and must not be used")
                .isEqualTo("198.51.100.7");
    }

    @Test
    @DisplayName("a spoofed left-most value cannot create a new bucket")
    void spoofedValuesShareOneBucket() {
        // Same real client, different forged prefixes each time — all must map to
        // the same identity, or the limit is trivially defeated.
        String a = resolve("10.0.0.1, 198.51.100.7");
        String b = resolve("172.16.9.9, 198.51.100.7");
        String c = resolve("8.8.8.8, 198.51.100.7");

        assertThat(a).isEqualTo(b).isEqualTo(c).isEqualTo("198.51.100.7");
    }

    @Test
    @DisplayName("a single XFF entry is used as-is")
    void singleEntry() {
        assertThat(resolve("198.51.100.7")).isEqualTo("198.51.100.7");
    }

    @Test
    @DisplayName("falls back to the socket address when XFF is absent")
    void fallsBackToRemoteAddress() {
        assertThat(resolve(null)).isEqualTo("203.0.113.9");
    }

    @Test
    @DisplayName("falls back when XFF is blank rather than bucketing everyone together")
    void blankHeaderFallsBack() {
        assertThat(resolve("   ")).isEqualTo("203.0.113.9");
    }

    @Test
    @DisplayName("whitespace around entries is trimmed")
    void trimsWhitespace() {
        assertThat(resolve("1.2.3.4 ,   198.51.100.7  ")).isEqualTo("198.51.100.7");
    }
}
