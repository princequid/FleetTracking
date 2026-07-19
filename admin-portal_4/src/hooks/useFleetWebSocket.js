import { useCallback, useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { useAuthStore } from "../store/authStore";
import { WS_BASE_URL } from "../constants/config";

const WS_URL = WS_BASE_URL;

export function useFleetWebSocket() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const clientRef = useRef(null);
  const callbacksRef = useRef({});
  const stompSubsRef = useRef({});
  // Generic topic subscriptions (e.g. "/topic/admin/notifications") keyed by
  // the raw topic string, kept separate from the tripId-keyed location subs above.
  const topicCallbacksRef = useRef({});
  const topicSubsRef = useRef({});
  const [isConnected, setIsConnected] = useState(false);

  const resubscribeAll = useCallback(() => {
    const client = clientRef.current;
    if (!client || !client.connected) return;
    Object.entries(callbacksRef.current).forEach(([tripId, callback]) => {
      if (stompSubsRef.current[tripId]) return;
      const sub = client.subscribe(`/topic/trips/${tripId}/location`, (message) => {
        try {
          callback(JSON.parse(message.body));
        } catch {
          // ignore malformed payload
        }
      });
      stompSubsRef.current[tripId] = sub;
    });
    Object.entries(topicCallbacksRef.current).forEach(([topic, callback]) => {
      if (topicSubsRef.current[topic]) return;
      const sub = client.subscribe(topic, (message) => {
        try {
          callback(JSON.parse(message.body));
        } catch {
          // ignore malformed payload
        }
      });
      topicSubsRef.current[topic] = sub;
    });
  }, []);

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      reconnectDelay: 5000,
      onConnect: () => {
        if (import.meta.env.DEV) console.log("Fleet WebSocket connected");
        setIsConnected(true);
        stompSubsRef.current = {};
        topicSubsRef.current = {};
        resubscribeAll();
      },
      onDisconnect: () => setIsConnected(false),
      onWebSocketClose: () => setIsConnected(false),
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      clientRef.current = null;
    };
  }, [accessToken, resubscribeAll]);

  const subscribe = useCallback((tripId, callback) => {
    callbacksRef.current[tripId] = callback;
    const client = clientRef.current;
    if (client && client.connected && !stompSubsRef.current[tripId]) {
      const sub = client.subscribe(`/topic/trips/${tripId}/location`, (message) => {
        try {
          callback(JSON.parse(message.body));
        } catch {
          // ignore malformed payload
        }
      });
      stompSubsRef.current[tripId] = sub;
    }
  }, []);

  const unsubscribe = useCallback((tripId) => {
    delete callbacksRef.current[tripId];
    const sub = stompSubsRef.current[tripId];
    if (sub) {
      sub.unsubscribe();
      delete stompSubsRef.current[tripId];
    }
  }, []);

  // Generic topic subscription for consumers that aren't keyed by tripId
  // (e.g. NotificationBell's "/topic/admin/notifications" feed).
  const subscribeTopic = useCallback((topic, callback) => {
    topicCallbacksRef.current[topic] = callback;
    const client = clientRef.current;
    if (client && client.connected && !topicSubsRef.current[topic]) {
      const sub = client.subscribe(topic, (message) => {
        try {
          callback(JSON.parse(message.body));
        } catch {
          // ignore malformed payload
        }
      });
      topicSubsRef.current[topic] = sub;
    }
  }, []);

  const unsubscribeTopic = useCallback((topic) => {
    delete topicCallbacksRef.current[topic];
    const sub = topicSubsRef.current[topic];
    if (sub) {
      sub.unsubscribe();
      delete topicSubsRef.current[topic];
    }
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.deactivate();
  }, []);

  return { subscribe, unsubscribe, subscribeTopic, unsubscribeTopic, isConnected, disconnect };
}
