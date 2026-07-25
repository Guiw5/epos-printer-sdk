import { memo, useMemo, useState } from 'react';
import { t } from './strings';

export interface PrintedJob {
  xml: string;
  text: string;
  printjobid: string;
}

interface Part {
  kind: 'text' | 'glyph';
  value: string;
}

const ENTITIES: Record<string, string> = {
  '&#10;': '\n',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&amp;': '&',
};

function decode(s: string): string {
  return s.replace(/&#10;|&lt;|&gt;|&quot;|&apos;|&amp;/g, (m) => ENTITIES[m]);
}

/**
 * Turns the ePOS-Print XML of a job into what the paper would show. Text
 * prints as text; barcodes, symbols and images can't be rendered as
 * characters, so they're announced instead of silently dropped — the point is
 * to see that the job carried them.
 */
function parseJob(xml: string): Part[] {
  const parts: Part[] = [];
  // Self-closing alternative first, and deliberately so: `<text width="2"/>`
  // would otherwise match the paired form, whose lazy body then swallows
  // everything up to the next `</text>` — printing raw markup as if it were
  // receipt text.
  const tag =
    /<(text|feed|cut|image|pulse|position)\b([^>]*)\/>|<(text|barcode|symbol|image|feed|cut)\b([^>]*)>([\s\S]*?)<\/\3>/g;

  for (const m of xml.matchAll(tag)) {
    const name = m[1] ?? m[3];
    const attrs = m[2] ?? m[4] ?? '';
    const body = m[5] ?? '';

    switch (name) {
      case 'text':
        if (body) parts.push({ kind: 'text', value: decode(body) });
        break;
      // In page mode each <position> moves the print head, so whatever
      // follows lands on its own line — without this, positioned label text
      // renders as one run-on string.
      case 'position':
        if (parts.length > 0) parts.push({ kind: 'text', value: '\n' });
        break;
      case 'feed': {
        const lines = Number(/line="(\d+)"/.exec(attrs)?.[1] ?? 1);
        parts.push({ kind: 'text', value: '\n'.repeat(Math.min(lines, 4)) });
        break;
      }
      case 'barcode': {
        const type = /type="([^"]*)"/.exec(attrs)?.[1] ?? 'barcode';
        parts.push({ kind: 'glyph', value: `▌▏▌▌▏▌▏▏▌▌▏▌\n${type} · ${decode(body)}` });
        break;
      }
      case 'symbol': {
        const type = /type="([^"]*)"/.exec(attrs)?.[1] ?? 'symbol';
        parts.push({ kind: 'glyph', value: `▀▄▀▄▀▄\n${type} · ${decode(body)}` });
        break;
      }
      case 'image':
        parts.push({ kind: 'glyph', value: t.rasterImage });
        break;
      case 'pulse':
        parts.push({ kind: 'glyph', value: t.drawerOpened });
        break;
      default:
        break;
    }
  }

  return parts;
}

/** Breaks the one-line XML into indented lines so it can actually be read. */
function prettyXml(xml: string): string {
  return xml
    .replace(/></g, '>\n<')
    .split('\n')
    .map((line) => (line.startsWith('</') ? line : line))
    .join('\n');
}

const Receipt = memo(function Receipt({ job, index }: { job: PrintedJob; index: number }) {
  const parts = useMemo(() => parseJob(job.xml), [job.xml]);
  const [showXml, setShowXml] = useState(false);

  return (
    <article className="receipt" aria-label={`Receipt ${index + 1}`}>
      <header className="receipt-meta">
        <span>#{String(index + 1).padStart(3, '0')}</span>
        <span>{job.printjobid ? job.printjobid : t.noJobId}</span>
        <button
          type="button"
          className="receipt-toggle"
          onClick={() => setShowXml((v) => !v)}
          aria-pressed={showXml}
        >
          {showXml ? t.viewPaper : t.viewXml}
        </button>
      </header>
      {showXml ? (
        <code className="receipt-xml">{prettyXml(job.xml)}</code>
      ) : (
        parts.map((part, i) =>
          part.kind === 'text' ? (
            <span key={i}>{part.value}</span>
          ) : (
            <span key={i} className="receipt-glyph">
              {part.value}
            </span>
          )
        )
      )}
    </article>
  );
});

const EMPTY = (
  <p className="rail-empty">
    {t.nothingPrinted}
    <br />
    {t.nothingPrintedHint}
  </p>
);

/**
 * The output side of the bench. Receipts stack newest-first, as they would
 * pile up coming out of the printer.
 */
function PaperRail({ jobs }: { jobs: PrintedJob[] }) {
  return (
    <aside className="rail" aria-live="polite" aria-label={t.paperRail}>
      <div className="rail-slot" />
      {jobs.length === 0 ? (
        EMPTY
      ) : (
        <div className="rail-stack">
          {jobs
            .map((job, i) => ({ job, i }))
            .reverse()
            .map(({ job, i }) => (
              <Receipt key={`${job.printjobid}-${i}`} job={job} index={i} />
            ))}
        </div>
      )}
    </aside>
  );
}

export default memo(PaperRail);
