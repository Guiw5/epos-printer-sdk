import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrinterCard from '../PrinterCard';

/**
 * End-to-end through the real stack: the UI drives the usePrinter hook, which
 * drives EposHttpPrinter, which posts through the simulator's fetch. Nothing
 * here is mocked, if the library breaks, these fail.
 */
async function connectInDemoMode(user: ReturnType<typeof userEvent.setup>) {
  render(<PrinterCard label="Printer 1" onRemove={() => {}} />);

  const demoToggle = screen.getByRole('checkbox', { name: /demo mode/i });
  if (!(demoToggle as HTMLInputElement).checked) {
    await user.click(demoToggle);
  }
  await user.click(screen.getByRole('button', { name: 'Connect' }));

  await waitFor(() => expect(screen.getByRole('button', { name: 'Disconnect' })).toBeEnabled());
}

/** Finds the Print button belonging to a named recipe. */
function printButtonFor(title: string): HTMLElement {
  const heading = screen.getByRole('heading', { name: title });
  const row = heading.closest('.recipe') as HTMLElement;
  return within(row).getByRole('button', { name: 'Print' });
}

describe('demo flow', () => {
  it('starts with nothing printed and every recipe disabled', () => {
    render(<PrinterCard label="Printer 1" onRemove={() => {}} />);

    expect(screen.getByText(/Nothing printed yet/)).toBeInTheDocument();
    expect(printButtonFor('Sales receipt')).toBeDisabled();
  });

  it('connects to the simulated printer and enables the recipes', async () => {
    const user = userEvent.setup();
    await connectInDemoMode(user);

    expect(printButtonFor('Sales receipt')).toBeEnabled();
    expect(screen.getByText(/Connected \(simulated\)/)).toBeInTheDocument();
  });

  it('prints a receipt that shows up on the paper rail', async () => {
    const user = userEvent.setup();
    await connectInDemoMode(user);

    await user.click(printButtonFor('Sales receipt'));

    const receipt = await screen.findByLabelText('Receipt 1');
    expect(receipt).toHaveTextContent('MY STORE');
    expect(receipt).toHaveTextContent('TOTAL');
    expect(screen.queryByText(/Nothing printed yet/)).not.toBeInTheDocument();
  });

  it('shows the raw ePOS-Print XML behind a printed receipt', async () => {
    const user = userEvent.setup();
    await connectInDemoMode(user);
    await user.click(printButtonFor('Sales receipt'));
    const receipt = await screen.findByLabelText('Receipt 1');

    await user.click(within(receipt).getByRole('button', { name: 'XML' }));

    expect(receipt).toHaveTextContent('<text align="center"/>');
    expect(receipt).toHaveTextContent('<cut type="feed"/>');
  });

  it('reveals the source snippet for a recipe', async () => {
    const user = userEvent.setup();
    render(<PrinterCard label="Printer 1" onRemove={() => {}} />);

    const heading = screen.getByRole('heading', { name: 'QR / 2D symbol' });
    const row = heading.closest('.recipe') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Show code' }));

    expect(within(row).getByText(/addSymbol\(data, type, 'level_m', 4\)/)).toBeInTheDocument();
  });

  it('prints a barcode recipe and announces it on the paper', async () => {
    const user = userEvent.setup();
    await connectInDemoMode(user);

    await user.click(printButtonFor('1D barcode'));

    const receipt = await screen.findByLabelText('Receipt 1');
    expect(receipt).toHaveTextContent('code128');
  });

  it('reports the status readout after querying', async () => {
    const user = userEvent.setup();
    await connectInDemoMode(user);

    await user.click(screen.getByRole('button', { name: 'Check' }));

    await waitFor(() => expect(screen.getByText('Online')).toBeInTheDocument());
    expect(screen.getByText('Paper')).toBeInTheDocument();
  });

  it('disconnecting clears the paper and disables the recipes again', async () => {
    const user = userEvent.setup();
    await connectInDemoMode(user);
    await user.click(printButtonFor('Sales receipt'));
    await screen.findByLabelText('Receipt 1');

    await user.click(screen.getByRole('button', { name: 'Disconnect' }));

    expect(screen.getByText(/Nothing printed yet/)).toBeInTheDocument();
    expect(printButtonFor('Sales receipt')).toBeDisabled();
  });
});
