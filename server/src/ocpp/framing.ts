import {
  MessageType,
  OcppError,
  type CallErrorMessage,
  type CallMessage,
  type CallResultMessage,
  type OcppMessage,
} from '@ocpp/shared';

/** Parse a raw WebSocket frame into a validated OCPP-J message tuple. */
export function parseMessage(raw: string): OcppMessage {
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    throw new OcppError('ProtocolError', 'Message is not valid JSON');
  }
  if (!Array.isArray(arr) || arr.length < 3)
    throw new OcppError('ProtocolError', 'Message must be a JSON array');

  const [type, messageId] = arr as [number, string];
  if (typeof messageId !== 'string')
    throw new OcppError('ProtocolError', 'messageId must be a string');

  switch (type) {
    case MessageType.CALL: {
      if (typeof arr[2] !== 'string')
        throw new OcppError('ProtocolError', 'action must be a string');
      return [MessageType.CALL, messageId, arr[2], arr[3]] as CallMessage;
    }
    case MessageType.CALLRESULT:
      return [MessageType.CALLRESULT, messageId, arr[2]] as CallResultMessage;
    case MessageType.CALLERROR:
      return [
        MessageType.CALLERROR,
        messageId,
        String(arr[2]),
        String(arr[3]),
        arr[4] ?? {},
      ] as CallErrorMessage;
    default:
      throw new OcppError('ProtocolError', `Unknown message type ${type}`);
  }
}

export function encodeCall(
  messageId: string,
  action: string,
  payload: unknown,
): string {
  return JSON.stringify([MessageType.CALL, messageId, action, payload ?? {}]);
}
export function encodeResult(messageId: string, payload: unknown): string {
  return JSON.stringify([MessageType.CALLRESULT, messageId, payload ?? {}]);
}
export function encodeError(
  messageId: string,
  err: OcppError,
): string {
  return JSON.stringify([
    MessageType.CALLERROR,
    messageId,
    err.code,
    err.message,
    err.details ?? {},
  ]);
}

export function kindName(type: MessageType): string {
  return MessageType[type];
}
