/**
 * OCPP-J RPC framing. Both OCPP 1.6J and OCPP 2.0.1 use the same JSON-over-WebSocket
 * wire format: a 4-element (CALL) or 3/5-element (CALLRESULT/CALLERROR) JSON array.
 */

export enum MessageType {
  CALL = 2,
  CALLRESULT = 3,
  CALLERROR = 4,
}

export type CallMessage = [MessageType.CALL, string, string, unknown];
export type CallResultMessage = [MessageType.CALLRESULT, string, unknown];
export type CallErrorMessage = [
  MessageType.CALLERROR,
  string,
  string,
  string,
  unknown,
];

export type OcppMessage = CallMessage | CallResultMessage | CallErrorMessage;

/** Standard OCPP RPC framework error codes (used inside CALLERROR). */
export type OcppErrorCode =
  | 'NotImplemented'
  | 'NotSupported'
  | 'InternalError'
  | 'ProtocolError'
  | 'SecurityError'
  | 'FormationViolation'
  | 'PropertyConstraintViolation'
  | 'OccurenceConstraintViolation'
  | 'TypeConstraintViolation'
  | 'GenericError';

/** Thrown by a message handler to produce a CALLERROR back to the charge point. */
export class OcppError extends Error {
  constructor(
    public readonly code: OcppErrorCode,
    description: string,
    public readonly details: unknown = {},
  ) {
    super(description);
    this.name = 'OcppError';
  }
}

export const OCPP_SUBPROTOCOLS = {
  '1.6': 'ocpp1.6',
  '2.0.1': 'ocpp2.0.1',
} as const;

export type OcppVersion = keyof typeof OCPP_SUBPROTOCOLS;

export function subprotocolToVersion(p: string | undefined): OcppVersion | null {
  if (p === OCPP_SUBPROTOCOLS['1.6']) return '1.6';
  if (p === OCPP_SUBPROTOCOLS['2.0.1']) return '2.0.1';
  return null;
}
