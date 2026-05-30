import { useEffect, useState, useRef } from 'react';
import { SSEEvent } from '../types';

export function useEventSource(url: string, enabled = true) {
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    function connect() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        retryCountRef.current = 0;
        setError(null);
      };

      eventSource.onmessage = (event) => {
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
        eventSource.close();
        if (retryCountRef.current < 5) {
          retryCountRef.current += 1;
          const timeout = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
          setTimeout(connect, timeout);
        } else {
          setError(new Error('SSE connection failed after retries'));
        }
      };
    }

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [url, enabled]);

  return { lastEvent, error };
}
