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
                // NOTE: the /analytics/** route was removed. analytics-service_5 is a
                // directory of empty stub classes with no pom.xml and no application
                // class — it cannot be built or registered in Eureka. Routing to it
                // produced a 503 from the load balancer plus a service-discovery error
                // in the logs, which reads like an infrastructure fault during triage.
                // Restore this route in the same commit that makes the service real.

                // WebSocket — proxied to gps-service /ws
                .route("gps-ws", r -> r
                        .path("/ws/**")
                        .uri("lb://gps-service"))
                .build();
    }
}
