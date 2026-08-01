package com.fleettrack.gps.websocket;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final StompAuthChannelInterceptor stompAuthChannelInterceptor;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
    }

    // Runs the Bearer-token check (StompAuthChannelInterceptor) on every inbound STOMP
    // frame, but the interceptor itself only actually validates CONNECT frames.
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(stompAuthChannelInterceptor);
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Browser-facing origin restriction is enforced once, at api-gateway's CorsWebFilter
        // (the only public entrypoint — gps-service is never reached directly from the
        // internet). Restricting origins here too duplicated that check with a separately
        // configured, independently-drifting origin list, which is what caused the browser
        // to see two Access-Control-Allow-Origin headers on the same response and reject it.
        // setSuppressCors(true) is the part that actually delegates. setAllowedOriginPatterns("*")
        // alone does NOT stop SockJS writing its own Access-Control-Allow-Origin — it only
        // widens which origins it accepts, then echoes the request origin straight back. The
        // gateway's CorsWebFilter adds the identical header, so the browser received
        //   Access-Control-Allow-Origin: <origin>, <origin>
        // and rejected the /ws/info handshake outright ("contains multiple values, but only
        // one is allowed"), which broke the admin portal's live map. Suppressing CORS here
        // leaves exactly one writer of that header: the gateway.
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS()
                .setSuppressCors(true);
    }
}
