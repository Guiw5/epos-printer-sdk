import { useState } from 'react';
import PrinterCard from './PrinterCard';

interface PrinterSlot {
  id: number;
  label: string;
}

let nextId = 1;

export default function App() {
  const [printers, setPrinters] = useState<PrinterSlot[]>([{ id: nextId++, label: 'Impresora 1' }]);

  function addPrinter() {
    setPrinters((prev) => [...prev, { id: nextId++, label: `Impresora ${prev.length + 1}` }]);
  }

  function removePrinter(id: number) {
    setPrinters((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <main className="app">
      <h1>epos-printer-sdk — ejemplo React</h1>
      <p className="subtitle">
        Casos de uso con el hook <code>usePrinter</code> (<code>epos-printer-sdk/http</code>). Cada tarjeta es una
        impresora independiente — su propia conexión, estado y log — para probar el manejo de varias a la vez.
      </p>

      <div className="actions" style={{ marginBottom: '1.5rem' }}>
        <button type="button" onClick={addPrinter}>
          + Agregar impresora
        </button>
      </div>

      {printers.map((p) => (
        <PrinterCard key={p.id} label={p.label} onRemove={() => removePrinter(p.id)} />
      ))}
    </main>
  );
}
