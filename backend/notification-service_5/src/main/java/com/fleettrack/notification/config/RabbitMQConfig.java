package com.fleettrack.notification.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE = "fleettrack.events";
    public static final String NOTIFICATION_QUEUE = "notification-service.queue";

    // Incident events get their own queue (rather than sharing NOTIFICATION_QUEUE)
    // so TripEventConsumer and IncidentEventConsumer don't become competing consumers
    // on the same queue — RabbitMQ round-robins deliveries across ALL listeners bound
    // to one queue regardless of routing key, which would silently drop half of each
    // event type between the two unrelated handlers.
    public static final String INCIDENT_QUEUE = "notification-service.incident.queue";

    // Dead-letter routing: messages the listener nacks with requeue=false (malformed
    // payloads) land here instead of being discarded, so they can be inspected/replayed
    // rather than silently lost.
    public static final String DLX = "notification-service.dlx";
    public static final String DEAD_LETTER_QUEUE = "notification-service.queue.dlq";
    public static final String INCIDENT_DEAD_LETTER_QUEUE = "notification-service.incident.queue.dlq";

    @Bean
    public TopicExchange fleettrackExchange() {
        return new TopicExchange(EXCHANGE, true, false);
    }

    @Bean
    public DirectExchange notificationDlx() {
        return new DirectExchange(DLX, true, false);
    }

    @Bean
    public Queue notificationQueue() {
        return QueueBuilder.durable(NOTIFICATION_QUEUE)
                .withArgument("x-dead-letter-exchange", DLX)
                .withArgument("x-dead-letter-routing-key", DEAD_LETTER_QUEUE)
                .build();
    }

    @Bean
    public Queue notificationDeadLetterQueue() {
        return QueueBuilder.durable(DEAD_LETTER_QUEUE).build();
    }

    @Bean
    public Binding notificationDeadLetterBinding(Queue notificationDeadLetterQueue, DirectExchange notificationDlx) {
        return BindingBuilder.bind(notificationDeadLetterQueue).to(notificationDlx).with(DEAD_LETTER_QUEUE);
    }

    // Only trip lifecycle events drive driver notifications
    @Bean
    public Binding notificationBinding(Queue notificationQueue, TopicExchange fleettrackExchange) {
        return BindingBuilder.bind(notificationQueue).to(fleettrackExchange).with("trip.#");
    }

    @Bean
    public Queue incidentQueue() {
        return QueueBuilder.durable(INCIDENT_QUEUE)
                .withArgument("x-dead-letter-exchange", DLX)
                .withArgument("x-dead-letter-routing-key", INCIDENT_DEAD_LETTER_QUEUE)
                .build();
    }

    @Bean
    public Queue incidentDeadLetterQueue() {
        return QueueBuilder.durable(INCIDENT_DEAD_LETTER_QUEUE).build();
    }

    @Bean
    public Binding incidentDeadLetterBinding(Queue incidentDeadLetterQueue, DirectExchange notificationDlx) {
        return BindingBuilder.bind(incidentDeadLetterQueue).to(notificationDlx).with(INCIDENT_DEAD_LETTER_QUEUE);
    }

    @Bean
    public Binding incidentBinding(Queue incidentQueue, TopicExchange fleettrackExchange) {
        return BindingBuilder.bind(incidentQueue).to(fleettrackExchange).with("incident.#");
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
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory, Jackson2JsonMessageConverter messageConverter) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(messageConverter);
        factory.setAcknowledgeMode(AcknowledgeMode.MANUAL);
        factory.setDefaultRequeueRejected(false);
        return factory;
    }
}
