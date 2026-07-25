import { useState } from 'react';
import PrinterCard from './PrinterCard';
import { t } from './strings';

interface PrinterSlot {
  id: number;
  label: string;
}

let nextId = 1;

export default function App() {
  const [printers, setPrinters] = useState<PrinterSlot[]>([{ id: nextId++, label: 'Printer 1' }]);

  function addPrinter() {
    setPrinters((prev) => [...prev, { id: nextId++, label: `Printer ${prev.length + 1}` }]);
  }

  function removePrinter(id: number) {
    setPrinters((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="shell">
      <header className="masthead">
        <h1>epos-printer-sdk</h1>
        <p>{t.tagline}</p>
        <nav className="masthead-links">
          <a href="https://github.com/Guiw5/epos-printer-sdk" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href="https://www.npmjs.com/package/epos-printer-sdk" target="_blank" rel="noreferrer">
            npm
          </a>
        </nav>
      </header>

      {printers.map((p) => (
        <PrinterCard key={p.id} label={p.label} onRemove={() => removePrinter(p.id)} />
      ))}

      <div className="actions" style={{ marginTop: '1.5rem' }}>
        <button type="button" className="ghost" onClick={addPrinter}>
          {t.addPrinter}
        </button>
      </div>
    </div>
  );
}
