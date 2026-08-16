import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ePOSDevice } from '../ePOSDevice';
import { RESULTS, ERRORS } from '../../constants/connection';

function fakeResponse(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(''),
  } as unknown as Response;
}

// Why the connection failed, over the HTTP path. Every failure used to come
// back as ERROR_PARAMETER, so a printer that was simply switched off was
// reported to the user as a bad argument.
describe('ePOSDevice.connect over the HTTP (eposprint) path', () => {
  let device: ePOSDevice;

  beforeEach(() => {
    device = new ePOSDevice();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('resolves OK when the print service answers', async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(200));

    await expect(device.connect('printer.example.com', 8043, { eposprint: true })).resolves.toBe(RESULTS.OK);
    expect(device.isConnected()).toBe(true);
  });

  it('resolves TIMEOUT when the host is unreachable (DNS, refused connection)', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'));

    await expect(device.connect('unreachable.invalid', 8043, { eposprint: true })).resolves.toBe(RESULTS.TIMEOUT);
    expect(device.isConnected()).toBe(false);
  });

  it('resolves TIMEOUT when nothing answers within the probe timeout', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation((_url, init) =>
      new Promise((_resolve, reject) => {
        (init as RequestInit).signal?.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted', 'AbortError'))
        );
      })
    );

    const connecting = device.connect('10.0.0.1', 8043, { eposprint: true });
    await vi.advanceTimersByTimeAsync(5000);

    await expect(connecting).resolves.toBe(RESULTS.TIMEOUT);
  });

  it('resolves ERROR when something answers but not with the print service', async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(404));

    await expect(device.connect('printer.example.com', 8043, { eposprint: true })).resolves.toBe(RESULTS.ERROR);
    expect(device.isConnected()).toBe(false);
  });

  it('resolves ERROR_PARAMETER for an address that is not a usable URL, without requesting anything', async () => {
    await expect(device.connect('', 8043, { eposprint: true })).resolves.toBe(ERRORS.ERROR_PARAMETER);
    await expect(device.connect('has space', 8043, { eposprint: true })).resolves.toBe(ERRORS.ERROR_PARAMETER);

    expect(fetch).not.toHaveBeenCalled();
  });
});
