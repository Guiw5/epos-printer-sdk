import type { Outcome } from './printOutcomes';
import { ALL_OUTCOMES, KIND_LABEL } from './printOutcomes';

interface OutcomePanelProps {
  /** The last real result the printer returned. */
  last: Outcome | null;
  /** Runs the recommended action, when it can be automated. */
  onRetry: () => void;
  onRecover: () => void;
  busy: boolean;
  connected: boolean;
}

/**
 * Shows the last result with its recommended action, plus the full catalogue
 * of codes the printer can return, so it's clear at a glance what to expect
 * and what to do in each case.
 */
export default function OutcomePanel({ last, onRetry, onRecover, busy, connected }: OutcomePanelProps) {
  return (
    <div className="panel">
      <h3>Result</h3>

      {last ? (
        <div className="outcome" data-kind={last.kind}>
          <div className="outcome-head">
            <code>{last.code}</code>
            <span className="tag">{KIND_LABEL[last.kind]}</span>
          </div>
          <p>{last.meaning}</p>
          <p className="action">{last.action}</p>

          {/* Only automatable actions get a button. 'operator' cases need
              someone at the printer, and 'fatal' ones don't improve by
              retrying. */}
          {last.kind === 'retry' ? (
            <div className="actions">
              <button type="button" onClick={onRetry} disabled={busy || !connected}>
                Retry now
              </button>
            </div>
          ) : null}
          {last.kind === 'recover' ? (
            <div className="actions">
              <button type="button" onClick={onRecover} disabled={busy || !connected}>
                Run recover()
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="outcome-empty">Run any recipe to see the diagnosis here.</p>
      )}

      <details className="outcome-catalog">
        <summary>All response codes ({ALL_OUTCOMES.length})</summary>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Type</th>
              <th>Recommended action</th>
            </tr>
          </thead>
          <tbody>
            {ALL_OUTCOMES.map((o) => (
              <tr key={o.code}>
                <td>
                  <code>{o.code}</code>
                </td>
                <td>
                  <span className="tag">{KIND_LABEL[o.kind]}</span>
                </td>
                <td>
                  <div>{o.meaning}</div>
                  <div className="muted">{o.action}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
