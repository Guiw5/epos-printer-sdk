import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommBoxManager } from '../CommBoxManager';
import { Connection } from '../Connection';
import type { ePosDeviceMessage } from '../ePosDeviceMessage';

// Unit tests for the promisified CommBox request/response flow. A stub
// Connection captures every emitted message so each test can pull the real
// `sequence` off the wire message and feed the matching client_* response
// back in, the same way procOpenCommBox/procCommBoxData would.
describe('CommBoxManager / CommBox (promisified)', () => {
  let manager: CommBoxManager;
  let emit: ReturnType<typeof vi.fn>;

  function lastSentSequence(): number {
    const eposmsg = emit.mock.calls.at(-1)?.[0] as ePosDeviceMessage;
    return eposmsg.sequence;
  }

  beforeEach(() => {
    manager = new CommBoxManager();
    emit = vi.fn();
    manager.setConnection({
      isUsableDeviceIF: () => true,
      emit,
    } as unknown as Connection);
  });

  async function openBox(boxID = 'box1') {
    const promise = manager.openCommBox(boxID);
    manager.client_opencommbox({ box_id: boxID, code: 'OK' } as never, lastSentSequence());
    return promise;
  }

  describe('openCommBox', () => {
    it('resolves with the CommBox when the server responds OK', async () => {
      const box = await openBox();
      expect(box.getBoxId()).toBe('box1');
      expect(manager.isOpened('box1')).toBe(true);
    });

    it('rejects with ALREADY_OPENED when reopening a box (server OK but no new instance, vendor behavior)', async () => {
      await openBox();

      const promise = manager.openCommBox('box1');
      manager.client_opencommbox({ box_id: 'box1', code: 'OK' } as never, lastSentSequence());

      await expect(promise).rejects.toThrow(manager.ERROR_ALREADY_OPENED);
    });

    it('rejects with the server error code on failure', async () => {
      const promise = manager.openCommBox('box1');
      manager.client_opencommbox({ box_id: 'box1', code: 'BOX_COUNT_OVER' } as never, lastSentSequence());

      await expect(promise).rejects.toThrow('BOX_COUNT_OVER');
    });

    it('rejects with SYSTEM_ERROR when the device IF is not usable', async () => {
      manager.setConnection({ isUsableDeviceIF: () => false, emit } as unknown as Connection);

      await expect(manager.openCommBox('box1')).rejects.toThrow(manager.ERROR_SYSTEM_ERROR);
      expect(emit).not.toHaveBeenCalled();
    });
  });

  describe('closeCommBox', () => {
    it('resolves on OK and the box is removed from the local list', async () => {
      const box = await openBox();

      const promise = manager.closeCommBox(box);
      manager.client_closecommbox({ box_id: 'box1', code: 'OK' } as never, lastSentSequence());

      await expect(promise).resolves.toBeUndefined();
      expect(manager.isOpened('box1')).toBe(false);
    });

    it('rejects with NOT_OPENED for a box that was never opened', async () => {
      const box = await openBox();
      manager.removeCommBox('box1');

      await expect(manager.closeCommBox(box)).rejects.toThrow(manager.ERROR_NOT_OPENED);
    });
  });

  describe('CommBox.send / getCommHistory', () => {
    it('send() resolves with the delivered count, dispatched through executeCommDataCallback (regression: detached client_send used to lose `this`)', async () => {
      const box = await openBox();

      const promise = box.send('hola', 'member1');
      manager.executeCommDataCallback(
        { box_id: 'box1', type: 'send', code: 'OK', count: 2 } as never,
        lastSentSequence()
      );

      await expect(promise).resolves.toBe(2);
    });

    it('send() rejects with the error code when delivery fails', async () => {
      const box = await openBox();

      const promise = box.send('hola', 'ghost');
      manager.executeCommDataCallback(
        { box_id: 'box1', type: 'send', code: 'MEMBER_NOT_FOUND', count: 0 } as never,
        lastSentSequence()
      );

      await expect(promise).rejects.toThrow('MEMBER_NOT_FOUND');
    });

    it('getCommHistory() resolves with the history list', async () => {
      const box = await openBox();
      const history = [{ sender_id: 'a', message: 'hi' }];

      const promise = box.getCommHistory();
      manager.executeCommDataCallback(
        { box_id: 'box1', type: 'getcommhistory', code: 'OK', history_list: history } as never,
        lastSentSequence()
      );

      await expect(promise).resolves.toEqual(history);
    });

    it('send() rejects immediately with NOT_OPENED when the box was closed', async () => {
      const box = await openBox();
      manager.removeCommBox('box1');

      await expect(box.send('hola', 'member1')).rejects.toThrow('NOT_OPENED');
    });

    it('settles even if the device echoes the sequence back as a string (regression: Map<number> did no key coercion, unlike the vendor plain object)', async () => {
      const box = await openBox();

      const promise = box.send('hola', 'member1');
      manager.executeCommDataCallback(
        { box_id: 'box1', type: 'send', code: 'OK', count: 1 } as never,
        String(lastSentSequence()) as unknown as number
      );

      await expect(promise).resolves.toBe(1);
    });

    it('client_onreceive stays event-based and delivers the mapped payload', async () => {
      const box = await openBox();
      const onreceive = vi.fn();
      box.onreceive = onreceive;

      manager.executeCommDataCallback(
        { box_id: 'box1', type: 'onreceive', sender_id: 's1', receiver_id: 'r1', message: 'ping' } as never,
        0
      );

      expect(onreceive).toHaveBeenCalledWith({ senderId: 's1', receiverId: 'r1', message: 'ping' });
    });
  });
});
