import { useCallback, useRef, useState } from 'react';
import { EposHttpPrinter, decodePrinterStatus } from 'epos-printer-sdk/http';
import type { PrintServiceResponse, PrinterStatus } from 'epos-printer-sdk/http';
import { createSimulator, type Simulator } from 'epos-printer-sdk/simulator';
import { explainResponse, explainError, type Outcome } from './printOutcomes';
import type { Recipe, RecipeContext } from './recipes';
import type { PrintedJob } from './PaperRail';

export type PrinterConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

export interface RetryOptions {
  /** Total attempts, including the first. */
  attempts?: number;
  /** Initial wait; doubles on each retry. */
  baseDelayMs?: number;
  onAttempt?: (attempt: number, reason: string) => void;
}

export interface UsePrinterResult {
  state: PrinterConnectionState;
  error: string | null;
  connect: (host: string, port?: number, options?: { demo?: boolean }) => Promise<void>;
  disconnect: () => void;

  /** Runs one of the recipes against the connected printer. */
  runRecipe: (recipe: Recipe, ctx: RecipeContext) => Promise<PrintServiceResponse>;
  getStatus: () => Promise<PrintServiceResponse>;

  /** Live status, updated automatically while isMonitoring is true. */
  isMonitoring: boolean;
  status: PrinterStatus | null;
  startMonitoring: (intervalMs?: number) => void;
  stopMonitoring: () => void;

  /** Simulated printer backing the connection, when connected in demo mode. */
  simulator: Simulator | null;
  /** Jobs the simulated printer has produced, oldest first. */
  printedJobs: PrintedJob[];

  /**
   * Runs a job, automatically retrying the cases the manual calls transient
   * (printer busy, queue full, network down) with exponential backoff.
   * Errors that retrying can't fix (out of paper, invalid XML) come back
   * immediately.
   */
  printWithRetry: (
    job: () => Promise<PrintServiceResponse>,
    options?: RetryOptions
  ) => Promise<PrintServiceResponse>;

  /** Tries to clear a recoverable printer error. */
  recover: () => Promise<PrintServiceResponse>;
}

const NOT_CONNECTED = 'No printer connected';

/**
 * Thin React wrapper around EposHttpPrinter: keeps the instance in a ref (it's
 * not something React needs to re-render on) and exposes connection state,
 * live status monitoring and printed output as plain state.
 */
export function usePrinter(): UsePrinterResult {
  const printerRef = useRef<EposHttpPrinter | null>(null);
  const [state, setState] = useState<PrinterConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [status, setStatus] = useState<PrinterStatus | null>(null);
  const [simulator, setSimulator] = useState<Simulator | null>(null);
  const [printedJobs, setPrintedJobs] = useState<PrintedJob[]>([]);

  const connect = useCallback(async (host: string, port?: number, { demo = false } = {}) => {
    setState('connecting');
    setError(null);
    try {
      // Demo mode swaps the transport for a simulated printer. Everything
      // downstream, printing, status, monitoring, error handling, runs the
      // exact same code paths as against real hardware. onPrint mirrors the
      // simulator's job list into state, since it mutates its own array.
      const sim = demo
        ? createSimulator({
            initialState: { paper: 8 },
            onPrint: (job) => setPrintedJobs((prev) => [...prev, job]),
          })
        : null;
      const printer = new EposHttpPrinter(host, { port, fetch: sim?.fetch });
      await printer.connect();
      printerRef.current = printer;
      setSimulator(sim);
      setState('connected');
    } catch (err) {
      printerRef.current = null;
      setState('error');
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, []);

  const disconnect = useCallback(() => {
    printerRef.current?.close();
    printerRef.current = null;
    setState('idle');
    setError(null);
    setIsMonitoring(false);
    setStatus(null);
    setSimulator(null);
    setPrintedJobs([]);
  }, []);

  const runRecipe = useCallback(async (recipe: Recipe, ctx: RecipeContext) => {
    const printer = printerRef.current;
    if (!printer) throw new Error(NOT_CONNECTED);
    return (await recipe.run(printer, ctx)) as PrintServiceResponse;
  }, []);

  const getStatus = useCallback(async (): Promise<PrintServiceResponse> => {
    const printer = printerRef.current;
    if (!printer) throw new Error(NOT_CONNECTED);
    const res = await printer.send();
    // A one-off query updates the readout too, not just the monitoring loop,
    // otherwise asking for the status appears to do nothing.
    setStatus(decodePrinterStatus(res.status, res.battery));
    return res;
  }, []);

  // EposHttpPrinter already implements the polling loop (inherited from
  // ePOSPrint.open()/close()) and fires onstatuschange / onbatterystatuschange
  // as ASB bits change, we just decode those into React state.
  const startMonitoring = useCallback((intervalMs = 3000) => {
    const printer = printerRef.current;
    if (!printer) throw new Error(NOT_CONNECTED);
    printer.interval = intervalMs;
    const sync = () => setStatus(decodePrinterStatus(printer.status, printer.battery));
    printer.onstatuschange = sync;
    printer.onbatterystatuschange = sync;
    printer.open();
    setIsMonitoring(true);
  }, []);

  const stopMonitoring = useCallback(() => {
    printerRef.current?.close();
    setIsMonitoring(false);
  }, []);

  const recover = useCallback(async (): Promise<PrintServiceResponse> => {
    const printer = printerRef.current;
    if (!printer) throw new Error(NOT_CONNECTED);
    return printer.recover();
  }, []);

  const printWithRetry = useCallback(
    async (
      job: () => Promise<PrintServiceResponse>,
      { attempts = 3, baseDelayMs = 500, onAttempt }: RetryOptions = {}
    ): Promise<PrintServiceResponse> => {
      let last: PrintServiceResponse | null = null;

      for (let attempt = 1; attempt <= attempts; attempt++) {
        let outcome: Outcome;
        try {
          last = await job();
          outcome = explainResponse(last);
        } catch (err) {
          // We never reached the printer (network, DNS, CORS): also transient,
          // so it falls under the same retry policy.
          outcome = explainError(err);
          if (attempt === attempts) throw err;
          last = null;
        }

        if (outcome.kind !== 'retry') {
          // Success, or a failure retrying won't fix (paper, cover, invalid
          // XML): return right away so the UI can act.
          if (last) return last;
          throw new Error(outcome.meaning);
        }

        if (attempt < attempts) {
          const delay = baseDelayMs * 2 ** (attempt - 1);
          onAttempt?.(attempt, `${outcome.code}, retrying in ${delay}ms`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      if (!last) throw new Error('No response from the printer after several attempts');
      return last;
    },
    []
  );

  return {
    state,
    error,
    connect,
    disconnect,
    runRecipe,
    getStatus,
    isMonitoring,
    status,
    startMonitoring,
    stopMonitoring,
    simulator,
    printedJobs,
    printWithRetry,
    recover,
  };
}
