import type { Request, Response } from 'express';
import { bus } from '../events';

/** Server-Sent-Events endpoint streaming live platform events to dashboards. */
export function sseHandler(req: Request, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');

  const unsubscribe = bus.onEvent((e) => {
    res.write(`data: ${JSON.stringify(e)}\n\n`);
  });

  // Heartbeat comment keeps proxies from closing the idle connection.
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000);

  req.on('close', () => {
    clearInterval(ping);
    unsubscribe();
  });
}
