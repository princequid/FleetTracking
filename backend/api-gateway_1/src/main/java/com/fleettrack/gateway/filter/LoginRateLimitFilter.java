package com.fleettrack.gateway.filter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-IP fixed-window throttle on the credential endpoints. Complements the
 * per-account lockout in auth-service by slowing credential-stuffing / enumeration
 * that spreads across many accounts from a single source. Refresh is intentionally
 * NOT limited so legitimate silent token refresh is never blocked.
 */
@Component
public class LoginRateLimitFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(LoginRateLimitFilter.class);

    private static final List<String> LIMITED_PATHS = List.of("/auth/login", "/auth/register");
    private static final int MAX_REQUESTS = 10;      // per window, per IP
    private static final long WINDOW_MS = 60_000;    // 1 minute
    private static final int MAX_TRACKED_IPS = 50_000;

    private final Map<String, Window> counters = new ConcurrentHashMap<>();

    private record Window(long start, int count) {}

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        if (LIMITED_PATHS.stream().noneMatch(path::startsWith)) {
            return chain.filter(exchange);
        }

        long now = System.currentTimeMillis();
        String ip = clientIp(exchange);

        if (counters.size() > MAX_TRACKED_IPS) {
            counters.entrySet().removeIf(e -> now - e.getValue().start() >= WINDOW_MS);
        }

        Window window = counters.compute(ip, (k, cur) ->
                (cur == null || now - cur.start() >= WINDOW_MS)
                        ? new Window(now, 1)
                        : new Window(cur.start(), cur.count() + 1));

        if (window.count() > MAX_REQUESTS) {
            log.warn("Rate limit exceeded for {} from {}", path, ip);
            exchange.getResponse().setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
            exchange.getResponse().getHeaders().set("Retry-After", "60");
            return exchange.getResponse().setComplete();
        }

        return chain.filter(exchange);
    }

    /**
     * Resolves the client IP for rate-limit bucketing.
     *
     * Takes the RIGHT-most X-Forwarded-For entry, not the left-most. XFF is
     * append-only: each proxy adds the address it received the request from, so
     * the last entry is the one written by our own trusted proxy (Caddy/nginx)
     * and is the only value a client cannot forge. The left-most entry is fully
     * attacker-controlled — sending a random value per request created a fresh
     * bucket every time and made the limit unlimited.
     *
     * Note this trusts exactly one proxy hop. If another reverse proxy is placed
     * in front, increase TRUSTED_PROXY_HOPS to match, or the value taken will be
     * one the client supplied.
     */
    private static final int TRUSTED_PROXY_HOPS = 1;

    private String clientIp(ServerWebExchange exchange) {
        String forwarded = exchange.getRequest().getHeaders().getFirst("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String[] hops = forwarded.split(",");
            int index = hops.length - TRUSTED_PROXY_HOPS;
            if (index < 0) index = 0;
            String candidate = hops[index].trim();
            if (!candidate.isBlank()) {
                return candidate;
            }
        }
        InetSocketAddress remote = exchange.getRequest().getRemoteAddress();
        return remote != null ? remote.getAddress().getHostAddress() : "unknown";
    }

    @Override
    public int getOrder() {
        return -3; // run before auth/JWT filters
    }
}
