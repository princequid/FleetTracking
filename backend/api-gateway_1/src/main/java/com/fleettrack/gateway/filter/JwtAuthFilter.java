package com.fleettrack.gateway.filter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeoutException;

@Component
public class JwtAuthFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthFilter.class);

    private static final List<String> PUBLIC_PATHS = List.of(
            "/auth/login", "/auth/register", "/auth/refresh", "/ws"
    );

    private final WebClient webClient;
    private final String internalServiceSecret;

    public JwtAuthFilter(WebClient.Builder webClientBuilder,
                         @org.springframework.beans.factory.annotation.Value("${internal.service.secret}") String internalServiceSecret) {
        this.webClient = webClientBuilder.build();
        this.internalServiceSecret = internalServiceSecret;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();

        if (PUBLIC_PATHS.stream().anyMatch(path::startsWith)) {
            return chain.filter(exchange);
        }

        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.debug("Missing or malformed Authorization header for path: {}", path);
            return unauthorized(exchange);
        }

        return webClient.get()
                .uri("lb://auth-service/auth/validate")
                .header(HttpHeaders.AUTHORIZATION, authHeader)
                .header("X-Internal-Service-Key", internalServiceSecret)
                .retrieve()
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(5))
                // Only errors from THIS call (validating the token) count as an auth
                // failure. Tag them so the catch below can't also swallow unrelated
                // failures from chain.filter() further down — e.g. a proxied service
                // being down/slow — which would otherwise get mapped to 401 and bounce
                // an already-logged-in client to the login screen.
                .onErrorMap(ex -> !(ex instanceof ValidationFailedException),
                        ex -> new ValidationFailedException(describeValidationError(path, ex)))
                .flatMap(body -> {
                    String userId = String.valueOf(body.get("userId"));
                    String role = (String) body.get("role");
                    log.debug("Token validated — userId={} role={}", userId, role);

                    // SECURITY: forcibly OVERWRITE these identity headers (set, not add)
                    // so a client can never smuggle its own X-User-Id / X-User-Role
                    // through the gateway and impersonate another user or role.
                    var mutatedRequest = exchange.getRequest().mutate()
                            .headers(h -> {
                                h.set("X-User-Id", userId);
                                h.set("X-User-Role", role);
                            })
                            .build();
                    return chain.filter(exchange.mutate().request(mutatedRequest).build());
                })
                .onErrorResume(ValidationFailedException.class, ex -> {
                    log.debug("Token validation failed: {}", ex.getMessage());
                    return unauthorized(exchange);
                });
    }

    private String describeValidationError(String path, Throwable ex) {
        if (ex instanceof WebClientResponseException.Unauthorized) {
            return "token rejected by auth-service";
        }
        if (ex instanceof TimeoutException) {
            return "timed out validating token for path: " + path;
        }
        return "validate call failed: " + ex.getMessage();
    }

    private static final class ValidationFailedException extends RuntimeException {
        ValidationFailedException(String message) {
            super(message);
        }
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        return exchange.getResponse().setComplete();
    }

    @Override
    public int getOrder() {
        return -1;
    }
}
