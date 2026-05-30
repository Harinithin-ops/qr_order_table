import { Request, Response } from 'express';
import { eventEmitter } from '../lib/event-emitter.js';

export function getEvents(req: Request, res: Response) {
  // SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Immediately send connection confirmation
  res.write(': connected\n\n');

  // Set up event listener
  const listener = (data: Record<string, unknown>) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      console.error('Error sending event', e);
    }
  };

  eventEmitter.on('*', listener);

  // Keep connection alive with periodic pings (every 30s)
  const timer = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (e) {
      clearInterval(timer);
    }
  }, 30000);

  // Clean up when client disconnects
  req.on('close', () => {
    clearInterval(timer);
    eventEmitter.off('*', listener);
  });
}
