import type { Outcome } from './printOutcomes';
import { ALL_OUTCOMES, KIND_LABEL } from './printOutcomes';

interface OutcomePanelProps {
  /** Último resultado real obtenido de la impresora. */
  last: Outcome | null;
  /** Ejecuta la acción recomendada, cuando es automatizable. */
  onRetry: () => void;
  onRecover: () => void;
  busy: boolean;
  connected: boolean;
}

/**
 * Muestra el último resultado con su acción recomendada, y el catálogo
 * completo de códigos que la impresora puede devolver — para que se vea de
 * un vistazo qué esperar y qué hacer en cada caso.
 */
export default function OutcomePanel({ last, onRetry, onRecover, busy, connected }: OutcomePanelProps) {
  return (
    <section className="card">
      <h3>Resultado y acción recomendada</h3>

      {last ? (
        <div className={`outcome outcome-${last.kind}`}>
          <div className="outcome-head">
            <code>{last.code}</code>
            <span className={`badge badge-${last.kind}`}>{KIND_LABEL[last.kind]}</span>
          </div>
          <p className="outcome-meaning">{last.meaning}</p>
          <p className="outcome-action">
            <strong>Acción:</strong> {last.action}
          </p>

          {/* Solo las acciones automatizables se ofrecen como botón. Las de
              tipo 'operator' requieren que alguien toque la impresora, y las
              'fatal' no se arreglan reintentando. */}
          {last.kind === 'retry' && (
            <button type="button" onClick={onRetry} disabled={busy || !connected}>
              Reintentar ahora
            </button>
          )}
          {last.kind === 'recover' && (
            <button type="button" onClick={onRecover} disabled={busy || !connected}>
              Ejecutar recover()
            </button>
          )}
          {last.kind === 'operator' && (
            <p className="hint">Requiere intervención física; después reintentá el trabajo.</p>
          )}
        </div>
      ) : (
        <p className="hint">Todavía no hay resultados. Ejecutá cualquier impresión para ver el diagnóstico acá.</p>
      )}

      <details className="outcome-catalog">
        <summary>Catálogo completo de códigos ({ALL_OUTCOMES.length})</summary>
        <table className="outcome-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Tipo</th>
              <th>Acción recomendada</th>
            </tr>
          </thead>
          <tbody>
            {ALL_OUTCOMES.map((o) => (
              <tr key={o.code}>
                <td>
                  <code>{o.code}</code>
                </td>
                <td>
                  <span className={`badge badge-${o.kind}`}>{KIND_LABEL[o.kind]}</span>
                </td>
                <td>
                  <div>{o.meaning}</div>
                  <div className="hint">{o.action}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
