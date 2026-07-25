import { describe, it, expect, beforeEach } from 'vitest';
import { ePOSBuilder } from '../ePOSBuilder';

// Strips the <epos-print> wrapper so assertions focus on the element(s)
// actually produced by each builder call.
function body(builder: ePOSBuilder): string {
  return builder
    .toString()
    .replace('<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">', '')
    .replace('</epos-print>', '');
}

describe('ePOSBuilder', () => {
  let b: ePOSBuilder;

  beforeEach(() => {
    b = new ePOSBuilder();
  });

  it('toString() wraps an empty message in <epos-print>', () => {
    expect(b.toString()).toBe('<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"></epos-print>');
  });

  describe('text', () => {
    it('addText escapes markup-sensitive characters', () => {
      b.addText('<A & B>\n');
      expect(body(b)).toBe('<text>&lt;A &amp; B&gt;&#10;</text>');
    });

    it('addTextAlign / addTextFont / addTextRotate / addTextSmooth', () => {
      b.addTextAlign('center').addTextFont('font_b').addTextRotate(true).addTextSmooth(false);
      expect(body(b)).toBe('<text align="center"/><text font="font_b"/><text rotate="true"/><text smooth="false"/>');
    });

    it('addTextSize validates the 1-8 range and rejects out-of-range values', () => {
      b.addTextSize(2, 3);
      expect(body(b)).toBe('<text width="2" height="3"/>');
      expect(() => new ePOSBuilder().addTextSize(0, 3)).toThrow();
      expect(() => new ePOSBuilder().addTextSize(2, 9)).toThrow();
    });

    it('addTextStyle only emits attributes that were actually passed', () => {
      b.addTextStyle(true, undefined, true);
      expect(body(b)).toBe('<text reverse="true" em="true"/>');
    });

    it('addTextLang escapes the attribute value (the vendor interpolates it raw, the one caller-data injection point)', () => {
      b.addTextLang('en" size="9');
      expect(body(b)).toBe('<text lang="en&quot; size=&quot;9"/>');
    });

    it('addTextPosition/addTextVPosition quote the attribute value (regression: used to emit x=5 unquoted)', () => {
      b.addTextPosition(5).addTextVPosition(10);
      expect(body(b)).toBe('<text x="5"/><text y="10"/>');
    });
  });

  describe('feed', () => {
    it('addFeedLine / addFeedUnit / addFeed / addFeedPosition', () => {
      b.addFeed().addFeedLine(2).addFeedUnit(50).addFeedPosition('cutting');
      expect(body(b)).toBe('<feed/><feed line="2"/><feed unit="50"/><feed pos="cutting"/>');
    });
  });

  describe('barcode', () => {
    it('emits the required type attribute and escapes/encodes the data', () => {
      b.addBarcode('0001', 'code39', 'below');
      expect(body(b)).toBe('<barcode type="code39" hri="below">0001</barcode>');
    });

    it('accepts every BarcodeType value from the official ePOS-Print XML manual', () => {
      const types: Parameters<ePOSBuilder['addBarcode']>[1][] = [
        'upc_a', 'upc_e', 'ean13', 'jan13', 'ean8', 'jan8', 'code39', 'itf', 'codabar', 'code93',
        'code128', 'code128_auto', 'gs1_128',
        'gs1_databar_omnidirectional', 'gs1_databar_truncated', 'gs1_databar_limited', 'gs1_databar_expanded',
      ];
      for (const type of types) {
        expect(() => new ePOSBuilder().addBarcode('123', type)).not.toThrow();
      }
    });
  });

  describe('symbol (2D / QR)', () => {
    it('emits type and optional level/width/height/size', () => {
      b.addSymbol('https://example.com', 'qrcode_model_2', 'level_q', 3, 3);
      expect(body(b)).toBe('<symbol type="qrcode_model_2" level="level_q" width="3" height="3">https://example.com</symbol>');
    });

    it('accepts an Aztec Code numeric level (5-95) as well as the named levels', () => {
      expect(() => new ePOSBuilder().addSymbol('ABC', 'azteccode_fullrange', 50)).not.toThrow();
    });
  });

  describe('image (regression: no x/y attribute)', () => {
    it('addImage never emits x/y: only width/height/color/mode, per the official manual', () => {
      const fakeCtx = {
        getImageData: () => ({ data: new Uint8ClampedArray([255, 255, 255, 255]), width: 1, height: 1 }),
      } as unknown as CanvasRenderingContext2D;

      b.addImage(fakeCtx, 10, 20, 8, 8, 'color_1', 'mono');
      const xml = body(b);
      expect(xml).toMatch(/^<image width="8" height="8" color="color_1" mode="mono">/);
      expect(xml).not.toContain(' x="');
      expect(xml).not.toContain(' y="');
    });

    it('rejects out-of-spec halftone/brightness (regression: used to allow 0-255 instead of 0-2 / 0.1-10)', () => {
      const fakeCtx = {
        getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 0]), width: 1, height: 1 }),
      } as unknown as CanvasRenderingContext2D;

      const withBrightness = (v: number) => {
        const builder = new ePOSBuilder() as ePOSBuilder & { brightness: number };
        builder.brightness = v;
        return () => builder.addImage(fakeCtx, 0, 0, 1, 1);
      };
      expect(withBrightness(0)).toThrow(); // brightness must be >= 0.1
      expect(withBrightness(1)).not.toThrow();
    });
  });

  describe('page mode', () => {
    it('addPageBegin/addPageArea/addPageDirection/addPagePosition/addPageRectangle/addPageEnd', () => {
      b.addPageBegin()
        .addPageArea(0, 0, 100, 50)
        .addPageDirection('left_to_right')
        .addPagePosition(10, 20)
        .addText('hi')
        .addPageRectangle(0, 0, 99, 49, 'thin')
        .addPageEnd();

      expect(body(b)).toBe(
        '<page><area x="0" y="0" width="100" height="50"/><direction dir="left_to_right"/>' +
        '<position x="10" y="20"/><text>hi</text><rectangle x1="0" y1="0" x2="99" y2="49" style="thin"/></page>'
      );
    });
  });

  describe('cut / recovery / reset', () => {
    it('addCut with and without a type', () => {
      expect(body(new ePOSBuilder().addCut('feed'))).toBe('<cut type="feed"/>');
      expect(body(new ePOSBuilder().addCut())).toBe('<cut/>');
    });

    it('addRecovery / addReset', () => {
      expect(body(new ePOSBuilder().addRecovery())).toBe('<recovery/>');
      expect(body(new ePOSBuilder().addReset())).toBe('<reset/>');
    });
  });

  describe('command', () => {
    it('addCommand hex-encodes the payload', () => {
      b.addCommand('AB');
      expect(body(b)).toBe('<command>4142</command>');
    });
  });

  it('toString() reflects force="true" once addRecovery-style force flag is set', () => {
    const forced = new ePOSBuilder() as ePOSBuilder & { force: boolean };
    forced.force = true;
    expect(forced.toString()).toContain(' force="true"');
  });
});
