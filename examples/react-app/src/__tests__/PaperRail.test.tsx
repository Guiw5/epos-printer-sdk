import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PaperRail, { type PrintedJob } from '../PaperRail';

function job(xml: string, printjobid = ''): PrintedJob {
  return { xml, text: '', printjobid };
}

describe('PaperRail', () => {
  it('invites you to print when nothing has been printed yet', () => {
    render(<PaperRail jobs={[]} />);
    expect(screen.getByText(/Nothing printed yet/)).toBeInTheDocument();
  });

  it('renders printed text as it would appear on paper', () => {
    render(<PaperRail jobs={[job('<text>Hola&#10;mundo</text>')]} />);
    expect(screen.getByLabelText('Receipt 1')).toHaveTextContent('Hola');
    expect(screen.getByLabelText('Receipt 1')).toHaveTextContent('mundo');
  });

  it('does not let a self-closing tag swallow the text after it (regression: printed raw markup)', () => {
    // Exactly what the "sales receipt" recipe produces.
    const xml =
      '<text align="center"/><text width="2" height="2"/><text>MY STORE&#10;</text>' +
      '<text width="1" height="1"/><text>Coffee 3.50&#10;</text><cut type="feed"/>';

    render(<PaperRail jobs={[job(xml)]} />);

    const printed = screen.getByLabelText('Receipt 1').textContent ?? '';
    expect(printed).toContain('MY STORE');
    expect(printed).toContain('Coffee 3.50');
    expect(printed).not.toContain('<text');
    expect(printed).not.toContain('width=');
  });

  it('decodes the entities the builder escapes', () => {
    render(<PaperRail jobs={[job('<text>a &amp; b &lt;c&gt; &quot;d&quot;</text>')]} />);
    expect(screen.getByLabelText('Receipt 1')).toHaveTextContent('a & b <c> "d"');
  });

  it('breaks a line at each page-mode <position> (regression: label text ran together)', () => {
    const label =
      '<page><area x="0" y="0" width="380" height="120"/>' +
      '<position x="10" y="30"/><text>Producto</text>' +
      '<position x="10" y="60"/><text>SKU-42</text></page>';

    render(<PaperRail jobs={[job(label)]} />);

    // Two positioned strings must not end up as one run-on line.
    expect(screen.getByLabelText('Receipt 1').textContent).toContain('Producto\nSKU-42');
  });

  it('announces a barcode instead of dropping it silently', () => {
    render(<PaperRail jobs={[job('<barcode type="code128" hri="below">12345</barcode>')]} />);
    expect(screen.getByLabelText('Receipt 1')).toHaveTextContent('code128');
    expect(screen.getByLabelText('Receipt 1')).toHaveTextContent('12345');
  });

  it('announces 2D symbols, images and a drawer pulse', () => {
    render(
      <PaperRail
        jobs={[
          job('<symbol type="qrcode_model_2">https://x.dev</symbol>'),
          job('<image width="8" height="8">AAA=</image>'),
          job('<pulse drawer="drawer_1" time="pulse_100"/>'),
        ]}
      />
    );
    expect(screen.getByLabelText('Receipt 1')).toHaveTextContent('qrcode_model_2');
    expect(screen.getByLabelText('Receipt 2')).toHaveTextContent('raster image');
    expect(screen.getByLabelText('Receipt 3')).toHaveTextContent('drawer opened');
  });

  it('turns a feed into blank lines, capped so one job cannot flood the rail', () => {
    render(<PaperRail jobs={[job('<text>a</text><feed line="99"/><text>b</text>')]} />);
    const printed = screen.getByLabelText('Receipt 1').textContent ?? '';
    expect(printed).toContain('a\n\n\n\nb');
  });

  it('numbers receipts and shows the job id when there is one', () => {
    render(<PaperRail jobs={[job('<text>x</text>', 'job-7')]} />);
    expect(screen.getByLabelText('Receipt 1')).toHaveTextContent('#001');
    expect(screen.getByLabelText('Receipt 1')).toHaveTextContent('job-7');
  });

  it('stacks the newest receipt first, the way paper piles up', () => {
    render(
      <PaperRail
        jobs={[job('<text>primero</text>'), job('<text>segundo</text>')]}
      />
    );
    const receipts = screen.getAllByRole('article');
    expect(receipts[0]).toHaveTextContent('segundo');
    expect(receipts[1]).toHaveTextContent('primero');
  });
});
