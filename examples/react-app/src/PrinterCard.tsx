import { FormEvent, useState } from 'react';
import type { BarcodeType, SymbolType } from '@epos/printer/http';
import { usePrinter } from './usePrinter';
import { useLog } from './useLog';
import { drawDemoCanvas } from './demoCanvas';
import { BARCODE_TYPES, SYMBOL_TYPES } from './barcodeOptions';

export interface PrinterCardProps {
  label: string;
  onRemove: () => void;
}

/** Everything needed to connect to and drive ONE printer. Fully
 * self-contained — its own connection, state and log — so multiple
 * printers are just multiple independent <PrinterCard>s. */
export default function PrinterCard({ label, onRemove }: PrinterCardProps) {
  const {
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
  } = usePrinter();
  const { lines, log } = useLog();

  const [address, setAddress] = useState('');
  const [port, setPort] = useState(443);
  const [busy, setBusy] = useState(false);
  const [barcodeType, setBarcodeType] = useState<BarcodeType>('code128');
  const [barcodeData, setBarcodeData] = useState('0123456789');
  const [symbolType, setSymbolType] = useState<SymbolType>('qrcode_model_2');
  const [symbolData, setSymbolData] = useState('https://example.com');

  const isConnected = state === 'connected';

  async function handleConnect(event: FormEvent) {
    event.preventDefault();
    log(`Conectando a ${address}:${port}...`);
    try {
      await connect(address, port);
      log('Conectado. Impresora lista.');
    } catch (err) {
      log(`No se pudo conectar: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function handleDisconnect() {
    disconnect();
    log('Desconectado.');
  }

  async function handlePrint() {
    log('Enviando recibo de prueba...');
    try {
      const result = await printText(`${label}\n`);
      log(result.success ? 'Impreso correctamente.' : `Fallo de impresión: ${result.code}`);
    } catch (err) {
      log(`Error al imprimir: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleStatus() {
    log('Consultando estado...');
    try {
      const result = await getStatus();
      log(`Estado: 0x${result.status.toString(16)} — batería: ${result.battery}`);
    } catch (err) {
      log(`Error al consultar estado: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function handleToggleMonitoring() {
    if (isMonitoring) {
      stopMonitoring();
      log('Monitoreo detenido.');
    } else {
      startMonitoring(3000);
      log('Monitoreo iniciado (cada 3s).');
    }
  }

  async function handlePrintCanvas() {
    setBusy(true);
    const jobId = `canvas-${Date.now()}`;
    log(`Enviando imagen (job ${jobId})...`);
    try {
      const result = await printCanvasAndTrack(drawDemoCanvas(), jobId, {
        onUpdate: (r, attempt) => {
          log(attempt === 0 ? `Job aceptado: success=${r.success} code="${r.code}"` : `Consulta de job #${attempt}: success=${r.success}`);
        },
      });
      log(result.success ? 'Job de imagen confirmado como impreso.' : `Job no se confirmó como impreso (code: ${result.code}).`);
    } catch (err) {
      log(`Error al imprimir imagen: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handlePrintBarcode() {
    setBusy(true);
    log(`Imprimiendo código de barras (${barcodeType})...`);
    try {
      const result = await printBarcode(barcodeData, barcodeType);
      log(result.success ? 'Código de barras impreso.' : `Fallo: ${result.code}`);
    } catch (err) {
      log(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handlePrintSymbol() {
    setBusy(true);
    log(`Imprimiendo símbolo 2D (${symbolType})...`);
    try {
      const result = await printSymbol(symbolData, symbolType);
      log(result.success ? 'Símbolo impreso.' : `Fallo: ${result.code}`);
    } catch (err) {
      log(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handlePrintLabel() {
    setBusy(true);
    log('Imprimiendo etiqueta (page mode)...');
    try {
      const result = await printLabel([label, new Date().toLocaleString(), 'Etiqueta de prueba']);
      log(result.success ? 'Etiqueta impresa.' : `Fallo: ${result.code}`);
    } catch (err) {
      log(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="printer-card">
      <div className="printer-card-header">
        <h2>{label}</h2>
        <button type="button" className="remove-btn" onClick={onRemove}>
          Quitar
        </button>
      </div>

      <section className="card">
        <h3>Conexión</h3>
        <form onSubmit={handleConnect}>
          <label>
            Dirección
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="192.168.1.100 o printer.example.com"
              disabled={isConnected}
              required
            />
          </label>
          <label>
            Puerto
            <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} disabled={isConnected} required />
          </label>
          <div className="actions">
            <button type="submit" disabled={isConnected || state === 'connecting'}>
              {state === 'connecting' ? 'Conectando...' : 'Conectar'}
            </button>
            <button type="button" onClick={handleDisconnect} disabled={!isConnected}>
              Desconectar
            </button>
          </div>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="card">
        <h3>Impresión / estado</h3>
        <div className="actions">
          <button type="button" onClick={handlePrint} disabled={!isConnected || busy}>
            Imprimir recibo de prueba
          </button>
          <button type="button" onClick={handleStatus} disabled={!isConnected || busy}>
            Consultar estado
          </button>
          <button type="button" onClick={handleToggleMonitoring} disabled={!isConnected}>
            {isMonitoring ? 'Detener monitoreo' : 'Iniciar monitoreo'}
          </button>
        </div>
        {status && (
          <dl className="status-grid">
            <dt>En línea</dt>
            <dd>{status.online ? 'sí' : 'no'}</dd>
            <dt>Tapa</dt>
            <dd>{status.coverOpen ? 'abierta' : 'cerrada'}</dd>
            <dt>Papel</dt>
            <dd>{status.paper}</dd>
            <dt>Cajón</dt>
            <dd>{status.drawerOpen ? 'abierto' : 'cerrado'}</dd>
            <dt>Batería</dt>
            <dd>{status.battery}</dd>
          </dl>
        )}
      </section>

      <section className="card">
        <h3>Código de barras / QR</h3>
        <label>
          Tipo de código de barras
          <select value={barcodeType} onChange={(e) => setBarcodeType(e.target.value as BarcodeType)} disabled={!isConnected}>
            {BARCODE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Datos
          <input type="text" value={barcodeData} onChange={(e) => setBarcodeData(e.target.value)} disabled={!isConnected} />
        </label>
        <div className="actions">
          <button type="button" onClick={handlePrintBarcode} disabled={!isConnected || busy}>
            Imprimir código de barras
          </button>
        </div>

        <label style={{ marginTop: '1rem' }}>
          Tipo de símbolo 2D
          <select value={symbolType} onChange={(e) => setSymbolType(e.target.value as SymbolType)} disabled={!isConnected}>
            {SYMBOL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Datos
          <input type="text" value={symbolData} onChange={(e) => setSymbolData(e.target.value)} disabled={!isConnected} />
        </label>
        <div className="actions">
          <button type="button" onClick={handlePrintSymbol} disabled={!isConnected || busy}>
            Imprimir símbolo 2D
          </button>
        </div>
      </section>

      <section className="card">
        <h3>Imagen (canvas) con seguimiento de job</h3>
        <p className="hint">
          Renderiza un canvas y lo imprime — datos de impresión más grandes que un texto simple. Consulta
          automáticamente <code>getPrintJobStatus()</code> hasta confirmar que el trabajo se completó.
        </p>
        <div className="actions">
          <button type="button" onClick={handlePrintCanvas} disabled={!isConnected || busy}>
            Imprimir imagen de prueba
          </button>
        </div>
      </section>

      <section className="card">
        <h3>Etiqueta (page mode)</h3>
        <p className="hint">
          Usa <code>&lt;page&gt;</code>/<code>&lt;area&gt;</code>/<code>&lt;position&gt;</code> para un layout de
          ancho y alto fijos con texto posicionado y un borde — el modo de las etiquetas, distinto del flujo
          secuencial de un recibo normal.
        </p>
        <div className="actions">
          <button type="button" onClick={handlePrintLabel} disabled={!isConnected || busy}>
            Imprimir etiqueta de prueba
          </button>
        </div>
      </section>

      <section className="card">
        <h3>Log</h3>
        <pre className="log">{lines.join('\n')}</pre>
      </section>
    </section>
  );
}
