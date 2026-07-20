import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance, type Mock } from 'vitest';
import io from 'socket.io-client';
import { ePOSDevice } from '../ePOSDevice';
import { Connection } from '../Connection';
import { CODES, REQUEST } from '../../constants/eposmessage';
import { RESULT_OK, CONNECT_TIMEOUT } from '../../constants/devices';
import { ERRORS } from '../../constants/connection';

// Mock de socket.io-client
vi.mock('socket.io-client', () => {
  const mockSocket = {
    on: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn()
  };

  return {
    default: {
      connect: vi.fn(() => mockSocket)
    },
    Socket: vi.fn()
  };
});

// connectBySocketIo() lazily does `await import('socket.io-client')` before
// calling io.connect(...)/registering any listeners, so the mock's `.on(...)`
// calls don't show up synchronously right after device.connect() — they land
// a few microtask turns later. Poll instead of reading mock.calls immediately.
async function waitForHandler(
  mockSocket: { on: Mock },
  event: string
): Promise<(...args: unknown[]) => void> {
  return vi.waitFor(() => {
    const call = mockSocket.on.mock.calls.find((c) => c[0] === event);
    if (!call) {
      throw new Error(`"${event}" handler not registered yet`);
    }
    return call[1] as (...args: unknown[]) => void;
  });
}

describe('ePOSDevice Socket Connection', () => {
  let device: ePOSDevice;
  let mockSocket: { on: Mock; emit: Mock };
  let probeSpy: MockInstance;

  beforeEach(() => {
    device = new ePOSDevice();
    // Obtenemos la instancia del socket mock
    mockSocket = vi.mocked(io.connect(''));

    // Avoid real network calls: handleSocketError() (the socket "error"
    // path) falls back to an HTTP probe via Connection.probe(), which would
    // otherwise fire a real XMLHttpRequest at the fake test address. Spied
    // (not vi.restoreAllMocks()'d away) so the io.connect mock's own
    // implementation — a plain vi.fn(), not a spy on a real method — isn't
    // reset to a no-op by a blanket restore.
    probeSpy = vi.spyOn(Connection.prototype, 'probe').mockResolvedValue(ERRORS.ERROR_PARAMETER);
  });

  afterEach(() => {
    vi.clearAllMocks();
    probeSpy.mockRestore();
    device.disconnect();
  });

  it('should handle complete socket connection sequence', async () => {
    // 1. Iniciamos la conexión
    const connectPromise = device.connect('192.168.1.1', 8008);

    // 2. Simulamos el evento "connect" del socket
    const connectCallback = await waitForHandler(mockSocket, 'connect');
    connectCallback();

    // 3. Simulamos el mensaje CONNECT del servidor. parseRequestMessage()
    // reads these positionally (message[0]/[1]/[2]...), matching
    // ePosDeviceMessage.toTransmissionForm() — not a {request, data} object.
    const messageCallback = await waitForHandler(mockSocket, 'message');
    messageCallback([
      REQUEST.CONNECT,
      {
        protocol_version: 2,
        client_id: '12345',
        // Must be valid hex: genClientKeys() feeds these straight into real
        // Diffie-Hellman powMod() arithmetic. A non-hex string like
        // "prime_number" truncates to a bigint of 0 at the first invalid
        // digit (see str2bigInt), producing a zero modulus that hangs
        // powMod() indefinitely instead of throwing.
        prime: 'b3',
        key: '5'
      }
    ]);

    // 4. Simulamos la respuesta PUBKEY exitosa
    messageCallback([REQUEST.PUBKEY, CODES.RESULT_OK]);

    // 5. Simulamos la respuesta ADMININFO exitosa
    messageCallback([
      REQUEST.ADMININFO,
      CODES.RESULT_OK,
      { admin_name: 'admin', location: 'location' }
    ]);

    // 6. Verificamos que la conexión fue exitosa
    const result = await connectPromise;
    expect(result).toBe(RESULT_OK);
  });

  it('should handle socket connection errors', async () => {
    // 1. Iniciamos la conexión
    const connectPromise = device.connect('192.168.1.1', 8008);

    // 2. Simulamos un error de conexión (falls back to the mocked HTTP
    // probe above, which resolves to ERROR_PARAMETER — never OK)
    const errorCallback = await waitForHandler(mockSocket, 'error');
    errorCallback(new Error('Connection failed'));

    // 3. Verificamos que la conexión falló
    const result = await connectPromise;
    expect(result).not.toBe(RESULT_OK);
  });

  it('should handle PUBKEY mismatch error', async () => {
    // 1. Iniciamos la conexión
    const connectPromise = device.connect('192.168.1.1', 8008);

    // Force the "retry window exhausted" branch of procPubkey's mismatch
    // handling (mismatchTimeout >= CONNECT_TIMEOUT) — otherwise a mismatch
    // just schedules a silent retry and connect() never settles.
    (device as unknown as { connectStartTime: number }).connectStartTime = Date.now() - CONNECT_TIMEOUT - 1000;

    // 2. Simulamos el evento "connect" del socket
    const connectCallback = await waitForHandler(mockSocket, 'connect');
    connectCallback();

    // 3. Simulamos el mensaje CONNECT
    const messageCallback = await waitForHandler(mockSocket, 'message');
    messageCallback([
      REQUEST.CONNECT,
      {
        protocol_version: 2,
        client_id: '12345',
        // Must be valid hex: genClientKeys() feeds these straight into real
        // Diffie-Hellman powMod() arithmetic. A non-hex string like
        // "prime_number" truncates to a bigint of 0 at the first invalid
        // digit (see str2bigInt), producing a zero modulus that hangs
        // powMod() indefinitely instead of throwing.
        prime: 'b3',
        key: '5'
      }
    ]);

    // 4. Simulamos error de PUBKEY, ya fuera de la ventana de reintento
    messageCallback([REQUEST.PUBKEY, CODES.SHARED_KEY_MISMATCH_ERROR]);

    // 5. Verificamos que la conexión falló
    const result = await connectPromise;
    expect(result).not.toBe(RESULT_OK);
  });

  it('createDevice() resolves with the device once the OPENDEVICE response arrives', async () => {
    // Handshake completo primero
    const connectPromise = device.connect('192.168.1.1', 8008);
    (await waitForHandler(mockSocket, 'connect'))();
    const messageCallback = await waitForHandler(mockSocket, 'message');
    messageCallback([
      REQUEST.CONNECT,
      { protocol_version: 2, client_id: '12345', prime: 'b3', key: '5' }
    ]);
    messageCallback([REQUEST.PUBKEY, CODES.RESULT_OK]);
    messageCallback([
      REQUEST.ADMININFO,
      CODES.RESULT_OK,
      { admin_name: 'admin', location: 'location' }
    ]);
    expect(await connectPromise).toBe(RESULT_OK);

    const devicePromise = device.createDevice('local_printer', 'type_printer');

    // El OPENDEVICE sale por el socket de forma asíncrona (select() hace un
    // import dinámico de la clase del device), así que esperamos el emit.
    await vi.waitFor(() => {
      const sent = mockSocket.emit.mock.calls.find(
        (c) => c[0] === 'message' && (c[1] as unknown[])?.[0] === REQUEST.OPENDEVICE
      );
      if (!sent) throw new Error('OPENDEVICE not emitted yet');
    });

    // Simulamos la respuesta OK del server
    messageCallback([REQUEST.OPENDEVICE, 'local_printer', CODES.RESULT_OK, {}, 0]);

    const printer = await devicePromise;
    expect(printer).toBeTruthy();
    expect(typeof (printer as { send: unknown }).send).toBe('function');
  });

  it('createDevice() rejects with the error code when the device cannot be opened', async () => {
    const connectPromise = device.connect('192.168.1.1', 8008);
    (await waitForHandler(mockSocket, 'connect'))();
    const messageCallback = await waitForHandler(mockSocket, 'message');
    messageCallback([
      REQUEST.CONNECT,
      { protocol_version: 2, client_id: '12345', prime: 'b3', key: '5' }
    ]);
    messageCallback([REQUEST.PUBKEY, CODES.RESULT_OK]);
    messageCallback([
      REQUEST.ADMININFO,
      CODES.RESULT_OK,
      { admin_name: 'admin', location: 'location' }
    ]);
    expect(await connectPromise).toBe(RESULT_OK);

    const devicePromise = device.createDevice('local_printer', 'type_printer');
    await vi.waitFor(() => {
      if (!mockSocket.emit.mock.calls.some((c) => (c[1] as unknown[])?.[0] === REQUEST.OPENDEVICE)) {
        throw new Error('OPENDEVICE not emitted yet');
      }
    });
    messageCallback([REQUEST.OPENDEVICE, 'local_printer', 'DEVICE_NOT_FOUND', {}, 0]);

    await expect(devicePromise).rejects.toThrow('DEVICE_NOT_FOUND');
  });

  it('createDevice() rejects with SYSTEM_ERROR when not connected', async () => {
    await expect(device.createDevice('local_printer', 'type_printer')).rejects.toThrow('SYSTEM_ERROR');
  });

  it('should handle reconnection sequence', async () => {
    // 1. Completamos primero un handshake exitoso: sin un connectionId real
    // asignado, "disconnect" no puede distinguir una reconexión legítima de
    // un cierre sin más (ver procConnect / el "disconnect" handler).
    const connectPromise = device.connect('192.168.0.3', 8008);

    const connectCallback = await waitForHandler(mockSocket, 'connect');
    connectCallback();

    const messageCallback = await waitForHandler(mockSocket, 'message');
    messageCallback([
      REQUEST.CONNECT,
      {
        protocol_version: 2,
        client_id: 'reconnect-client',
        // Must be valid hex: genClientKeys() feeds these straight into real
        // Diffie-Hellman powMod() arithmetic. A non-hex string like
        // "prime_number" truncates to a bigint of 0 at the first invalid
        // digit (see str2bigInt), producing a zero modulus that hangs
        // powMod() indefinitely instead of throwing.
        prime: 'b3',
        key: '5'
      }
    ]);
    messageCallback([REQUEST.PUBKEY, CODES.RESULT_OK]);
    messageCallback([
      REQUEST.ADMININFO,
      CODES.RESULT_OK,
      { admin_name: 'admin', location: 'location' }
    ]);

    expect(await connectPromise).toBe(RESULT_OK);

    const onreconnect = vi.fn();
    device.onreconnect = onreconnect;

    // 2. Simulamos que el transporte se cae
    const disconnectCallback = await waitForHandler(mockSocket, 'disconnect');
    disconnectCallback();

    // 3. Verificamos que se inició la reconexión
    expect(device['reconnectTryCount']).toBe(0);
    expect(device['reconnectTimerId']).not.toBe(0);
    expect(device.isConnected()).toBe(true); // RECONNECTING cuenta como conectado

    // 4. Simulamos reconexión exitosa
    messageCallback([REQUEST.RECONNECT, CODES.RESULT_OK]);

    expect(onreconnect).toHaveBeenCalledTimes(1);
    expect(device.isConnected()).toBe(true);
  });
});
