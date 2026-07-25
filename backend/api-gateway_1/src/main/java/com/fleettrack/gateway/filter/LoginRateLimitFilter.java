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

    private String clientIp(ServerWebExchange exchange) {
        String forwarded = exchange.getRequest().getHeaders().getFirst("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        InetSocketAddress remote = exchange.getRequest().getRemoteAddress();
        return remote != null ? remote.getAddress().getHostAddress() : "unknown";
    }

    @Override
    public int getOrder() {
        return -3; // run before auth/JWT filters
    }
}
