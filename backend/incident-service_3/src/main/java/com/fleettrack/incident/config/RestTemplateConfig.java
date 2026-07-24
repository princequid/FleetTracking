package com.fleettrack.incident.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.util.List;

// @LoadBalanced RestTemplate for direct Eureka-resolved calls to trip-service/
// driver-service (verifying a DRIVER caller's incident actually belongs to their own
// trip) — same pattern as gps-service's/trip-service's own RestTemplateConfig.
@Configuration
public class RestTemplateConfig {

    @Value("${internal.service.secret}")
    private String internalServiceSecret;

    private static final int CONNECT_TIMEOUT_MS = 5_000;
    private static final int READ_TIMEOUT_MS = 10_000;

    @Bean
    @LoadBalanced
    public RestTemplate restTemplate() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(CONNECT_TIMEOUT_MS);
        requestFactory.setReadTimeout(READ_TIMEOUT_MS);

        RestTemplate restTemplate = new RestTemplate(requestFactory);
        restTemplate.setInterceptors(List.of(internalServiceKeyInterceptor()));
        return restTemplate;
    }

    private ClientHttpRequestInterceptor internalServiceKeyInterceptor() {
        return (request, body, execution) -> {
            request.getHeaders().set("X-Internal-Service-Key", internalServiceSecret);
            return execution.execute(request, body);
        };
    }
}
