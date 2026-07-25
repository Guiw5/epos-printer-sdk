import { describe, it, expect, vi } from 'vitest';
import { createSimulator } from '../simulator';
import { EposHttpPrinter } from '../components/EposHttpPrinter';

// The simulator's whole value is that code written against it behaves the same
// against hardware, so these drive it through the real EposHttpPrinter,
// not by calling sim.fetch directly.
function makePrinter(...args: Parameters<typeof createSimulator>) {
  const sim = createSimulator({ latencyMs: 0, ...args[0] });
  const printer = new EposHttpPrinter('demo', { fetch: sim.fetch });
  return { sim, printer };
}

describe('createSimulator', () => {
  it('accepts a print job and exposes the rendered text', async () => {
    const { sim, printer } = makePrinter();

    const res = await printer.addText('Hola\n').addCut('feed').send();

    expect(res.success).toBe(true);
    expect(sim.jobs).toHaveLength(1);
    expect(sim.jobs[0].text).toBe('Hola\n');
    expect(sim.jobs[0].xml).toContain('<cut type="feed"/>');
  });

  it('reports paper running out, then refuses to print', async () => {
    const { sim, printer } = makePrinter({ initialState: { paper: 1 } });

    await expect(printer.addText('uno\n').send()).resolves.toMatchObject({ success: true });
    expect(sim.state.paper).toBe(0);

    const res = await printer.addText('dos\n').send();
    expect(res.success).toBe(false);
    expect(res.code).toBe('EPTR_REC_EMPTY');
    expect(sim.jobs).toHaveLength(1);
  });

  it('surfaces an open cover as EPTR_COVER_OPEN and in the decoded status', async () => {
    const { sim, printer } = makePrinter();
    sim.state.coverOpen = true;

    const res = await printer.addText('x\n').send();

    expect(res.code).toBe('EPTR_COVER_OPEN');
    expect(res.status & 32).toBeTruthy(); // ASB_COVER_OPEN
  });

  it('an offline printer fails like an unreachable one, connect() throws', async () => {
    const { sim, printer } = makePrinter();
    sim.state.online = false;

    await expect(printer.connect()).rejects.toThrow();
  });

  it('a status query answers without consuming paper', async () => {
    const { sim, printer } = makePrinter({ initialState: { paper: 3 } });

    const res = await printer.send();

    expect(res.success).toBe(true);
    expect(sim.state.paper).toBe(3);
    expect(sim.jobs).toHaveLength(0);
  });

  it('near-end paper is reported before it runs out', async () => {
    const { printer } = makePrinter({ initialState: { paper: 4 } });

    const res = await printer.send();

    expect(res.status & 131072).toBeTruthy(); // ASB_RECEIPT_NEAR_END
    expect(res.status & 524288).toBeFalsy();  // not ASB_RECEIPT_END yet
  });

  it('addPulse opens the simulated drawer', async () => {
    const { sim, printer } = makePrinter();

    await printer.addPulse('drawer_1', 'pulse_100').send();

    expect(sim.state.drawerOpen).toBe(true);
  });

  it('calls onPrint for each job and reset() restores the initial state', async () => {
    const onPrint = vi.fn();
    const sim = createSimulator({ latencyMs: 0, initialState: { paper: 5 }, onPrint });
    const printer = new EposHttpPrinter('demo', { fetch: sim.fetch });

    await printer.addText('a\n').send();
    expect(onPrint).toHaveBeenCalledWith(expect.objectContaining({ text: 'a\n' }));

    sim.reset();
    expect(sim.jobs).toHaveLength(0);
    expect(sim.state.paper).toBe(5);
  });

  it('round-trips a printjobid so job tracking can be exercised', async () => {
    const { sim, printer } = makePrinter();

    await printer.send(
      '<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"><text>x</text></epos-print>',
      'job-7'
    );

    expect(sim.jobs[0].printjobid).toBe('job-7');
    await expect(printer.getPrintJobStatus('job-7')).resolves.toMatchObject({ printjobid: 'job-7' });
  });

  it('treats an empty <epos-print/> as a status query, not a print', async () => {
    const { sim, printer } = makePrinter({ initialState: { paper: 3 } });

    await printer.send('<epos-print/>', 'job-8');

    expect(sim.jobs).toHaveLength(0);
    expect(sim.state.paper).toBe(3);
  });
});
