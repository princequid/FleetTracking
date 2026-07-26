package com.fleettrack.notification.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.util.List;

/**
 * @LoadBalanced RestTemplate that stamps the shared internal-service secret on every
 * call, for direct Eureka-resolved calls to auth-service (admin directory),
 * driver-service (driver names), incident-service (incident detail) and
 * analytics-service (fleet summary) — same pattern trip-service uses for its
 * downstream clients. Email now goes over Gmail SMTP (JavaMailSender), not this
 * RestTemplate, so there's no separate "external" bean anymore.
 */
@Configuration
public class RestTemplateConfig {

    @Value("${internal.service.secret}")
    private String internalServiceSecret;

    private static final int CONNECT_TIMEOUT_MS = 5_000;
    private static final int READ_TIMEOUT_MS = 10_000;

    @Bean
    @LoadBalanced
    public RestTemplate internalRestTemplate() {
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
