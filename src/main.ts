import './style.css';
import { EposHttpPrinter } from './index';

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const form = byId<HTMLFormElement>('connect-form');
const addressInput = byId<HTMLInputElement>('address');
const portInput = byId<HTMLInputElement>('port');
const connectBtn = byId<HTMLButtonElement>('connect-btn');
const disconnectBtn = byId<HTMLButtonElement>('disconnect-btn');
const printBtn = byId<HTMLButtonElement>('print-btn');
const statusBtn = byId<HTMLButtonElement>('status-btn');
const logEl = byId<HTMLPreElement>('log');

function log(message: string): void {
  const time = new Date().toLocaleTimeString();
  logEl.textContent += `[${time}] ${message}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

let printer: EposHttpPrinter | null = null;

function setConnected(connected: boolean): void {
  connectBtn.disabled = connected;
  disconnectBtn.disabled = !connected;
  printBtn.disabled = !connected;
  statusBtn.disabled = !connected;
  addressInput.disabled = connected;
  portInput.disabled = connected;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const address = addressInput.value.trim();
  const port = Number(portInput.value);

  log(`Conectando a ${address}:${port}...`);
  connectBtn.disabled = true;

  try {
    printer = new EposHttpPrinter(address, { port });
    await printer.connect();
    log('Conectado. Impresora lista.');
    setConnected(true);
  } catch (error) {
    log(`No se pudo conectar: ${error instanceof Error ? error.message : String(error)}`);
    printer = null;
    connectBtn.disabled = false;
  }
});

disconnectBtn.addEventListener('click', () => {
  printer = null;
  log('Desconectado.');
  setConnected(false);
});

printBtn.addEventListener('click', async () => {
  if (!printer) return;

  printBtn.disabled = true;
  log('Enviando recibo de prueba...');

  try {
    const result = await printer
      .addTextAlign(printer.ALIGN_CENTER)
      .addTextSize(2, 2)
      .addText('epos-printer-sdk demo\n')
      .addTextSize(1, 1)
      .addFeedLine(1)
      .addCut('feed')
      .send();

    log(result.success ? 'Printed successfully.' : `Print failed: ${result.code}`);
  } catch (error) {
    log(`Error al imprimir: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    printBtn.disabled = false;
  }
});

statusBtn.addEventListener('click', async () => {
  if (!printer) return;

  statusBtn.disabled = true;
  log('Consultando estado...');

  try {
    const result = await printer.send();
    log(`Status: 0x${result.status.toString(16)}, battery: ${result.battery}`);
  } catch (error) {
    log(`Error al consultar estado: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    statusBtn.disabled = false;
  }
});
