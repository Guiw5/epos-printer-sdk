import { useCallback, useRef, useState } from 'react';
import { EposHttpPrinter, decodePrinterStatus } from 'epos-printer-sdk/http';
import type { PrintServiceResponse, PrinterStatus, BarcodeType, Hri, SymbolType, Level } from 'epos-printer-sdk/http';
import { explainResponse, explainError, type Outcome } from './printOutcomes';

export type PrinterConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

export interface PollJobStatusOptions {
  attempts?: number;
  delayMs?: number;
  onUpdate?: (result: PrintServiceResponse, attempt: number) => void;
}

export interface RetryOptions {
  /** Intentos totales (incluye el primero). */
  attempts?: number;
  /** Espera inicial; se duplica en cada reintento. */
  baseDelayMs?: number;
  onAttempt?: (attempt: number, reason: string) => void;
}

export interface UsePrinterResult {
  state: PrinterConnectionState;
  error: string | null;
  connect: (host: string, port?: number) => Promise<void>;
  disconnect: () => void;
  printText: (text: string) => Promise<PrintServiceResponse>;
  getStatus: () => Promise<PrintServiceResponse>;

  /** Live status, updated automatically while isMonitoring is true. */
  isMonitoring: boolean;
  status: PrinterStatus | null;
  startMonitoring: (intervalMs?: number) => void;
  stopMonitoring: () => void;

  /**
   * Prints a canvas (large print data — e.g. a rendered image/receipt
   * layout) with an explicit job id, then automatically polls
   * getPrintJobStatus() a few times to confirm the printer actually
   * finished the job rather than just accepted the request.
   */
  printCanvasAndTrack: (
    canvas: HTMLCanvasElement,
    printjobid: string,
    options?: PollJobStatusOptions
  ) => Promise<PrintServiceResponse>;

  /** Prints a 1D barcode (type per ePOS-Print XML spec — upc_a, ean13, code128, ...). */
  printBarcode: (data: string, type: BarcodeType, hri?: Hri) => Promise<PrintServiceResponse>;
  /** Prints a 2D symbol — QR code, PDF417, DataMatrix, Aztec, GS1 DataBar, ... */
  printSymbol: (data: string, type: SymbolType, level?: Level) => Promise<PrintServiceResponse>;
  /** Prints a small page-mode label: fixed area, positioned text, and a border rectangle. */
  printLabel: (lines: string[]) => Promise<PrintServiceResponse>;

  /**
   * Ejecuta un trabajo reintentando automáticamente los casos que el manual
   * marca como transitorios (impresora ocupada, cola llena, red caída) con
   * backoff exponencial. Los errores que no se arreglan reintentando
   * (falta de papel, XML inválido) se devuelven de inmediato.
   */
  printWithRetry: (
    job: () => Promise<PrintServiceResponse>,
    options?: RetryOptions
  ) => Promise<PrintServiceResponse>;

  /** Intenta recuperar la impresora de un error recuperable (recover / reset). */
  recover: () => Promise<PrintServiceResponse>;
}

/**
 * Thin React wrapper around EposHttpPrinter: keeps the instance in a ref
 * (it's not something React needs to re-render on) and exposes connection
 * state, live status monitoring, and print-job tracking as plain useState
 * so components can react to them normally.
 */
export function usePrinter(): UsePrinterResult {
  const printerRef = useRef<EposHttpPrinter | null>(null);
  const [state, setState] = useState<PrinterConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [status, setStatus] = useState<PrinterStatus | null>(null);

  const connect = useCallback(async (host: string, port?: number) => {
    setState('connecting');
    setError(null);
    try {
      const printer = new EposHttpPrinter(host, { port });
      await printer.connect();
      printerRef.current = printer;
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
  }, []);

  const printText = useCallback(async (text: string): Promise<PrintServiceResponse> => {
    const printer = printerRef.current;
    if (!printer) {
      throw new Error('No hay impresora conectada');
    }
    return printer
      .addTextAlign(printer.ALIGN_CENTER)
      .addText(text)
      .addFeedLine(1)
      .addCut('feed')
      .send();
  }, []);

  const getStatus = useCallback(async (): Promise<PrintServiceResponse> => {
    const printer = printerRef.current;
    if (!printer) {
      throw new Error('No hay impresora conectada');
    }
    return printer.send();
  }, []);

  // Printer monitoring: EposHttpPrinter already implements the polling loop
  // (inherited from ePOSPrint.open()/close()) and fires onstatuschange /
  // onbatterystatuschange as ASB bits change — we just decode those into
  // PrinterStatus and mirror them into React state.
  const startMonitoring = useCallback((intervalMs = 3000) => {
    const printer = printerRef.current;
    if (!printer) {
      throw new Error('No hay impresora conectada');
    }
    printer.interval = intervalMs;
    printer.onstatuschange = () => {
      setStatus(decodePrinterStatus(printer.status, printer.battery));
    };
    printer.onbatterystatuschange = () => {
      setStatus(decodePrinterStatus(printer.status, printer.battery));
    };
    printer.open();
    setIsMonitoring(true);
  }, []);

  const stopMonitoring = useCallback(() => {
    printerRef.current?.close();
    setIsMonitoring(false);
  }, []);

  const printCanvasAndTrack = useCallback(
    async (
      canvas: HTMLCanvasElement,
      printjobid: string,
      { attempts = 4, delayMs = 1500, onUpdate }: PollJobStatusOptions = {}
    ): Promise<PrintServiceResponse> => {
      const printer = printerRef.current;
      if (!printer) {
        throw new Error('No hay impresora conectada');
      }

      let result = await printer.print(canvas, printjobid);
      onUpdate?.(result, 0);

      // Large print data (an image) may still be spooling/printing after
      // the initial request is accepted — poll the job explicitly instead
      // of just trusting the first response.
      for (let attempt = 1; attempt <= attempts && !result.success; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        result = await printer.getPrintJobStatus(printjobid);
        onUpdate?.(result, attempt);
      }

      return result;
    },
    []
  );

  const printBarcode = useCallback(async (data: string, type: BarcodeType, hri: Hri = 'below'): Promise<PrintServiceResponse> => {
    const printer = printerRef.current;
    if (!printer) {
      throw new Error('No hay impresora conectada');
    }
    return printer
      .addTextAlign(printer.ALIGN_CENTER)
      .addBarcode(data, type, hri)
      .addFeedLine(1)
      .addCut('feed')
      .send();
  }, []);

  const printSymbol = useCallback(async (data: string, type: SymbolType, level: Level = 'default'): Promise<PrintServiceResponse> => {
    const printer = printerRef.current;
    if (!printer) {
      throw new Error('No hay impresora conectada');
    }
    return printer
      .addTextAlign(printer.ALIGN_CENTER)
      .addSymbol(data, type, level)
      .addFeedLine(1)
      .addCut('feed')
      .send();
  }, []);

  // Page mode: a fixed-size area with explicitly positioned text and a
  // border rectangle — the building blocks for a label layout, per the
  // ePOS-Print XML manual's <page>/<area>/<direction>/<position> elements.
  const printLabel = useCallback(async (lines: string[]): Promise<PrintServiceResponse> => {
    const printer = printerRef.current;
    if (!printer) {
      throw new Error('No hay impresora conectada');
    }
    const width = 380;
    const height = 40 + lines.length * 30;

    printer.addPageBegin().addPageArea(0, 0, width, height).addPageDirection('left_to_right');
    lines.forEach((line, i) => {
      printer.addPagePosition(10, 20 + i * 30).addText(line);
    });
    printer.addPageRectangle(0, 0, width - 1, height - 1, 'thin').addPageEnd();

    return printer.send();
  }, []);

  const recover = useCallback(async (): Promise<PrintServiceResponse> => {
    const printer = printerRef.current;
    if (!printer) {
      throw new Error('No hay impresora conectada');
    }
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
          // No llegamos a hablar con la impresora (red, DNS, CORS): también
          // es transitorio, así que entra en la misma política de reintento.
          outcome = explainError(err);
          if (attempt === attempts) throw err;
          last = null;
        }

        if (outcome.kind !== 'retry') {
          // Éxito, o un error que reintentar no arregla (papel, tapa, XML
          // inválido): devolver enseguida para que la UI actúe.
          if (last) return last;
          throw new Error(outcome.meaning);
        }

        if (attempt < attempts) {
          const delay = baseDelayMs * 2 ** (attempt - 1);
          onAttempt?.(attempt, `${outcome.code} — reintento en ${delay}ms`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      if (!last) throw new Error('Sin respuesta de la impresora tras varios intentos');
      return last;
    },
    []
  );

  return {
    state,
    error,
    connect,
    disconnect,
    printText,
    getStatus,
    isMonitoring,
    status,
    startMonitoring,
    stopMonitoring,
    printCanvasAndTrack,
    printBarcode,
    printSymbol,
    printLabel,
    printWithRetry,
    recover,
  };
}
