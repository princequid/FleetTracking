package com.fleettrack.gateway.config;

import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class RouteConfig {

    @Bean
    @LoadBalanced
    public WebClient.Builder webClientBuilder() {
        return WebClient.builder();
    }

    @Bean
    public RouteLocator routes(RouteLocatorBuilder builder) {
        return builder.routes()
                // Auth — no strip: controller already has /auth/** prefix
                .route("auth-service", r -> r
                        .path("/auth/**")
                        .uri("lb://auth-service"))

                // All other services — strip /prefix so they receive /**, /{id}, etc.
                .route("driver-service", r -> r
                        .path("/drivers/**")
                        .filters(f -> f.stripPrefix(1))
                        .uri("lb://driver-service"))
                .route("vehicle-service", r -> r
                        .path("/vehicles/**")
                        .filters(f -> f.stripPrefix(1))
                        .uri("lb://vehicle-service"))
                .route("trip-service", r -> r
                        .path("/trips/**")
                        .filters(f -> f.stripPrefix(1))
                        .uri("lb://trip-service"))
                .route("gps-service", r -> r
                        .path("/gps/**")
                        .filters(f -> f.stripPrefix(1))
                        .uri("lb://gps-service"))
                .route("media-service", r -> r
                        .path("/media/**")
                        .filters(f -> f.stripPrefix(1))
                        .uri("lb://media-service"))
                .route("incident-service", r -> r
                        .path("/incidents/**")
                        .filters(f -> f.stripPrefix(1))
                        .uri("lb://incident-service"))
                .route("notification-service", r -> r
                        .path("/notifications/**")
                        .filters(f -> f.stripPrefix(1))
                        .uri("lb://notification-service"))
                .route("analytics-service", r -> r
                        .path("/analytics/**")
                        .filters(f -> f.stripPrefix(1))
                        .uri("lb://analytics-service"))
                .build();
    }
}
