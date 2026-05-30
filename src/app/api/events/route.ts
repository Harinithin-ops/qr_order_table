import { NextResponse } from 'next/server';
import { eventEmitter } from '@/lib/event-emitter';

export const runtime = 'edge';

// Keep connection alive
const PING_INTERVAL = 30000;

export async function GET() {
  let timer: NodeJS.Timeout;
  let listener: (data: Record<string, unknown>) => void;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(': connected\n\n'));

      listener = (data: Record<string, unknown>) => {
        try {
          const payload = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch (e) {
          console.error('Error sending event', e);
        }
      };

      eventEmitter.on('*', listener);

      timer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch (e) {
          clearInterval(timer);
        }
      }, PING_INTERVAL);
    },
    cancel() {
      if (timer) clearInterval(timer);
      if (listener) eventEmitter.off('*', listener);
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
