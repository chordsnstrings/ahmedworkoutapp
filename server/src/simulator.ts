/**
 * Charge-point simulator. Connects to the CSMS as a real station would, so the
 * whole platform can be exercised without hardware.
 *
 *   npm run simulator -- --id CP_SIM_1 --version 1.6
 *   npm run simulator -- --id CP_SIM_2 --version 2.0.1 --url ws://localhost:3000
 */
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { MessageType, OCPP_SUBPROTOCOLS, type OcppVersion } from '@ocpp/shared';

function arg(name: string, fallback: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const id = arg('id', 'CP_SIM_1');
const version = arg('version', '1.6') as OcppVersion;
const baseUrl = arg('url', 'ws://localhost:3000');
const idType = arg('idType', 'ISO14443'); // ISO14443 (RFID) or eMAID (Plug & Charge)
const idTag = arg('idTag', idType === 'eMAID' ? 'DE-8AA-CA12B34-9' : 'RFID-0001');

const url = `${baseUrl.replace(/\/$/, '')}/ocpp/${id}`;
const ws = new WebSocket(url, [OCPP_SUBPROTOCOLS[version]]);

const pending = new Map<string, (payload: any) => void>();
let meterWh = 12_000;
let transactionId: string | null = null;
let meterTimer: NodeJS.Timeout | null = null;

function call(action: string, payload: unknown): Promise<any> {
  const messageId = randomUUID();
  return new Promise((resolve) => {
    pending.set(messageId, resolve);
    ws.send(JSON.stringify([MessageType.CALL, messageId, action, payload]));
    console.log(`→ ${action}`, JSON.stringify(payload));
  });
}
function reply(messageId: string, payload: unknown) {
  ws.send(JSON.stringify([MessageType.CALLRESULT, messageId, payload]));
}

function soc(): number {
  // Rises from ~40% toward ~95% as energy accumulates.
  return Math.min(95, Math.round(40 + (meterWh - 12_000) / 600));
}

function meterValue(): any {
  if (version === '1.6') {
    return {
      timestamp: new Date().toISOString(),
      sampledValue: [
        { value: String(meterWh), measurand: 'Energy.Active.Import.Register', unit: 'Wh', format: 'SignedData' },
        { value: '7400', measurand: 'Power.Active.Import', unit: 'W' },
        { value: String(soc()), measurand: 'SoC', unit: 'Percent' },
      ],
    };
  }
  return {
    timestamp: new Date().toISOString(),
    sampledValue: [
      {
        value: meterWh,
        measurand: 'Energy.Active.Import.Register',
        unitOfMeasure: { unit: 'Wh' },
        signedMeterValue: { signedMeterData: 'c2lnbmVk', signingMethod: 'ECDSA', encodingMethod: 'DLMS' },
      },
      { value: 7400, measurand: 'Power.Active.Import', unitOfMeasure: { unit: 'W' } },
      { value: soc(), measurand: 'SoC', unitOfMeasure: { unit: 'Percent' } },
    ],
  };
}

async function startTransaction() {
  if (transactionId) return;
  const meterStart = meterWh;
  if (version === '1.6') {
    const res = await call('StartTransaction', {
      connectorId: 1,
      idTag,
      meterStart,
      timestamp: new Date().toISOString(),
    });
    transactionId = String(res.transactionId);
  } else {
    transactionId = String(Math.floor(Math.random() * 1e6));
    await call('TransactionEvent', {
      eventType: 'Started',
      timestamp: new Date().toISOString(),
      triggerReason: 'RemoteStart',
      seqNo: 0,
      transactionInfo: { transactionId },
      evse: { id: 1, connectorId: 1 },
      idToken: { idToken: idTag, type: idType },
      meterValue: [meterValue()],
    });
  }
  console.log(`🔌 Charging started (tx ${transactionId})`);
  await sendStatus('Charging');

  let seq = 1;
  meterTimer = setInterval(async () => {
    meterWh += 60; // ~7.2 kW over a 30s tick (compressed time)
    if (version === '1.6') {
      await call('MeterValues', {
        connectorId: 1,
        transactionId: Number(transactionId),
        meterValue: [meterValue()],
      });
    } else {
      await call('TransactionEvent', {
        eventType: 'Updated',
        timestamp: new Date().toISOString(),
        triggerReason: 'MeterValuePeriodic',
        seqNo: seq++,
        transactionInfo: { transactionId, chargingState: 'Charging' },
        evse: { id: 1, connectorId: 1 },
        meterValue: [meterValue()],
      });
    }
  }, 5_000);
}

async function stopTransaction() {
  if (!transactionId) return;
  if (meterTimer) clearInterval(meterTimer);
  meterTimer = null;
  if (version === '1.6') {
    await call('StopTransaction', {
      transactionId: Number(transactionId),
      meterStop: meterWh,
      timestamp: new Date().toISOString(),
      reason: 'Remote',
    });
  } else {
    await call('TransactionEvent', {
      eventType: 'Ended',
      timestamp: new Date().toISOString(),
      triggerReason: 'RemoteStop',
      seqNo: 999,
      transactionInfo: { transactionId, stoppedReason: 'Remote' },
      evse: { id: 1, connectorId: 1 },
      meterValue: [meterValue()],
    });
  }
  console.log(`✅ Charging stopped (tx ${transactionId})`);
  transactionId = null;
  await sendStatus('Available');
}

function runFirmwareSequence() {
  const states = ['Downloading', 'Downloaded', 'Installing', 'Installed'];
  states.forEach((status, i) => {
    setTimeout(() => {
      const action =
        version === '1.6'
          ? 'FirmwareStatusNotification'
          : 'FirmwareStatusNotification';
      void call(action, { status, ...(version === '2.0.1' ? { requestId: 1 } : {}) });
    }, (i + 1) * 1500);
  });
}

function runDiagnosticsSequence(kind: 'Diagnostics' | 'Log') {
  const action =
    version === '1.6' ? 'DiagnosticsStatusNotification' : 'LogStatusNotification';
  const states = kind === 'Log' ? ['Uploading', 'Uploaded'] : ['Uploading', 'Uploaded'];
  states.forEach((status, i) => {
    setTimeout(() => {
      void call(action, { status, ...(version === '2.0.1' ? { requestId: 1 } : {}) });
    }, (i + 1) * 1500);
  });
}

async function sendStatus(status: string) {
  if (version === '1.6') {
    await call('StatusNotification', {
      connectorId: 1,
      errorCode: 'NoError',
      status,
    });
  } else {
    const map: Record<string, string> = {
      Available: 'Available',
      Charging: 'Occupied',
    };
    await call('StatusNotification', {
      timestamp: new Date().toISOString(),
      connectorStatus: map[status] ?? status,
      evseId: 1,
      connectorId: 1,
    });
  }
}

ws.on('open', async () => {
  console.log(`Connected to ${url} as OCPP ${version}`);
  if (version === '1.6') {
    await call('BootNotification', {
      chargePointVendor: 'SimuVolt',
      chargePointModel: 'Virtual-1',
      firmwareVersion: '1.0.0',
      chargePointSerialNumber: id,
    });
  } else {
    await call('BootNotification', {
      reason: 'PowerUp',
      chargingStation: {
        model: 'Virtual-1',
        vendorName: 'SimuVolt',
        firmwareVersion: '1.0.0',
        serialNumber: id,
      },
    });
  }
  await sendStatus('Available');
  setInterval(() => call('Heartbeat', {}), 30_000);
  console.log('Idle — start a session from the dashboard, or it auto-starts in 5s.');
  setTimeout(startTransaction, 5_000);
});

ws.on('message', async (data) => {
  const msg = JSON.parse(data.toString());
  const [type] = msg;
  if (type === MessageType.CALLRESULT) {
    const [, messageId, payload] = msg;
    pending.get(messageId)?.(payload);
    pending.delete(messageId);
    return;
  }
  if (type === MessageType.CALLERROR) {
    const [, messageId, code, description] = msg;
    console.warn(`⚠ CALLERROR ${code}: ${description}`);
    pending.get(messageId)?.({});
    pending.delete(messageId);
    return;
  }
  // Incoming CALL from the CSMS.
  const [, messageId, action, payload] = msg;
  console.log(`← ${action}`, JSON.stringify(payload));
  switch (action) {
    case 'RemoteStartTransaction':
    case 'RequestStartTransaction':
      reply(messageId, { status: 'Accepted' });
      setTimeout(startTransaction, 500);
      break;
    case 'RemoteStopTransaction':
    case 'RequestStopTransaction':
      reply(messageId, { status: 'Accepted' });
      setTimeout(stopTransaction, 500);
      break;
    case 'Reset':
      reply(messageId, { status: 'Accepted' });
      break;
    case 'ChangeAvailability':
      reply(messageId, { status: 'Accepted' });
      break;
    case 'SetChargingProfile':
      reply(messageId, { status: 'Accepted' });
      break;
    case 'ClearChargingProfile':
      reply(messageId, { status: 'Accepted' });
      break;
    case 'GetCompositeSchedule': {
      const schedule = {
        chargingRateUnit: 'A',
        duration: payload.duration ?? 86400,
        chargingSchedulePeriod: [
          { startPeriod: 0, limit: 32 },
          { startPeriod: 28800, limit: 16 },
          { startPeriod: 64800, limit: 32 },
        ],
      };
      if (version === '1.6') {
        reply(messageId, {
          status: 'Accepted',
          connectorId: payload.connectorId ?? 1,
          scheduleStart: new Date().toISOString(),
          chargingSchedule: schedule,
        });
      } else {
        reply(messageId, {
          status: 'Accepted',
          evseId: payload.evseId ?? 1,
          schedule: { ...schedule, id: 1 },
        });
      }
      break;
    }
    case 'ReserveNow':
      reply(messageId, { status: 'Accepted' });
      setTimeout(() => sendStatus('Reserved'), 300);
      break;
    case 'CancelReservation':
      reply(messageId, { status: 'Accepted' });
      setTimeout(() => sendStatus('Available'), 300);
      break;
    case 'TriggerMessage':
      reply(messageId, { status: 'Accepted' });
      break;
    case 'GetConfiguration':
      reply(messageId, {
        configurationKey: [
          { key: 'HeartbeatInterval', readonly: false, value: '60' },
          { key: 'MeterValueSampleInterval', readonly: false, value: '30' },
          { key: 'NumberOfConnectors', readonly: true, value: '1' },
          { key: 'SupportedFeatureProfiles', readonly: true, value: 'Core,FirmwareManagement,SmartCharging,Reservation' },
        ],
        unknownKey: [],
      });
      break;
    case 'ChangeConfiguration':
      reply(messageId, { status: 'Accepted' });
      break;
    case 'GetVariables':
      reply(messageId, {
        getVariableResult: (payload.getVariableData ?? []).map((d: any) => ({
          attributeStatus: 'Accepted',
          attributeValue: '60',
          component: d.component,
          variable: d.variable,
        })),
      });
      break;
    case 'SetVariables':
      reply(messageId, {
        setVariableResult: (payload.setVariableData ?? []).map((d: any) => ({
          attributeStatus: 'Accepted',
          component: d.component,
          variable: d.variable,
        })),
      });
      break;
    case 'UpdateFirmware':
      reply(messageId, version === '1.6' ? {} : { status: 'Accepted' });
      runFirmwareSequence();
      break;
    case 'GetDiagnostics':
      reply(messageId, { fileName: 'diagnostics-001.tar.gz' });
      runDiagnosticsSequence('Diagnostics');
      break;
    case 'GetLog':
      reply(messageId, { status: 'Accepted', filename: 'log-001.tar.gz' });
      runDiagnosticsSequence('Log');
      break;
    default:
      reply(messageId, {});
  }
});

ws.on('close', () => {
  console.log('Disconnected');
  process.exit(0);
});
ws.on('error', (e) => console.error('WS error:', e.message));
