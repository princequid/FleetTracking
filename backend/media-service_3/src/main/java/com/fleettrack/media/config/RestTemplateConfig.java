package com.fleettrack.media.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.web.client.RestTemplate;

import java.util.List;

@Configuration
public class RestTemplateConfig {

    @Value("${internal.service.secret}")
    private String internalServiceSecret;

    @Bean
    @LoadBalanced
    public RestTemplate restTemplate() {
        RestTemplate restTemplate = new RestTemplate();
        restTemplate.setInterceptors(List.of(internalServiceKeyInterceptor()));
        return restTemplate;
    }

    /**
     * media-service calls trip-service/driver-service directly (bypassing the
     * gateway), so those services never see a caller-derived X-User-Role header.
     * This tags media-service's outgoing internal calls with the shared
     * service-to-service secret those downstream services check explicitly.
     */
    private ClientHttpRequestInterceptor internalServiceKeyInterceptor() {
        return (request, body, execution) -> {
            request.getHeaders().set("X-Internal-Service-Key", internalServiceSecret);
            return execution.execute(request, body);
        };
    }
}
