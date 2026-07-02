import { useCallback, useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { useAuthStore } from "../store/authStore";

const WS_URL = "http://localhost:8080/ws";

export function useFleetWebSocket() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const clientRef = useRef(null);
  const callbacksRef = useRef({});
  const stompSubsRef = useRef({});
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
  }, []);

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      reconnectDelay: 5000,
      onConnect: () => {
        console.log("Fleet WebSocket connected");
        setIsConnected(true);
        stompSubsRef.current = {};
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

  const disconnect = useCallback(() => {
    clientRef.current?.deactivate();
  }, []);

  return { subscribe, unsubscribe, isConnected, disconnect };
}
