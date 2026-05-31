import { useEffect, useState, useRef, useCallback } from 'react';
import { SSEEvent } from '../types';

export function useEventSource(url: string, enabled = true) {
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current || !enabled) return;

    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (!mountedRef.current) return;
      retryCountRef.current = 0;
      setConnected(true);
    };

    eventSource.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const parsed = JSON.parse(event.data) as Record<string, unknown>;
        const type = parsed.type as SSEEvent['type'];
        const timestamp =
          typeof parsed.timestamp === 'string'
            ? parsed.timestamp
            : new Date().toISOString();
        const nested = parsed.data;
        let data: Record<string, unknown>;
        if (
          nested !== undefined &&
          typeof nested === 'object' &&
          nested !== null &&
          !Array.isArray(nested)
        ) {
          data = { ...(nested as Record<string, unknown>) };
        } else {
          data = { ...parsed };
          delete data.type;
          delete data.timestamp;
        }
        setLastEvent({ type, data, timestamp });
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = () => {
      if (!mountedRef.current) return;
      eventSource.close();
      eventSourceRef.current = null;
      setConnected(false);

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, then cap at 30s
      // Unlike before: retry count NEVER stops — always reconnect
      retryCountRef.current += 1;
      const delay = Math.min(1000 * Math.pow(2, Math.min(retryCountRef.current - 1, 5)), 30000);

      retryTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };
  }, [url, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) connect();

    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [url, enabled, connect]);

  return { lastEvent, connected };
}
