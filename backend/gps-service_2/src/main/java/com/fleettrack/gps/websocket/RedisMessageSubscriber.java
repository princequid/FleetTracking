package com.fleettrack.gps.websocket;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class RedisMessageSubscriber implements MessageListener {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public void onMessage(Message message, byte[] pattern) {
        String channel = new String(message.getChannel());
        String body = new String(message.getBody());

        String[] parts = channel.split(":");
        if (parts.length >= 2) {
            String tripId = parts[1];
            String destination = "/topic/trips/" + tripId + "/location";
            messagingTemplate.convertAndSend(destination, body);
            log.debug("Broadcast to WebSocket: {}", destination);
        }
    }
}
