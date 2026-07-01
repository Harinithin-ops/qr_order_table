import { Request, Response } from 'express';
import { eventEmitter } from '../lib/event-emitter.js';

export function getEvents(req: Request, res: Response) {
  // SSE Headers — disable all buffering so events arrive immediately
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-store, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Flush headers immediately
  res.flushHeaders?.();

  // Helper: write and flush (works for both Express and Vercel)
  const send = (chunk: string) => {
    try {
      res.write(chunk);
      // res.flush exists when compression middleware is used
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    } catch {
      // Connection already closed — ignore
    }
  };

  // Immediately send connection confirmation
  send(': connected\n\n');

  // Listen to ALL events via wildcard
  const listener = (data: Record<string, unknown>) => {
    send(`data: ${JSON.stringify(data)}\n\n`);
  };

  eventEmitter.on('*', listener);

  // Keep-alive ping every 25 seconds (Vercel has a 30s idle timeout)
  const timer = setInterval(() => {
    send(': ping\n\n');
  }, 25000);

  // Clean up when client disconnects
  req.on('close', () => {
    clearInterval(timer);
    eventEmitter.off('*', listener);
  });

  // Also clean up on connection error
  req.on('error', () => {
    clearInterval(timer);
    eventEmitter.off('*', listener);
  });

  // Also clean up on response stream error to prevent EPIPE/ECONNRESET crashes
  res.on('error', (err) => {
    console.error('[SSE Response stream error]:', err);
    clearInterval(timer);
    eventEmitter.off('*', listener);
  });
}
