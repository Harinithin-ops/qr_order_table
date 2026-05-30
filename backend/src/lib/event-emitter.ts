type EventHandler = (data: Record<string, unknown>) => void;

class ServerEventEmitter {
  private listeners: Map<string, Set<EventHandler>> = new Map();

  on(event: string, handler: EventHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: EventHandler) {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event: string, data: Record<string, unknown>) {
    this.listeners.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
    // Also emit to wildcard listeners
    this.listeners.get('*')?.forEach((handler) => {
      try {
        handler({ type: event, ...data });
      } catch (error) {
        console.error(`Error in wildcard handler:`, error);
      }
    });
  }
}

const globalForEmitter = globalThis as unknown as {
  eventEmitter: ServerEventEmitter | undefined;
};

export const eventEmitter =
  globalForEmitter.eventEmitter ?? new ServerEventEmitter();

if (process.env.NODE_ENV !== 'production') {
  globalForEmitter.eventEmitter = eventEmitter;
}
