import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import {
  MessageType,
  OcppError,
  type OcppVersion,
} from '@ocpp/shared';
import { log } from '../logger';
import { store } from '../store';
import {
  encodeCall,
  encodeError,
  encodeResult,
  parseMessage,
} from './framing';
import { handlers16 } from './handlers16';
import { handlers201 } from './handlers201';

export type Handler = (
  conn: ChargePointConnection,
  payload: any,
) => Promise<unknown> | unknown;
export type HandlerMap = Record<string, Handler>;

interface Pending {
  action: string;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
  timer: NodeJS.Timeout;
}

/** One live OCPP-J session with a single charge point. */
export class ChargePointConnection {
  readonly handlers: HandlerMap;
  private pending = new Map<string, Pending>();

  constructor(
    readonly id: string,
    readonly version: OcppVersion,
    private readonly ws: WebSocket,
  ) {
    this.handlers = version === '1.6' ? handlers16 : handlers201;
  }

  handleRaw(raw: string) {
    let parsed;
    try {
      parsed = parseMessage(raw);
    } catch (e) {
      if (e instanceof OcppError)
        this.ws.send(encodeError(randomUUID(), e));
      return;
    }

    if (parsed[0] === MessageType.CALL) {
      const [, messageId, action, payload] = parsed;
      this.logMsg('in', 'CALL', action, messageId, payload);
      void this.dispatchCall(messageId, action, payload);
    } else if (parsed[0] === MessageType.CALLRESULT) {
      const [, messageId, payload] = parsed;
      const p = this.pending.get(messageId);
      this.logMsg('in', 'CALLRESULT', p?.action ?? '', messageId, payload);
      if (p) {
        clearTimeout(p.timer);
        this.pending.delete(messageId);
        p.resolve(payload);
      }
    } else {
      const [, messageId, code, description, details] = parsed;
      const p = this.pending.get(messageId);
      this.logMsg('in', 'CALLERROR', p?.action ?? '', messageId, {
        code,
        description,
        details,
      });
      if (p) {
        clearTimeout(p.timer);
        this.pending.delete(messageId);
        p.reject(new OcppError(code as any, description, details));
      }
    }
  }

  private async dispatchCall(
    messageId: string,
    action: string,
    payload: unknown,
  ) {
    const handler = this.handlers[action];
    if (!handler) {
      const err = new OcppError(
        'NotImplemented',
        `Action ${action} is not supported on OCPP ${this.version}`,
      );
      this.logMsg('out', 'CALLERROR', action, messageId, err.message);
      this.ws.send(encodeError(messageId, err));
      return;
    }
    try {
      const result = (await handler(this, payload)) ?? {};
      this.logMsg('out', 'CALLRESULT', action, messageId, result);
      this.ws.send(encodeResult(messageId, result));
    } catch (e) {
      const err =
        e instanceof OcppError
          ? e
          : new OcppError('InternalError', (e as Error).message);
      log.error(`Handler ${action} failed:`, err.message);
      this.logMsg('out', 'CALLERROR', action, messageId, err.message);
      this.ws.send(encodeError(messageId, err));
    }
  }

  /** Send a CALL to the charge point and await its CALLRESULT. */
  call<T = any>(action: string, payload: unknown, timeoutMs = 30_000): Promise<T> {
    const messageId = randomUUID();
    this.logMsg('out', 'CALL', action, messageId, payload);
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(messageId);
        reject(new OcppError('GenericError', `${action} timed out`));
      }, timeoutMs);
      this.pending.set(messageId, {
        action,
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });
      this.ws.send(encodeCall(messageId, action, payload));
    });
  }

  close() {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new OcppError('GenericError', 'Connection closed'));
    }
    this.pending.clear();
  }

  private logMsg(
    direction: 'in' | 'out',
    kind: string,
    action: string,
    messageId: string,
    payload: unknown,
  ) {
    log.ocpp(direction, this.id, kind, action);
    store.addLog({
      chargerId: this.id,
      direction,
      kind,
      action,
      messageId,
      payload,
    });
  }

  // ---------------------------------------------------- high-level commands
  // These translate version-agnostic dashboard intents into the right OCPP
  // message for whichever protocol the charge point negotiated.

  async remoteStart(idTag: string, connectorId?: number) {
    if (this.version === '1.6') {
      return this.call('RemoteStartTransaction', {
        idTag,
        ...(connectorId ? { connectorId } : {}),
      });
    }
    return this.call('RequestStartTransaction', {
      idToken: { idToken: idTag, type: 'ISO14443' },
      remoteStartId: Math.floor(Math.random() * 1e6),
      ...(connectorId ? { evseId: connectorId } : {}),
    });
  }

  async remoteStop(transactionId: string) {
    if (this.version === '1.6') {
      return this.call('RemoteStopTransaction', {
        transactionId: Number(transactionId),
      });
    }
    return this.call('RequestStopTransaction', { transactionId });
  }

  async reset(type: 'Soft' | 'Hard') {
    if (this.version === '1.6') return this.call('Reset', { type });
    return this.call('Reset', { type: type === 'Hard' ? 'Immediate' : 'OnIdle' });
  }

  async changeAvailability(connectorId: number, operative: boolean) {
    if (this.version === '1.6') {
      return this.call('ChangeAvailability', {
        connectorId,
        type: operative ? 'Operative' : 'Inoperative',
      });
    }
    return this.call('ChangeAvailability', {
      operationalStatus: operative ? 'Operative' : 'Inoperative',
      evse: { id: connectorId },
    });
  }

  /** Dynamic Load Management: cap the connector's charging current (amps). */
  async setPowerLimit(connectorId: number, limitA: number) {
    if (this.version === '1.6') {
      return this.call('SetChargingProfile', {
        connectorId,
        csChargingProfiles: {
          chargingProfileId: connectorId * 100 + 1,
          stackLevel: 0,
          chargingProfilePurpose: 'TxDefaultProfile',
          chargingProfileKind: 'Absolute',
          chargingSchedule: {
            chargingRateUnit: 'A',
            chargingSchedulePeriod: [{ startPeriod: 0, limit: limitA }],
          },
        },
      });
    }
    return this.call('SetChargingProfile', {
      evseId: connectorId,
      chargingProfile: {
        id: connectorId * 100 + 1,
        stackLevel: 0,
        chargingProfilePurpose: 'TxDefaultProfile',
        chargingProfileKind: 'Absolute',
        chargingSchedule: [
          {
            id: 1,
            chargingRateUnit: 'A',
            chargingSchedulePeriod: [{ startPeriod: 0, limit: limitA }],
          },
        ],
      },
    });
  }

  async reserveNow(
    reservationId: number,
    connectorId: number,
    idTag: string,
    expiryDate: string,
  ) {
    if (this.version === '1.6') {
      return this.call('ReserveNow', {
        connectorId,
        expiryDate,
        idTag,
        reservationId,
      });
    }
    return this.call('ReserveNow', {
      id: reservationId,
      expiryDateTime: expiryDate,
      idToken: { idToken: idTag, type: 'ISO14443' },
      evseId: connectorId,
    });
  }

  async cancelReservation(reservationId: number) {
    return this.call('CancelReservation', { reservationId });
  }

  async triggerMessage(requestedMessage: string, connectorId?: number) {
    if (this.version === '1.6') {
      return this.call('TriggerMessage', {
        requestedMessage,
        ...(connectorId ? { connectorId } : {}),
      });
    }
    return this.call('TriggerMessage', {
      requestedMessage,
      ...(connectorId ? { evse: { id: connectorId } } : {}),
    });
  }
}
