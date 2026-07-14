package com.fleettrack.gps.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.util.List;

@Configuration
public class RestTemplateConfig {

    @Value("${internal.service.secret}")
    private String internalServiceSecret;

    // checkDeviation's call to trip-service runs inside a DB @Transactional (GpsService
    // .savePing), which holds a pooled DB connection open for the duration of the HTTP
    // call. Without a timeout, a stalled/unresponsive trip-service would hold that
    // connection (and the calling thread) indefinitely. Explicit bounds keep a bad
    // dependency from cascading into DB connection-pool exhaustion.
    private static final int CONNECT_TIMEOUT_MS = 5_000;
    private static final int READ_TIMEOUT_MS = 10_000;

    @Bean
    @LoadBalanced
    public RestTemplate restTemplate() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(CONNECT_TIMEOUT_MS);
        requestFactory.setReadTimeout(READ_TIMEOUT_MS);

        RestTemplate restTemplate = new RestTemplate(requestFactory);
        // gps-service calls trip-service directly (bypassing the gateway), so tag the
        // outgoing request with the shared internal secret the target service requires.
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
