package com.fleettrack.auth.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * auth-service only PUBLISHES events onto the shared exchange — it has no @RabbitListener,
 * so it must not declare queues/bindings that belong to the services that actually consume
 * them (notification-service, audit-service, ...). It previously did, with stale copies of
 * their queue definitions (e.g. missing notification-service's dead-letter-exchange
 * argument) — whichever service's RabbitAdmin ran first "won", and the other crashed on
 * startup with a PRECONDITION_FAILED channel error the moment the two declarations disagreed.
 * Each service now owns only its own queues; auth-service only needs the exchange to publish to.
 */
@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE = "fleettrack.events";

    @Bean
    public TopicExchange fleettrackExchange() {
        return new TopicExchange(EXCHANGE, true, false);
    }

    @Bean
    public RabbitAdmin rabbitAdmin(ConnectionFactory connectionFactory) {
        return new RabbitAdmin(connectionFactory);
    }

    @Bean
    public ApplicationRunner rabbitInitializer(RabbitAdmin rabbitAdmin) {
        return args -> rabbitAdmin.initialize();
    }

    @Bean
    public Jackson2JsonMessageConverter messageConverter() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        return new Jackson2JsonMessageConverter(mapper);
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory,
                                        Jackson2JsonMessageConverter messageConverter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter);
        template.setExchange(EXCHANGE);
        return template;
    }
}
