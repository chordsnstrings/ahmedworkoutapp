import { EventEmitter } from 'node:events';
import type { ServerEvent } from '@ocpp/shared';

/** Single process-wide bus the REST/SSE layer subscribes to for live dashboard updates. */
class Bus extends EventEmitter {
  emitEvent(e: ServerEvent) {
    this.emit('event', e);
  }
  onEvent(fn: (e: ServerEvent) => void) {
    this.on('event', fn);
    return () => this.off('event', fn);
  }
}

export const bus = new Bus();
bus.setMaxListeners(0);
