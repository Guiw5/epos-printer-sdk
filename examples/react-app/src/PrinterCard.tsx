import { FormEvent, useCallback, useRef, useState } from 'react';
import type { BarcodeType, PrintServiceResponse, SymbolType } from 'epos-printer-sdk/http';
import { usePrinter } from './usePrinter';
import { useLog } from './useLog';
import { BARCODE_TYPES, SYMBOL_TYPES } from './barcodeOptions';
import { explainResponse, explainError, KIND_LABEL, type Outcome } from './printOutcomes';
import OutcomePanel from './OutcomePanel';
import PaperRail from './PaperRail';
import RecipeRow from './RecipeRow';
import { RECIPES, type Recipe } from './recipes';
import { t } from './strings';

export interface PrinterCardProps {
  label: string;
  onRemove: () => void;
}

/**
 * Everything needed to connect to and drive ONE printer. Fully self-contained
 * its own connection, state and log, so multiple printers are just
 * multiple independent <PrinterCard>s.
 */
export default function PrinterCard({ label, onRemove }: PrinterCardProps) {
  const {
    state,
    error,
    connect,
    disconnect,
    getStatus,
    isMonitoring,
    status,
    startMonitoring,
    stopMonitoring,
    runRecipe,
    printWithRetry,
    recover,
    printedJobs,
  } = usePrinter();
  const { lines, log } = useLog();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  /** Last job run, so the outcome panel can retry it. */
  const lastJobRef = useRef<(() => Promise<PrintServiceResponse>) | null>(null);

  const [address, setAddress] = useState('');
  const [port, setPort] = useState(443);
  // On the public deploy there is no reachable printer: start in demo mode.
  const [demo, setDemo] = useState(!['localhost', '127.0.0.1'].includes(window.location.hostname));
  const [busy, setBusy] = useState(false);
  const [barcodeType, setBarcodeType] = useState<BarcodeType>('code128');
  const [barcodeData, setBarcodeData] = useState('0123456789');
  const [symbolType, setSymbolType] = useState<SymbolType>('qrcode_model_2');
  const [symbolData, setSymbolData] = useState('https://example.com');

  const isConnected = state === 'connected';

  async function handleConnect(event: FormEvent) {
    event.preventDefault();
    log(demo ? t.logConnectingSim : t.logConnecting(address, port));
    try {
      await connect(demo ? 'simulated-printer' : address, port, { demo });
      log(demo ? t.logConnectedSim : t.logConnected);
    } catch (err) {
      log(t.logConnectFailed(err instanceof Error ? err.message : String(err)));
    }
  }

  function handleDisconnect() {
    disconnect();
    log(t.logDisconnected);
  }

  /**
   * The single path every job takes: retry what the manual calls transient,
   * translate the result into a diagnosis with a recommended action, and keep
   * it around so it can be retried by hand.
   */
  const runJob = useCallback(
    async (description: string, job: () => Promise<PrintServiceResponse>) => {
      setBusy(true);
      lastJobRef.current = job;
      log(t.logRunning(description));
      try {
        const result = await printWithRetry(job, {
          onAttempt: (attempt, reason) => log(t.logAttemptFailed(attempt, reason)),
        });
        const diagnosis = explainResponse(result);
        setOutcome(diagnosis);
        log(`${diagnosis.code} [${KIND_LABEL[diagnosis.kind]}] — ${diagnosis.action}`);
        return result;
      } catch (err) {
        const diagnosis = explainError(err);
        setOutcome(diagnosis);
        log(`${diagnosis.code} — ${diagnosis.meaning}`);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [log, printWithRetry]
  );

  const handleRunRecipe = useCallback(
    (recipe: Recipe) => {
      void runJob(recipe.title, () =>
        runRecipe(recipe, { label, barcodeData, barcodeType, symbolData, symbolType })
      );
    },
    [runJob, runRecipe, label, barcodeData, barcodeType, symbolData, symbolType]
  );

  async function handleStatus() {
    try {
      const result = await getStatus();
      log(t.logStatus(result.status.toString(16), result.battery));
      setOutcome(explainResponse(result));
    } catch (err) {
      setOutcome(explainError(err));
      log(t.logConnectFailed(err instanceof Error ? err.message : String(err)));
    }
  }

  async function handleRetryLast() {
    const job = lastJobRef.current;
    if (!job) return;
    await runJob(t.logRetryLast, job);
  }

  async function handleRecover() {
    setBusy(true);
    log(t.logRecovering);
    try {
      const result = await recover();
      const diagnosis = explainResponse(result);
      setOutcome(diagnosis);
      log(`recover() → ${diagnosis.code}. ${diagnosis.action}`);
    } catch (err) {
      setOutcome(explainError(err));
      log(`recover() failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  function handleToggleMonitoring() {
    if (isMonitoring) {
      stopMonitoring();
      log(t.logMonitoringOff);
    } else {
      startMonitoring(3000);
      log(t.logMonitoringOn);
    }
  }

  // Derived during render, not in an effect, the LEDs are just a view of the
  // last status we got back.
  const leds = [
    { label: t.ledReady, on: !isConnected ? '' : status?.online === false ? 'bad' : 'ok' },
    {
      label: t.ledPaper,
      on: !status ? '' : status.paper === 'end' ? 'bad' : status.paper === 'near_end' ? 'warn' : 'ok',
    },
    { label: t.ledCover, on: !status ? '' : status.coverOpen ? 'bad' : 'ok' },
    { label: t.ledDrawer, on: !status ? '' : status.drawerOpen ? 'warn' : 'ok' },
  ];

  return (
    <section className="bench">
      <div>
        <div className="machine">
          <div className="machine-top">
            <h2>{label}</h2>
            <div className="leds">
              {leds.map((l) => (
                <span key={l.label} className="led" data-on={l.on}>
                  {l.label}
                </span>
              ))}
            </div>
            <button type="button" className="ghost" onClick={onRemove} aria-label={`${t.remove} ${label}`}>
              {t.remove}
            </button>
          </div>

          <div className="machine-body">
            <div className="panel">
              <h3>{t.connection}</h3>
              <form onSubmit={handleConnect}>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={demo}
                    onChange={(e) => setDemo(e.target.checked)}
                    disabled={isConnected}
                  />
                  {t.demoMode}
                </label>
                <div className="field-row">
                  <label>
                    {t.address}
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder={demo ? 'simulated-printer' : '192.168.1.100'}
                      disabled={isConnected || demo}
                      required={!demo}
                    />
                  </label>
                  <label>
                    {t.port}
                    <input
                      type="number"
                      value={port}
                      onChange={(e) => setPort(Number(e.target.value))}
                      disabled={isConnected || demo}
                      required={!demo}
                    />
                  </label>
                  <div className="actions">
                    <button
                      type="submit"
                      className="primary"
                      disabled={isConnected || state === 'connecting'}
                    >
                      {state === 'connecting' ? t.connecting : t.connect}
                    </button>
                    <button type="button" onClick={handleDisconnect} disabled={!isConnected}>
                      {t.disconnect}
                    </button>
                  </div>
                </div>
              </form>
              {error ? <p className="error">{error}</p> : null}
            </div>

            <div className="panel">
              <h3>{t.inputs}</h3>
              <div className="field-row">
                <label>
                  {t.barcode}
                  <select
                    value={barcodeType}
                    onChange={(e) => setBarcodeType(e.target.value as BarcodeType)}
                    disabled={!isConnected}
                  >
                    {BARCODE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t.data}
                  <input
                    type="text"
                    value={barcodeData}
                    onChange={(e) => setBarcodeData(e.target.value)}
                    disabled={!isConnected}
                  />
                </label>
              </div>
              <div className="field-row" style={{ marginTop: '0.6rem' }}>
                <label>
                  {t.symbol}
                  <select
                    value={symbolType}
                    onChange={(e) => setSymbolType(e.target.value as SymbolType)}
                    disabled={!isConnected}
                  >
                    {SYMBOL_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t.data}
                  <input
                    type="text"
                    value={symbolData}
                    onChange={(e) => setSymbolData(e.target.value)}
                    disabled={!isConnected}
                  />
                </label>
              </div>
            </div>

            <div className="panel">
              <h3>{t.recipes}</h3>
              <div className="recipe-list">
                {RECIPES.map((recipe) => (
                  <RecipeRow
                    key={recipe.id}
                    recipe={recipe}
                    disabled={!isConnected || busy}
                    onRun={handleRunRecipe}
                  />
                ))}
              </div>
            </div>

            <div className="panel">
              <h3>{t.status}</h3>
              <div className="actions">
                <button type="button" onClick={handleStatus} disabled={!isConnected || busy}>
                  {t.checkStatus}
                </button>
                <button type="button" onClick={handleToggleMonitoring} disabled={!isConnected}>
                  {isMonitoring ? t.stopMonitoring : t.startMonitoring}
                </button>
              </div>
              {status ? (
                <dl className="readout" style={{ marginTop: '0.7rem' }}>
                  <div>
                    <dt>{t.online}</dt>
                    <dd>{status.online ? t.yes : t.no}</dd>
                  </div>
                  <div>
                    <dt>{t.cover}</dt>
                    <dd>{status.coverOpen ? t.open : t.closed}</dd>
                  </div>
                  <div>
                    <dt>{t.paper}</dt>
                    <dd>{status.paper}</dd>
                  </div>
                  <div>
                    <dt>{t.drawer}</dt>
                    <dd>{status.drawerOpen ? t.open : t.closed}</dd>
                  </div>
                </dl>
              ) : null}
            </div>

            <OutcomePanel
              last={outcome}
              onRetry={handleRetryLast}
              onRecover={handleRecover}
              busy={busy}
              connected={isConnected}
            />

            <div className="panel">
              <h3>{t.activity}</h3>
              <pre className="log">{lines.join('\n')}</pre>
            </div>
          </div>
        </div>
      </div>

      <PaperRail jobs={printedJobs} />
    </section>
  );
}
