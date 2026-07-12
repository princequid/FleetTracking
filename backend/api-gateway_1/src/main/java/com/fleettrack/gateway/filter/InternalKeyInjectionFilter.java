package com.fleettrack.gateway.filter;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Stamps every request proxied downstream with the shared internal-service secret.
 * Downstream services require this header, so a caller that reaches a service
 * directly (bypassing this gateway) is rejected — defense-in-depth behind the
 * network isolation. Runs for ALL paths (including the public /auth/** and /ws
 * routes, which JwtAuthFilter skips) and uses set() so a client can never supply
 * its own value.
 */
@Component
public class InternalKeyInjectionFilter implements GlobalFilter, Ordered {

    private final String internalServiceSecret;

    public InternalKeyInjectionFilter(@Value("${internal.service.secret}") String internalServiceSecret) {
        this.internalServiceSecret = internalServiceSecret;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        var mutated = exchange.getRequest().mutate()
                .headers(h -> h.set("X-Internal-Service-Key", internalServiceSecret))
                .build();
        return chain.filter(exchange.mutate().request(mutated).build());
    }

    @Override
    public int getOrder() {
        return -4; // before rate-limit (-3), security headers (-2), JWT (-1)
    }
}
