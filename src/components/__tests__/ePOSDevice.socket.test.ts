import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import io from 'socket.io-client';
import { ePOSDevice } from '../ePOSDevice';
import { CODES, REQUEST } from '../../constants/eposmessage';
import { RESULT_OK } from '../../constants/devices';

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

describe('ePOSDevice Socket Connection', () => {
  let device: ePOSDevice;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSocket: any;

  beforeEach(() => {
    device = new ePOSDevice();
    // Obtenemos la instancia del socket mock
    mockSocket = vi.mocked(io.connect(''));
  });

  afterEach(() => {
    vi.clearAllMocks();
    device.disconnect();
  });

  it('should handle complete socket connection sequence', async () => {
    // 1. Iniciamos la conexión
    const connectPromise = device.connect('192.168.1.1', 8008);

    // 2. Simulamos el evento "connect" del socket
    const connectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
    connectCallback();

    // 3. Simulamos el mensaje CONNECT del servidor
    const messageCallback = mockSocket.on.mock.calls.find(call => call[0] === 'message')[1];
    messageCallback({
      request: REQUEST.CONNECT,
      data: {
        protocol_version: 2,
        client_id: '12345',
        prime: 'prime_number',
        key: 'public_key'
      }
    });

    // 4. Simulamos la respuesta PUBKEY exitosa
    messageCallback({
      request: REQUEST.PUBKEY,
      code: CODES.RESULT_OK
    });

    // 5. Simulamos la respuesta ADMININFO exitosa
    messageCallback({
      request: REQUEST.ADMININFO,
      code: CODES.RESULT_OK,
      data: {
        admin_name: 'admin',
        location: 'location'
      }
    });

    // 6. Verificamos que la conexión fue exitosa
    const result = await connectPromise;
    expect(result).toBe(RESULT_OK);
  });

  it('should handle socket connection errors', async () => {
    // 1. Iniciamos la conexión
    const connectPromise = device.connect('192.168.1.1', 8008);

    // 2. Simulamos un error de conexión
    const errorCallback = mockSocket.on.mock.calls.find(call => call[0] === 'error')[1];
    errorCallback(new Error('Connection failed'));

    // 3. Verificamos que la conexión falló
    const result = await connectPromise;
    expect(result).not.toBe(RESULT_OK);
  });

  it('should handle PUBKEY mismatch error', async () => {
    // 1. Iniciamos la conexión
    const connectPromise = device.connect('192.168.1.1', 8008);

    // 2. Simulamos el evento "connect" del socket
    const connectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
    connectCallback();

    // 3. Simulamos el mensaje CONNECT
    const messageCallback = mockSocket.on.mock.calls.find(call => call[0] === 'message')[1];
    messageCallback({
      request: REQUEST.CONNECT,
      data: {
        protocol_version: 2,
        client_id: '12345',
        prime: 'prime_number',
        key: 'public_key'
      }
    });

    // 4. Simulamos error de PUBKEY
    messageCallback({
      request: REQUEST.PUBKEY,
      code: CODES.SHARED_KEY_MISMATCH_ERROR
    });

    // 5. Verificamos que la conexión falló
    const result = await connectPromise;
    expect(result).not.toBe(RESULT_OK);
  });

  it('should handle reconnection sequence', async () => {
    // 1. Iniciamos la conexión inicial
    const connectPromise = device.connect('192.168.0.3', 8008);

    // 2. Simulamos conexión exitosa
    const connectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
    connectCallback();

    // 3. Simulamos desconexión
    const disconnectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
    disconnectCallback();

    // 4. Verificamos que se inició la reconexión
    expect(device['reconnectTryCount']).toBe(0);
    expect(device['reconnectTimerId']).not.toBe(0);

    // 5. Simulamos reconexión exitosa
    const messageCallback = mockSocket.on.mock.calls.find(call => call[0] === 'message')[1];
    messageCallback({
      request: REQUEST.RECONNECT,
      code: CODES.RESULT_OK
    });

    const result = await connectPromise;
    expect(result).toBe(RESULT_OK);
  });
}); 