package com.fleettrack.auth.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Rejects any request that did not arrive through the API gateway (or another
 * trusted internal service), identified by the shared X-Internal-Service-Key
 * header the gateway stamps on every proxied request. Defense-in-depth behind
 * network isolation: even if this service's port were reachable, a forged direct
 * request is refused. Actuator/health is exempt so orchestration probes still work.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class InternalKeyFilter extends OncePerRequestFilter {

    @Value("${internal.service.secret:}")
    private String internalServiceSecret;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getRequestURI().startsWith("/actuator");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!matches(request.getHeader("X-Internal-Service-Key"))) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Direct service access is not permitted\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    // Constant-time comparison so the secret can't be recovered via response timing.
    private boolean matches(String provided) {
        if (internalServiceSecret == null || internalServiceSecret.isBlank() || provided == null) {
            return false;
        }
        return MessageDigest.isEqual(
                internalServiceSecret.getBytes(StandardCharsets.UTF_8),
                provided.getBytes(StandardCharsets.UTF_8));
    }
}
