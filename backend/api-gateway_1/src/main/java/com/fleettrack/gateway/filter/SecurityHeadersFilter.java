package com.fleettrack.gateway.filter;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Adds baseline security headers to every response leaving the gateway.
 * Applied via beforeCommit so even short-circuited responses (e.g. 401/429) get them.
 */
@Component
public class SecurityHeadersFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        exchange.getResponse().beforeCommit(() -> {
            HttpHeaders h = exchange.getResponse().getHeaders();
            // Set (replace) so we never emit duplicates if an upstream also set one.
            h.set("X-Content-Type-Options", "nosniff");
            h.set("X-Frame-Options", "DENY");
            h.set("Referrer-Policy", "no-referrer");
            h.set("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
            // Effective once traffic is served over TLS; ignored by browsers over plain HTTP.
            h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
            // This gateway serves JSON APIs only — lock everything else down.
            h.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
            return Mono.empty();
        });
        return chain.filter(exchange);
    }

    @Override
    public int getOrder() {
        return -2; // ahead of JwtAuthFilter; beforeCommit runs at response-commit time regardless
    }
}
